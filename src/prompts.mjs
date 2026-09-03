const DEFAULT_NEGATIVE_PROMPT = 'inconsistent face, identity drift, extra limbs, unreadable text, logo, watermark, no written lyrics, no on-screen lyrics, no lyric subtitles, no captions, no text overlays';

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
  },
  {
    id: 'moonlit_laundromat_poet',
    label: 'Moonlit laundromat poet',
    subject: 'a sleepless poet folding blue shirts while memories appear in the washing-machine glass',
    setting: 'a twenty-four-hour laundromat connected to a quiet alley and a moonlit apartment balcony',
    anchor: 'a handwritten receipt, a spinning blue shirt, and a red plastic laundry basket',
    wardrobe: 'a cream sweater, blue jeans, worn canvas shoes, and a red scarf kept throughout',
    spatialRule: 'move from the front washers to the alley, then return home with one remembered object',
    palette: 'moon blue, washer silver, cream, and one red accent',
    camera: 'circular reflections in the washers followed by intimate handheld observation'
  },
  {
    id: 'chrome_arcade_pilgrim',
    label: 'Chrome arcade pilgrim',
    subject: 'a determined player in a white bomber jacket following a glowing token through an arcade',
    setting: 'a chrome-lit arcade, its prize counter, and a silent street outside after closing',
    anchor: 'one glowing token, a broken joystick, and a blue prize ticket',
    wardrobe: 'the white bomber jacket, black trousers, red high-top sneakers, and a blue wristband',
    spatialRule: 'advance cabinet by cabinet toward the prize counter, then carry the token outside',
    palette: 'electric blue, chrome, candy red, black, and ultraviolet',
    camera: 'low dolly moves between cabinets with game-screen reflections in close-up'
  },
  {
    id: 'wildflower_hitchhiker',
    label: 'Wildflower hitchhiker',
    subject: 'a quiet traveler with a yellow duffel and a pressed wildflower tucked behind one ear',
    setting: 'a two-lane country road linking a farm gate, a gas station, and a hilltop overlook',
    anchor: 'the pressed wildflower, yellow duffel, and a hand-painted road sign',
    wardrobe: 'a faded denim jacket, sunflower shirt, olive trousers, and dusty boots',
    spatialRule: 'move toward the hilltop while vehicles pass in both directions, stopping only at meaningful choices',
    palette: 'field green, faded denim, sunflower yellow, asphalt gray, and dusk violet',
    camera: 'long-lens roadside portraits opening into expansive horizon wides'
  },
  {
    id: 'raincoat_record_keeper',
    label: 'Raincoat record keeper',
    subject: 'an archivist in a yellow raincoat cataloging sounds that vanish after midnight',
    setting: 'a flooded records office, a covered market, and a rooftop antenna station',
    anchor: 'a waterproof cassette case, numbered labels, and a red listening lamp',
    wardrobe: 'the yellow raincoat, gray trousers, rubber boots, and red headphones',
    spatialRule: 'follow the archivist upward from storage shelves to the antenna, preserving the same numbered case',
    palette: 'rain yellow, slate gray, wet red, and electric cyan',
    camera: 'measured lateral tracking among shelves with sudden overhead views at the antenna'
  },
  {
    id: 'velvet_motel_magician',
    label: 'Velvet motel magician',
    subject: 'a traveling magician in a plum suit carrying a suitcase of ordinary objects',
    setting: 'a roadside motel, its empty pool, and a neon sign visible from every room',
    anchor: 'the plum suitcase, a silver coin, and the flickering motel sign',
    wardrobe: 'a plum suit, ivory shirt, silver tie, and black shoes that never change',
    spatialRule: 'move room to room toward the pool, keeping the motel sign as the geographic north star',
    palette: 'plum, turquoise, motel cream, silver, and deep midnight blue',
    camera: 'formal centered frames that break into a slow orbit when an object disappears'
  },
  {
    id: 'suburban_stargazer',
    label: 'Suburban stargazer',
    subject: 'a teenager in a green hoodie aligning a small telescope from a backyard patio',
    setting: 'a suburban bedroom, backyard, and rooftop water tower beneath changing skies',
    anchor: 'the brass telescope, a red notebook, and a string of patio lights',
    wardrobe: 'the green hoodie, gray shorts, striped socks, and the same red notebook',
    spatialRule: 'move from indoor preparation to the yard and finally the water tower, always following the same star',
    palette: 'grass green, patio amber, navy sky, brass, and red ink',
    camera: 'quiet tripod compositions with telescope eyepiece inserts and a final cosmic pull-back'
  },
  {
    id: 'carnival_mapmaker',
    label: 'Carnival mapmaker',
    subject: 'a carnival mapmaker in a striped vest redrawing the grounds as rides move overnight',
    setting: 'a traveling carnival, its service road, and a half-packed fairground at dawn',
    anchor: 'a hand-inked map, a brass compass, and a carousel horse emblem',
    wardrobe: 'a navy-and-cream striped vest, red trousers, leather boots, and a brass compass',
    spatialRule: 'trace the map from the ticket gate through the rides to the departing trucks, never losing the compass direction',
    palette: 'carousel red, faded cream, night navy, brass, and cotton-candy pink',
    camera: 'whirling ride movement contrasted with precise top-down map views'
  },
  {
    id: 'electric_bike_messenger',
    label: 'Electric bike messenger',
    subject: 'an electric-bike messenger carrying a sealed blue parcel through a city blackout',
    setting: 'a darkened downtown, a lit corner pharmacy, and a bridge powered by emergency lights',
    anchor: 'the sealed blue parcel, the bike headlamp, and a yellow street map',
    wardrobe: 'a reflective black cycling jacket, orange gloves, navy pants, and a white helmet',
    spatialRule: 'ride west through dark streets toward the bridge, stopping only where the parcel changes hands',
    palette: 'headlamp white, blackout blue, emergency orange, and wet asphalt gray',
    camera: 'fast stabilized tracking beside the bike with still frames at every handoff'
  },
  {
    id: 'glasshouse_botanist',
    label: 'Glasshouse botanist',
    subject: 'a botanist in a linen apron tending one luminous plant that responds to sound',
    setting: 'a glass greenhouse, a misted service corridor, and a dawn garden beyond the panes',
    anchor: 'the luminous plant, a copper watering can, and a red seed packet',
    wardrobe: 'a sage linen apron, white shirt, dark work trousers, and green gloves',
    spatialRule: 'move from the plant bench through the corridor to the garden, keeping the plant’s growth as the progress marker',
    palette: 'glass cyan, leaf green, copper, soft white, and dawn coral',
    camera: 'macro botanical details widening into quiet symmetrical greenhouse frames'
  },
  {
    id: 'silver_train_passenger',
    label: 'Silver train passenger',
    subject: 'a solitary passenger in a blue coat carrying a small red suitcase across a night train',
    setting: 'a sleeping train, an empty platform, and a bright morning station at the final stop',
    anchor: 'the red suitcase, a window reflection, and a paper ticket with one destination circled',
    wardrobe: 'the blue coat, cream scarf, dark trousers, and black travel shoes',
    spatialRule: 'move forward through the train carriages toward the engine, then step into the final station without losing the ticket',
    palette: 'steel silver, midnight blue, ticket red, warm carriage amber, and dawn cream',
    camera: 'smooth corridor dolly shots with reflected faces and restrained platform wides'
  },
  {
    id: 'ocean_pier_astronomer',
    label: 'Ocean pier astronomer',
    subject: 'an amateur astronomer in a rust sweater charting stars above a foggy pier',
    setting: 'a weathered ocean pier, a small observatory room, and the tide line below',
    anchor: 'a star chart, a brass sextant, and a blue lantern',
    wardrobe: 'the rust sweater, navy trousers, rubber boots, and a knitted cream cap',
    spatialRule: 'move from the observatory to the pier end and down toward the tide, aligning every step to the star chart',
    palette: 'sea blue, rust, brass, fog white, and lantern gold',
    camera: 'slow horizon pans with close hands-on instrument work and one vertical drop toward the tide'
  },
  {
    id: 'vhs_repair_shop',
    label: 'VHS repair shop',
    subject: 'a patient repair technician in a teal smock finding an alternate life inside a damaged tape',
    setting: 'a cluttered VHS shop, a back-room editing desk, and a storefront after rain',
    anchor: 'a labeled videotape, a blinking time counter, and a red rewind button',
    wardrobe: 'the teal smock, white T-shirt, dark jeans, and round safety glasses',
    spatialRule: 'move from public counter to private edit desk, then return to the storefront with the repaired tape',
    palette: 'VHS cobalt, teal, faded magenta, monitor green, and rain silver',
    camera: 'analog scanline inserts, rack focus across shelves, and intimate desk-level framing'
  },
  {
    id: 'rooftop_kite_builder',
    label: 'Rooftop kite builder',
    subject: 'a careful kite builder in a blue sweater assembling a red kite for someone absent',
    setting: 'a small apartment, a rooftop workshop, and a skyline washed in late afternoon light',
    anchor: 'the red kite, a spool of white string, and a blue toolbox',
    wardrobe: 'the blue sweater, tan trousers, white sneakers, and a yellow wristwatch',
    spatialRule: 'carry the unfinished kite from the apartment to the roof, then release it only after the final repair',
    palette: 'sky blue, paper red, warm concrete, white string, and sunset gold',
    camera: 'patient overhead assembly shots becoming wide wind-led aerial movement'
  },
  {
    id: 'lighthouse_signal_keeper',
    label: 'Lighthouse signal keeper',
    subject: 'a lighthouse keeper in a navy coat maintaining a lamp that sends a personal signal',
    setting: 'a cliffside lighthouse, a storm-battered path, and a small harbor below',
    anchor: 'the rotating lamp, a brass key, and a red signal flag',
    wardrobe: 'the navy coat, cream sweater, rubber boots, and red knit cap',
    spatialRule: 'climb from harbor path to lantern room, then descend after the signal is seen',
    palette: 'storm navy, lamp gold, sea foam, red flag, and wet stone gray',
    camera: 'spiraling stair movement with locked horizon frames at the lantern room'
  },
  {
    id: 'plastic_castle_explorer',
    label: 'Plastic castle explorer',
    subject: 'a child-sized explorer in a yellow cape crossing a bedroom kingdom built from toys',
    setting: 'a bedroom floor, a blanket castle, and a moonlit hallway that becomes a royal road',
    anchor: 'a toy crown, a blue flashlight, and a red plastic drawbridge',
    wardrobe: 'the yellow cape over blue pajamas, striped socks, and a cardboard badge',
    spatialRule: 'advance from bed to castle gate to hallway, keeping the flashlight as the explorer’s beacon',
    palette: 'toy blue, cape yellow, plastic red, moon lavender, and blanket cream',
    camera: 'low child-height tracking that turns into grand miniature-world wides'
  },
  {
    id: 'blue_hour_florist',
    label: 'Blue-hour florist',
    subject: 'a florist in a lilac apron delivering bouquets whose colors carry secret messages',
    setting: 'a narrow flower shop, a blue-hour street, and a quiet apartment stairwell',
    anchor: 'a lilac bouquet, handwritten cards, and a brass shop bell',
    wardrobe: 'the lilac apron, green shirt, brown trousers, and red rain boots',
    spatialRule: 'move outward from shop counter to each doorstep, returning for the final bouquet',
    palette: 'blue hour cobalt, lilac, leaf green, paper cream, and rain red',
    camera: 'gentle handheld deliveries with floral macro inserts and stairwell verticals'
  },
  {
    id: 'underground_roller_disco',
    label: 'Underground roller disco',
    subject: 'a shy skater in a magenta jacket finding confidence among strangers beneath the city',
    setting: 'an abandoned subway platform transformed into a roller disco and a sunrise street exit',
    anchor: 'magenta roller skates, a mirror ball, and a yellow transit token',
    wardrobe: 'the magenta jacket, black shorts over tights, silver knee pads, and white gloves',
    spatialRule: 'circle the platform with the crowd, break away toward the tunnel, then return to the central dance floor',
    palette: 'magenta, electric cyan, silver, subway green, and sunrise peach',
    camera: 'fluid skating pursuit shots with overhead circles during the collective dance'
  },
  {
    id: 'antique_clock_thief',
    label: 'Antique clock thief',
    subject: 'a careful thief in a burgundy coat stealing minutes from a silent clock shop',
    setting: 'an antique clock shop, a narrow alley, and a stopped town square',
    anchor: 'a pocket watch, a brass key, and a clock with a missing hand',
    wardrobe: 'the burgundy coat, cream gloves, charcoal trousers, and polished boots',
    spatialRule: 'move from back room to shopfront to square, with each stolen minute slowing the surrounding world',
    palette: 'burgundy, antique brass, charcoal, parchment cream, and frozen blue',
    camera: 'precise ticking inserts followed by increasingly suspended wide frames'
  },
  {
    id: 'cloud_bus_driver',
    label: 'Cloud-bus driver',
    subject: 'a cheerful driver in a sky-blue uniform guiding a small bus above the skyline',
    setting: 'a floating bus depot, a cloud highway, and a sunrise terminal above the city',
    anchor: 'the bus route map, a red ticket punch, and glowing cloud markers',
    wardrobe: 'the sky-blue uniform, white gloves, dark shoes, and a yellow cap',
    spatialRule: 'follow the numbered route upward, stopping at each cloud marker before the sunrise terminal',
    palette: 'sky blue, cloud white, route-map red, gold sunrise, and lavender shadow',
    camera: 'smooth aerial tracking beside the bus with cockpit close-ups at each stop'
  },
  {
    id: 'motel_pool_oracle',
    label: 'Motel pool oracle',
    subject: 'a night swimmer in a green robe reading tomorrow’s choices in a motel pool reflection',
    setting: 'a desert motel, its turquoise pool, and a locked room at the far end of the courtyard',
    anchor: 'the pool reflection, a green robe, and a coin placed on the diving board',
    wardrobe: 'the green robe, black swimwear, white sandals, and a silver hair clip',
    spatialRule: 'move around the pool toward the locked room, returning to the water whenever a choice changes',
    palette: 'turquoise, desert sand, motel pink, green, and midnight violet',
    camera: 'surface-level pool reflections with slow courtyard orbits and locked room close-ups'
  },
  {
    id: 'golden_radio_host',
    label: 'Golden-era radio host',
    subject: 'a late-night radio host in a mustard suit speaking to callers who may not exist',
    setting: 'a vintage broadcast booth, a transmitter roof, and a sleeping city below',
    anchor: 'the ribbon microphone, a red ON AIR sign, and a stack of listener letters',
    wardrobe: 'the mustard suit, black shirt, cream headphones, and a gold wristwatch',
    spatialRule: 'move from microphone to control desk to transmitter roof, keeping the red ON AIR light as the signal',
    palette: 'mustard gold, radio red, walnut brown, cream, and midnight blue',
    camera: 'period-perfect locked frames with slow push-ins during impossible calls'
  },
  {
    id: 'alleyway_shadow_painter',
    label: 'Alleyway shadow painter',
    subject: 'a muralist in a white coverall painting shadows that move ahead of their owners',
    setting: 'a narrow city alley, a rooftop paint station, and a dawn public square',
    anchor: 'a cobalt spray can, a folding ladder, and one growing shadow mural',
    wardrobe: 'the white coverall, cobalt gloves, red bandana, and paint-spattered boots',
    spatialRule: 'paint from alley entrance toward the rooftop, then bring the mural into the public square at dawn',
    palette: 'cobalt, concrete gray, white, vermilion, and sunrise peach',
    camera: 'tracking along mural lines with shadow-matched compositions and a final crane reveal'
  },
  {
    id: 'astronaut_in_a_kitchen',
    label: 'Astronaut in a kitchen',
    subject: 'a home cook in a white apron treating an ordinary kitchen as a small spacecraft',
    setting: 'a compact kitchen, a hallway of floating utensils, and a dining table beneath stars',
    anchor: 'a silver mixing bowl, a red timer, and a single recipe card',
    wardrobe: 'the white apron, navy shirt, gray slippers, and a paper astronaut badge',
    spatialRule: 'move from counter to table as gravity loosens, preserving the recipe card as the navigation point',
    palette: 'appliance silver, recipe red, kitchen cream, deep navy, and starlight white',
    camera: 'familiar domestic close-ups that gradually become weightless floating wides'
  },
  {
    id: 'firefly_street_vendor',
    label: 'Firefly street vendor',
    subject: 'a street vendor in a green jacket selling jars of firefly light to a tired neighborhood',
    setting: 'a dark market street, a row of apartment stoops, and a small community garden',
    anchor: 'glowing jars, a green cart, and a handwritten price board',
    wardrobe: 'the green jacket, tan apron, brown boots, and a yellow scarf',
    spatialRule: 'push the cart from market to stoops to garden, leaving one jar at each human connection',
    palette: 'firefly gold, deep green, wet blue, warm window amber, and paper cream',
    camera: 'slow cart-level tracking with intimate doorstep portraits and a garden-wide release'
  },
  {
    id: 'clockwork_garden_caretaker',
    label: 'Clockwork garden caretaker',
    subject: 'a caretaker in a copper vest winding mechanical flowers in a hidden courtyard',
    setting: 'a clockwork greenhouse, a gear-lined corridor, and a courtyard at first light',
    anchor: 'a brass winding key, one blue mechanical flower, and a copper watering can',
    wardrobe: 'the copper vest, cream shirt, dark trousers, leather boots, and brass goggles',
    spatialRule: 'wind flowers from the greenhouse inward toward the courtyard, saving the blue flower for the final beat',
    palette: 'copper, gear gray, leaf green, porcelain blue, and first-light gold',
    camera: 'macro gear movement transitioning to symmetrical garden tableaux'
  },
  {
    id: 'winter_carnival_stranger',
    label: 'Winter carnival stranger',
    subject: 'a masked stranger in a cobalt coat arriving at a snow-covered carnival before dawn',
    setting: 'a frozen fairground, a deserted ticket booth, and a ferris wheel above the town',
    anchor: 'a white mask, a red ticket, and one unlit carnival bulb',
    wardrobe: 'the cobalt coat, silver scarf, black gloves, and snow-dusted boots',
    spatialRule: 'move from ticket booth through silent rides toward the ferris wheel, lighting bulbs behind the stranger',
    palette: 'snow white, cobalt, ticket red, silver, and warm bulb gold',
    camera: 'wide snowbound compositions with masked close-ups and rising ferris-wheel views'
  },
  {
    id: 'subway_tunnel_violinist',
    label: 'Subway tunnel violinist',
    subject: 'a violinist in a rust coat whose playing changes the color of underground lights',
    setting: 'a subway platform, service tunnel, and stairway opening into a city dawn',
    anchor: 'the wooden violin, a rust coat, and a flickering platform clock',
    wardrobe: 'the rust coat, black shirt, gray trousers, and worn leather shoes',
    spatialRule: 'play from platform edge through the tunnel toward the stairs, carrying the same melody upward',
    palette: 'rust, subway green, wood brown, fluorescent white, and dawn coral',
    camera: 'rhythmic lateral platform tracks with vibration-sensitive close-ups of the bow'
  },
  {
    id: 'paper_boat_navigator',
    label: 'Paper boat navigator',
    subject: 'a small traveler in a yellow coat steering a paper boat through oversized streets',
    setting: 'a rain gutter, a flooded plaza, and a moonlit canal made from ordinary city surfaces',
    anchor: 'the folded paper boat, a blue button compass, and a yellow coat',
    wardrobe: 'the yellow coat, red boots, navy scarf, and a paper captain badge',
    spatialRule: 'follow the water’s flow from gutter to plaza to canal, never changing the boat’s forward direction',
    palette: 'rain blue, paper cream, coat yellow, button cobalt, and moon silver',
    camera: 'low waterline tracking with miniature-scale reveals and gentle overhead maps'
  },
  {
    id: 'night_aquarium_guide',
    label: 'Night-shift aquarium guide',
    subject: 'an aquarium guide in a blue vest discovering that the fish mirror visitors’ emotions',
    setting: 'a closed aquarium, a staff corridor, and the largest ocean tank after midnight',
    anchor: 'a blue flashlight, a laminated route card, and one orange fish',
    wardrobe: 'the blue vest, white shirt, black trousers, practical shoes, and a silver name tag',
    spatialRule: 'walk tank by tank toward the ocean exhibit, following the orange fish as the emotional guide',
    palette: 'deep ocean blue, aquarium cyan, orange, black, and soft staff-room amber',
    camera: 'glass-reflected tracking with slow underwater transitions and quiet face close-ups'
  },
  {
    id: 'golden_highway_drifter',
    label: 'Golden highway drifter',
    subject: 'a lone driver in a cream jacket following a repeating golden roadside symbol',
    setting: 'a desert highway, a gas station, and a hill road above a dry valley',
    anchor: 'the golden symbol, a cream car, and a red paper map',
    wardrobe: 'the cream jacket, faded blue shirt, dark jeans, and driving gloves',
    spatialRule: 'follow the symbol through each roadside stop, turning only when it appears on the map',
    palette: 'desert gold, cream, faded blue, red map ink, and violet dusk',
    camera: 'long highway wides, dashboard reflections, and slow turns around roadside signs'
  },
  {
    id: 'rooftop_weather_reporter',
    label: 'Rooftop weather reporter',
    subject: 'a weather reporter in an orange jacket whose personal forecast alters the skyline',
    setting: 'a compact broadcast studio, a rooftop weather rig, and city streets beneath moving clouds',
    anchor: 'a handheld anemometer, a yellow forecast card, and the orange jacket',
    wardrobe: 'the orange jacket, navy trousers, white sneakers, and a blue earpiece',
    spatialRule: 'move from studio to roof to street, tracking one cloud formation as the forecast becomes personal',
    palette: 'weather blue, forecast yellow, orange, cloud white, and storm charcoal',
    camera: 'broadcast-stable frames that give way to wind-led handheld movement outdoors'
  },
  {
    id: 'toyshop_after_midnight',
    label: 'Toyshop after midnight',
    subject: 'a night watchman in a burgundy vest discovering toys rehearsing after closing',
    setting: 'a toyshop floor, a locked stockroom, and a miniature theater built between shelves',
    anchor: 'a wind-up rabbit, a burgundy vest, and a tiny red stage curtain',
    wardrobe: 'the burgundy vest, cream shirt, dark trousers, and polished shoes',
    spatialRule: 'follow the watchman from storefront to stockroom to theater, letting each toy open the next space',
    palette: 'toy red, cream, burgundy, brass, and midnight blue',
    camera: 'low shelf-level dollies with theatrical reveals and miniature stage wides'
  },
  {
    id: 'forgotten_theme_park_operator',
    label: 'Forgotten theme-park operator',
    subject: 'a former operator in a faded teal uniform restarting one abandoned attraction',
    setting: 'an overgrown theme park, a maintenance shed, and a silent carousel at sunset',
    anchor: 'a brass control lever, a teal uniform, and one carousel horse',
    wardrobe: 'the faded teal uniform, red scarf, work boots, and a brass name badge',
    spatialRule: 'move from gate to maintenance shed to carousel, powering each zone in sequence',
    palette: 'faded teal, overgrown green, sunset orange, brass, and dusty cream',
    camera: 'slow exploratory wides punctuated by tactile mechanical close-ups'
  },
  {
    id: 'motel_room_time_traveler',
    label: 'Motel-room time traveler',
    subject: 'a traveler in a black coat finding each motel room set in a different emotional era',
    setting: 'a single motel corridor whose rooms shift from 1950s diner warmth to future neon',
    anchor: 'a brass room key, a black coat, and the same bedside lamp in every era',
    wardrobe: 'the black coat, white shirt, dark trousers, and a silver watch that never changes',
    spatialRule: 'walk room by room toward the end of the corridor, preserving the lamp as the continuity anchor',
    palette: 'era-specific warmth bounded by black, brass, and a recurring electric blue',
    camera: 'centered corridor dolly with match cuts across decades'
  },
  {
    id: 'sunken_library_diver',
    label: 'Sunken library diver',
    subject: 'a diver in a red suit retrieving one floating book from an underwater library',
    setting: 'a flooded reading room, a submerged archive, and a surface dock at dawn',
    anchor: 'the red diving suit, a brass book clasp, and a floating page',
    wardrobe: 'the red suit, brass helmet, dark gloves, and a blue ribbon tied to the book',
    spatialRule: 'descend from reading room to archive stacks, then follow the book’s pages back toward the surface',
    palette: 'deep blue, red suit, brass, paper cream, and dawn gold',
    camera: 'weightless underwater tracking with page-level macro shots and a surface ascent'
  },
  {
    id: 'neon_tailor',
    label: 'Neon tailor',
    subject: 'a tailor in a violet apron sewing a garment that changes with the wearer’s courage',
    setting: 'a tiny tailor shop, a fitting room of mirrors, and a neon-lit street outside',
    anchor: 'a violet measuring tape, silver shears, and one unfinished jacket',
    wardrobe: 'the violet apron, black shirt, charcoal trousers, and yellow thimble',
    spatialRule: 'move from cutting table to fitting room to street, adding only one new garment detail per turn',
    palette: 'violet, neon cyan, charcoal, silver, and courage-yellow accents',
    camera: 'precise tailoring inserts paired with mirror-based character reveals'
  },
  {
    id: 'desert_bloom_cartographer',
    label: 'Desert bloom cartographer',
    subject: 'a cartographer in a green scarf mapping flowers that appear overnight in the desert',
    setting: 'a field tent, a salt flat, and a canyon where the final bloom opens',
    anchor: 'a green scarf, a red field notebook, and one violet flower',
    wardrobe: 'the green scarf, tan expedition jacket, khaki trousers, and dust-covered boots',
    spatialRule: 'plot each bloom from camp toward the canyon, following the flower colors as a route',
    palette: 'salt white, desert ochre, scarf green, notebook red, and violet bloom',
    camera: 'topographic overheads with intimate plant-level details and a canyon reveal'
  },
  {
    id: 'haunted_convenience_store',
    label: 'Haunted convenience store',
    subject: 'a night cashier in a blue apron receiving gentle advice from animated store objects',
    setting: 'a corner convenience store, its stockroom, and the parking lot beneath a flickering sign',
    anchor: 'a blue apron, a red receipt, and a humming refrigerator light',
    wardrobe: 'the blue apron, white shirt, dark trousers, and green name tag',
    spatialRule: 'move from register through stockroom to parking lot, following each object’s small intervention',
    palette: 'refrigerator cyan, receipt red, fluorescent green, black, and night violet',
    camera: 'static retail compositions interrupted by subtle object-led pushes'
  },
  {
    id: 'station_letter_writer',
    label: 'Train-station letter writer',
    subject: 'a letter writer in a tan coat composing messages that change the station’s departures',
    setting: 'an old train station, a tiled waiting room, and a platform under morning rain',
    anchor: 'a fountain pen, blue envelopes, and a departure board with one blank line',
    wardrobe: 'the tan coat, blue scarf, brown trousers, and leather satchel',
    spatialRule: 'write from waiting room to platform, delivering each envelope before the corresponding train leaves',
    palette: 'station cream, rain blue, envelope cobalt, brass, and signal red',
    camera: 'observational platform wides with intimate handwriting macro shots'
  },
  {
    id: 'rooftop_snow_globe_maker',
    label: 'Rooftop snow-globe maker',
    subject: 'a craftsperson in a red sweater building a miniature city that mirrors the skyline below',
    setting: 'a rooftop workshop, a glass snow globe, and the real city at blue hour',
    anchor: 'the glass globe, miniature lights, and a red sweater',
    wardrobe: 'the red sweater, cream shirt, dark overalls, and silver work gloves',
    spatialRule: 'move from parts table to globe to rooftop edge, aligning the miniature streets with the real ones',
    palette: 'blue hour cobalt, miniature gold, red, glass white, and concrete gray',
    camera: 'macro miniature movement matched to full-scale skyline wides'
  },
  {
    id: 'invisible_orchestra_conductor',
    label: 'Invisible orchestra conductor',
    subject: 'a conductor in a white suit leading sounds that appear as colored motion through an empty hall',
    setting: 'an empty concert hall, backstage corridors, and a city plaza after the performance',
    anchor: 'a white baton, a red music folder, and the hall’s circular chandelier',
    wardrobe: 'the white suit, black shirt, red shoes, and a silver watch',
    spatialRule: 'conduct from stage center through backstage and into the plaza, carrying the same musical gesture outward',
    palette: 'hall ivory, baton white, signal red, shadow black, and prismatic color',
    camera: 'formal stage wides that become sweeping performance orbits'
  },
  {
    id: 'lighthouse_cat_caretaker',
    label: 'Lighthouse cat caretaker',
    subject: 'a caretaker in a sea-green sweater following a clever cat between lighthouse rooms',
    setting: 'a coastal lighthouse, a cliff path, and a small keeper’s cottage',
    anchor: 'the sea-green sweater, a brass bell, and the cat’s red collar',
    wardrobe: 'the sea-green sweater, tan trousers, rubber boots, and a wool cap',
    spatialRule: 'follow the cat upward and outward, returning to the lighthouse lamp after each detour',
    palette: 'sea green, lighthouse white, brass, storm blue, and collar red',
    camera: 'cat-height tracking mixed with vertical lighthouse climbs and horizon holds'
  },
  {
    id: 'solar_street_dj',
    label: 'Solar-powered street DJ',
    subject: 'a street DJ in a yellow jacket using a portable solar rig to restore music to a dark city',
    setting: 'a blackout plaza, a rooftop solar array, and a neighborhood street party',
    anchor: 'the solar speaker, yellow jacket, and a red extension cable',
    wardrobe: 'the yellow jacket, black cargo pants, white sneakers, and mirrored sunglasses',
    spatialRule: 'move power from rooftop to plaza to street, keeping the red cable as the route marker',
    palette: 'solar yellow, blackout navy, speaker black, cable red, and party cyan',
    camera: 'energetic circular performance coverage with a rooftop-to-street descent'
  },
  {
    id: 'rainbow_bridge_locksmith',
    label: 'Rainbow bridge locksmith',
    subject: 'a locksmith in a violet coat opening colored doors that connect separated memories',
    setting: 'a rainy pedestrian bridge, a row of impossible doors, and a bright riverside path',
    anchor: 'a brass key ring, the violet coat, and one rainbow-painted lock',
    wardrobe: 'the violet coat, cream sweater, dark trousers, and orange work gloves',
    spatialRule: 'cross the bridge door by door, returning to the same central railing before each choice',
    palette: 'rain gray, violet, brass, orange, and rainbow highlights',
    camera: 'forward bridge tracking with symmetrical doorway reveals and a riverwide finale'
  },
  {
    id: 'velvet_rooftop_dancer',
    label: 'Velvet rooftop dancer',
    subject: 'a dancer in a velvet burgundy jacket rehearsing beneath a rooftop water tower',
    setting: 'a rehearsal room, a fire escape, and a rooftop above a glowing avenue',
    anchor: 'the velvet jacket, a portable mirror, and a strip of blue tape marking the floor',
    wardrobe: 'the burgundy velvet jacket, black trousers, white sneakers, and silver earrings',
    spatialRule: 'carry one repeated movement from the marked floor through the fire escape to the roof edge',
    palette: 'burgundy, rooftop blue, mirror silver, asphalt black, and avenue gold',
    camera: 'locked rehearsal frames opening into expressive orbiting performance shots'
  },
  {
    id: 'harbor_bell_collector',
    label: 'Harbor bell collector',
    subject: 'a harbor worker in an orange vest collecting bells whose tones correspond to forgotten boats',
    setting: 'a foggy harbor, a rope warehouse, and a breakwater at low tide',
    anchor: 'a brass bell, orange safety vest, and a water-stained boat ledger',
    wardrobe: 'the orange vest, navy sweater, rubber boots, and red knit cap',
    spatialRule: 'move from dock to warehouse to breakwater, sounding one bell at each geographic marker',
    palette: 'fog white, harbor navy, brass, safety orange, and tide green',
    camera: 'mist-softened wides with bell close-ups and slow breakwater tracking'
  },
  {
    id: 'mechanical_bird_tinkerer',
    label: 'Mechanical bird tinkerer',
    subject: 'a tinkerer in a brown vest repairing a mechanical bird that remembers a vanished city',
    setting: 'a cluttered workshop, a clock tower interior, and a rooftop garden',
    anchor: 'the mechanical bird, a copper screwdriver, and a blue blueprint',
    wardrobe: 'the brown vest, cream shirt, olive trousers, and copper goggles',
    spatialRule: 'repair from workbench to tower to garden, releasing the bird only after every landmark is revisited',
    palette: 'copper, blueprint blue, workshop brown, leaf green, and dawn white',
    camera: 'tactile mechanical close-ups with vertical tower climbs and a garden flight'
  },
  {
    id: 'rainbow_roller_rink',
    label: 'Rainbow roller rink',
    subject: 'a newcomer in a cyan jacket learning a shared routine from a glowing roller-rink crew',
    setting: 'a retro roller rink, its locker corridor, and an empty street after closing',
    anchor: 'cyan skates, a rainbow floor stripe, and a locker with a paper star',
    wardrobe: 'the cyan jacket, white T-shirt, violet trousers, and silver knee pads',
    spatialRule: 'start alone at the rink edge, join the circle, then carry the routine into the street',
    palette: 'rainbow neon, cyan, violet, polished wood, and streetlight amber',
    camera: 'low skating pursuit, overhead formation shots, and a final street-level glide'
  },
  {
    id: 'forest_cabin_signaler',
    label: 'Forest cabin signaler',
    subject: 'a forest ranger in a red flannel sending a sequence of lantern signals from a remote cabin',
    setting: 'a pine cabin, a snowy trail, and a ridge above a sleeping valley',
    anchor: 'a red lantern, a folded trail map, and the ranger’s flannel shirt',
    wardrobe: 'the red flannel, olive field jacket, canvas trousers, and winter boots',
    spatialRule: 'carry the lantern signal from cabin to trail to ridge, preserving the same three-beat code',
    palette: 'pine green, snow white, flannel red, lantern gold, and night blue',
    camera: 'steady forest tracking with lantern-lit close-ups and a ridgewide signal reveal'
  },
  {
    id: 'floating_bookshop_owner',
    label: 'Floating bookshop owner',
    subject: 'a bookshop owner in a mustard cardigan steering a store that drifts above the city',
    setting: 'a bookshop on a floating barge, a cloud bridge, and a rooftop reading garden',
    anchor: 'a brass shop bell, a red bookmark, and a drifting stack of books',
    wardrobe: 'the mustard cardigan, white shirt, brown trousers, and blue sneakers',
    spatialRule: 'move from shelves to barge deck to rooftop garden, keeping the red bookmark in the current book',
    palette: 'mustard, paper cream, sky blue, roof green, and bookmark red',
    camera: 'shelf-level dolly shots opening into buoyant aerial city views'
  },
  {
    id: 'tide_pool_message_carrier',
    label: 'Tide-pool message carrier',
    subject: 'a coastal messenger in a white windbreaker carrying a sealed shell from tide pool to town',
    setting: 'a rocky beach, a cliff stairway, and a fishing-town square at low tide',
    anchor: 'the sealed shell, white windbreaker, and a green cord bracelet',
    wardrobe: 'the white windbreaker, slate shorts, red boots, and green cord bracelet',
    spatialRule: 'climb from waterline to town, keeping the shell dry and facing inland after the turn',
    palette: 'sea foam, slate, white, cord green, and town-square coral',
    camera: 'low tide-line movement with long stairway ascents and a townwide handoff'
  },
  {
    id: 'museum_night_guardian',
    label: 'Museum night guardian',
    subject: 'a museum guard in a charcoal uniform noticing one sculpture move closer each night',
    setting: 'a closed modern museum, a conservation studio, and a glass atrium at sunrise',
    anchor: 'a flashlight, a silver sculpture, and a red visitor badge',
    wardrobe: 'the charcoal uniform, white shirt, black shoes, and red visitor badge',
    spatialRule: 'patrol gallery by gallery toward the atrium, marking the sculpture’s exact movement',
    palette: 'museum white, charcoal, silver, flashlight blue, and sunrise red',
    camera: 'measured security-camera geometry with intimate flashlight reveals'
  },
  {
    id: 'canal_bicycle_postman',
    label: 'Canal bicycle postman',
    subject: 'a bicycle postman in a green cap carrying one undeliverable letter through a canal city',
    setting: 'a narrow canal street, a footbridge, and a quiet waterside courtyard',
    anchor: 'the undeliverable letter, a green cap, and a red bicycle bell',
    wardrobe: 'the green cap, navy postal jacket, tan trousers, and brown cycling shoes',
    spatialRule: 'ride beside the canal toward the final courtyard, crossing the bridge only once to deliver the letter',
    palette: 'canal teal, postal red, stone cream, cap green, and evening gold',
    camera: 'smooth bicycle tracking with bridge overheads and intimate letter close-ups'
  },
  {
    id: 'desert_moon_gardener',
    label: 'Desert moon gardener',
    subject: 'a gardener in a silver scarf tending night-blooming plants beneath a desert moon',
    setting: 'a moonlit desert garden, a glass irrigation shed, and a dune overlook',
    anchor: 'a silver watering can, moon flowers, and the scarf’s reflective edge',
    wardrobe: 'the silver scarf, dark green coat, sand trousers, and soft work boots',
    spatialRule: 'water from garden beds to shed to dune, revealing one bloom at each location',
    palette: 'moon silver, desert violet, cactus green, sand gold, and flower white',
    camera: 'slow moonlit wides with botanical macro work and a final dune silhouette'
  },
  {
    id: 'city_rooftop_beekeeper',
    label: 'City rooftop beekeeper',
    subject: 'a beekeeper in a white veil carrying a small amber hive through a city morning',
    setting: 'a rooftop apiary, a service elevator, and a community garden below',
    anchor: 'the amber hive, a white veil, and a yellow rooftop marker',
    wardrobe: 'the white veil, yellow jacket, denim trousers, and tan gloves',
    spatialRule: 'descend from rooftop to garden, keeping the hive protected and the yellow marker visible',
    palette: 'honey amber, veil white, rooftop blue, leaf green, and marker yellow',
    camera: 'gentle hive macro shots, elevator vertical movement, and gardenwide pollination views'
  },
  {
    id: 'winter_window_pianist',
    label: 'Winter window pianist',
    subject: 'a pianist in a burgundy sweater practicing beside a window where snow reveals memories',
    setting: 'a warm apartment piano room, a snowy fire escape, and a dawn street below',
    anchor: 'the upright piano, a burgundy sweater, and a paper music page with one blank measure',
    wardrobe: 'the burgundy sweater, cream trousers, wool socks, and a silver pendant',
    spatialRule: 'move from keys to window to fire escape, returning to the blank measure with new understanding',
    palette: 'burgundy, piano black, snow blue, warm ivory, and dawn peach',
    camera: 'close hands-on-keyboard coverage opening to framed window tableaux'
  },
  {
    id: 'marble_statue_restorer',
    label: 'Marble statue restorer',
    subject: 'a restorer in a gray apron repairing a statue whose expression changes with each layer',
    setting: 'a museum workshop, a sculpture courtyard, and a sunlit gallery',
    anchor: 'the marble face, a gray apron, and a red restoration pencil',
    wardrobe: 'the gray apron, white shirt, dark trousers, and protective glasses',
    spatialRule: 'work from studio bench to courtyard to gallery, revealing only one restored feature per section',
    palette: 'marble white, workshop gray, pencil red, courtyard green, and gallery gold',
    camera: 'patient sculptural close-ups with measured reveal cuts and gallery wides'
  },
  {
    id: 'harbor_ferry_dreamer',
    label: 'Harbor ferry dreamer',
    subject: 'a ferry passenger in a mustard coat imagining every passing vessel as a different future',
    setting: 'a harbor ferry, a foggy terminal, and a city overlook above the water',
    anchor: 'a mustard coat, a blue ferry ticket, and the harbor horn',
    wardrobe: 'the mustard coat, gray scarf, black trousers, and red gloves',
    spatialRule: 'move from lower deck to bow to terminal, keeping the ticket pressed against the window',
    palette: 'harbor blue, mustard, fog gray, ticket red, and sodium amber',
    camera: 'slow ferry tracking, window reflections, and a broad terminal arrival'
  },
  {
    id: 'orchard_lantern_keeper',
    label: 'Orchard lantern keeper',
    subject: 'an orchard keeper in a green jacket lighting lanterns before a late frost',
    setting: 'an orchard row, a packing shed, and a hill overlooking the valley',
    anchor: 'the green jacket, a brass lantern, and one red apple',
    wardrobe: 'the green jacket, cream work shirt, brown trousers, and rubber boots',
    spatialRule: 'light each orchard row toward the hill, saving the red apple for the final tree',
    palette: 'orchard green, lantern gold, apple red, frost blue, and shed cream',
    camera: 'row-aligned tracking with lantern close-ups and an elevated valley reveal'
  },
  {
    id: 'museum_of_lost_sounds',
    label: 'Museum of lost sounds',
    subject: 'a curator in a blue blazer opening exhibits that contain vanished everyday noises',
    setting: 'a quiet museum, a soundproof archive, and a plaza where the sounds return',
    anchor: 'a blue blazer, a brass exhibit key, and a red listening button',
    wardrobe: 'the blue blazer, white blouse, black trousers, and silver headphones',
    spatialRule: 'open exhibit by exhibit toward the plaza, carrying the last sound beyond the museum door',
    palette: 'archive blue, brass, listening-button red, white, and plaza gold',
    camera: 'still gallery frames with tactile button close-ups and an expansive plaza release'
  },
  {
    id: 'rainy_rooftop_cook',
    label: 'Rainy rooftop cook',
    subject: 'a rooftop cook in a yellow apron preparing a meal for neighbors during a storm',
    setting: 'a compact kitchen, a rain-soaked rooftop, and a shared stairwell dining table',
    anchor: 'the yellow apron, a copper pot, and a string of red bulbs',
    wardrobe: 'the yellow apron, navy shirt, rolled trousers, and waterproof boots',
    spatialRule: 'carry the meal from kitchen to roof to stairwell, keeping the copper pot central to every handoff',
    palette: 'rain blue, apron yellow, copper, red bulbs, and warm food amber',
    camera: 'steam and rain macro details opening into communal overhead table shots'
  },
  {
    id: 'island_radio_sailor',
    label: 'Island radio sailor',
    subject: 'a sailor in a coral jacket repairing a radio on a small island before the tide turns',
    setting: 'a beach shack, a rocky inlet, and a signal hill above the sea',
    anchor: 'the coral jacket, a hand radio, and a green signal flag',
    wardrobe: 'the coral jacket, cream shirt, navy shorts, and deck shoes',
    spatialRule: 'move from shack to inlet to signal hill, carrying the same radio and watching the tide line',
    palette: 'coral, sea green, cream, signal green, and deep ocean blue',
    camera: 'windy handheld coastal wides with close radio repairs and a hilltop signal'
  },
  {
    id: 'library_window_watcher',
    label: 'Library window watcher',
    subject: 'a librarian in a rust cardigan noticing the same stranger appear in every window reflection',
    setting: 'a historic library, its reading room windows, and a rain-bright courtyard',
    anchor: 'a rust cardigan, a red library stamp, and a recurring window reflection',
    wardrobe: 'the rust cardigan, cream blouse, dark skirt, and round glasses',
    spatialRule: 'move shelf by shelf toward the reading room, keeping the reflection ahead of the librarian',
    palette: 'book brown, rust, rain silver, paper cream, and courtyard green',
    camera: 'quiet aisle tracking with reflection match cuts and courtyard symmetry'
  },
  {
    id: 'windmill_message_runner',
    label: 'Windmill message runner',
    subject: 'a runner in a blue scarf carrying a message between windmills across open farmland',
    setting: 'a farmhouse, a line of windmills, and a hilltop grain silo',
    anchor: 'the blue scarf, a sealed red envelope, and the windmill blades',
    wardrobe: 'the blue scarf, tan field jacket, dark trousers, and white running shoes',
    spatialRule: 'run from farmhouse to windmill to silo, using each blade rotation as a timing cue',
    palette: 'farmland green, windmill white, scarf blue, envelope red, and sky gold',
    camera: 'lateral field tracking with rhythmic blade inserts and a silo-wide finale'
  },
  {
    id: 'neon_ferry_ticket',
    label: 'Neon ferry ticket',
    subject: 'a traveler in a violet raincoat following a ticket that glows only near the right ferry',
    setting: 'a neon ferry terminal, a wet lower deck, and a glowing island dock',
    anchor: 'the glowing ticket, violet raincoat, and a green terminal sign',
    wardrobe: 'the violet raincoat, black trousers, silver boots, and yellow gloves',
    spatialRule: 'follow the ticket’s light through the terminal and deck until it points toward the island dock',
    palette: 'violet rain, terminal green, ticket gold, deck black, and island cyan',
    camera: 'reflected terminal tracking with ticket macro shots and a ferrywide departure'
  },
  {
    id: 'quiet_city_bellmaker',
    label: 'Quiet city bellmaker',
    subject: 'a bellmaker in a charcoal apron crafting one bell meant to wake an entire quiet city',
    setting: 'a bell workshop, a narrow tower stair, and a silent central square',
    anchor: 'the unfinished bell, a charcoal apron, and a red tuning hammer',
    wardrobe: 'the charcoal apron, white shirt, brown trousers, and leather gloves',
    spatialRule: 'move from forge to tower to square, carrying the bell’s tone through each vertical space',
    palette: 'charcoal, brass, forge orange, square blue, and tuning red',
    camera: 'tactile forge close-ups, spiraling tower movement, and a still squarewide resonance'
  },
  {
    id: 'prism_motel_projectionist',
    label: 'Prism motel projectionist',
    subject: 'a projectionist in a teal vest screening one film across every room of a roadside motel',
    setting: 'a motel lobby, a corridor of rooms, and a poolside screen under a starry sky',
    anchor: 'a prism projector lens, a teal vest, and a reel marked with a red star',
    wardrobe: 'the teal vest, cream shirt, dark trousers, and silver projector gloves',
    spatialRule: 'carry the projector from lobby to rooms to pool, letting the same image change each location',
    palette: 'projector cyan, motel cream, prism violet, reel red, and pool midnight blue',
    camera: 'beam-cut silhouettes, corridor tracking, and a wide poolside projection reveal'
  },
  {
    id: 'sunken_subway_gardener',
    label: 'Sunken subway gardener',
    subject: 'a gardener in an orange vest growing small trees along a retired underground train line',
    setting: 'a flooded subway platform, a maintenance tunnel, and a sunlit station entrance',
    anchor: 'a copper watering can, an orange vest, and one green sapling',
    wardrobe: 'the orange vest, gray hoodie, work trousers, and yellow rubber boots',
    spatialRule: 'plant from platform through tunnel toward the entrance, following the rails as the garden path',
    palette: 'subway green, tunnel gray, orange, sapling leaf, and entrance sunlight',
    camera: 'low rail tracking, plant-level macro shots, and a final stationwide canopy reveal'
  },
  {
    id: 'comet_mailroom_clerk',
    label: 'Comet mailroom clerk',
    subject: 'a mailroom clerk in a silver sweater sorting letters addressed to places beyond the sky',
    setting: 'a city mailroom, a rooftop sorting deck, and a small observatory beneath a comet trail',
    anchor: 'a silver sweater, a blue sorting tray, and one comet-stamped envelope',
    wardrobe: 'the silver sweater, navy trousers, white sneakers, and a red postal badge',
    spatialRule: 'sort from indoor racks to rooftop deck to observatory, following the comet envelope’s destination',
    palette: 'silver, postal red, sorting blue, midnight navy, and comet gold',
    camera: 'precise sorting-table inserts opening into rooftop skyward movement'
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
  if (!overrides || typeof overrides !== 'object') return { ...base, requiredProps: [], avoid: [], camera: base.camera || null };
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
    camera: overrides.camera || base.camera || null
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
  // Keep supplied lyric meaning in the narrative, but remove quote wrappers
  // before it reaches generator-facing prose. Quoted phrases are frequently
  // interpreted as text to render, which previously made the lyric-driven
  // narrative appear to disappear in downstream generators.
  const lyricLines = lyricReferences.map((line) => promptSafeLyricText(line.text)).filter(Boolean);
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
    ? `Place the protagonist in ${profile.setting}; establish ${profile.anchor} and make the environment express the tension in ${lyricHook}.`
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
    ? `Place ${profile.subject} in ${profile.setting}; show ${profile.anchor} in the first readable composition and use ${profile.palette} as the baseline palette while the lyric hook ${lyricHook} triggers the opening action.${requiredPropsText}${avoidText}`
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
    characterAction: `${direction.action}. Use ${lyricHook} as the immediate behavioral trigger, not as a list of text to illustrate.`,
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
      ? `Lyric moments to honor: ${lyricMoments.map((moment) => `${promptSafeLyricText(moment.text)} (${moment.startSeconds.toFixed(3)}-${moment.endSeconds.toFixed(3)}s)`).join(' | ')}.`
      : '';
    const lyricDirection = lyricReferences.length
      ? `Lyric-driven visual direction: translate these supplied lines into visible action, props, and character behavior: ${lyricReferences.map((line) => promptSafeLyricText(line.text)).filter(Boolean).join(' | ')}. Use acoustically aligned timing where marked; otherwise treat the lyric window as approximate and preserve narrative order.`
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

const SHOT_TARGET_SECONDS = { coarse: 20, standard: 8, dense: 5 };
const SHOT_ROLE_LANGUAGE = {
  establish: 'Establish the geography and subject in one readable composition.',
  action: 'Show one specific character action that changes the immediate story state.',
  detail: 'Use one focused visual detail or insert that carries the established motif.',
  transition: 'Create one clear transition that carries the character and continuity into the next shot.',
  payoff: 'Deliver one memorable visual payoff for this section without changing the established world.'
};

function shotTargetSeconds(granularity = 'standard') {
  return SHOT_TARGET_SECONDS[granularity] || SHOT_TARGET_SECONDS.standard;
}

function allocateShotCounts(scenes, granularity = 'standard', maxShots = 40) {
  if (!scenes.length) return [];
  const targetSeconds = shotTargetSeconds(granularity);
  const durations = scenes.map((scene) => Math.max(0.001, Number(scene.endSeconds) - Number(scene.startSeconds)));
  const totalDuration = durations.reduce((sum, value) => sum + value, 0);
  const desired = Math.min(maxShots, Math.max(scenes.length, Math.ceil(totalDuration / targetSeconds)));
  const ideal = durations.map((duration) => duration / targetSeconds);
  const counts = ideal.map((value) => Math.max(1, Math.floor(value)));
  const rank = (index) => ideal[index] - counts[index];
  while (counts.reduce((sum, value) => sum + value, 0) < desired) {
    const index = counts.map((_, candidate) => candidate).sort((left, right) => rank(right) - rank(left))[0];
    counts[index] += 1;
  }
  while (counts.reduce((sum, value) => sum + value, 0) > desired) {
    const candidates = counts.map((count, index) => ({ count, index })).filter((item) => item.count > 1);
    if (!candidates.length) break;
    const index = candidates.sort((left, right) => rank(left.index) - rank(right.index))[0].index;
    counts[index] -= 1;
  }
  return counts;
}

function shotRoleFor(scene, shotIndex, shotCount) {
  if (shotCount === 1) return scene.narrative?.arcRole === 'visual payoff' ? 'payoff' : 'establish';
  if (shotIndex === 0) return 'establish';
  if (shotIndex === shotCount - 1) {
    return ['visual payoff', 'resolution or suspended ending', 'reintegrated resolution', 'cinematic resolution'].includes(scene.narrative?.arcRole) ? 'payoff' : 'transition';
  }
  if (shotCount >= 4 && shotIndex === 1) return 'detail';
  return 'action';
}

function shotCameraFor(scene, role, shotIndex) {
  const raw = String(scene.shotLanguage || scene.narrative?.camera || scene.camera?.shot || 'single-camera coverage').trim();
  if (scene.shotLanguage) return raw;
  const fragments = raw.split(/\s*(?:,|;|\bthen\b|\bfollowed by\b)\s*/i).map((item) => item.trim().replace(/^(and|then)\s+/i, '')).filter(Boolean);
  const selected = role === 'establish'
    ? fragments[0]
    : role === 'payoff'
      ? fragments.at(-1)
      : fragments[Math.min(Math.max(shotIndex, 1), fragments.length - 1)];
  const shotType = { establish: 'wide establishing shot', action: 'medium action shot', detail: 'close insert shot', transition: 'transitional tracking shot', payoff: 'wide payoff shot' }[role] || 'single-camera shot';
  return `${shotType} using ${selected || raw}`;
}

function lyricCueForShot(scene, shotIndex, shotCount) {
  const cues = [...(scene.lyricMoments || []), ...(scene.lyricReferences || [])].filter((item, index, items) => item?.text && items.findIndex((candidate) => candidate.text === item.text) === index);
  if (!cues.length) return null;
  return cues[Math.min(cues.length - 1, Math.floor((shotIndex * cues.length) / shotCount))];
}

// Lyric lines are references for visual direction, not title cards. Keep the
// prompt text free of quote wrappers because some generators interpret quoted
// phrases as text that should be rendered on screen.
function promptSafeLyricText(value) {
  return String(value || '').replace(/[\u0022\u201c\u201d]/g, '').replace(/\s+/g, ' ').trim();
}

function kissSafeLyricText(value) {
  return promptSafeLyricText(value)
    .replace(/\[(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]/g, ' ')
    .replace(/\[(?:intro|outro|verse|pre-chorus|chorus|bridge|hook|refrain|breakdown|prelude|interlude)(?:\s+\d+)?\]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildKissPrompt({ creative = {} } = {}) {
  const lyrics = kissSafeLyricText(creative.lyrics);
  const brief = promptSafeLyricText(creative.brief);
  const source = lyrics ? `Use these lyrics as the story source: ${lyrics}.` : 'Use the supplied song and creative intent as the story source.';
  const intent = brief ? `Creative intent: ${brief}.` : '';
  return `K.I.S.S.: ${source} ${intent} Turn it into one clear, emotionally coherent narrative for a music video: follow one subject with a concrete desire, an obstacle, a turning point, and a changed ending; turn recurring images into visible choices and action, preserve continuity, and communicate through imagery rather than written words. Return only a compact prose story with no quoted lyric lines, captions, timing markers, or extra prompt sections.`.replace(/\s+/g, ' ').trim();
}

function listParts(value) {
  return String(value || '').split(/\s*,\s*|\s+and\s+/i).map((item) => item.trim().replace(/^(and|then)\s+/i, '')).filter(Boolean);
}

function shotLocationFor(scene, shotIndex, shotCount) {
  const locations = listParts(scene.narrative?.setting);
  return locations[Math.min(locations.length - 1, Math.floor((shotIndex * locations.length) / shotCount))] || scene.narrative?.setting || 'the established setting';
}

function shotAnchorFor(scene, shotIndex, shotCount) {
  const anchors = listParts(scene.narrative?.anchor);
  return anchors[Math.min(anchors.length - 1, Math.floor((shotIndex * anchors.length) / shotCount))] || scene.narrative?.anchor || 'the established visual anchor';
}

export function generateShotPlan({ scenes = [], granularity = 'standard', maxShots = 40 } = {}) {
  if (!Array.isArray(scenes) || !scenes.length) return [];
  const counts = allocateShotCounts(scenes, granularity, maxShots);
  let sequence = 0;
  return scenes.flatMap((scene, sceneIndex) => {
    const count = counts[sceneIndex] || 1;
    const start = Number(scene.startSeconds) || 0;
    const end = Number(scene.endSeconds) || start;
    const duration = Math.max(0, end - start);
    return Array.from({ length: count }, (_, shotIndex) => {
      sequence += 1;
      const shotStart = start + (duration * shotIndex) / count;
      const shotEnd = shotIndex === count - 1 ? end : start + (duration * (shotIndex + 1)) / count;
      const role = shotRoleFor(scene, shotIndex, count);
      const camera = shotCameraFor(scene, role, shotIndex);
      const lyricCue = lyricCueForShot(scene, shotIndex, count);
      const narrative = scene.narrative || {};
      const location = shotLocationFor(scene, shotIndex, count);
      const anchor = shotAnchorFor(scene, shotIndex, count);
      const continuity = `Continuity lock: ${narrative.subject}. Wardrobe: ${narrative.wardrobe}. Current location: ${location}. Current anchor: ${anchor}. Palette: ${narrative.palette}.`;
      const lyricText = lyricCue ? promptSafeLyricText(lyricCue.text) : '';
      const lyricDirection = lyricText ? `Respond visually to the lyric moment: ${lyricText}; make it behavior or visible action, not on-screen text.` : 'Let the section\'s emotional turn drive one visible character action.';
      const prompt = `${SHOT_ROLE_LANGUAGE[role]} ${continuity} In ${location}, show ${narrative.subject} interacting with ${anchor}. ${lyricDirection} Camera: ${camera}. Lighting: ${scene.lighting}. Preserve the spatial rule: ${narrative.spatialRule}. Use one continuous camera setup in this location and do not introduce a second location or character design.`.replace(/\s+/g, ' ').trim();
      return {
        id: `shot_${String(sequence).padStart(2, '0')}`,
        sceneBlockId: scene.id,
        sceneBlockIndex: sceneIndex,
        sceneShotIndex: shotIndex + 1,
        sceneShotCount: count,
        sectionId: scene.sectionId,
        sectionLabel: scene.sectionLabel,
        startSeconds: Number(shotStart.toFixed(3)),
        endSeconds: Number(shotEnd.toFixed(3)),
        durationSeconds: Number((shotEnd - shotStart).toFixed(3)),
        role,
        prompt,
        negativePrompt: scene.negativePrompt,
        camera: { shot: camera, movement: camera },
        lighting: scene.lighting,
        lyricCue: lyricCue ? { text: lyricCue.text, source: lyricCue.source, provenance: lyricCue.provenance, timing: lyricCue.timing } : null,
        continuityRefs: scene.continuityRefs,
        provenance: { ...scene.provenance, shot: 'default_proposal' }
      };
    });
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
