const DEFAULT_NEGATIVE_PROMPT = 'inconsistent face, identity drift, extra limbs, unreadable text, logo, watermark, accidental subtitles';

const SECTION_DIRECTION = {
  intro: { intent: 'Establish the world, visual thesis, and recurring subject before the main vocal statement.', camera: 'wide establishing shot with a slow push-in', lighting: 'restrained atmosphere that introduces the palette', transition: 'fade-in' },
  verse: { intent: 'Develop the narrative with intimate, character-led imagery and lyrical detail.', camera: 'medium or close coverage with motivated handheld movement', lighting: 'controlled contrast with the established palette', transition: 'cut on selected beats' },
  'pre-chorus': { intent: 'Build anticipation through escalating motion, framing, and visual tension.', camera: 'forward tracking shot with gradually increasing movement', lighting: 'rising contrast and brighter practical accents', transition: 'accelerating cuts' },
  chorus: { intent: 'Deliver the primary visual hook with the broadest scale, strongest motif, and memorable movement.', camera: 'dynamic wide shot with sweeping movement and performance coverage', lighting: 'full expression of the palette with heightened highlights', transition: 'beat-synchronized hard cuts' },
  bridge: { intent: 'Introduce contrast or revelation while preserving the established world and character identity.', camera: 'deliberate close orbit or locked-off visual contrast', lighting: 'distinctive shift in color or direction without breaking continuity', transition: 'motivated match cut' },
  outro: { intent: 'Resolve or deliberately suspend the visual story and leave a final memorable image.', camera: 'wide pull-back or lingering close-up', lighting: 'softened version of the established palette', transition: 'slow dissolve or final held frame' }
};

function directionFor(label) {
  return SECTION_DIRECTION[label] || SECTION_DIRECTION.verse;
}

function beatCues(section, beatGrid) {
  const interval = beatGrid?.intervalSeconds;
  if (!Number.isFinite(interval) || interval <= 0) return [];
  const cues = [];
  for (let time = section.startSeconds; time < section.endSeconds; time += interval) cues.push(Number(time.toFixed(3)));
  return cues.slice(0, 64);
}

function lyricMomentsFor(section, alignment) {
  const aligned = alignment?.sections?.find((item) => item.audioSectionId === section.id);
  if (!aligned?.lines?.length) return [];
  const confidenceFloor = alignment.backend === 'acoustic_forced' || alignment.mode === 'acoustic_forced' ? 0.65 : 0.3;
  return aligned.lines.filter((line) => Number(line.confidence) >= confidenceFloor).slice(0, 3).map((line) => ({
    text: line.text,
    startSeconds: line.startSeconds,
    endSeconds: line.endSeconds,
    confidence: line.confidence,
    source: line.source,
    words: line.words?.slice(0, 24) || [],
    promptEligible: true
  }));
}

function providedLyricLines(lyrics) {
  if (typeof lyrics !== 'string') return [];
  return lyrics.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !/^\[[^\]]+\]$/.test(line));
}

const NARRATIVE_DIRECTION = {
  intro: { role: 'establishing setup', state: 'the protagonist’s want is visible but unresolved', action: 'introduce the protagonist through a specific, readable action rather than a montage of lyric words' },
  verse: { role: 'character complication', state: 'the protagonist meets a consequence that changes the next choice', action: 'make the protagonist pursue, avoid, or react to the lyric-driven problem in the scene' },
  'pre-chorus': { role: 'rising threshold', state: 'pressure rises and the protagonist commits to a risky next move', action: 'turn the lyric tension into a visible decision that propels the protagonist toward the refrain' },
  chorus: { role: 'visual payoff', state: 'the recurring motif returns at full energy and the protagonist acts instead of hesitating', action: 'pay off the established want with a memorable, repeatable visual hook' },
  bridge: { role: 'reversal or revelation', state: 'the meaning of the recurring motif changes before the final return', action: 'reframe the protagonist, prop, or location so the audience sees the established world differently' },
  outro: { role: 'resolution or suspended ending', state: 'the protagonist reaches a changed emotional state, even if the plot remains open', action: 'leave a final image that resolves or deliberately suspends the central want' }
};

