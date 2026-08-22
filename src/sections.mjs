function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function quantile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))];
}

function smooth(values) {
  return values.map((_, index) => {
    const start = Math.max(0, index - 2);
    const end = Math.min(values.length, index + 3);
    const window = values.slice(start, end);
    return window.reduce((sum, value) => sum + value, 0) / window.length;
  });
}

function nearestEnergyMinimum(values, index, radius) {
  const start = Math.max(1, index - radius);
  const end = Math.min(values.length - 2, index + radius);
  let best = index;
  for (let candidate = start; candidate <= end; candidate += 1) {
    if (values[candidate] < values[best]) best = candidate;
  }
  return best;
}

function normalizeLabel(value) {
  const label = value.toLowerCase().replace(/\s+/g, '-');
  if (label.startsWith('intro')) return 'intro';
  if (label.startsWith('verse')) return 'verse';
  if (label.startsWith('pre-chorus')) return 'pre-chorus';
  if (label.startsWith('chorus') || label.startsWith('hook') || label.startsWith('refrain')) return 'chorus';
  if (label.startsWith('bridge')) return 'bridge';
  if (label.startsWith('outro')) return 'outro';
  return null;
}

function lyricHints(lyrics) {
  if (typeof lyrics !== 'string' || !lyrics.trim()) return { hints: [], mode: null };
  const tagged = [...lyrics.matchAll(/^\s*\[([^\]]+)\]\s*$/gm)]
    .map((match) => normalizeLabel(match[1]))
    .filter(Boolean);
  if (tagged.length >= 2) return { hints: tagged, mode: 'tagged' };

  const blocks = lyrics.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  if (blocks.length < 3) return { hints: [], mode: null };
  const normalized = blocks.map((block) => block.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim());
  const counts = new Map();
  normalized.forEach((block) => counts.set(block, (counts.get(block) || 0) + 1));
  const hints = normalized.map((block, index) => counts.get(block) >= 2 ? 'chorus' : index === 0 ? 'intro' : null);
  return { hints, mode: hints.some(Boolean) ? 'repeated_blocks' : null };
}

function applyLyricHints(sections, lyrics, lyricsSource = 'provided') {
  const { hints, mode } = lyricHints(lyrics);
  if (!hints.length || !mode || !sections.length) return { sections, mode: null };
  const output = sections.map((section) => ({ ...section }));
  const used = new Set();
  hints.forEach((hint, index) => {
    if (!hint) return;
    const expected = hints.length === 1 ? 0 : Math.round((index * (output.length - 1)) / (hints.length - 1));
    let target = expected;
    while (used.has(target) && target < output.length - 1) target += 1;
    if (used.has(target)) return;
    used.add(target);
    const confidence = lyricsSource === 'auto_tag' ? 0.58 : mode === 'tagged' ? 0.72 : 0.58;
    output[target] = { ...output[target], label: hint, id: `${hint.replace('-', '_')}_${String(target + 1).padStart(2, '0')}`, confidence: Number(confidence.toFixed(3)) };
  });
  return { sections: output, mode };
}

