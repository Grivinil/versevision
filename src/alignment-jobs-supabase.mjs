import { randomUUID } from 'node:crypto';
import { analyzeAudioBufferAsync } from './audio.mjs';
import { generateScenePrompts } from './prompts.mjs';
import { buildLyricArtifacts } from './lrc.mjs';

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

function jobError(code, message, statusCode = 400) {
  return Object.assign(new Error(message), { code, statusCode });
}

function encodePath(path) {
  return path.split('/').map((part) => encodeURIComponent(part)).join('/');
}

function normalizedRow(row) {
  if (!row) return null;
  return {
    id: row.job_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    input: row.request,
    filename: row.filename,
    mimeType: row.mime_type,
    audioPath: row.audio_path,
    idempotencyKey: row.idempotency_key,
    attempts: row.attempts,
    result: row.result,
    error: row.error
  };
}

export class SupabaseAlignmentJobManager {
  constructor({ acousticAligner, enabled = false, url = process.env.SUPABASE_URL, serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY, bucket = process.env.VERSEVISION_ALIGNMENT_BUCKET || 'versevision-audio', pollMs = 3000 } = {}) {
    if (!url || !serviceRoleKey) throw new Error('Supabase alignment storage requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    this.kind = 'supabase';
    this.acousticAligner = acousticAligner;
    this.enabled = enabled;
    this.baseUrl = url.replace(/\/$/, '');
    this.serviceRoleKey = serviceRoleKey;
    this.bucket = bucket;
    this.draining = false;
    this.bucketReady = null;
    this.timer = null;
    if (enabled) {
      this.timer = setInterval(() => { void this.drain(); }, Math.max(1000, Number(pollMs) || 3000));
      this.timer.unref?.();
      void this.drain();
    }
  }

  headers(extra = {}) {
    return { apikey: this.serviceRoleKey, authorization: `Bearer ${this.serviceRoleKey}`, ...extra };
  }

  async request(path, { method = 'GET', body, headers = {}, allowStatuses = [] } = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers({ ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers }),
      ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) })
    });
    const text = await response.text();
    if (!response.ok && !allowStatuses.includes(response.status)) {
      throw Object.assign(new Error(`Supabase request failed (${response.status}): ${text.slice(0, 240)}`), { statusCode: response.status >= 500 ? 503 : 502 });
    }
    if (!text) return null;
    try { return JSON.parse(text); } catch { return text; }
  }

  async ensureBucket() {
    if (this.bucketReady) return this.bucketReady;
    this.bucketReady = this.request('/storage/v1/bucket', {
      method: 'POST',
      body: { id: this.bucket, name: this.bucket, public: false },
      allowStatuses: [400, 409]
    }).then(() => true).catch((error) => {
      this.bucketReady = null;
      throw error;
    });
    return this.bucketReady;
  }

  async uploadAudio(path, bytes, mimeType) {
    await this.ensureBucket();
    const response = await fetch(`${this.baseUrl}/storage/v1/object/${encodeURIComponent(this.bucket)}/${encodePath(path)}`, {
      method: 'POST',
      headers: this.headers({ 'content-type': mimeType || 'application/octet-stream', 'x-upsert': 'false' }),
      body: bytes
    });
    if (!response.ok) throw Object.assign(new Error(`Supabase audio upload failed (${response.status}).`), { statusCode: response.status >= 500 ? 503 : 502 });
  }

  async downloadAudio(path) {
    const response = await fetch(`${this.baseUrl}/storage/v1/object/authenticated/${encodeURIComponent(this.bucket)}/${encodePath(path)}`, { headers: this.headers() });
    if (!response.ok) throw Object.assign(new Error(`Supabase audio download failed (${response.status}).`), { statusCode: response.status >= 500 ? 503 : 502 });
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_AUDIO_BYTES) throw jobError('invalid_audio', 'Stored audio is empty or exceeds the size limit.');
    return bytes;
  }

  async deleteAudio(path) {
    await fetch(`${this.baseUrl}/storage/v1/object/${encodeURIComponent(this.bucket)}/${encodePath(path)}`, { method: 'DELETE', headers: this.headers() });
  }

  async create({ input, audioBytes, filename, mimeType, idempotencyKey } = {}) {
    if (input?.alignment?.mode !== 'acoustic') throw jobError('acoustic_mode_required', 'Alignment jobs require alignment.mode = acoustic.');
    if (typeof this.acousticAligner !== 'function') throw jobError('alignment_worker_not_configured', 'Acoustic alignment is not configured on this service.', 503);
    if (!audioBytes?.length) throw jobError('invalid_audio', 'Alignment jobs require a non-empty audio payload.');
    await this.ensureBucket();
    if (idempotencyKey) {
      const existing = await this.request(`/rest/v1/versevision_alignment_jobs?select=*&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`);
      if (Array.isArray(existing) && existing[0]) return normalizedRow(existing[0]);
    }
    const id = `vv_align_${randomUUID().replaceAll('-', '').slice(0, 20)}`;
    const audioPath = `jobs/${id}.audio`;
    await this.uploadAudio(audioPath, audioBytes, mimeType);
    try {
      const inserted = await this.request('/rest/v1/versevision_alignment_jobs', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: {
          job_id: id,
          status: 'queued',
          request: input,
          filename: filename || null,
          mime_type: mimeType || null,
          audio_path: audioPath,
          idempotency_key: idempotencyKey || null
        }
      });
      void this.drain();
      return normalizedRow(Array.isArray(inserted) ? inserted[0] : inserted);
    } catch (error) {
      await this.deleteAudio(audioPath).catch(() => {});
      throw error;
    }
  }

  async get(id) {
    const rows = await this.request(`/rest/v1/versevision_alignment_jobs?select=*&job_id=eq.${encodeURIComponent(id)}&limit=1`);
    return normalizedRow(Array.isArray(rows) ? rows[0] : null);
  }

  publicView(job) {
    if (!job) return null;
    return {
      schema: 'versevision/alignment-job/v1',
      jobId: job.id,
      status: job.status,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      ...(job.result ? { result: job.result } : {}),
      ...(job.error ? { error: job.error } : {})
    };
  }

  async claim() {
    const rows = await this.request('/rest/v1/rpc/claim_versevision_alignment_job', { method: 'POST', body: {} });
    return normalizedRow(Array.isArray(rows) ? rows[0] : null);
  }

  async update(id, patch) {
    await this.request(`/rest/v1/versevision_alignment_jobs?job_id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: { ...patch, updated_at: new Date().toISOString() }
    });
  }

  async drain() {
    if (this.draining || !this.enabled) return;
    this.draining = true;
    try {
      const job = await this.claim();
      if (job) await this.run(job);
    } catch (error) {
      // Polling retries on the next interval; the durable job remains queued.
      this.lastPollError = error.message;
    } finally {
      this.draining = false;
    }
  }

  async run(job) {
    try {
      const bytes = await this.downloadAudio(job.audioPath);
      const analysis = await analyzeAudioBufferAsync({ buffer: bytes, mimeType: job.mimeType, filename: job.filename, lyrics: job.input.creative?.lyrics, lyricsMode: job.input.creative?.lyricsMode, acousticAligner: this.acousticAligner });
      const scenes = generateScenePrompts({ sections: analysis.analysis.sections, creative: job.input.creative, analysis: analysis.analysis, output: job.input.output });
      const lyricArtifacts = buildLyricArtifacts({ alignment: analysis.analysis.lyricAlignment, lyrics: job.input.creative?.lyrics, durationSeconds: analysis.source.durationSeconds, title: job.input.source?.title });
      await this.update(job.id, {
        status: 'completed',
        result: { source: analysis.source, lyricAlignment: analysis.analysis.lyricAlignment, scenes, artifacts: lyricArtifacts, warnings: analysis.warnings },
        error: null,
        locked_at: null
      });
    } catch (error) {
      await this.update(job.id, { status: 'failed', result: null, error: { code: error.code || 'alignment_failed', message: error.message, retryable: error.statusCode === 503 } }).catch(() => {});
    } finally {
      await this.deleteAudio(job.audioPath).catch(() => {});
    }
  }
}
