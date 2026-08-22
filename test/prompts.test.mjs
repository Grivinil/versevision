import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStyleBible, generateScenePrompts } from '../src/prompts.mjs';

test('generates time-coded scene prompts from classified sections', () => {
  const sections = [
    { id: 'intro_01', label: 'intro', startSeconds: 0, endSeconds: 12, confidence: 0.6 },
    { id: 'chorus_02', label: 'chorus', startSeconds: 12, endSeconds: 30, confidence: 0.7 }
  ];
  const scenes = generateScenePrompts({
    sections,
    analysis: {
      beatGrid: { intervalSeconds: 0.5 },
      lyricAlignment: {
        sections: [{
          audioSectionId: 'chorus_02',
          lines: [{ text: 'The hook arrives', startSeconds: 14, endSeconds: 18, confidence: 0.42, source: 'meter_estimate', words: [{ text: 'hook', startSeconds: 14.5, endSeconds: 15.5, confidence: 0.34, source: 'meter_estimate' }] }]
        }]
      }
    },
    creative: { brief: 'A joyful sunrise road trip.', genre: ['indie pop'], mood: ['bright'], visualStyle: 'Warm 16mm film texture.' },
    output: { aspectRatio: '16:9' }
  });
  assert.equal(scenes.length, 2);
  assert.equal(scenes[0].startSeconds, 0);
  assert.equal(scenes[1].sectionLabel, 'chorus');
  assert.ok(scenes[1].beatCues.length > 0);
  assert.equal(scenes[1].edit.cutOnBeat, true);
  assert.ok(scenes[1].prompt.includes('Warm 16mm film texture.'));
  assert.equal(scenes[1].lyricMoments.length, 1);
  assert.equal(scenes[1].lyricMoments[0].words[0].text, 'hook');
  assert.equal(scenes[1].lyricMoments[0].promptEligible, true);
  assert.ok(scenes[1].prompt.includes('The hook arrives'));
  assert.equal(scenes[1].edit.lyricCueCount, 1);
  assert.deepEqual(scenes[0].continuityRefs, ['character_01', 'location_01', 'style_01']);
});

test('confidence-gates acoustic lyric cues before putting them in prompts', () => {
  const scenes = generateScenePrompts({
    sections: [{ id: 'verse_01', label: 'verse', startSeconds: 0, endSeconds: 8, confidence: 0.7 }],
    analysis: {
      lyricAlignment: {
        backend: 'acoustic_forced',
        mode: 'acoustic_forced',
        sections: [{
          audioSectionId: 'verse_01',
          lines: [
            { text: 'uncertain line', startSeconds: 0, endSeconds: 2, confidence: 0.55, words: [] },
            { text: 'trusted line', startSeconds: 2, endSeconds: 4, confidence: 0.86, words: [] }
          ]
        }]
      }
    }
  });
  assert.deepEqual(scenes[0].lyricMoments.map((moment) => moment.text), ['trusted line']);
  assert.ok(scenes[0].prompt.includes('trusted line'));
  assert.ok(!scenes[0].prompt.includes('uncertain line'));
});

test('builds a reusable style bible from creative intent', () => {
  const bible = buildStyleBible({ creative: { brief: 'A surreal night journey.', visualStyle: 'Neon dreamscape.' } });
  assert.equal(bible.visualThesis, 'A surreal night journey.');
  assert.deepEqual(bible.palette, ['Neon dreamscape.']);
  assert.equal(bible.entities.length, 3);
});
