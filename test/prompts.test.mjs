import test from 'node:test';
import assert from 'node:assert/strict';
import { auditSceneContinuity, buildStyleBible, generateScenePrompts, generateShotPlan } from '../src/prompts.mjs';

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
  assert.equal(scenes[1].lyricMoments[0].provenance, 'default_proposal');
  assert.ok(scenes[1].prompt.includes('The hook arrives'));
  assert.equal(scenes[1].edit.lyricCueCount, 1);
  assert.deepEqual(scenes[0].continuityRefs, ['character_01', 'location_01', 'style_01']);
});

test('keeps framing flexible when no production aspect ratio is selected', () => {
  const [scene] = generateScenePrompts({
    sections: [{ id: 'verse_01', label: 'verse', startSeconds: 0, endSeconds: 8, confidence: 0.7 }],
    analysis: {},
    creative: { brief: 'A character waits beside a quiet road.' },
    output: {}
  });
  assert.ok(scene.prompt.includes('Keep framing production-flexible'));
  assert.ok(!scene.prompt.includes('Compose for 16:9'));
});

test('chooses a concrete seeded starter world when visual choices are blank', () => {
  const scenes = generateScenePrompts({
    sections: [
      { id: 'intro_01', label: 'intro', startSeconds: 0, endSeconds: 12, confidence: 0.7 },
      { id: 'verse_02', label: 'verse', startSeconds: 12, endSeconds: 24, confidence: 0.7 }
    ],
    creative: { lyrics: 'Smooth baby oil\nGlide on glide on through the fabric\nSo clean brightened sheen' },
    output: {}
  });
  assert.ok(scenes[0].narrative.profileId);
  assert.equal(scenes[0].narrative.profileId, scenes[1].narrative.profileId);
  assert.ok(scenes[0].narrative.profileLabel);
  assert.ok(!scenes[0].narrative.subject.includes('established by the creative brief'));
  assert.ok(!scenes[0].narrative.setting.includes('established by the creative brief'));
  assert.ok(!scenes[1].prompt.includes('a recurring prop or visual motif implied by the lyric intent'));
  assert.equal(scenes[0].camera.shot, scenes[0].narrative.camera);
  assert.equal(scenes[0].provenance.profile, 'starter_profile');
});

test('selects section-specific shot language with global fallback', () => {
  const scenes = generateScenePrompts({
    sections: [
      { id: 'intro_01', label: 'intro', startSeconds: 0, endSeconds: 8, confidence: 0.7 },
      { id: 'verse_02', label: 'verse', startSeconds: 8, endSeconds: 16, confidence: 0.7 },
      { id: 'chorus_03', label: 'chorus', startSeconds: 16, endSeconds: 24, confidence: 0.7 }
    ],
    creative: {
      shotLanguage: {
        global: 'motivated movement with clear geography',
        sections: [
          { section: 'intro', setup: 'locked wide, slow push-in' },
          { section: 'chorus', setup: 'sweeping wide orbit' }
        ]
      }
    },
    analysis: {},
    output: {}
  });
  assert.equal(scenes[0].camera.shot, 'locked wide, slow push-in');
  assert.equal(scenes[1].camera.shot, 'motivated movement with clear geography');
  assert.equal(scenes[2].camera.shot, 'sweeping wide orbit');
  assert.ok(scenes[0].prompt.includes('Shot language for intro: locked wide, slow push-in.'));
});

test('expands scene blocks into ordered one-camera shots without timing gaps', () => {
  const scenes = generateScenePrompts({
    sections: [
      { id: 'intro_01', label: 'intro', startSeconds: 0, endSeconds: 10, confidence: 0.7 },
      { id: 'chorus_02', label: 'chorus', startSeconds: 10, endSeconds: 30, confidence: 0.7 }
    ],
    creative: { lyrics: 'A light appears\nThe character moves toward it.' },
    analysis: {}
  });
  const shots = generateShotPlan({ scenes, granularity: 'standard' });
  assert.equal(shots.length, 4);
  assert.equal(shots[0].sceneBlockId, 'scene_01');
  assert.equal(shots.at(-1).sceneBlockId, 'scene_02');
  assert.equal(shots[0].startSeconds, 0);
  assert.equal(shots.at(-1).endSeconds, 30);
  shots.forEach((shot, index) => {
    assert.ok(shot.prompt.length > 100);
    assert.ok(shot.camera.shot.length > 0);
    assert.ok(shot.endSeconds > shot.startSeconds);
    if (index > 0) assert.equal(shot.startSeconds, shots[index - 1].endSeconds);
  });
});

