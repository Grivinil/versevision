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

function shotLanguageFor(sectionLabel, shotLanguage) {
  if (!shotLanguage || typeof shotLanguage !== 'object') return null;
  const sections = Array.isArray(shotLanguage.sections) ? shotLanguage.sections : [];
  const specific = sections.find((item) => item?.section === sectionLabel);
  const fallback = sections.find((item) => item?.section === 'default');
  return specific?.setup || fallback?.setup || shotLanguage.global || null;
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
  const acoustic = alignment.backend === 'acoustic_forced' || alignment.mode === 'acoustic_forced';
  const confidenceFloor = acoustic ? 0.65 : 0.3;
  return aligned.lines.filter((line) => Number(line.confidence) >= confidenceFloor).slice(0, 3).map((line) => ({
    text: line.text,
    startSeconds: line.startSeconds,
    endSeconds: line.endSeconds,
    confidence: line.confidence,
    source: line.source || (acoustic ? 'acoustic_forced_alignment' : 'meter_estimate'),
    provenance: acoustic ? 'acoustically_aligned' : lyricProvenance(line),
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

const MODE_NARRATIVE_DIRECTION = {
  meditation: {
    preparation: { role: 'grounding preparation', state: 'the body settles and attention turns inward', action: 'anchor posture, breath, and stillness in a concrete physical action' },
    ascent: { role: 'outward ascent', state: 'attention leaves the ordinary room and follows the central thread outward', action: 'translate each breath into measured movement away from the body while preserving the central visual anchor' },
    expansion: { role: 'cosmic expansion', state: 'the central image reaches its widest scale and changes the meaning of the journey', action: 'expand the world beyond human scale without losing the original body-to-cosmos connection' },
    integration: { role: 'breath integration', state: 'breath and the central image pulse as one connected system', action: 'make inhale and exhale produce visible contraction and release in the recurring image' },
    descent: { role: 'return descent', state: 'attention retraces the established route toward the body', action: 'reverse the outward path with the same landmarks and a slower, gentler visual rhythm' },
    resolution: { role: 'reintegrated resolution', state: 'the listener returns to the body carrying a changed relationship to the wider world', action: 'end with a calm physical re-entry and one retained trace of the journey' }
  },
  spoken_word: {
    setup: { role: 'spoken premise', state: 'the central idea is introduced through a concrete human situation', action: 'stage the premise through one decisive observation or action rather than illustrating every word literally' },
    development: { role: 'spoken development', state: 'the idea gains specificity as the subject tests it against lived detail', action: 'turn the speaker\'s next point into a visible choice, object, or change in behavior' },
    turn: { role: 'spoken turn', state: 'the audience\'s understanding shifts when a contradiction or revelation appears', action: 'reframe the established subject, object, or location so the spoken idea acquires a new consequence' },
    resolution: { role: 'spoken resolution', state: 'the idea lands in a memorable image or unresolved question', action: 'leave one precise final image that carries the argument beyond the last line' }
  },
  cinematic_narration: {
    setup: { role: 'cinematic setup', state: 'the world, subject, and inciting question are legible before the plot accelerates', action: 'establish geography and character behavior with a visually specific opening beat' },
    development: { role: 'cinematic development', state: 'the subject pursues a goal while the world introduces a concrete obstacle', action: 'make each narrated detail alter blocking, props, or the subject\'s next decision' },
    revelation: { role: 'cinematic revelation', state: 'a hidden relationship or fact changes how the audience reads the established world', action: 'recontextualize a recurring motif without changing the subject\'s identity or continuity anchors' },
    escalation: { role: 'cinematic escalation', state: 'the consequence becomes unavoidable and the subject must commit', action: 'increase scale, risk, and visual pressure while preserving the established geography and props' },
    resolution: { role: 'cinematic resolution', state: 'the central question resolves or remains deliberately suspended in a final image', action: 'pay off the strongest recurring motif and end on a clear emotional consequence' }
  }
};

function modeNarrativeDirection(mode, index, total) {
  const progress = total <= 1 ? 1 : index / (total - 1);
  if (mode === 'meditation') {
    if (index === 0) return MODE_NARRATIVE_DIRECTION.meditation.preparation;
    if (index === total - 1) return MODE_NARRATIVE_DIRECTION.meditation.resolution;
    if (progress <= 0.25) return MODE_NARRATIVE_DIRECTION.meditation.ascent;
    if (progress <= 0.5) return MODE_NARRATIVE_DIRECTION.meditation.expansion;
    if (progress <= 0.75) return MODE_NARRATIVE_DIRECTION.meditation.integration;
    return MODE_NARRATIVE_DIRECTION.meditation.descent;
  }
  if (mode === 'spoken_word') {
    if (index === 0) return MODE_NARRATIVE_DIRECTION.spoken_word.setup;
    if (index === total - 1) return MODE_NARRATIVE_DIRECTION.spoken_word.resolution;
    return progress < 0.5 ? MODE_NARRATIVE_DIRECTION.spoken_word.development : MODE_NARRATIVE_DIRECTION.spoken_word.turn;
  }
  if (mode === 'cinematic_narration') {
    if (index === 0) return MODE_NARRATIVE_DIRECTION.cinematic_narration.setup;
    if (index === total - 1) return MODE_NARRATIVE_DIRECTION.cinematic_narration.resolution;
    if (progress < 0.34) return MODE_NARRATIVE_DIRECTION.cinematic_narration.development;
    if (progress < 0.67) return MODE_NARRATIVE_DIRECTION.cinematic_narration.revelation;
    return MODE_NARRATIVE_DIRECTION.cinematic_narration.escalation;
  }
  return null;
}

function narrativeDirectionFor(label, index, total, mode = 'song') {
  const modeDirection = modeNarrativeDirection(mode, index, total);
  if (modeDirection) return modeDirection;
  if (index === 0) return NARRATIVE_DIRECTION.intro;
  if (index === total - 1) return label === 'outro' ? NARRATIVE_DIRECTION.outro : NARRATIVE_DIRECTION.chorus;
  if (label === 'bridge') return NARRATIVE_DIRECTION.bridge;
  if (index === 1) return NARRATIVE_DIRECTION.verse;
  if (label === 'pre-chorus') return NARRATIVE_DIRECTION['pre-chorus'];
  if (total >= 5 && index === Math.floor((total - 1) / 2)) return NARRATIVE_DIRECTION.bridge;
  return NARRATIVE_DIRECTION['pre-chorus'];
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
  if (/\bbacon\b|\bmustache\b|\bmoustache\b|\bstylist\b|\bnickel\b|\bconditioner\b|\bgrease\b/.test(text)) motifs.push({ name: 'a five-cent mustache makeover and bacon-grease reveal', direction: 'plant the cheap makeover details early, then pay them off as the comic reveal' });
  if (/\bsun\b|\bsky\b|\bclouds?\b|\bwalking\b|\bfree\b|\bfavorite song\b|\bgood day\b/.test(text)) motifs.push({ name: 'a bright day becoming a private music-video world', direction: 'repeat ordinary places while increasing color, motion, and shared musical energy' });
  if (/\bmeditat(?:e|ion|ing)\b|\bbreathe\b|\bbreath\b|\brelax(?:ing)?\b|\bquiet place\b|\bclose your eyes\b/.test(text)) motifs.push({ name: 'a breath-led inward-to-cosmic meditation', direction: 'let each inhale and exhale produce a visible, measured change in scale and motion' });
  if (/\bsilver thread\b|\bthread(?:s)?\b|\brope of existence\b|\buniverse\b|\bgalaxy\b|\batmosphere\b/.test(text)) motifs.push({ name: 'a silver thread joining the body to a breathing cosmos', direction: 'keep one continuous thread as the geographic and emotional axis from departure through return' });
  return motifs;
}

// When a user supplies audio/lyrics but leaves the visual choices blank, a
// concrete starter world is more useful than asking a downstream generator to
// invent every continuity anchor. These profiles are deliberately broad enough
// to fit many songs, but specific enough to produce immediately usable shots.
// Selection is seeded from the request so a preview and its paid blueprint keep
// the same world while different tracks naturally receive different starters.
const STARTER_PROFILES = [
  {
    id: 'neon_boardwalk_courier',
    label: 'Neon boardwalk courier',
    subject: 'a silver-jacketed night courier with a compact cassette player clipped to their belt',
    setting: 'a rain-slick neon boardwalk that connects a convenience store, an arcade entrance, and a rooftop overlooking the water',
    anchor: 'the translucent cassette player, a magenta delivery envelope, and the courier\'s reflective silver jacket',
    wardrobe: 'the reflective silver jacket, violet sneakers, black cargo trousers, and the same cassette player at the belt in every scene',
    spatialRule: 'move left-to-right along the boardwalk toward the water, reversing only when the courier chooses to deliver the envelope',
    palette: 'electric cyan, hot magenta, violet shadow, and small pools of sodium amber',
    camera: 'low tracking wides that rise into intimate shoulder-level coverage at each handoff'
  },
  {
    id: 'sunset_rooftop_runner',
    label: 'Sunset rooftop runner',
    subject: 'a determined young runner in a coral windbreaker carrying a single paper map marked with hand-drawn stars',
    setting: 'a connected city route from a laundromat, through a pedestrian overpass, to a water-tank rooftop at sunset',
    anchor: 'the folded paper map, a loose red thread tied to its corner, and the coral windbreaker',
    wardrobe: 'the coral windbreaker, cream T-shirt, charcoal running pants, and white trainers; keep the silhouette unchanged throughout',
    spatialRule: 'start at street level and climb through the overpass toward the rooftop, keeping the runner moving toward the lowering sun',
    palette: 'peach sunset, cobalt sky, washed concrete, and a red-thread accent',
    camera: 'handheld lateral tracking in the route, then a wide crane reveal when the runner reaches the roof'
  },
  {
    id: 'candy_diner_duo',
    label: 'Candy-colored diner duo',
    subject: 'two friends in coordinated mint and cherry jackets sharing a chrome portable radio',
    setting: 'a pastel roadside diner, its fluorescent parking lot, and the quiet service road beyond it',
    anchor: 'the chrome radio, a paper cup with a striped straw, and the checkerboard diner floor',
    wardrobe: 'one mint jacket and one cherry-red jacket over simple white tops; preserve the color pairing and hairstyles in every scene',
    spatialRule: 'keep the friends together from booth to parking lot, separating them only at the emotional turn before bringing them back into the same frame',
    palette: 'bubblegum pink, mint, cream, chrome highlights, and midnight blue outside the diner',
    camera: 'symmetrical locked frames for connection, followed by a gentle orbit when the radio changes the mood'
  },
  {
    id: 'desert_radio_mechanic',
    label: 'Desert radio mechanic',
    subject: 'a resourceful radio mechanic in a rust-orange jumpsuit carrying a hand-built antenna',
    setting: 'a sunlit desert service station linked to an abandoned motel and a ridge with a clear horizon',
    anchor: 'the hand-built antenna, a dusty portable radio, and the station\'s turquoise service door',
    wardrobe: 'the rust-orange jumpsuit, canvas work boots, protective goggles pushed onto the head, and a turquoise work glove',
    spatialRule: 'travel from the station toward the motel and finally up the ridge, keeping the horizon as the directional axis',
    palette: 'sun-bleached sand, turquoise paint, rust orange, and long cobalt shadows',
    camera: 'patient wides for the landscape with close mechanical inserts whenever the signal changes'
  },
  {
    id: 'paper_planet_dreamer',
    label: 'Paper planet dreamer',
    subject: 'a curious child-sized traveler in a navy coat carrying a folded paper planet',
    setting: 'an ordinary apartment hallway that opens into a paper-built city, then a moonlit rooftop',
    anchor: 'the folded paper planet, a brass key, and one paper doorway that remains in every world',
    wardrobe: 'the navy coat, mustard scarf, red rain boots, and the same brass key on a cord',
    spatialRule: 'follow the traveler forward through one doorway at a time; distort scale after each threshold but never change the traveler\'s silhouette',
    palette: 'ink navy, paper cream, mustard, vermilion, and moonlit lavender',
    camera: 'gentle dolly moves through the ordinary world that become floating overhead views after each threshold'
  },
  {
    id: 'midnight_grocery_dance',
    label: 'Midnight grocery dance',
    subject: 'a tired night-shift clerk in a teal apron who discovers a private dance in the empty aisles',
    setting: 'a twenty-four-hour grocery store moving from fluorescent aisles to the loading dock and a dawn bus stop',
    anchor: 'a rolling shopping basket, a blinking aisle sign, and the teal apron',
    wardrobe: 'the teal apron over a charcoal shirt, comfortable black shoes, and a yellow name tag that remains readable but never changes',
    spatialRule: 'move aisle by aisle toward the loading dock, then carry the same forward motion into the dawn bus stop',
    palette: 'fluorescent lime, teal, ripe orange packaging, wet asphalt blue, and dawn peach',
    camera: 'precise aisle vanishing points that loosen into buoyant circular movement once the dance begins'
  }
];

function stableProfileIndex(creative = {}) {
  const seed = [creative.lyrics, creative.visualStyle, creative.narrativeMode, creative.genre, creative.mood]
    .map((value) => Array.isArray(value) ? value.join('|') : String(value || ''))
    .join('::');
  let hash = 2166136261;
  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % STARTER_PROFILES.length;
}

function starterProfileFor(creative = {}) {
  return STARTER_PROFILES[stableProfileIndex(creative)];
}

function baseNarrativeProfile({ motifs, creative }) {
  if (creative.brief) {
    return {
      subject: 'the central subject established by the creative brief',
      setting: 'the primary world established by the creative brief',
      anchor: 'the recurring prop or visual motif established by the brief',
      wardrobe: 'the wardrobe and physical design established by the brief',
      spatialRule: 'preserve the geography and screen direction established by the brief',
      palette: 'the palette established by the brief'
    };
  }
  const names = new Set(motifs.map((motif) => motif.name));
  if (names.has('family or academic pressure') && names.has('a distinctive drink or handheld prop')) {
    return {
      subject: 'a perpetually late high-school student in an oversized cobalt hoodie, scuffed white sneakers, and a sticker-covered backpack',
      setting: 'a continuous route from a cramped kitchen table, through fluorescent school corridors, to a corner boba shop and the adjacent residential block',
      anchor: 'a clear brown-sugar boba cup with a blue straw, a red report card, and the cobalt hoodie',
      wardrobe: 'the cobalt hoodie, scuffed white sneakers, sticker-covered backpack, and loosened school tie',
      spatialRule: 'keep the student moving left-to-right from home toward school and the boba shop; reverse direction only when the story turns inward',
      palette: 'cobalt blue, boba amber, fluorescent green, and report-card red'
    };
  }
  if (names.has('a five-cent mustache makeover and bacon-grease reveal')) {
    return {
      subject: 'a scraggly, hungry man with a narrow face, unruly dark mustache, patched olive work jacket, frayed jeans, and scuffed brown boots',
      setting: 'a sun-bleached neighborhood sidewalk leading to a one-chair mustache kiosk with a striped awning, a hand-painted five-cent sign, and a wall mirror',
      anchor: 'the single nickel, the five-cent sign, the barber scissors, the wall mirror, and the glossy bacon-greased mustache',
      wardrobe: 'the patched olive work jacket, frayed jeans, scuffed brown boots, and the same silhouette before and after the trim',
      spatialRule: 'track the man left-to-right along the sidewalk, stop him at the kiosk, then hold the mirror as the visual axis for the reveal',
      palette: 'dusty ochre, faded red-and-cream stripes, greasy amber highlights, and deep brown shadows'
    };
  }
  if (names.has('a bright day becoming a private music-video world') && !names.has('a breath-led inward-to-cosmic meditation') && !names.has('a silver thread joining the body to a breathing cosmos')) {
    return {
      subject: 'a carefree young traveler in a yellow windbreaker, red headphones, white sneakers, and a small blue daypack',
      setting: 'a tree-lined residential block that opens into a pocket park, a pedestrian bridge, and a bright rooftop overlook',
      anchor: 'the red headphones, yellow windbreaker, white sneakers, and the same blue daypack carried through every location',
      wardrobe: 'the yellow windbreaker, red headphones, white sneakers, and blue daypack; never change the silhouette between sections',
      spatialRule: 'begin at street level, widen into the park and bridge, then rise to the rooftop; keep the traveler moving toward the sun until the final return',
      palette: 'morning blue, cloud white, warm yellow, leaf green, and a small red accent from the headphones'
    };
  }
  if (names.has('a breath-led inward-to-cosmic meditation') && names.has('a silver thread joining the body to a breathing cosmos')) {
    return {
      subject: 'a calm meditator in loose ivory linen, first seen in a quiet resting body and later as a luminous human silhouette',
      setting: 'a dim quiet room that opens through the ground, atmosphere, stars, galaxy, and outer universe before returning along the same path',
      anchor: 'one silver thread rising from just below the navel, a multicolored rope of existence, and the visible pulse of each breath',
      wardrobe: 'loose ivory linen with no changes during the outward journey; add only a subtle spectrum tint to the silhouette on the return',
      spatialRule: 'travel outward along the single silver thread from body to cosmos, expand at the rope, then descend along the identical route back into the body',
      palette: 'soft silver, midnight blue, violet, deep space black, and restrained rainbow color that appears only after renewal'
    };
  }
  if (names.has('money and status anxiety')) {
    return {
      subject: 'a resourceful protagonist trying to appear more confident than their circumstances allow',
      setting: 'a connected neighborhood world where storefronts, clothing, and empty pockets reveal status',
      wardrobe: 'the repaired jacket, worn trousers, and one aspirational accessory that remains visible in every scene',
      spatialRule: 'move from public exposure toward a private decision, keeping the aspirational object in frame whenever status anxiety peaks',
      palette: 'muted street neutrals with one increasingly saturated aspirational color',
      anchor: 'one conspicuous object that changes meaning as the protagonist’s fortunes shift'
    };
  }
  if (names.has('a surreal escape or wish image')) {
    return {
      subject: 'a grounded protagonist tempted by an increasingly surreal escape',
      setting: 'a familiar everyday world with one consistent threshold into the impossible',
      anchor: 'a recurring ordinary object that foreshadows the wish image',
      wardrobe: 'grounded everyday clothing that gains one impossible detail only after the threshold is crossed',
      spatialRule: 'keep the ordinary world physically consistent until the threshold is crossed, then distort scale without changing the protagonist',
      palette: 'natural everyday color with one impossible accent that grows brighter scene by scene'
    };
  }
  return starterProfileFor(creative);
}

function narrativeProfile({ motifs, creative }) {
  const base = baseNarrativeProfile({ motifs, creative });
  const overrides = creative?.visualOverrides;
  if (!overrides || typeof overrides !== 'object') return { ...base, requiredProps: [], avoid: [], camera: null };
  const requiredProps = Array.isArray(overrides.requiredProps) ? overrides.requiredProps.filter(Boolean) : [];
  const avoid = Array.isArray(overrides.avoid) ? overrides.avoid.filter(Boolean) : [];
  return {
    ...base,
    ...(overrides.subject ? { subject: overrides.subject } : {}),
    ...(overrides.setting ? { setting: overrides.setting } : {}),
    ...(overrides.wardrobe ? { wardrobe: overrides.wardrobe } : {}),
    ...(overrides.palette ? { palette: overrides.palette } : {}),
    ...(overrides.spatialRule ? { spatialRule: overrides.spatialRule } : {}),
    requiredProps,
    avoid,
    camera: overrides.camera || null
  };
}

function profileProvenance({ creative = {}, globalMotifs = [] } = {}) {
  const overrides = creative.visualOverrides && typeof creative.visualOverrides === 'object' ? creative.visualOverrides : {};
  const source = (field) => {
    if (Object.prototype.hasOwnProperty.call(overrides, field)) return 'user_supplied';
    if (field === 'palette' && creative.visualStyle) return 'user_supplied';
    if (creative.brief && ['subject', 'setting'].includes(field)) return 'user_supplied';
    if (globalMotifs.length && ['subject', 'setting', 'anchor'].includes(field)) return 'lyric_inferred';
    return 'default_proposal';
  };
  return {
    subject: source('subject'),
    setting: source('setting'),
    anchor: source('anchor'),
    wardrobe: source('wardrobe'),
    spatialRule: source('spatialRule'),
    palette: source('palette'),
    requiredProps: overrides.requiredProps ? 'user_supplied' : 'default_proposal',
    avoid: overrides.avoid ? 'user_supplied' : 'default_proposal',
    camera: overrides.camera ? 'user_supplied' : 'default_proposal',
    motifs: globalMotifs.length ? 'lyric_inferred' : 'default_proposal'
  };
}

function lyricProvenance(line) {
  if (line?.timing === 'acoustic' || line?.source === 'acoustic_forced_alignment') return 'acoustically_aligned';
  if (line?.source === 'provided_lyrics_reference') return 'user_supplied';
  return 'default_proposal';
}

function buildNarrativeBeat({ sceneId, section, index, total, lyricReferences, creative, previous, globalMotifs, narrativeMode = 'song' }) {
  const direction = narrativeDirectionFor(section.label, index, total, narrativeMode);
  const lyricLines = lyricReferences.map((line) => line.text).filter(Boolean);
  const motifs = inferNarrativeMotifs(lyricLines);
  const profile = narrativeProfile({ motifs: globalMotifs?.length ? globalMotifs : motifs, creative });
  const provenance = profileProvenance({ creative, globalMotifs: globalMotifs?.length ? globalMotifs : motifs });
  const subject = profile.subject;
  const motifText = motifs.length ? motifs.map((motif) => motif.name).join(', ') : profile.anchor;
  const lyricHook = lyricLines.length ? lyricLines.slice(0, 3).join(' / ') : 'the section’s emotional turn';
  const continuity = previous
    ? `Continue directly from ${previous.id}: ${previous.stateAfter}. Keep the same protagonist, wardrobe logic, geography, and established motifs before introducing only the section’s new pressure.`
    : 'Open with an establishing image that makes the protagonist, world, and central want legible before expanding the visual scale.';
  const scene = index === 0
    ? `Place the protagonist in ${profile.setting}; establish ${profile.anchor} and make the environment express the tension in “${lyricHook}”.`
    : section.label === 'chorus'
      ? `Return to ${profile.setting}; let ${motifText} deliver the visual payoff rather than appearing as decoration, while ${profile.anchor} remains recognizable.`
      : `Move the protagonist through ${profile.setting}; let ${motifText} cause or reveal the next turn rather than appearing as decoration, while ${profile.anchor} remains recognizable.`;
  const carryForward = previous
    ? `Carry forward the prior scene’s anchor prop, wardrobe, color logic, and spatial direction; transform one of them only when the story state changes.`
    : 'Establish a repeatable wardrobe, silhouette, location anchor, and prop that later scenes can recognize immediately.';
  const payoff = direction.role === 'visual payoff';
  const requiredPropsText = profile.requiredProps.length ? ` Required props: ${profile.requiredProps.join(', ')}.` : '';
  const avoidText = profile.avoid.length ? ` Avoid: ${profile.avoid.join(', ')}.` : '';
  const preciseContinuity = previous
    ? `Continue directly from ${previous.id}: ${previous.stateAfter}. Keep ${profile.subject} in ${profile.wardrobe}; preserve ${profile.anchor}, ${profile.setting}, and the rule that ${profile.spatialRule} before introducing only the section's new pressure.`
    : `Open with an establishing image of ${profile.subject} inside ${profile.setting}; make ${profile.anchor} visible and establish that ${profile.spatialRule}.`;
  const preciseScene = index === 0
    ? `Place ${profile.subject} in ${profile.setting}; show ${profile.anchor} in the first readable composition and use ${profile.palette} as the baseline palette while the lyric hook "${lyricHook}" triggers the opening action.${requiredPropsText}${avoidText}`
    : payoff
      ? `Return ${profile.subject} to the established ${profile.setting}; make ${profile.anchor} deliver the payoff, with ${profile.spatialRule} and ${profile.palette} visibly intensified rather than replaced.${requiredPropsText}${avoidText}`
      : `Move ${profile.subject} through ${profile.setting}; use ${profile.anchor} and ${profile.spatialRule} to cause or reveal the next turn, while ${motifText} changes the character's behavior rather than sitting in the background.${requiredPropsText}${avoidText}`;
  const preciseCarryForward = previous
    ? `${preciseContinuity} Carry forward ${profile.wardrobe}, ${profile.anchor}, and ${profile.palette}; preserve ${profile.spatialRule}. Change only the single prop, lighting state, or blocking choice required by the new story state.${requiredPropsText}${avoidText}`
    : `${preciseContinuity} Establish ${profile.wardrobe}, ${profile.anchor}, ${profile.palette}, and ${profile.spatialRule} so later scenes can match the same subject and geography immediately.${requiredPropsText}${avoidText}`;
  return {
    arcRole: direction.role,
    subject,
    scene: preciseScene,
    characterAction: `${direction.action}. Use “${lyricHook}” as the immediate behavioral trigger, not as a list of text to illustrate.`,
    stateBefore: previous?.stateAfter || 'the story has not yet shown the protagonist’s want',
    stateAfter: direction.state,
    continuityFrom: previous?.id || null,
    carryForward: preciseCarryForward,
    motifs,
    setting: profile.setting,
    anchor: profile.anchor,
    wardrobe: profile.wardrobe,
    spatialRule: profile.spatialRule,
    palette: profile.palette,
    profileId: profile.id || null,
    profileLabel: profile.label || null,
    requiredProps: profile.requiredProps,
    avoid: profile.avoid,
    camera: profile.camera,
    provenance: {
      ...provenance,
      profile: profile.id ? 'starter_profile' : (globalMotifs?.length ? 'lyric_inferred' : (creative.brief ? 'creative_brief' : 'default_proposal')),
      profileId: profile.id || null,
      lyricHooks: lyricLines.length ? 'user_supplied' : 'default_proposal',
      narrativeMode: creative.narrativeMode ? 'user_supplied' : 'default_proposal'
    }
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
    provenance: 'acoustically_aligned',
    promptEligible: Number(line.confidence) >= 0.65
  }));
  const acousticText = new Set(acoustic.map((line) => String(line.text).trim().toLowerCase()));
  const references = [...acoustic];
  for (const text of windowLines) {
    if (acousticText.has(text.toLowerCase())) continue;
    references.push({ text, confidence: null, source: 'provided_lyrics_reference', timing: 'approximate', provenance: 'user_supplied', promptEligible: false });
  }
  return references.slice(0, 8);
}

export function generateScenePrompts({ sections = [], creative = {}, analysis = {}, output = {} } = {}) {
  const brief = creative.brief || 'Create a coherent visual interpretation of the music.';
  const style = creative.visualStyle || 'Cinematic, intentional visual storytelling with consistent subjects and locations.';
  const mood = Array.isArray(creative.mood) && creative.mood.length ? creative.mood.join(', ') : 'follow the emotional movement of the track';
  const genre = Array.isArray(creative.genre) && creative.genre.length ? creative.genre.join(', ') : 'music video';
  const framingDirection = output.aspectRatio
    ? `Compose for ${output.aspectRatio}.`
    : 'Keep framing production-flexible; do not lock the scene to a specific orientation.';
  const narrativeMode = creative.narrativeMode || 'song';
  const globalMotifs = inferNarrativeMotifs(providedLyricLines(creative.lyrics));
  let previousBeat = null;
  return sections.map((section, index) => {
    const visualDirection = directionFor(section.label);
    const sceneId = `scene_${String(index + 1).padStart(2, '0')}`;
    const continuityRefs = ['character_01', 'location_01', 'style_01'];
    const lyricMoments = lyricMomentsFor(section, analysis.lyricAlignment);
    const lyricReferences = lyricReferencesFor({ section, sectionIndex: index, sections, lyrics: creative.lyrics, alignment: analysis.lyricAlignment });
    const narrative = buildNarrativeBeat({ sceneId, section, index, total: sections.length, lyricReferences, creative, previous: previousBeat, globalMotifs, narrativeMode });
    const shotSetup = shotLanguageFor(section.label, creative.shotLanguage);
    const cameraDirection = shotSetup || narrative.camera || visualDirection.camera;
    const modePrompt = `Narrative mode: ${narrativeMode}. Use this mode's arc language and pacing while preserving the supplied subject, lyrics, and continuity anchors.`;
    const narrativePrompt = `Narrative continuity: ${narrative.continuityFrom ? `continue from ${narrative.continuityFrom};` : 'begin the story;'} Arc role: ${narrative.arcRole}. Subject: ${narrative.subject}. Scene: ${narrative.scene} Character action: ${narrative.characterAction} State transition: ${narrative.stateBefore} → ${narrative.stateAfter}. ${narrative.carryForward}`;
    const narrativeSpecifics = `Wardrobe continuity: ${narrative.wardrobe}. Spatial continuity: ${narrative.spatialRule}. Palette continuity: ${narrative.palette}. ${narrative.requiredProps.length ? `Required props: ${narrative.requiredProps.join(', ')}.` : ''} ${narrative.avoid.length ? `Avoid: ${narrative.avoid.join(', ')}.` : ''}`;
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
      narrativeMode,
      shotLanguage: shotSetup,
      beatCues: beatCues(section, analysis.beatGrid),
      lyricMoments,
      lyricReferences,
      lyricDirection,
      narrative,
      provenance: {
        ...narrative.provenance,
        lyricMoments: lyricMoments.map((moment) => moment.provenance),
        lyricReferences: lyricReferences.map((reference) => reference.provenance)
      },
      intent: visualDirection.intent,
      prompt: `${visualDirection.intent} ${brief} Genre: ${genre}. Mood: ${mood}. Style: ${style}. ${framingDirection} ${shotSetup ? `Shot language for ${section.label}: ${shotSetup}.` : ''} ${modePrompt} ${narrativePrompt} ${narrativeSpecifics} ${lyricCueText} ${lyricDirection} Preserve the recurring subject, location logic, palette, and visual motifs from the style bible.`,
      negativePrompt: [DEFAULT_NEGATIVE_PROMPT, ...narrative.avoid].join(', '),
      camera: { shot: cameraDirection, movement: cameraDirection },
      lighting: visualDirection.lighting,
      edit: { cutOnBeat: section.label === 'chorus' || section.label === 'pre-chorus', transition: visualDirection.transition, lyricCueCount: lyricMoments.length, lyricReferenceCount: lyricReferences.length, lyricCuePolicy: 'confidence_gated_with_approximate_text_references' },
      continuityRefs,
      confidence: section.confidence
    };
    previousBeat = { ...narrative, id: sceneId };
    return scene;
  });
}

export function auditSceneContinuity(scenes = []) {
  if (!Array.isArray(scenes) || scenes.length === 0) {
    return { status: 'not_available', score: null, sceneCount: 0, checks: [], violations: [] };
  }
  const checks = [];
  const violations = [];
  const required = ['subject', 'setting', 'anchor', 'wardrobe', 'spatialRule', 'palette', 'arcRole', 'stateBefore', 'stateAfter'];
  const pass = (code, sceneId, message) => checks.push({ code, sceneId, status: 'pass', message });
  const fail = (code, sceneId, message, severity = 'error') => {
    const finding = { code, sceneId, severity, message };
    checks.push({ ...finding, status: 'fail' });
    violations.push(finding);
  };

  scenes.forEach((scene, index) => {
    const sceneId = scene?.id || `scene_${String(index + 1).padStart(2, '0')}`;
    const narrative = scene?.narrative || {};
    for (const field of required) {
      if (typeof narrative[field] !== 'string' || !narrative[field].trim()) fail('missing_narrative_field', sceneId, `narrative.${field} is missing or empty`);
    }
    if (index > 0) {
      const previous = scenes[index - 1];
      const previousId = previous?.id || `scene_${String(index).padStart(2, '0')}`;
      const previousNarrative = previous?.narrative || {};
      for (const field of ['subject', 'setting', 'anchor', 'wardrobe', 'spatialRule', 'palette']) {
        if (narrative[field] !== previousNarrative[field]) fail('continuity_drift', sceneId, `${field} changed from ${previousId} without an explicit profile change`);
        else pass(`stable_${field}`, sceneId, `${field} matches ${previousId}`);
      }
      if (narrative.continuityFrom !== previousId) fail('broken_continuity_link', sceneId, `continuityFrom must reference ${previousId}`);
      else pass('continuity_link', sceneId, `continuityFrom references ${previousId}`);
      if (narrative.stateBefore !== previousNarrative.stateAfter) fail('broken_state_handoff', sceneId, `stateBefore must equal ${previousId}.stateAfter`);
      else pass('state_handoff', sceneId, `stateBefore matches ${previousId}.stateAfter`);
      if (Number.isFinite(previous.endSeconds) && Number.isFinite(scene.startSeconds) && scene.startSeconds < previous.endSeconds) fail('overlapping_scene_window', sceneId, `scene starts before ${previousId} ends`);
      else pass('ordered_scene_window', sceneId, 'scene timing follows the previous scene');
    } else {
      if (narrative.continuityFrom !== null) fail('invalid_first_continuity_link', sceneId, 'the first scene must have continuityFrom = null');
      else pass('first_scene_anchor', sceneId, 'first scene starts a new continuity chain');
    }
  });
  const errorCount = violations.filter((item) => item.severity === 'error').length;
  return {
    status: errorCount ? 'fail' : 'pass',
    score: Number(((checks.filter((check) => check.status === 'pass').length / Math.max(1, checks.length)) * 100).toFixed(1)),
    sceneCount: scenes.length,
    checks,
    violations
  };
}

export function buildStyleBible({ creative = {} } = {}) {
  return {
    visualThesis: creative.brief || 'A coherent visual interpretation of the supplied music.',
    palette: creative.visualStyle ? [creative.visualStyle] : ['derive from the supplied mood and references'],
    userOverrides: creative.visualOverrides || null,
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
