import test from 'node:test';
import assert from 'node:assert/strict';
import { alignLyrics } from '../src/alignment.mjs';

test('aligns provided lyrics to section, line, and word timing windows', () => {
  const result = alignLyrics({
    lyrics: '[Verse 1]\nSun in the sky\nWatching clouds go by\n\n[Chorus]\nYaya yaya yaya\nJust you and me',
    lyricsSource: 'provided',
    sections: [
      { id: 'verse_01', label: 'verse', startSeconds: 0, endSeconds: 10, confidence: 0.7 },
      { id: 'chorus_02', label: 'chorus', startSeconds: 10, endSeconds: 30, confidence: 0.7 }
    ],
    beatGrid: { intervalSeconds: 0.5 },
    durationSeconds: 30
  });
  assert.equal(result.mode, 'meter_estimate');
  assert.equal(result.lineCount, 4);
  assert.equal(result.wordCount, 15);
  assert.equal(result.sections.length, 2);
  assert.equal(result.sections[1].audioSectionId, 'chorus_02');
  for (const section of result.sections) {
    for (const line of section.lines) {
      assert.ok(line.startSeconds >= section.startSeconds);
      assert.ok(line.endSeconds <= section.endSeconds);
      assert.ok(line.endSeconds > line.startSeconds);
      for (const word of line.words) {
        assert.ok(word.startSeconds >= line.startSeconds);
        assert.ok(word.endSeconds <= line.endSeconds + 0.001);
      }
    }
  }
  assert.equal(result.warnings[0].code, 'alignment_provisional');
});

test('marks auto-tag alignment lower confidence than supplied lyrics', () => {
  const result = alignLyrics({
    lyrics: '[Verse 1]\nA simple line',
    lyricsSource: 'auto_tag',
    sections: [{ id: 'verse_01', label: 'verse', startSeconds: 0, endSeconds: 4 }],
    durationSeconds: 4
  });
  assert.equal(result.confidence, 0.26);
  assert.equal(result.sections[0].lines[0].source, 'meter_estimate');
});