test('keeps lyric references out of quotation marks and carries a no-written-lyrics guard', () => {
  const scenes = generateScenePrompts({
    sections: [{ id: 'verse_01', label: 'verse', startSeconds: 0, endSeconds: 8, confidence: 0.7 }],
    creative: { lyrics: 'A line with "quoted" words' },
    analysis: {}
  });
  const shots = generateShotPlan({ scenes, granularity: 'standard' });
  assert.equal(shots.length, 1);
  assert.doesNotMatch(shots[0].prompt, /[\u0022\u201c\u201d]/);
  assert.match(shots[0].prompt, /Respond visually to the lyric moment:/);
  assert.match(shots[0].negativePrompt, /no written lyrics/);
  assert.match(shots[0].negativePrompt, /no on-screen lyrics/);
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
  assert.equal(scenes[0].lyricMoments[0].provenance, 'acoustically_aligned');
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

test('derives concrete recurring details for narrative-specific lyrics', () => {
  const bacon = generateScenePrompts({
    sections: [
      { id: 'intro', label: 'intro', startSeconds: 0, endSeconds: 10 },
      { id: 'middle', label: 'verse', startSeconds: 10, endSeconds: 20 },
      { id: 'end', label: 'verse', startSeconds: 20, endSeconds: 30 }
    ],
    creative: { lyrics: 'Guy walks down the street\nJust a nickel in his pocket\nHe sees a mustache stylist\nThe stylist used bacon grease' }
  });
  assert.match(bacon[0].narrative.subject, /mustache/);
  assert.match(bacon[0].narrative.setting, /five-cent sign/);
  assert.match(bacon[1].narrative.spatialRule, /mirror/);
  assert.match(bacon[2].prompt, /bacon-greased mustache/);

  const goodDay = generateScenePrompts({
    sections: [
      { id: 'one', label: 'chorus', startSeconds: 0, endSeconds: 10 },
      { id: 'two', label: 'chorus', startSeconds: 10, endSeconds: 20 }
    ],
    creative: { lyrics: 'Sun in the sky\nWalking down the street\nFeeling so free\nIt\'s a good day' }
  });
  assert.match(goodDay[0].narrative.subject, /red headphones/);
  assert.match(goodDay[1].narrative.setting, /rooftop overlook/);
  assert.match(goodDay[1].prompt, /yellow windbreaker/);
});

test('audits scene continuity and reports profile drift', () => {
  const scenes = generateScenePrompts({
    sections: [
      { id: 'one', label: 'intro', startSeconds: 0, endSeconds: 8 },
      { id: 'two', label: 'verse', startSeconds: 8, endSeconds: 16 }
    ],
    creative: { lyrics: 'A character wants a change.' }
  });
  const passing = auditSceneContinuity(scenes);
  assert.equal(passing.status, 'pass');
  assert.equal(passing.sceneCount, 2);
  assert.equal(passing.violations.length, 0);

  const drifted = structuredClone(scenes);
  drifted[1].narrative.wardrobe = 'a different wardrobe';
  const failing = auditSceneContinuity(drifted);
  assert.equal(failing.status, 'fail');
  assert.ok(failing.violations.some((item) => item.code === 'continuity_drift'));
});

test('applies user visual overrides across every scene', () => {
  const scenes = generateScenePrompts({
    sections: [
      { id: 'one', label: 'intro', startSeconds: 0, endSeconds: 8 },
      { id: 'two', label: 'chorus', startSeconds: 8, endSeconds: 16 }
    ],
    creative: {
      lyrics: 'A character walks toward the sea.',
      visualOverrides: {
        subject: 'A woman in a silver raincoat',
        setting: 'A single coastal motel and its parking lot',
        wardrobe: 'Silver raincoat, red boots, black gloves',
        palette: 'Steel blue and sodium orange',
        spatialRule: 'Always move toward the ocean until the bridge',
        camera: 'Locked-off wides with occasional slow dolly-ins',
        requiredProps: ['red umbrella'],
        avoid: ['crowds']
      }
    }
  });
  assert.equal(scenes[0].narrative.subject, 'A woman in a silver raincoat');
  assert.equal(scenes[1].narrative.setting, 'A single coastal motel and its parking lot');
  assert.equal(scenes[1].camera.shot, 'Locked-off wides with occasional slow dolly-ins');
  assert.deepEqual(scenes[1].narrative.requiredProps, ['red umbrella']);
  assert.equal(scenes[1].provenance.subject, 'user_supplied');
  assert.equal(scenes[1].provenance.requiredProps, 'user_supplied');
  assert.equal(scenes[1].provenance.lyricHooks, 'user_supplied');
  assert.match(scenes[1].prompt, /Avoid: crowds/);
  assert.match(scenes[1].negativePrompt, /crowds/);
  assert.equal(buildStyleBible({ creative: { visualOverrides: { palette: 'Steel blue' } } }).userOverrides.palette, 'Steel blue');
});

test('derives a breath-led cosmic profile from meditation lyrics', () => {
  const scenes = generateScenePrompts({
    sections: [
      { id: 'outward', label: 'verse', startSeconds: 0, endSeconds: 20 },
      { id: 'cosmos', label: 'bridge', startSeconds: 20, endSeconds: 40 },
      { id: 'return', label: 'outro', startSeconds: 40, endSeconds: 60 }
    ],
    creative: { lyrics: 'Breathe deeply through your nose. Follow this silver thread through the atmosphere to the universe. Return along the same thread.' }
  });
  assert.match(scenes[0].narrative.subject, /meditator/);
  assert.match(scenes[0].narrative.anchor, /silver thread/);
  assert.match(scenes[1].narrative.spatialRule, /identical route/);
  assert.match(scenes[2].prompt, /rainbow color/);
});

test('uses mode-specific narrative arcs without changing the visual contract', () => {
  const sections = Array.from({ length: 6 }, (_, index) => ({
    id: `section_${index + 1}`,
    label: 'verse',
    startSeconds: index * 10,
    endSeconds: (index + 1) * 10,
    confidence: 0.8
  }));
  const meditation = generateScenePrompts({ sections, creative: { narrativeMode: 'meditation', lyrics: 'Breathe and follow the thread.' } });
  assert.deepEqual(meditation.map((scene) => scene.narrative.arcRole), [
    'grounding preparation',
    'outward ascent',
    'cosmic expansion',
    'breath integration',
    'return descent',
    'reintegrated resolution'
  ]);
  assert.ok(meditation.every((scene) => scene.narrativeMode === 'meditation' && typeof scene.intent === 'string' && scene.camera.shot));
  assert.match(meditation[3].prompt, /Narrative mode: meditation/);

  const spoken = generateScenePrompts({
    sections: [
      { id: 'one', label: 'intro', startSeconds: 0, endSeconds: 10 },
      { id: 'two', label: 'verse', startSeconds: 10, endSeconds: 20 },
      { id: 'three', label: 'bridge', startSeconds: 20, endSeconds: 30 },
      { id: 'four', label: 'outro', startSeconds: 30, endSeconds: 40 }
    ],
    creative: { narrativeMode: 'spoken_word', lyrics: 'Here is the premise. Then the turn. Finally, the question.' }
  });
  assert.deepEqual(spoken.map((scene) => scene.narrative.arcRole), ['spoken premise', 'spoken development', 'spoken turn', 'spoken resolution']);

  const cinematic = generateScenePrompts({
    sections: Array.from({ length: 5 }, (_, index) => ({ id: `cin_${index}`, label: 'verse', startSeconds: index * 8, endSeconds: (index + 1) * 8 })),
    creative: { narrativeMode: 'cinematic_narration', lyrics: 'A question enters the world and changes everything.' }
  });
  assert.deepEqual(cinematic.map((scene) => scene.narrative.arcRole), ['cinematic setup', 'cinematic development', 'cinematic revelation', 'cinematic escalation', 'cinematic resolution']);
});

test('builds a reusable style bible from creative intent', () => {
  const bible = buildStyleBible({ creative: { brief: 'A surreal night journey.', visualStyle: 'Neon dreamscape.' } });
  assert.equal(bible.visualThesis, 'A surreal night journey.');
  assert.deepEqual(bible.palette, ['Neon dreamscape.']);
  assert.equal(bible.entities.length, 3);
});
