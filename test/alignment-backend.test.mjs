import test from 'node:test';
import assert from 'node:assert/strict';
import { alignLyricsWithBackend } from '../src/alignment-backend.mjs';

const input = {
  lyrics: '[Verse 1]\nSun in the sky',
  lyricsSource: 'provided',
  sections: [{ id: 'verse_01', label: 'verse', startSeconds: 0, endSeconds: 4 }],
  durationSeconds: 4
};

test('defaults to the deterministic provisional backend', async () => {
  const result = await alignLyricsWithBackend(input);
  assert.equal(result.backend, 'meter_estimate');
  assert.equal(result.mode, 'meter_estimate');
});

test('accepts an injected acoustic backend without changing the contract', async () => {
  let received;
  const result = await alignLyricsWithBackend(input, {
    acousticAligner: async (request) => {
      received = request;
      return {
        confidence: 0.91,
        sections: [{
          audioSectionId: 'verse_01',
          label: 'verse',
          startSeconds: 0,
          endSeconds: 4,
          confidence: 0.9,
          lines: [{
            text: 'Sun in the sky',
            startSeconds: 0.4,
            endSeconds: 2.4,
            confidence: 0.92,
            source: 'acoustic_forced_alignment',
            words: []
          }]
        }],
        lineCount: 1,
        wordCount: 0,
        warnings: []
      };
    }
  });
  assert.equal(received.durationSeconds, 4);
  assert.equal(result.backend, 'acoustic_forced');
  assert.equal(result.mode, 'acoustic_forced');
  assert.equal(result.source, 'acoustic_forced_alignment');
  assert.equal(result.sections[0].lines[0].confidence, 0.92);
});
