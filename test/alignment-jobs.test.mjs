import test from 'node:test';
import assert from 'node:assert/strict';
import { AlignmentJobManager } from '../src/alignment-jobs.mjs';

function makeSilentWav() {
  const sampleRate = 8000;
  const samples = Buffer.alloc(sampleRate * 2);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + samples.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(samples.length, 40);
  return Buffer.concat([header, samples]);
}

async function waitForCompletion(job) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (job.status === 'completed' || job.status === 'failed') return job;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  return job;
}

test('queues acoustic work and returns merged lyric alignment plus scenes', async () => {
  const manager = new AlignmentJobManager({
    acousticAligner: async () => ({
      mode: 'acoustic_forced',
      source: 'acoustic_forced_alignment',
      backend: 'acoustic_forced',
      confidence: 0.9,
      sections: [],
      lineCount: 0,
      wordCount: 0,
      warnings: []
    })
  });
  const job = manager.create({
    input: {
      schema: 'versevision/blueprint-request/v1',
      source: { kind: 'upload' },
      alignment: { mode: 'acoustic' },
      creative: { lyrics: '[Verse 1]\nSun in the sky', lyricsMode: 'provided' }
    },
    audioBytes: makeSilentWav(),
    filename: 'track.wav',
    mimeType: 'audio/wav',
    idempotencyKey: 'job-test-1'
  });
  await waitForCompletion(job);
  assert.equal(job.status, 'completed');
  assert.equal(job.result.lyricAlignment.mode, 'acoustic_forced');
  assert.ok(Array.isArray(job.result.scenes));
  assert.equal(manager.create({ input: job.input, audioBytes: makeSilentWav(), filename: 'track.wav', mimeType: 'audio/wav', idempotencyKey: 'job-test-1' }).id, job.id);
});

test('rejects acoustic jobs when the remote worker is not configured', () => {
  const manager = new AlignmentJobManager();
  assert.throws(() => manager.create({ input: { alignment: { mode: 'acoustic' } }, audioBytes: Buffer.from('audio') }), { code: 'alignment_worker_not_configured' });
});

test('supports gated transcription benchmark jobs without supplied lyrics', async () => {
  const manager = new AlignmentJobManager({
    allowTranscription: true,
    acousticAligner: async ({ lyrics }) => ({ mode: 'transcription', text: lyrics ? 'unexpected' : 'blind transcript', words: [], warnings: [] })
  });
  const job = manager.create({
    input: { schema: 'versevision/blueprint-request/v1', source: { kind: 'upload' }, alignment: { mode: 'transcription' } },
    audioBytes: makeSilentWav(),
    filename: 'track.wav',
    mimeType: 'audio/wav'
  });
  await waitForCompletion(job);
  assert.equal(job.status, 'completed');
  assert.equal(job.result.transcription.text, 'blind transcript');
});
