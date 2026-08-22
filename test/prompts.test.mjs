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

test('carries subject, setting, motifs, and state across narrative scene blocks', () => {
  const scenes = generateScenePrompts({
    sections: [
      { id: 'verse_01', label: 'verse', startSeconds: 0, endSeconds: 10, confidence: 0.7 },
      { id: 'pre_02', label: 'pre-chorus', startSeconds: 10, endSeconds: 20, confidence: 0.7 },
      { id: 'chorus_03', label: 'chorus', startSeconds: 20, endSeconds: 30, confidence: 0.7 }
    ],
    creative: { lyrics: 'Boba gotta shake\nMy mom saw my grades\nWe can take it to the top' }
  });
  assert.equal(scenes[0].narrative.continuityFrom, null);
  assert.equal(scenes[1].narrative.continuityFrom, 'scene_01');
  assert.equal(scenes[2].narrative.continuityFrom, 'scene_02');
  assert.equal(scenes[0].narrative.subject, scenes[1].narrative.subject);
  assert.equal(scenes[1].narrative.subject, scenes[2].narrative.subject);
  assert.ok(scenes[0].narrative.motifs.some((motif) => motif.name.includes('drink')));
  assert.ok(scenes.some((scene) => scene.narrative.motifs.some((motif) => motif.name.includes('academic'))));
  assert.ok(scenes[1].prompt.includes('continue from scene_01'));
  assert.ok(scenes[2].prompt.includes('visual payoff'));
});

test('uses an index-based story arc when section labels repeat', () => {
  const sections = Array.from({ length: 5 }, (_, index) => ({
    id: `chorus_${String(index + 1).padStart(2, '0')}`,
    label: 'chorus',
    startSeconds: index * 8,
    endSeconds: (index + 1) * 8,
    confidence: 0.2
  }));
  const scenes = generateScenePrompts({ sections, creative: { lyrics: 'A character wants a change.' } });
  assert.deepEqual(scenes.map((scene) => scene.narrative.arcRole), [
    'establishing setup',
    'character complication',
    'reversal or revelation',
    'rising threshold',
    'visual payoff'
  ]);
});

test('builds a reusable style bible from creative intent', () => {
  const bible = buildStyleBible({ creative: { brief: 'A surreal night journey.', visualStyle: 'Neon dreamscape.' } });
  assert.equal(bible.visualThesis, 'A surreal night journey.');
  assert.deepEqual(bible.palette, ['Neon dreamscape.']);
  assert.equal(bible.entities.length, 3);
});
