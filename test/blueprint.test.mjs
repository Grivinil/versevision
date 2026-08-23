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
