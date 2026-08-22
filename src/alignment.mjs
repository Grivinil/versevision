function normalizeLabel(value) {
  const label = value.toLowerCase().replace(/\s+/g, '-');
  if (label.startsWith('intro')) return 'intro';
  if (label.startsWith('verse')) return 'verse';
  if (label.startsWith('pre-chorus')) return 'pre-chorus';
  if (label.startsWith('chorus') || label.startsWith('hook') || label.startsWith('refrain')) return 'chorus';
  if (label.startsWith('bridge')) return 'bridge';
  if (label.startsWith('outro')) return 'outro';
  return 'verse';
}

function parseLyrics(lyrics) {
  if (typeof lyrics !== 'string' || !lyrics.trim()) return [];
  const sections = [];
  let current = { label: 'verse', lines: [] };
  for (const rawLine of lyrics.split(/\r?\n/)) {
    const line = rawLine.trim();
    const tag = line.match(/^\[([^\]]+)\]$/);
    if (tag) {
      if (current.lines.length) sections.push(current);
      current = { label: normalizeLabel(tag[1]), lines: [] };
    } else if (line) {
      current.lines.push(line);
    } else if (current.lines.length) {
      sections.push(current);
      current = { label: current.label, lines: [] };
    }
  }
  if (current.lines.length) sections.push(current);
  return sections;
}

function syllableWeight(word) {
  const letters = word.toLowerCase().replace(/[^a-z]/g, '');
  const groups = letters.match(/[aeiouy]+/g);
  return Math.max(1, groups ? groups.length : 1);
}

function lineWeight(line) {
  return line.split(/\s+/).filter(Boolean).reduce((sum, word) => sum + syllableWeight(word), 0);
}

function snapToBeat(value, beatGrid, minimum, maximum) {
  const interval = beatGrid?.intervalSeconds;
  if (!Number.isFinite(interval) || interval <= 0) return value;
  const snapped = Math.round(value / interval) * interval;
  return Math.min(maximum, Math.max(minimum, snapped));
}

function mapLyricsToAudioSections(lyricSections, audioSections, durationSeconds) {
  if (!audioSections.length) return lyricSections.map((section, index) => ({ lyric: section, audio: { id: `full_track_${String(index + 1).padStart(2, '0')}`, label: 'full', startSeconds: 0, endSeconds: durationSeconds } }));
  const used = new Set();
  return lyricSections.map((section, index) => {
    const expected = lyricSections.length === 1 ? 0 : Math.round((index * (audioSections.length - 1)) / (lyricSections.length - 1));
    let target = Math.min(audioSections.length - 1, expected);
    if (used.has(target)) {
      const available = audioSections
        .map((_, candidate) => candidate)
        .filter((candidate) => !used.has(candidate))
        .sort((left, right) => Math.abs(left - expected) - Math.abs(right - expected));
      if (available.length) target = available[0];
    }
    used.add(target);
    return { lyric: section, audio: audioSections[target] };
  });
}

function alignLines({ lyricSection, audioSection, beatGrid, source }) {
  const totalDuration = Math.max(0.001, audioSection.endSeconds - audioSection.startSeconds);
  const weights = lyricSection.lines.map(lineWeight);
  const totalWeight = Math.max(1, weights.reduce((sum, value) => sum + value, 0));
  let cursor = audioSection.startSeconds;
  const lines = lyricSection.lines.map((text, index) => {
    const rawEnd = audioSection.startSeconds + totalDuration * (weights.slice(0, index + 1).reduce((sum, value) => sum + value, 0) / totalWeight);
    const start = index === 0 ? audioSection.startSeconds : snapToBeat(cursor, beatGrid, audioSection.startSeconds, audioSection.endSeconds);
    const end = index === lyricSection.lines.length - 1 ? audioSection.endSeconds : Math.max(start + 0.05, snapToBeat(rawEnd, beatGrid, start + 0.05, audioSection.endSeconds));
    cursor = end;
    const words = text.split(/\s+/).filter(Boolean);
    const wordWeights = words.map(syllableWeight);
    const wordTotal = Math.max(1, wordWeights.reduce((sum, value) => sum + value, 0));
    let wordCursor = start;
    const wordItems = words.map((word, wordIndex) => {
      const wordEnd = wordIndex === words.length - 1 ? end : start + (end - start) * (wordWeights.slice(0, wordIndex + 1).reduce((sum, value) => sum + value, 0) / wordTotal);
      const item = { text: word, startSeconds: Number(wordCursor.toFixed(3)), endSeconds: Number(Math.max(wordCursor + 0.01, wordEnd).toFixed(3)), confidence: source === 'provided' ? 0.34 : 0.25, source: 'meter_estimate' };
      wordCursor = wordEnd;
      return item;
    });
    return { text, startSeconds: Number(start.toFixed(3)), endSeconds: Number(end.toFixed(3)), confidence: source === 'provided' ? 0.42 : 0.3, source: 'meter_estimate', words: wordItems };
  });
  return lines;
}

export function alignLyrics({ lyrics, lyricsSource = 'provided', sections = [], beatGrid, durationSeconds } = {}) {
  const lyricSections = parseLyrics(lyrics);
  if (!lyricSections.length || !Number.isFinite(durationSeconds)) return null;
  const audioSections = sections.map((section) => ({ ...section }));
  const mapped = mapLyricsToAudioSections(lyricSections, audioSections, durationSeconds);
  const alignedSections = mapped.map(({ lyric, audio }) => ({
    audioSectionId: audio.id,
    label: lyric.label,
    startSeconds: audio.startSeconds,
    endSeconds: audio.endSeconds,
    confidence: lyricsSource === 'provided' ? 0.42 : 0.3,
    lines: alignLines({ lyricSection: lyric, audioSection: audio, beatGrid, source: lyricsSource })
  }));
  return {
    mode: 'meter_estimate',
    source: 'beat_and_text_distribution',
    backend: 'meter_estimate',
    confidence: lyricsSource === 'provided' ? 0.38 : 0.26,
    sections: alignedSections,
    lineCount: alignedSections.reduce((sum, section) => sum + section.lines.length, 0),
    wordCount: alignedSections.reduce((sum, section) => sum + section.lines.reduce((lineSum, line) => lineSum + line.words.length, 0), 0),
    warnings: [{ code: 'alignment_provisional', message: 'Line and word timing is estimated from text weight and beat spacing; acoustic forced alignment is not configured.' }]
  };
}
