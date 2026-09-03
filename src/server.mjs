import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { analyzeAudioBufferAsync, MAX_AUDIO_BYTES } from './audio.mjs';
import { fetchAudioUrl } from './ingest.mjs';
import { parseMultipartBody } from './multipart.mjs';
import { NARRATIVE_MODES, validateBlueprintRequest } from './validation.mjs';
import { buildBlueprintResponse } from './blueprint.mjs';
import { buildKissPrompt, generateScenePrompts, generateShotPlan } from './prompts.mjs';
import { createWhisperXAligner } from './acoustic-worker.mjs';
import { createAlignmentJobManager } from './alignment-jobs.mjs';
import { renderStudioHtml } from './studio.mjs';
import { VERSEVISION_LOGO_SVG, VERSEVISION_SOCIAL_SVG } from './brand.mjs';
import { renderRobotsTxt, renderSitemapXml } from './seo.mjs';
import { renderLandingHtml } from './landing.mjs';

const JSON_BODY_LIMIT = 128 * 1024;
const MULTIPART_BODY_LIMIT = MAX_AUDIO_BYTES + 512 * 1024;
const DEFAULT_PORT = 8080;
const DEFAULT_HOST = '0.0.0.0';

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function sendHtml(response, statusCode, body) {
  response.writeHead(statusCode, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store'
  });
  response.end(body);
}

function sendSvg(response, statusCode, body) {
  response.writeHead(statusCode, {
    'content-type': 'image/svg+xml; charset=utf-8',
    'cache-control': 'public, max-age=86400'
  });
  response.end(body);
}

function sendXml(response, statusCode, body) {
  response.writeHead(statusCode, {
    'content-type': 'application/xml; charset=utf-8',
    'cache-control': 'public, max-age=3600'
  });
  response.end(body);
}

function sendRobots(response, statusCode, body) {
  response.writeHead(statusCode, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'public, max-age=3600'
  });
  response.end(body);
}