function narrativeDirectionFor(label, index) {
  if (index === 0) return NARRATIVE_DIRECTION.intro;
  return NARRATIVE_DIRECTION[label] || NARRATIVE_DIRECTION.verse;
}

function inferNarrativeMotifs(lines) {
  const text = lines.join(' ').toLowerCase();
  const motifs = [];
  if (/\bboba\b|\bshake\b/.test(text)) motifs.push({ name: 'a distinctive drink or handheld prop', direction: 'let it recur as a physical anchor and movement cue' });
  if (/\bmom\b|\bmother\b|\bgrades?\b|\bmath\b|\bschool\b/.test(text)) motifs.push({ name: 'family or academic pressure', direction: 'make the pressure visible through a room, object, glance, or interruption' });
  if (/\bbroke\b|\bpay bail\b|\bclothes\b|\bmoney\b/.test(text)) motifs.push({ name: 'money and status anxiety', direction: 'contrast what the protagonist wants with what the environment allows' });
  if (/\bsnail\b|\bslow\b/.test(text)) motifs.push({ name: 'delayed or awkward movement', direction: 'turn the limitation into a recurring physical performance motif' });
  if (/\btop\b|\blegendary\b|\bscary\b/.test(text)) motifs.push({ name: 'an ascent toward an unstable threshold', direction: 'increase scale and consequence without changing the protagonist’s identity' });
  if (/\bfairy\b|\bdream\b|\bmagic\b/.test(text)) motifs.push({ name: 'a surreal escape or wish image', direction: 'foreshadow it in grounded details before allowing it to break reality' });
  return motifs;
}

function narrativeProfile({ motifs, creative }) {
  if (creative.brief) {
    return {
      subject: 'the central subject established by the creative brief',
      setting: 'the primary world established by the creative brief',
      anchor: 'the recurring prop or visual motif established by the brief'
    };
  }
  const names = new Set(motifs.map((motif) => motif.name));
  if (names.has('family or academic pressure') && names.has('a distinctive drink or handheld prop')) {
    return {
      subject: 'a cash-strapped, restless student whose boba ritual becomes a playful escape from family and academic pressure',
      setting: 'a connected school, home, and neighborhood world with a recognizable kitchen-table or hallway anchor',
      anchor: 'the same boba cup, report-card imagery, and expressive student wardrobe'
    };
  }
  if (names.has('money and status anxiety')) {
    return {
      subject: 'a resourceful protagonist trying to appear more confident than their circumstances allow',
      setting: 'a connected neighborhood world where storefronts, clothing, and empty pockets reveal status',
      anchor: 'one conspicuous object that changes meaning as the protagonist’s fortunes shift'
    };
  }
  if (names.has('a surreal escape or wish image')) {
    return {
      subject: 'a grounded protagonist tempted by an increasingly surreal escape',
      setting: 'a familiar everyday world with one consistent threshold into the impossible',
      anchor: 'a recurring ordinary object that foreshadows the wish image'
    };
  }
  return {
    subject: 'one recurring protagonist with a stable face, silhouette, wardrobe logic, and physicality',
    setting: 'a consistent lived-in world whose geography remains legible from block to block',
    anchor: 'a recurring prop or visual motif implied by the lyric intent'
  };
}

