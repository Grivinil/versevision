import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBlueprintResponse } from '../src/blueprint.mjs';

test('builds a complete planning blueprint without rendering video', () => {
  const result = buildBlueprintResponse({
    id: 'vv_blueprint_test',
    createdAt: '2026-08-21T00:00:00.000Z',
    input: {
      source: { kind: 'upload', title: 'Test track' },
      creative: { brief: 'A hopeful night journey.', genre: ['electronic'], mood: ['hopeful'], visualStyle: 'Neon cinematic realism.' },
      output: { aspectRatio: '9:16' }
    },
    analysis: {
      source: { mimeType: 'audio/mpeg', durationSeconds: 30 },
      analysis: { bpm: { value: 120, confidence: 0.8 }, beatGrid: { intervalSeconds: 0.5 }, sections: [{ id: 'intro_01', label: 'intro', startSeconds: 0, endSeconds: 10, confidence: 0.7 }, { id: 'chorus_02', label: 'chorus', startSeconds: 10, endSeconds: 30, confidence: 0.72 }], energyCurve: [], confidence: 0.8 },
      warnings: [{ code: 'section_labels_heuristic', message: 'heuristic' }]
    }
  });
  assert.equal(result.schema, 'versevision/blueprint/v1');
  assert.equal(result.status, 'complete');
  assert.equal(result.scenes.length, 2);
  assert.equal(result.sceneBlocks.length, 2);
  assert.equal(result.shots.length, 4);
  assert.equal(result.scenes[1].sectionLabel, 'chorus');
  assert.match(result.artifacts.markdown, /Test track|VerseVision Blueprint/);
  assert.match(result.artifacts.timingCsv, /scene_id,section_label/);
  assert.match(result.artifacts.shotMarkdown, /Ordered Shot Plan/);
  assert.match(result.artifacts.shotTimingCsv, /shot_id,scene_block_id/);
});

test('keeps lyric narrative connected through the paid blueprint artifacts without quote wrappers', () => {
  const result = buildBlueprintResponse({
    id: 'vv_lyric_blueprint_test',
    createdAt: '2026-08-21T00:00:00.000Z',
    input: {
      source: { kind: 'upload', title: 'Lyric track' },
      creative: { lyrics: 'The quoted line becomes visible action' },
      output: { sceneGranularity: 'coarse' }
    },
    analysis: {
      source: { mimeType: 'audio/mpeg', durationSeconds: 30 },
      analysis: {
        beatGrid: { intervalSeconds: 0.5 },
        sections: [{ id: 'verse_01', label: 'verse', startSeconds: 0, endSeconds: 30, confidence: 0.7 }],
        energyCurve: [],
        confidence: 0.7
      },
      warnings: []
    }
  });
  assert.match(result.scenes[0].narrative.scene, /The quoted line becomes visible action/);
  assert.match(result.scenes[0].narrative.characterAction, /The quoted line becomes visible action/);
  assert.match(result.artifacts.markdown, /The quoted line becomes visible action/);
  assert.match(result.artifacts.markdown, /Narrative arc:/);
  assert.match(result.artifacts.markdown, /Scene narrative:/);
  assert.match(result.artifacts.markdown, /Lyric-driven visual direction:/);
  assert.doesNotMatch(result.artifacts.markdown, /[\u0022\u201c\u201d]/);
  assert.match(result.scenes[0].negativePrompt, /no written lyrics/);
});
