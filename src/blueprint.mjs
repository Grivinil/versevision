import { auditSceneContinuity, buildStyleBible, generateScenePrompts, generateShotPlan } from './prompts.mjs';
import { buildLyricArtifacts } from './lrc.mjs';

function markdownForBlueprint({ scenes, shots, styleBible }) {
  const lines = ['# VerseVision Blueprint', '', `Visual thesis: ${styleBible.visualThesis}`, '', '## Scenes', ''];
  scenes.forEach((scene) => {
    lines.push(`### ${scene.id} · ${scene.sectionLabel} · ${scene.startSeconds}s–${scene.endSeconds}s`);
    lines.push(`Intent: ${scene.intent}`);
    if (scene.narrative) {
      lines.push(`Narrative arc: ${scene.narrative.arcRole}`);
      lines.push(`Narrative subject: ${scene.narrative.subject}`);
      lines.push(`Scene narrative: ${scene.narrative.scene}`);
      lines.push(`Character action: ${scene.narrative.characterAction}`);
      lines.push(`State transition: ${scene.narrative.stateBefore} → ${scene.narrative.stateAfter}`);
      lines.push(`Continuity: ${scene.narrative.carryForward}`);
    }
    if (scene.lyricDirection) lines.push(scene.lyricDirection);
    lines.push(`Prompt: ${scene.prompt}`);
    lines.push(`Negative prompt: ${scene.negativePrompt}`);
    lines.push(`Camera: ${scene.camera.shot}`);
    lines.push(`Lighting: ${scene.lighting}`);
    lines.push('');
  });
  lines.push('## Ordered shots', '');
  shots.forEach((shot) => {
    lines.push(`### ${shot.id} · ${shot.startSeconds}s–${shot.endSeconds}s · ${shot.sectionLabel}`);
    lines.push(`Role: ${shot.role}`);
    lines.push(`Prompt: ${shot.prompt}`);
    lines.push(`Negative prompt: ${shot.negativePrompt}`);
    lines.push(`Camera: ${shot.camera.shot}`);
    lines.push(`Lighting: ${shot.lighting}`);
    lines.push('');
  });
  return lines.join('\n');
}

function markdownForShots(shots = []) {
  const lines = ['# VerseVision Ordered Shot Plan', ''];
  shots.forEach((shot) => {
    lines.push(`## ${shot.id} · ${shot.startSeconds}s–${shot.endSeconds}s · ${shot.sectionLabel}`);
    lines.push(`Role: ${shot.role}`);
    lines.push(shot.prompt);
    lines.push(`Negative prompt: ${shot.negativePrompt}`);
    lines.push('');
  });
  return lines.join('\n');
}

function timingCsvForScenes(scenes) {
  const rows = ['scene_id,section_label,start_seconds,end_seconds,cut_on_beat'];
  scenes.forEach((scene) => rows.push(`${scene.id},${scene.sectionLabel},${scene.startSeconds},${scene.endSeconds},${scene.edit.cutOnBeat}`));
  return `${rows.join('\n')}\n`;
}

function timingCsvForShots(shots) {
  const rows = ['shot_id,scene_block_id,section_label,start_seconds,end_seconds,role'];
  shots.forEach((shot) => rows.push(`${shot.id},${shot.sceneBlockId},${shot.sectionLabel},${shot.startSeconds},${shot.endSeconds},${shot.role}`));
  return `${rows.join('\n')}\n`;
}

export function buildBlueprintResponse({ id, input, analysis, createdAt = new Date().toISOString() }) {
  const styleBible = buildStyleBible({ creative: input.creative });
  const scenes = generateScenePrompts({ sections: analysis.analysis.sections, creative: input.creative, analysis: analysis.analysis, output: input.output });
  const shots = generateShotPlan({ scenes, granularity: input.output?.sceneGranularity || 'standard' });
  const lyricArtifacts = buildLyricArtifacts({
    alignment: analysis.analysis.lyricAlignment,
    lyrics: input.creative?.lyrics,
    durationSeconds: analysis.source.durationSeconds,
    title: input.source.title
  });
  return {
    schema: 'versevision/blueprint/v1',
    requestId: id,
    status: 'complete',
    createdAt,
    source: { ...(input.source.title ? { title: input.source.title } : {}), kind: input.source.kind, mimeType: analysis.source.mimeType, durationSeconds: analysis.source.durationSeconds },
    analysis: analysis.analysis,
    styleBible,
    scenes,
    sceneBlocks: scenes,
    shots,
    continuityAudit: auditSceneContinuity(scenes),
    artifacts: { markdown: markdownForBlueprint({ scenes, shots, styleBible }), shotMarkdown: markdownForShots(shots), timingCsv: timingCsvForScenes(scenes), shotTimingCsv: timingCsvForShots(shots), ...lyricArtifacts },
    warnings: analysis.warnings,
    limits: { sceneBlockCount: scenes.length, shotCount: shots.length, maxSceneBlockCount: 40, maxShotCount: 40 }
  };
}
