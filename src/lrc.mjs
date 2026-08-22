const LRC_VERSION = 'VerseVision 0.1';

function finiteSeconds(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : null;
}

export function formatLrcTimestamp(value) {
  const seconds = finiteSeconds(value) ?? 0;
  const centiseconds = Math.round(seconds * 100);
  const minutes = Math.floor(centiseconds / 6000);
  const remainder = centiseconds % 6000;
  const wholeSeconds = Math.floor(remainder / 100);
  const fraction = remainder % 100;
  return `[${String(minutes).padStart(2, '0')}:${String(wholeSeconds).padStart(2, '0')}.${String(fraction).padStart(2, '0')}]`;
}

function cleanLyrics(lyrics) {
  if (typeof lyrics !== 'string') return [];
  return lyrics.split(/\r?\n/)
    .map((text) => text.trim())
    .filter((text) => text && !/^\[[^\]]+\]$/.test(text));
}

function alignedLines(alignment) {
  return (alignment?.sections || [])
    .flatMap((section) => section.lines || [])
    .filter((line) => typeof line.text === 'string' && line.text.trim())
    .sort((left, right) => (finiteSeconds(left.startSeconds) ?? 0) - (finiteSeconds(right.startSeconds) ?? 0));
}

function acousticLine(line, alignment) {
  const source = String(line.source || alignment?.source || alignment?.backend || '').toLowerCase();
  return source.includes('acoustic') || alignment?.mode === 'acoustic_forced' || alignment?.backend === 'acoustic_forced';
}

function fallbackStart(index, count, durationSeconds) {
  const duration = finiteSeconds(durationSeconds);
  if (!duration || count < 1) return 0;
  return (duration * index) / count;
}

function buildLineRecords({ alignment, lyrics, durationSeconds }) {
  const measured = alignedLines(alignment);
  const supplied = cleanLyrics(lyrics);
  if (!supplied.length) {
    return measured.map((line) => ({
      ...line,
      text: line.text.trim(),
      startSeconds: finiteSeconds(line.startSeconds) ?? 0,
      timing: acousticLine(line, alignment) ? 'acoustic' : 'approximate'
    }));
  }

  const unused = measured.map((line, index) => ({ line, index, used: false }));
  return supplied.map((text, index) => {
    const match = unused.find((item) => !item.used && item.line.text.trim().toLowerCase() === text.toLowerCase());
    if (match) {
      match.used = true;
      return {
        ...match.line,
        text,
        startSeconds: finiteSeconds(match.line.startSeconds) ?? fallbackStart(index, supplied.length, durationSeconds),
        timing: acousticLine(match.line, alignment) ? 'acoustic' : 'approximate'
      };
    }
    return {
      text,
      startSeconds: fallbackStart(index, supplied.length, durationSeconds),
      timing: 'approximate',
      source: 'provided_lyrics_reference',
      words: []
    };
  });
}

function wordTimedLine(line) {
  const words = (line.words || [])
    .filter((word) => typeof word.text === 'string' && word.text.trim() && finiteSeconds(word.startSeconds) !== null)
    .map((word) => ({ ...word, text: word.text.trim().replace(/\s+/g, ' ') }));
  if (line.timing !== 'acoustic' || words.length < 2) return `${formatLrcTimestamp(line.startSeconds)}${line.text}`;
  return `${formatLrcTimestamp(line.startSeconds)}${words.map((word) => `<${formatLrcTimestamp(word.startSeconds).slice(1, -1)}>${word.text}`).join(' ')}`;
}

function header(title) {
  const lines = [`[by:VerseVision]`, `[ve:${LRC_VERSION}]`];
  if (title) lines.push(`[ti:${String(title).replace(/[\r\n\]]/g, ' ').trim()}]`);
  return lines;
}

export function buildLyricArtifacts({ alignment, lyrics, durationSeconds, title } = {}) {
  const lines = buildLineRecords({ alignment, lyrics, durationSeconds });
  const standardLines = lines.map((line) => `${formatLrcTimestamp(line.startSeconds)}${line.text}`);
  const enhancedLines = lines.map(wordTimedLine);
  const approximateLineCount = lines.filter((line) => line.timing !== 'acoustic').length;
  const wordTimedLineCount = lines.filter((line) => line.timing === 'acoustic' && (line.words || []).filter((word) => finiteSeconds(word.startSeconds) !== null).length >= 2).length;
  const metadata = {
    format: 'lrc',
    lineCount: lines.length,
    wordTimedLineCount,
    approximateLineCount,
    timingBasis: approximateLineCount ? (wordTimedLineCount ? 'mixed_acoustic_and_approximate' : 'approximate') : 'acoustic'
  };
  return {
    lrc: [...header(title), ...standardLines].join('\n') + (lines.length ? '\n' : ''),
    enhancedLrc: [...header(title), ...enhancedLines].join('\n') + (lines.length ? '\n' : ''),
    lrcMetadata: metadata
  };
}