function buildNarrativeBeat({ sceneId, section, index, lyricReferences, creative, previous, globalMotifs }) {
  const direction = narrativeDirectionFor(section.label, index);
  const lyricLines = lyricReferences.map((line) => line.text).filter(Boolean);
  const motifs = inferNarrativeMotifs(lyricLines);
  const profile = narrativeProfile({ motifs: globalMotifs?.length ? globalMotifs : motifs, creative });
  const subject = profile.subject;
  const motifText = motifs.length ? motifs.map((motif) => motif.name).join(', ') : 'a recurring prop or visual motif implied by the lyric intent';
  const lyricHook = lyricLines.length ? lyricLines.slice(0, 3).join(' / ') : 'the section’s emotional turn';
  const continuity = previous
    ? `Continue directly from ${previous.id}: ${previous.stateAfter}. Keep the same protagonist, wardrobe logic, geography, and established motifs before introducing only the section’s new pressure.`
    : 'Open with an establishing image that makes the protagonist, world, and central want legible before expanding the visual scale.';
  const scene = index === 0
    ? `Place the protagonist in ${profile.setting}; establish ${profile.anchor} and make the environment express the tension in “${lyricHook}”.`
    : `Move the protagonist through a connected version of ${profile.setting}; let ${motifText} cause or reveal the next turn rather than appearing as decoration, while ${profile.anchor} remains recognizable.`;
  const carryForward = previous
    ? `Carry forward the prior scene’s anchor prop, wardrobe, color logic, and spatial direction; transform one of them only when the story state changes.`
    : 'Establish a repeatable wardrobe, silhouette, location anchor, and prop that later scenes can recognize immediately.';
  return {
    arcRole: direction.role,
    subject,
    scene,
    characterAction: `${direction.action}. Use “${lyricHook}” as the immediate behavioral trigger, not as a list of text to illustrate.`,
    stateBefore: previous?.stateAfter || 'the story has not yet shown the protagonist’s want',
    stateAfter: direction.state,
    continuityFrom: previous?.id || null,
    carryForward,
    motifs,
    setting: profile.setting,
    anchor: profile.anchor
  };
}

function lyricReferencesFor({ section, sectionIndex, sections, lyrics, alignment }) {
  const aligned = alignment?.sections?.find((item) => item.audioSectionId === section.id);
  const alignedLines = Array.isArray(aligned?.lines) ? aligned.lines : [];
  const alignedText = new Set(alignedLines.map((line) => String(line.text || '').trim().toLowerCase()).filter(Boolean));
  const allProvided = providedLyricLines(lyrics);
  if (!allProvided.length) return [];

  // Acoustic output is authoritative where it exists. Fill the visual brief with
  // the remaining supplied lines using a bounded, explicitly approximate window.
  // This keeps the lyric content visible without pretending missing timestamps
  // were acoustically measured.
  const totalDuration = sections.at(-1)?.endSeconds || 0;
  const startRatio = totalDuration > 0 ? section.startSeconds / totalDuration : sectionIndex / sections.length;
  const endRatio = totalDuration > 0 ? section.endSeconds / totalDuration : (sectionIndex + 1) / sections.length;
  const start = Math.max(0, Math.floor(allProvided.length * startRatio));
  const end = Math.min(allProvided.length, Math.max(start + 1, Math.ceil(allProvided.length * endRatio)));
  const windowLines = allProvided.slice(start, end);
  const acoustic = alignedLines.filter((line) => alignedText.has(String(line.text || '').trim().toLowerCase())).map((line) => ({
    text: line.text,
    startSeconds: line.startSeconds,
    endSeconds: line.endSeconds,
    confidence: line.confidence,
    source: line.source || 'acoustic_forced_alignment',
    timing: 'acoustic',
    promptEligible: Number(line.confidence) >= 0.65
  }));
  const acousticText = new Set(acoustic.map((line) => String(line.text).trim().toLowerCase()));
  const references = [...acoustic];
  for (const text of windowLines) {
    if (acousticText.has(text.toLowerCase())) continue;
    references.push({ text, confidence: null, source: 'provided_lyrics_reference', timing: 'approximate', promptEligible: false });
  }
  return references.slice(0, 8);
}