function publicOrigin(request) {
  const configured = String(process.env.VERSEVISION_PUBLIC_URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  const host = request.headers.host || 'localhost:8080';
  const local = host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('[::1]');
  const forwarded = String(request.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  return `${forwarded || (local ? 'http' : 'https')}://${host}`;
}

function sendText(response, statusCode, body, filename) {
  response.writeHead(statusCode, {
    'content-type': 'text/plain; charset=utf-8',
    'content-disposition': `attachment; filename="${filename}"`,
    'cache-control': 'no-store'
  });
  response.end(body);
}

function requestId() {
  return `vv_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
}

function errorStatus(code) {
  if (code === 'media_too_large' || code === 'request_too_large') return 413;
  if (code === 'source_timeout') return 504;
  if (code === 'source_unreachable') return 502;
  if (code === 'analysis_failed') return 422;
  if (code === 'alignment_queue_full') return 429;
  if (code === 'alignment_worker_not_configured') return 503;
  if (code === 'unsupported_content_type') return 415;
  return 400;
}

function sendError(response, statusCode, id, code, message, field, retryable = false) {
  return sendJson(response, statusCode, {
    schema: 'versevision/error/v1',
    requestId: id,
    error: { code, message, ...(field ? { field } : {}), retryable }
  });
}

async function readBody(request, limit) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > limit) throw Object.assign(new Error('request body exceeds size limit'), { code: 'request_too_large' });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, total);
}

function parseJsonBody(buffer) {
  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch {
    throw Object.assign(new Error('request body must be valid JSON'), { code: 'invalid_request' });
  }
}

async function parseRequestPayload(request) {
  const contentType = (request.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  const multipart = contentType === 'multipart/form-data';
  if (!multipart && contentType !== 'application/json') {
    throw Object.assign(new Error('Requests must use application/json or multipart/form-data.'), { code: 'unsupported_content_type', statusCode: 415 });
  }
  if (multipart) {
    const parsed = parseMultipartBody(await readBody(request, MULTIPART_BODY_LIMIT), request.headers['content-type']);
    return { input: parseJsonBody(Buffer.from(parsed.spec)), uploadedAudio: parsed.audio };
  }
  return { input: parseJsonBody(await readBody(request, JSON_BODY_LIMIT)), uploadedAudio: undefined };
}

async function analyzeRequestInput(input, uploadedAudio, { acousticAligner } = {}) {
  if (input.source.kind === 'upload') {
    if (!uploadedAudio) throw Object.assign(new Error('Upload requests require an audio field.'), { code: 'invalid_multipart', field: 'audio' });
    const filename = uploadedAudio.filename || undefined;
    const mimeType = uploadedAudio.mimeType === 'application/octet-stream' ? undefined : uploadedAudio.mimeType;
    return analyzeAudioBufferAsync({ buffer: uploadedAudio.data, mimeType, filename, lyrics: input.creative?.lyrics, lyricsMode: input.creative?.lyricsMode, acousticAligner });
  }
  const fetched = await fetchAudioUrl(input.source.audioUrl);
  const filename = new URL(fetched.finalUrl).pathname.split('/').pop() || undefined;
  return analyzeAudioBufferAsync({ buffer: fetched.buffer, mimeType: fetched.mimeType, filename, lyrics: input.creative?.lyrics, lyricsMode: input.creative?.lyricsMode, acousticAligner });
}

function shotTargetSeconds(granularity) {
  return granularity === 'coarse' ? 20 : granularity === 'dense' ? 5 : 8;
}

function estimateShotCount(durationSeconds, granularity) {
  if (!Number.isFinite(durationSeconds)) return null;
  return Math.min(40, Math.max(1, Math.ceil(durationSeconds / shotTargetSeconds(granularity))));
}

export function buildPreviewResponse({ id, input, analysis }) {
  const durationSeconds = input.output?.durationSeconds ?? analysis.source.durationSeconds;
  const granularity = input.output?.sceneGranularity || 'standard';
  const sections = Array.isArray(analysis.analysis.sections) ? analysis.analysis.sections : [];
  const scenes = generateScenePrompts({
    sections,
    creative: input.creative || {},
    analysis: analysis.analysis,
    output: input.output || {}
  });
  const shots = generateShotPlan({ scenes, granularity });
  const sampleScenes = scenes.slice(0, 2).map((scene) => ({
    id: scene.id,
    startSeconds: scene.startSeconds,
    endSeconds: scene.endSeconds,
    sectionId: scene.sectionId,
    sectionLabel: scene.sectionLabel,
    intent: scene.intent,
    prompt: scene.prompt,
    camera: scene.camera,
    lighting: scene.lighting,
    narrative: scene.narrative
  }));
  const sampleShots = shots.slice(0, 3);
  return {
    schema: 'versevision/blueprint-preview/v1',
    requestId: id,
    status: 'preview',
    source: {
      ...(input.source.title ? { title: input.source.title } : {}),
      durationSeconds: analysis.source.durationSeconds,
      mimeType: analysis.source.mimeType
    },
    analysisSummary: {
      bpm: analysis.analysis.bpm,
      sectionCount: sections.length,
      sceneBlockCount: scenes.length,
      estimatedSceneCount: scenes.length,
      estimatedShotCount: sections.length ? shots.length : estimateShotCount(durationSeconds, granularity),
      shotTargetSeconds: shotTargetSeconds(granularity),
      estimatedDurationSeconds: durationSeconds,
      energySampleCount: analysis.analysis.energyCurve.length,
      confidence: analysis.analysis.confidence,
      sections,
      lyrics: analysis.analysis.lyrics,
      lyricAlignment: analysis.analysis.lyricAlignment
    },
    sampleScenes,
    sampleSceneBlocks: sampleScenes,
    sampleSceneCount: sampleScenes.length,
    sampleShots,
    sampleShotCount: sampleShots.length,
    samplePreviewSeconds: sampleScenes.at(-1)?.endSeconds ?? 0,
    kissPrompt: buildKissPrompt({ creative: input.creative }),
    warnings: analysis.warnings,
    next: { route: '/v1/blueprint', requiresPayment: true }
  };
}

async function handlePreview(request, response, { acousticAligner } = {}) {
  const id = requestId();
  try {
    const { input, uploadedAudio } = await parseRequestPayload(request);
    const validation = validateBlueprintRequest(input);
    if (!validation.ok) return sendJson(response, 400, { schema: 'versevision/error/v1', requestId: id, error: { code: 'invalid_request', message: 'Request failed schema validation.', field: validation.errors[0]?.path, retryable: false }, details: validation.errors });
    if (input.alignment?.mode === 'acoustic') return sendError(response, 400, id, 'acoustic_alignment_requires_job', 'Use POST /v1/alignment/jobs for acoustic alignment; previews remain local and provisional.', 'alignment.mode', false);
    const analysis = await analyzeRequestInput(input, uploadedAudio, { acousticAligner });
    return sendJson(response, 200, buildPreviewResponse({ id, input, analysis }));
  } catch (error) {
    const statusCode = error.statusCode || errorStatus(error.code);
    return sendError(response, statusCode, id, error.code || 'analysis_failed', error.message, error.field, error.code === 'source_timeout' || error.code === 'source_unreachable');
  }
}

async function handleAlignmentJobCreate(request, response, { enabled, transcriptionBenchmarkEnabled = false, jobs } = {}) {
  const id = requestId();
  if (!enabled) return sendError(response, 501, id, 'alignment_jobs_disabled', 'Acoustic alignment jobs are disabled until the job gate is explicitly enabled.', undefined, false);
  try {
    const { input, uploadedAudio } = await parseRequestPayload(request);
    const validation = validateBlueprintRequest(input);
    if (!validation.ok) return sendJson(response, 400, { schema: 'versevision/error/v1', requestId: id, error: { code: 'invalid_request', message: 'Request failed schema validation.', field: validation.errors[0]?.path, retryable: false }, details: validation.errors });
    if (input.alignment?.mode === 'transcription' && !transcriptionBenchmarkEnabled) return sendError(response, 404, id, 'not_found', 'The transcription benchmark route is private and disabled.', undefined, false);
    let audioBytes;
    let filename;
    let mimeType;
    if (input.source.kind === 'upload') {
      if (!uploadedAudio) throw Object.assign(new Error('Upload requests require an audio field.'), { code: 'invalid_multipart', field: 'audio' });
      audioBytes = uploadedAudio.data;
      filename = uploadedAudio.filename || undefined;
      mimeType = uploadedAudio.mimeType === 'application/octet-stream' ? undefined : uploadedAudio.mimeType;
    } else {
      const fetched = await fetchAudioUrl(input.source.audioUrl);
      audioBytes = fetched.buffer;
      filename = new URL(fetched.finalUrl).pathname.split('/').pop() || undefined;
      mimeType = fetched.mimeType;
    }
    const idempotencyKey = typeof request.headers['idempotency-key'] === 'string' ? request.headers['idempotency-key'].slice(0, 128) : undefined;
    const job = await jobs.create({ input, audioBytes, filename, mimeType, idempotencyKey });
    return sendJson(response, 202, { ...jobs.publicView(job), requestId: id });
  } catch (error) {
    return sendError(response, error.statusCode || errorStatus(error.code), id, error.code || 'invalid_request', error.message, error.field, error.code === 'source_timeout' || error.code === 'source_unreachable');
  }
}

function matchesTrialCode(candidate, configuredCode) {
  const supplied = typeof candidate === 'string' ? candidate.trim() : '';
  const expected = typeof configuredCode === 'string' ? configuredCode.trim() : '';
  if (!supplied || !expected) return false;
  const suppliedBytes = Buffer.from(supplied, 'utf8');
  const expectedBytes = Buffer.from(expected, 'utf8');
  return suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes);
}

async function handleBlueprint(request, response, { blueprintEnabled, paymentVerifier, trialCode, acousticAligner } = {}) {
  const id = requestId();
  if (!blueprintEnabled) return sendError(response, 501, id, 'blueprint_generation_pending', 'Full blueprint generation is prepared but disabled until payment enablement is explicitly configured.', undefined, false);
  try {
    const { input, uploadedAudio } = await parseRequestPayload(request);
    const validation = validateBlueprintRequest(input);
    if (!validation.ok) return sendJson(response, 400, { schema: 'versevision/error/v1', requestId: id, error: { code: 'invalid_request', message: 'Request failed schema validation.', field: validation.errors[0]?.path, retryable: false }, details: validation.errors });
    if (input.alignment?.mode === 'acoustic') return sendError(response, 400, id, 'acoustic_alignment_requires_job', 'Use POST /v1/alignment/jobs for acoustic alignment.', 'alignment.mode', false);
    const trial = matchesTrialCode(request.headers['x-versevision-trial-code'], trialCode);
    if (!trial) {
      if (typeof paymentVerifier !== 'function') return sendError(response, 501, id, 'payment_adapter_not_configured', 'Full blueprint generation requires an injected x402 payment verifier or a configured trial code.', undefined, false);
      const payment = await paymentVerifier({ request, requestId: id, input });
      if (!payment?.ok) return sendError(response, payment?.statusCode || 402, id, 'payment_required', payment?.message || 'A valid x402 payment is required for the full blueprint.', undefined, true);
    }
    const analysis = await analyzeRequestInput(input, uploadedAudio, { acousticAligner });
    return sendJson(response, 200, buildBlueprintResponse({ id, input, analysis }));
  } catch (error) {
    return sendError(response, error.statusCode || errorStatus(error.code), id, error.code || 'analysis_failed', error.message, error.field, error.code === 'source_timeout' || error.code === 'source_unreachable');
  }
}

export function createVerseVisionServer({ port = Number(process.env.PORT || DEFAULT_PORT), host = process.env.HOST || DEFAULT_HOST, blueprintEnabled = process.env.VERSEVISION_BLUEPRINT_ENABLED === '1', alignmentJobsEnabled = process.env.VERSEVISION_ALIGNMENT_JOBS_ENABLED === '1', transcriptionBenchmarkEnabled = process.env.VERSEVISION_TRANSCRIPTION_BENCHMARK === '1', paymentVerifier, trialCode = process.env.VERSEVISION_TRIAL_CODE, acousticAligner: configuredAcousticAligner } = {}) {
  let acousticAligner = null;
  try {
    acousticAligner = configuredAcousticAligner || createWhisperXAligner();
  } catch (error) {
    console.warn(`[versevision] acoustic alignment disabled: ${error.message}`);
  }
  let alignmentJobs;
  try {
    alignmentJobs = createAlignmentJobManager({ acousticAligner, allowTranscription: transcriptionBenchmarkEnabled, enabled: alignmentJobsEnabled && Boolean(acousticAligner) });
  } catch (error) {
    console.warn(`[versevision] durable alignment storage disabled: ${error.message}`);
    alignmentJobs = createAlignmentJobManager({ acousticAligner, allowTranscription: transcriptionBenchmarkEnabled, enabled: alignmentJobsEnabled && Boolean(acousticAligner), forceMemory: true });
  }
  const server = createHttpServer(async (request, response) => {
    const route = new URL(request.url || '/', 'http://localhost').pathname;
    if (request.method === 'GET' && route === '/assets/versevision-logo.svg') return sendSvg(response, 200, VERSEVISION_LOGO_SVG);
    if (request.method === 'GET' && route === '/assets/versevision-social.svg') return sendSvg(response, 200, VERSEVISION_SOCIAL_SVG);
    if (request.method === 'GET' && route === '/robots.txt') return sendRobots(response, 200, renderRobotsTxt({ publicUrl: publicOrigin(request) }));
    if (request.method === 'GET' && route === '/sitemap.xml') return sendXml(response, 200, renderSitemapXml({ publicUrl: publicOrigin(request) }));
    if (request.method === 'GET' && route === '/') return sendHtml(response, 200, renderLandingHtml({ publicUrl: publicOrigin(request) }));
    if (request.method === 'GET' && route === '/studio') return sendHtml(response, 200, renderStudioHtml({ publicUrl: publicOrigin(request), pagePath: route }));
    if (request.method === 'GET' && route === '/health') {
      return sendJson(response, 200, { service: 'versevision', status: 'ok', stage: process.env.NODE_ENV || 'development' });
    }
    if (request.method === 'GET' && route === '/catalog') {
      return sendJson(response, 200, {
        schema: 'versevision/catalog/v1', product: 'VerseVision', version: '0.1.0', status: 'preview_analysis',
        requestSchema: 'versevision/blueprint-request/v1', responseSchema: 'versevision/blueprint/v1',
        narrativeModes: [...NARRATIVE_MODES], defaultNarrativeMode: 'song',
        alignment: { backend: acousticAligner ? 'acoustic_forced' : 'meter_estimate', optional: true, jobStore: alignmentJobs.kind },
        limits: { maxAudioBytes: 25 * 1024 * 1024, maxAudioSeconds: 300, maxReferenceUrls: 8 },
        artifacts: {
          kissPrompt: 'compact lyric-to-narrative prompt',
          lyricFormats: ['lrc', 'enhanced_lrc'],
          enhancedWordTiming: Boolean(acousticAligner),
          downloads: {
            lrc: 'GET /v1/alignment/jobs/{jobId}/lyrics.lrc',
            enhancedLrc: 'GET /v1/alignment/jobs/{jobId}/lyrics.enhanced.lrc'
          }
        },
        routes: {
          studio: { method: 'GET', path: '/studio', payment: 'none', audience: 'human' },
          preview: { method: 'POST', path: '/v1/blueprint/preview', payment: 'none' },
          alignmentJob: { method: 'POST', path: '/v1/alignment/jobs', payment: 'not_enabled', enabled: Boolean(alignmentJobsEnabled && acousticAligner) },
          alignmentStatus: { method: 'GET', path: '/v1/alignment/jobs/{jobId}', payment: 'none' },
          blueprint: { method: 'POST', path: '/v1/blueprint', payment: 'x402_or_trial_code', enabled: Boolean(blueprintEnabled && (typeof paymentVerifier === 'function' || String(trialCode || '').trim())) }
        }
      });
    }
    if (request.method === 'POST' && route === '/v1/alignment/jobs') return void handleAlignmentJobCreate(request, response, { enabled: alignmentJobsEnabled, transcriptionBenchmarkEnabled, jobs: alignmentJobs });
    const lyricDownloadMatch = route.match(/^\/v1\/alignment\/jobs\/([^/]+)\/lyrics(?:\.(enhanced))?\.lrc$/);
    if (request.method === 'GET' && lyricDownloadMatch) {
      const job = await alignmentJobs.get(lyricDownloadMatch[1]);
      if (!job) return sendError(response, 404, requestId(), 'job_not_found', 'Alignment job was not found or has expired.', undefined, false);
      if (job.status !== 'completed' || !job.result?.artifacts) return sendError(response, 409, requestId(), 'artifact_not_ready', 'Lyric artifacts are available after alignment completes.', undefined, true);
      const enhanced = Boolean(lyricDownloadMatch[2]);
      const artifact = enhanced ? job.result.artifacts.enhancedLrc : job.result.artifacts.lrc;
      return sendText(response, 200, artifact || '', `${job.id}${enhanced ? '.enhanced' : ''}.lrc`);
    }
    const alignmentStatusMatch = route.match(/^\/v1\/alignment\/jobs\/([^/]+)$/);
    if (request.method === 'GET' && alignmentStatusMatch) {
      const job = await alignmentJobs.get(alignmentStatusMatch[1]);
      if (!job) return sendError(response, 404, requestId(), 'job_not_found', 'Alignment job was not found or has expired.', undefined, false);
      return sendJson(response, 200, alignmentJobs.publicView(job));
    }
    if (request.method === 'POST' && route === '/v1/blueprint/preview') return void handlePreview(request, response).catch((error) => sendError(response, 500, requestId(), 'internal_error', error.message, undefined, true));
    if (request.method === 'POST' && route === '/v1/blueprint') return void handleBlueprint(request, response, { blueprintEnabled, paymentVerifier, trialCode });
    return sendError(response, 404, requestId(), 'not_found', 'Route not found.', undefined, false);
  });
  server.port = port;
  server.host = host;
  server.alignmentJobs = alignmentJobs;
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const server = createVerseVisionServer();
  server.listen(server.port, server.host, () => console.log(`[versevision] listening on http://${server.host}:${server.port}`));
}
