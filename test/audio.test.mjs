import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeAudioBuffer, MAX_AUDIO_BYTES, parseWav, validateAudioInput } from '../src/audio.mjs';
import { assertPublicHttpsUrl } from '../src/ingest.mjs';

function makeClickWav({ seconds = 4, sampleRate = 8000, bpm = 120 } = {}) {
  const frameCount = seconds * sampleRate;
  const samples = Buffer.alloc(frameCount * 2);
  const beatSpacing = Math.round((60 / bpm) * sampleRate);
  for (let beat = 0; beat < frameCount; beat += beatSpacing) {
    for (let index = 0; index < Math.min(Math.round(sampleRate * 0.025), frameCount - beat); index += 1) {
      const envelope = 1 - index / Math.max(1, sampleRate * 0.025);
      samples.writeInt16LE(Math.round(Math.sin(index / 3) * 28000 * envelope), (beat + index) * 2);
    }
  }
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

test('validates supported audio input and parses WAV duration', () => {
  const buffer = makeClickWav();
  const validation = validateAudioInput({ buffer, mimeType: 'audio/wav' });
  assert.equal(validation.ok, true);
  const metadata = parseWav(buffer);
  assert.equal(metadata.channels, 1);
  assert.equal(metadata.sampleRate, 8000);
  assert.equal(metadata.durationSeconds, 4);
});

test('estimates beat timing with confidence instead of a bare guess', () => {
  const result = analyzeAudioBuffer({ buffer: makeClickWav({ bpm: 120 }), mimeType: 'audio/wav' });
  assert.equal(result.source.durationSeconds, 4);
  assert.ok(result.analysis.bpm);
  assert.ok(Math.abs(result.analysis.bpm.value - 120) <= 2);
  assert.ok(result.analysis.bpm.confidence > 0);
  assert.equal(result.analysis.beatGrid.count, 8);
  assert.ok(result.analysis.energyCurve.length >= 4);
});

test('rejects unsupported formats and oversized buffers', () => {
  const unsupported = validateAudioInput({ buffer: Buffer.from('audio'), mimeType: 'audio/ogg' });
  assert.equal(unsupported.ok, false);
  assert.ok(unsupported.errors.some((error) => error.code === 'unsupported_media'));
  const oversized = validateAudioInput({ buffer: Buffer.alloc(MAX_AUDIO_BYTES + 1), mimeType: 'audio/wav' });
  assert.equal(oversized.ok, false);
  assert.ok(oversized.errors.some((error) => error.code === 'media_too_large'));
});

test('blocks non-HTTPS and loopback audio sources before fetching', async () => {
  await assert.rejects(() => assertPublicHttpsUrl('http://example.com/track.mp3'), { code: 'invalid_url' });
  await assert.rejects(() => assertPublicHttpsUrl('https://localhost/track.mp3'), { code: 'blocked_host' });
});
