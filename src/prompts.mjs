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
  return sections.map((section, index) => {
    const direction = directionFor(section.label);
    const continuityRefs = ['character_01', 'location_01', 'style_01'];
    const lyricMoments = lyricMomentsFor(section, analysis.lyricAlignment);
    const lyricReferences = lyricReferencesFor({ section, sectionIndex: index, sections, lyrics: creative.lyrics, alignment: analysis.lyricAlignment });
    const lyricCueText = lyricMoments.length
      ? `Lyric moments to honor: ${lyricMoments.map((moment) => `"${moment.text}" (${moment.startSeconds.toFixed(3)}-${moment.endSeconds.toFixed(3)}s)`).join(' | ')}.`
      : '';
    const lyricDirection = lyricReferences.length
      ? `Lyric-driven visual direction: translate these supplied lines into visible action, props, and character behavior: ${lyricReferences.map((line) => `"${line.text}"`).join(' | ')}. Use acoustically aligned timing where marked; otherwise treat the lyric window as approximate and preserve narrative order.`
      : '';
    return {
      id: `scene_${String(index + 1).padStart(2, '0')}`,
      startSeconds: section.startSeconds,
      endSeconds: section.endSeconds,
      sectionId: section.id,
      sectionLabel: section.label,
      beatCues: beatCues(section, analysis.beatGrid),
      lyricMoments,
      lyricReferences,
      lyricDirection,
      intent: direction.intent,
      prompt: `${direction.intent} ${brief} Genre: ${genre}. Mood: ${mood}. Style: ${style}. Compose for ${aspectRatio}. ${lyricCueText} ${lyricDirection} Preserve the recurring subject, location logic, palette, and visual motifs from the style bible.`,
      negativePrompt: DEFAULT_NEGATIVE_PROMPT,
      camera: { shot: direction.camera, movement: direction.camera },
      lighting: direction.lighting,
      edit: { cutOnBeat: section.label === 'chorus' || section.label === 'pre-chorus', transition: direction.transition, lyricCueCount: lyricMoments.length, lyricReferenceCount: lyricReferences.length, lyricCuePolicy: 'confidence_gated_with_approximate_text_references' },
      continuityRefs,
      confidence: section.confidence
    };
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