export function classifySections({ energyCurve = [], durationSeconds, lyrics, lyricsSource = 'provided' } = {}) {
  if (!Number.isFinite(durationSeconds) || durationSeconds < 20 || energyCurve.length < 8) return [];
  const values = energyCurve.map((point) => clamp(Number(point.value) || 0, 0, 1));
  const filtered = smooth(values);
  const segmentCount = clamp(Math.round(durationSeconds / 32), 3, 12);
  const boundaryRadius = Math.max(2, Math.round(4 / Math.max(durationSeconds / values.length, 1)));
  const boundaries = [0];
  for (let segment = 1; segment < segmentCount; segment += 1) {
    const expected = Math.round((segment * values.length) / segmentCount);
    const candidate = nearestEnergyMinimum(filtered, expected, boundaryRadius);
    const previous = boundaries[boundaries.length - 1];
    if (candidate - previous >= 6 && values.length - candidate >= 6) boundaries.push(candidate);
  }
  boundaries.push(values.length);

  const segments = [];
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const startIndex = boundaries[index];
    const endIndex = boundaries[index + 1];
    const slice = values.slice(startIndex, endIndex);
    const meanEnergy = slice.reduce((sum, value) => sum + value, 0) / Math.max(1, slice.length);
    segments.push({ index, startIndex, endIndex, meanEnergy, startSeconds: startIndex * (durationSeconds / values.length), endSeconds: Math.min(durationSeconds, endIndex * (durationSeconds / values.length)) });
  }
  if (segments.length < 2) return [];

  const means = segments.map((segment) => segment.meanEnergy);
  const highThreshold = quantile(means, 0.7);
  const median = quantile(means, 0.5);
  const highestInterior = segments.slice(1, -1).reduce((best, segment) => segment.meanEnergy > best.meanEnergy ? segment : best, segments[1]);
  const labels = segments.map((segment, index) => {
    const isFirst = index === 0;
    const isLast = index === segments.length - 1;
    const isShortOpening = isFirst && (segment.endSeconds <= 32 || segment.meanEnergy <= median * 0.8);
    const isShortEnding = isLast && (durationSeconds - segment.startSeconds <= 32 || segment.meanEnergy <= median * 0.8);
    let label = 'verse';
    if (isShortOpening) label = 'intro';
    else if (isShortEnding) label = 'outro';
    else if (segment.meanEnergy >= highThreshold && segment.meanEnergy >= median + 0.04) label = 'chorus';
    else if (segment === highestInterior && segment.meanEnergy >= median + 0.06) label = 'chorus';
    else if (index === Math.floor(segments.length / 2) && segment.meanEnergy < median - 0.04) label = 'bridge';
    const separation = Math.abs(segment.meanEnergy - median);
    const confidence = Number(clamp(0.38 + separation * 0.8, 0.38, 0.78).toFixed(3));
    return {
      id: `${label}_${String(index + 1).padStart(2, '0')}`,
      label,
      startSeconds: Number(segment.startSeconds.toFixed(3)),
      endSeconds: Number(segment.endSeconds.toFixed(3)),
      confidence
    };
  });
  return applyLyricHints(labels, lyrics, lyricsSource).sections;
}

export function sectionLabelSource(lyrics) {
  return lyricHints(lyrics).mode;
}

export function suggestLyricsTags(lyrics) {
  if (typeof lyrics !== 'string' || !lyrics.trim()) return { mode: 'none', text: lyrics || '', suggestions: [] };
  if (/^\s*\[[^\]]+\]\s*$/m.test(lyrics)) return { mode: 'provided', text: lyrics, suggestions: [] };
  let blocks = lyrics.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  if (blocks.length < 2) {
    const lines = lyrics.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const blockSize = Math.max(2, Math.ceil(lines.length / 3));
    blocks = [];
    for (let index = 0; index < lines.length; index += blockSize) blocks.push(lines.slice(index, index + blockSize).join('\n'));
  }
  const normalized = blocks.map((block) => block.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim());
  const counts = new Map();
  normalized.forEach((block) => counts.set(block, (counts.get(block) || 0) + 1));
  let verseNumber = 1;
  const suggestions = blocks.map((block, index) => {
    const repeated = counts.get(normalized[index]) >= 2;
    const label = repeated ? 'Chorus' : index === 0 ? 'Verse 1' : index === blocks.length - 1 && blocks.length >= 3 ? 'Outro' : `Verse ${++verseNumber}`;
    return { label, confidence: repeated ? 0.65 : 0.34, reason: repeated ? 'repeated lyric block' : 'prose order and block position' };
  });
  return {
    mode: 'auto_tag',
    text: blocks.map((block, index) => `[${suggestions[index].label}]\n${block}`).join('\n\n'),
    suggestions
  };
}

export function prepareLyrics(lyrics, lyricsMode = 'provided') {
  if (lyricsMode === 'auto_tag') return suggestLyricsTags(lyrics);
  if (typeof lyrics !== 'string' || !lyrics.trim()) return { mode: 'none', text: lyrics || '', suggestions: [] };
  return { mode: 'provided', text: lyrics, suggestions: [] };
}