export function generateScenePrompts({ sections = [], creative = {}, analysis = {}, output = {} } = {}) {
  const brief = creative.brief || 'Create a coherent visual interpretation of the music.';
  const style = creative.visualStyle || 'Cinematic, intentional visual storytelling with consistent subjects and locations.';
  const mood = Array.isArray(creative.mood) && creative.mood.length ? creative.mood.join(', ') : 'follow the emotional movement of the track';
  const genre = Array.isArray(creative.genre) && creative.genre.length ? creative.genre.join(', ') : 'music video';
  const aspectRatio = output.aspectRatio || '16:9';
  const globalMotifs = inferNarrativeMotifs(providedLyricLines(creative.lyrics));
  let previousBeat = null;
  return sections.map((section, index) => {
    const direction = directionFor(section.label);
    const sceneId = `scene_${String(index + 1).padStart(2, '0')}`;
    const continuityRefs = ['character_01', 'location_01', 'style_01'];
    const lyricMoments = lyricMomentsFor(section, analysis.lyricAlignment);
    const lyricReferences = lyricReferencesFor({ section, sectionIndex: index, sections, lyrics: creative.lyrics, alignment: analysis.lyricAlignment });
    const narrative = buildNarrativeBeat({ sceneId, section, index, lyricReferences, creative, previous: previousBeat, globalMotifs });
    const narrativePrompt = `Narrative continuity: ${narrative.continuityFrom ? `continue from ${narrative.continuityFrom};` : 'begin the story;'} Arc role: ${narrative.arcRole}. Subject: ${narrative.subject}. Scene: ${narrative.scene} Character action: ${narrative.characterAction} State transition: ${narrative.stateBefore} → ${narrative.stateAfter}. ${narrative.carryForward}`;
    const lyricCueText = lyricMoments.length
      ? `Lyric moments to honor: ${lyricMoments.map((moment) => `"${moment.text}" (${moment.startSeconds.toFixed(3)}-${moment.endSeconds.toFixed(3)}s)`).join(' | ')}.`
      : '';
    const lyricDirection = lyricReferences.length
      ? `Lyric-driven visual direction: translate these supplied lines into visible action, props, and character behavior: ${lyricReferences.map((line) => `"${line.text}"`).join(' | ')}. Use acoustically aligned timing where marked; otherwise treat the lyric window as approximate and preserve narrative order.`
      : '';
    const scene = {
      id: sceneId,
      startSeconds: section.startSeconds,
      endSeconds: section.endSeconds,
      sectionId: section.id,
      sectionLabel: section.label,
      beatCues: beatCues(section, analysis.beatGrid),
      lyricMoments,
      lyricReferences,
      lyricDirection,
      narrative,
      intent: direction.intent,
      prompt: `${direction.intent} ${brief} Genre: ${genre}. Mood: ${mood}. Style: ${style}. Compose for ${aspectRatio}. ${narrativePrompt} ${lyricCueText} ${lyricDirection} Preserve the recurring subject, location logic, palette, and visual motifs from the style bible.`,
      negativePrompt: DEFAULT_NEGATIVE_PROMPT,
      camera: { shot: direction.camera, movement: direction.camera },
      lighting: direction.lighting,
      edit: { cutOnBeat: section.label === 'chorus' || section.label === 'pre-chorus', transition: direction.transition, lyricCueCount: lyricMoments.length, lyricReferenceCount: lyricReferences.length, lyricCuePolicy: 'confidence_gated_with_approximate_text_references' },
      continuityRefs,
      confidence: section.confidence
    };
    previousBeat = { ...narrative, id: sceneId };
    return scene;
  });
}

export function buildStyleBible({ creative = {} } = {}) {
  return {
    visualThesis: creative.brief || 'A coherent visual interpretation of the supplied music.',
    palette: creative.visualStyle ? [creative.visualStyle] : ['derive from the supplied mood and references'],
    lighting: 'Maintain a consistent lighting logic while allowing section-level intensity changes.',
    cameraLanguage: 'Use section-specific movement while preserving subject identity and spatial continuity.',
    texture: 'Keep texture, lens character, and image-generation artifacts consistent across scenes.',
    continuityRules: ['Keep recurring characters, wardrobe, locations, and visual motifs stable across all sections.'],
    entities: [
      { id: 'character_01', type: 'character', description: 'Primary performer or narrative subject; define from the user brief and references.' },
      { id: 'location_01', type: 'location', description: 'Primary visual world; preserve geography and lighting logic.' },
      { id: 'style_01', type: 'style', description: creative.visualStyle || 'Derived visual style.' }
    ]
  };
}
