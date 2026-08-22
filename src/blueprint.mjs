import { buildStyleBible, generateScenePrompts } from './prompts.mjs';

function markdownForBlueprint({ scenes, styleBible }) {
  const lines = ['# VerseVision Blueprint', '', `Visual thesis: ${styleBible.visualThesis}`, '', '## Scenes', ''];
  scenes.forEach((scene) => {
    lines.push(`### ${scene.id} · ${scene.sectionLabel} · ${scene.startSeconds}s–${scene.endSeconds}s`);
    lines.push(`Intent: ${scene.intent}`);
    lines.push(`Prompt: ${scene.prompt}`);
    lines.push(`Camera: ${scene.camera.shot}`);
    lines.push(`Lighting: ${scene.lighting}`);
    lines.push('');
  });
  return lines.join('\n');
}

function timingCsvForScenes(scenes) {
  const rows = ['scene_id,section_label,start_seconds,end_seconds,cut_on_beat'];
  scenes.forEach((scene) => rows.push(`${scene.id},${scene.sectionLabel},${scene.startSeconds},${scene.endSeconds},${scene.edit.cutOnBeat}`));
  return `${rows.join('\n')}\n`;
}

export function buildBlueprintResponse({ id, input, analysis, createdAt = new Date().toISOString() }) {
  const styleBible = buildStyleBible({ creative: input.creative });
  const scenes = generateScenePrompts({ sections: analysis.analysis.sections, creative: input.creative, analysis: analysis.analysis, output: input.output });
  return {
    schema: 'versevision/blueprint/v1',
    requestId: id,
    status: 'complete',
    createdAt,
    source: { ...(input.source.title ? { title: input.source.title } : {}), kind: input.source.kind, mimeType: analysis.source.mimeType, durationSeconds: analysis.source.durationSeconds },
    analysis: analysis.analysis,
    styleBible,
    scenes,
    artifacts: { markdown: markdownForBlueprint({ scenes, styleBible }), timingCsv: timingCsvForScenes(scenes) },
    warnings: analysis.warnings,
    limits: { sceneCount: scenes.length, maxSceneCount: 40 }
  };
}
