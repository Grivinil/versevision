import { randomUUID } from 'node:crypto';
import { analyzeAudioBufferAsync } from './audio.mjs';
import { generateScenePrompts } from './prompts.mjs';
import { buildLyricArtifacts } from './lrc.mjs';
import { SupabaseAlignmentJobManager } from './alignment-jobs-supabase.mjs';

const DEFAULT_MAX_QUEUE = 20;
const DEFAULT_CONCURRENCY = 1;
const DEFAULT_TTL_MS = 60 * 60 * 1000;

function jobId() {
  return `vv_align_${randomUUID().replaceAll('-', '').slice(0, 20)}`;
}

function jobError(code, message, statusCode = 400) {
  return Object.assign(new Error(message), { code, statusCode });
}

export class AlignmentJobManager {
  constructor({ acousticAligner, allowTranscription = false, maxQueue = DEFAULT_MAX_QUEUE, concurrency = DEFAULT_CONCURRENCY, ttlMs = DEFAULT_TTL_MS } = {}) {
    this.kind = 'memory';
    this.acousticAligner = acousticAligner;
    this.allowTranscription = allowTranscription;
    this.maxQueue = Math.max(1, Number(maxQueue) || DEFAULT_MAX_QUEUE);
    this.concurrency = Math.max(1, Number(concurrency) || DEFAULT_CONCURRENCY);
    this.ttlMs = Math.max(60_000, Number(ttlMs) || DEFAULT_TTL_MS);
    this.jobs = new Map();
    this.idempotency = new Map();
    this.queue = [];
    this.active = 0;
  }

  prune() {
    const cutoff = Date.now() - this.ttlMs;
    for (const [id, job] of this.jobs) {
      if (job.updatedAt < cutoff && !['queued', 'running'].includes(job.status)) {
        this.jobs.delete(id);
        if (job.idempotencyKey) this.idempotency.delete(job.idempotencyKey);
      }
    }
  }

  create({ input, audioBytes, filename, mimeType, idempotencyKey } = {}) {
    this.prune();
    const mode = input?.alignment?.mode;
    if (mode !== 'acoustic' && !(mode === 'transcription' && this.allowTranscription)) throw jobError('acoustic_mode_required', 'Alignment jobs require alignment.mode = acoustic.');
    if (typeof this.acousticAligner !== 'function') throw jobError('alignment_worker_not_configured', 'Acoustic alignment is not configured on this service.', 503);
    if (!audioBytes?.length) throw jobError('invalid_audio', 'Alignment jobs require a non-empty audio payload.');
    if (idempotencyKey && this.idempotency.has(idempotencyKey)) return this.jobs.get(this.idempotency.get(idempotencyKey));
    if (this.queue.length + this.active >= this.maxQueue) throw jobError('alignment_queue_full', 'The alignment queue is full; retry later.', 429);
    const now = Date.now();
    const job = {
      id: jobId(),
      status: 'queued',
      createdAt: new Date(now).toISOString(),
      updatedAt: now,
      input,
      audioBytes,
      filename,
      mimeType,
      idempotencyKey,
      result: null,
      error: null
    };
    this.jobs.set(job.id, job);
    if (idempotencyKey) this.idempotency.set(idempotencyKey, job.id);
    this.queue.push(job.id);
    this.drain();
    return job;
  }

  get(id) {
    this.prune();
    return this.jobs.get(id) || null;
  }

  publicView(job) {
    if (!job) return null;
    return {
      schema: 'versevision/alignment-job/v1',
      jobId: job.id,
      status: job.status,
      createdAt: job.createdAt,
      updatedAt: new Date(job.updatedAt).toISOString(),
      ...(job.status === 'queued' ? { queuePosition: Math.max(0, this.queue.indexOf(job.id) + 1) } : {}),
      ...(job.result ? { result: job.result } : {}),
      ...(job.error ? { error: job.error } : {})
    };
  }

  drain() {
    while (this.active < this.concurrency && this.queue.length) {
      const id = this.queue.shift();
      const job = this.jobs.get(id);
      if (!job) continue;
      this.active += 1;
      void this.run(job).finally(() => {
        this.active -= 1;
        this.drain();
      });
    }
  }

  async run(job) {
    job.status = 'running';
    job.updatedAt = Date.now();
    try {
      const mode = job.input.alignment?.mode;
      const analysis = await analyzeAudioBufferAsync({
        buffer: job.audioBytes,
        mimeType: job.mimeType,
        filename: job.filename,
        lyrics: job.input.creative?.lyrics,
        lyricsMode: job.input.creative?.lyricsMode,
        acousticAligner: mode === 'acoustic' ? this.acousticAligner : undefined
      });
      if (mode === 'transcription') {
        const transcription = await this.acousticAligner({
          lyrics: '',
          lyricsSource: 'none',
          sections: analysis.analysis.sections,
          beatGrid: analysis.analysis.beatGrid,
          durationSeconds: analysis.source.durationSeconds,
          audioBytes: job.audioBytes
        });
        job.result = { source: analysis.source, transcription, warnings: transcription.warnings || [] };
        job.status = 'completed';
        return;
      }
      const scenes = generateScenePrompts({
        sections: analysis.analysis.sections,
        creative: job.input.creative,
        analysis: analysis.analysis,
        output: job.input.output
      });
      const lyricArtifacts = buildLyricArtifacts({
        alignment: analysis.analysis.lyricAlignment,
        lyrics: job.input.creative?.lyrics,
        durationSeconds: analysis.source.durationSeconds,
        title: job.input.source?.title
      });
      job.result = {
        source: analysis.source,
        lyricAlignment: analysis.analysis.lyricAlignment,
        scenes,
        artifacts: lyricArtifacts,
        warnings: analysis.warnings
      };
      job.status = 'completed';
    } catch (error) {
      job.status = 'failed';
      job.error = { code: error.code || 'alignment_failed', message: error.message, retryable: error.statusCode === 503 || error.code === 'source_timeout' };
    } finally {
      job.audioBytes = null;
      job.updatedAt = Date.now();
    }
  }
}

export { jobError };

export function createAlignmentJobManager(options = {}) {
  if (!options.forceMemory && process.env.VERSEVISION_ALIGNMENT_STORE === 'supabase') return new SupabaseAlignmentJobManager(options);
  return new AlignmentJobManager(options);
}
