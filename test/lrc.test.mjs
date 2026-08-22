import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLyricArtifacts, formatLrcTimestamp } from '../src/lrc.mjs';

test('formats LRC timestamps with centisecond precision', () => {
  assert.equal(formatLrcTimestamp(14.562), '[00:14.56]');
  assert.equal(formatLrcTimestamp(61.009), '[01:01.01]');
});

test('exports standard and enhanced lyric tracks with honest timing metadata', () => {
  const artifacts = buildLyricArtifacts({
    title: 'Test song',
    durationSeconds: 20,
    lyrics: 'First line\nSecond line',
    alignment: {
      mode: 'acoustic_forced',
      sections: [{
        lines: [{
          text: 'First line',
          startSeconds: 1.25,
          confidence: 0.9,
          source: 'acoustic_forced_alignment',
          timing: 'acoustic',
          words: [
            { text: 'First', startSeconds: 1.25 },
            { text: 'line', startSeconds: 1.75 }
          ]
        }]
      }]
    }
  });
  assert.match(artifacts.lrc, /\[00:01\.25\]First line/);
  assert.match(artifacts.enhancedLrc, /\[00:01\.25\]<00:01\.25>First <00:01\.75>line/);
  assert.equal(artifacts.lrcMetadata.lineCount, 2);
  assert.equal(artifacts.lrcMetadata.wordTimedLineCount, 1);
  assert.equal(artifacts.lrcMetadata.approximateLineCount, 1);
  assert.equal(artifacts.lrcMetadata.timingBasis, 'mixed_acoustic_and_approximate');
});
