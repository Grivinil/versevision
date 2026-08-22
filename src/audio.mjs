import { MPEGDecoder } from 'mpg123-decoder';
import { alignLyrics } from './alignment.mjs';
import { alignLyricsWithBackend } from './alignment-backend.mjs';
import { classifySections, prepareLyrics } from './sections.mjs';

export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
export const MAX_AUDIO_SECONDS = 300;

export const SUPPORTED_AUDIO_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/x-m4a'
]);

const MIME_BY_EXTENSION = new Map([
  ['.mp3', 'audio/mpeg'],
  ['.wav', 'audio/wav'],
  ['.m4a', 'audio/mp4']
]);

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function asBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  return null;
}

export function inferMimeType(filename = '') {
  const dot = filename.lastIndexOf('.');
  if (dot < 0) return null;
  return MIME_BY_EXTENSION.get(filename.slice(dot).toLowerCase()) || null;
}

export function validateAudioInput({ buffer, mimeType, filename } = {}) {
  const errors = [];
  const bytes = asBuffer(buffer);
  const normalizedMimeType = (mimeType || inferMimeType(filename) || '').split(';')[0].trim().toLowerCase();

  if (!bytes) errors.push({ path: 'audio', code: 'invalid_audio', message: 'audio must be a Buffer or Uint8Array' });
  else if (bytes.length === 0) errors.push({ path: 'audio', code: 'empty_audio', message: 'audio cannot be empty' });
  else if (bytes.length > MAX_AUDIO_BYTES) errors.push({ path: 'audio', code: 'media_too_large', message: `audio must be ${MAX_AUDIO_BYTES} bytes or smaller` });

  if (!SUPPORTED_AUDIO_MIME_TYPES.has(normalizedMimeType)) {
    errors.push({ path: 'mimeType', code: 'unsupported_media', message: 'supported formats are MP3, WAV, and M4A' });
  }

  return { ok: errors.length === 0, errors, bytes: bytes?.length || 0, mimeType: normalizedMimeType };
}

function readFourCc(buffer, offset) {
  return buffer.toString('ascii', offset, offset + 4);
}

export function parseWav(buffer) {
  const bytes = asBuffer(buffer);
  if (!bytes || bytes.length < 44 || readFourCc(bytes, 0) !== 'RIFF' || readFourCc(bytes, 8) !== 'WAVE') {
    throw new Error('invalid WAV container');
  }

  let offset = 12;
  let format = null;
  let data = null;
  while (offset + 8 <= bytes.length) {
    const id = readFourCc(bytes, offset);
    const size = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + size;
    if (end > bytes.length) throw new Error('truncated WAV chunk');
    if (id === 'fmt ' && size >= 16) {
      format = {
        audioFormat: bytes.readUInt16LE(start),
        channels: bytes.readUInt16LE(start + 2),
        sampleRate: bytes.readUInt32LE(start + 4),
        byteRate: bytes.readUInt32LE(start + 8),
        blockAlign: bytes.readUInt16LE(start + 12),
        bitsPerSample: bytes.readUInt16LE(start + 14)
      };
    } else if (id === 'data') {
      data = { offset: start, size };
    }
    offset = end + (size % 2);
  }

  if (!format || !data) throw new Error('WAV must contain fmt and data chunks');
  if (format.audioFormat !== 1) throw new Error('only uncompressed PCM WAV is supported for native analysis');
  if (!format.channels || !format.sampleRate || !format.blockAlign || !format.byteRate) throw new Error('invalid WAV format metadata');

  return {
    ...format,
    dataOffset: data.offset,
    dataBytes: data.size,
    durationSeconds: data.size / format.byteRate
  };
}

function readPcmSample(buffer, offset, bitsPerSample) {
  if (bitsPerSample === 8) return (buffer.readUInt8(offset) - 128) / 128;
  if (bitsPerSample === 16) return buffer.readInt16LE(offset) / 32768;
  if (bitsPerSample === 24) {
    let value = buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
    if (value & 0x800000) value |= 0xff000000;
    return value / 8388608;
  }
  if (bitsPerSample === 32) return buffer.readInt32LE(offset) / 2147483648;
  throw new Error('unsupported PCM bit depth');
}

function buildEnergyCurve(buffer, wav) {
  const bytesPerSample = wav.bitsPerSample / 8;
  const frameCount = Math.floor(wav.dataBytes / wav.blockAlign);
  const windowFrames = Math.max(1, Math.floor(wav.sampleRate));
  const curve = [];
  for (let frame = 0; frame < frameCount; frame += windowFrames) {
    const end = Math.min(frameCount, frame + windowFrames);
    let sum = 0;
    for (let index = frame; index < end; index += 1) {
      const sampleOffset = wav.dataOffset + index * wav.blockAlign;
      const sample = readPcmSample(buffer, sampleOffset, wav.bitsPerSample);
      sum += sample * sample;
    }
    curve.push({ timeSeconds: frame / wav.sampleRate, raw: Math.sqrt(sum / Math.max(1, end - frame)) });
  }
  const maximum = Math.max(...curve.map((item) => item.raw), 0.000001);
  return curve.map(({ timeSeconds, raw }) => ({ timeSeconds, value: Number(clamp(raw / maximum, 0, 1).toFixed(4)) }));
}

function buildOnsetEnvelope(buffer, wav) {
  const bytesPerSample = wav.bitsPerSample / 8;
  const frameCount = Math.floor(wav.dataBytes / wav.blockAlign);
  const windowFrames = Math.max(1, Math.floor(wav.sampleRate * 0.02));
  const envelope = [];
  let previous = 0;
  for (let frame = 0; frame < frameCount; frame += windowFrames) {
    const end = Math.min(frameCount, frame + windowFrames);
    let sum = 0;
    for (let index = frame; index < end; index += 1) {
      const sampleOffset = wav.dataOffset + index * wav.blockAlign;
      const sample = readPcmSample(buffer, sampleOffset, wav.bitsPerSample);
      sum += sample * sample;
    }
    const rms = Math.sqrt(sum / Math.max(1, end - frame));
    envelope.push(Math.max(0, rms - previous));
    previous = rms;
  }
  return envelope;
}

function buildEnergyCurveFromSamples(samples, sampleRate) {
  const windowFrames = Math.max(1, Math.floor(sampleRate));
  const curve = [];
  for (let frame = 0; frame < samples.length; frame += windowFrames) {
    const end = Math.min(samples.length, frame + windowFrames);
    let sum = 0;
    for (let index = frame; index < end; index += 1) sum += samples[index] * samples[index];
    curve.push({ timeSeconds: frame / sampleRate, raw: Math.sqrt(sum / Math.max(1, end - frame)) });
  }
  const maximum = Math.max(...curve.map((item) => item.raw), 0.000001);
  return curve.map(({ timeSeconds, raw }) => ({ timeSeconds, value: Number(clamp(raw / maximum, 0, 1).toFixed(4)) }));
}

function buildOnsetEnvelopeFromSamples(samples, sampleRate) {
  const windowFrames = Math.max(1, Math.floor(sampleRate * 0.02));
  const envelope = [];
  let previous = 0;
  for (let frame = 0; frame < samples.length; frame += windowFrames) {
    const end = Math.min(samples.length, frame + windowFrames);
    let sum = 0;
    for (let index = frame; index < end; index += 1) sum += samples[index] * samples[index];
    const rms = Math.sqrt(sum / Math.max(1, end - frame));
    envelope.push(Math.max(0, rms - previous));
    previous = rms;
  }
  return envelope;
}

function estimateBpm(envelope, sampleRate) {
  const totalEnergy = envelope.reduce((sum, value) => sum + value, 0);
  if (totalEnergy < 0.01 || envelope.length < sampleRate * 2) return null;

  const mean = totalEnergy / envelope.length;
  const variance = envelope.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / envelope.length;
  const threshold = mean + Math.sqrt(variance) * 0.35;
  const minimumPeakDistance = Math.max(1, Math.floor(sampleRate * 0.25));
  const peaks = [];
  for (let index = 1; index < envelope.length - 1; index += 1) {
    if (envelope[index] < threshold || envelope[index] < envelope[index - 1] || envelope[index] < envelope[index + 1]) continue;
    if (peaks.length && index - peaks[peaks.length - 1] < minimumPeakDistance) {
      if (envelope[index] > envelope[peaks[peaks.length - 1]]) peaks[peaks.length - 1] = index;
      continue;
    }
    peaks.push(index);
  }

  if (peaks.length >= 3) {
    const intervals = peaks.slice(1).map((peak, index) => peak - peaks[index]);
    const sorted = [...intervals].sort((left, right) => left - right);
    const medianInterval = sorted[Math.floor(sorted.length / 2)];
    const rawBpm = 60 * sampleRate / medianInterval;
    const normalizedBpm = rawBpm > 180 ? rawBpm / 2 : rawBpm < 60 ? rawBpm * 2 : rawBpm;
    const intervalMean = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
    const intervalDeviation = intervals.reduce((sum, value) => sum + Math.abs(value - intervalMean), 0) / intervals.length;
    const regularity = 1 - clamp(intervalDeviation / Math.max(intervalMean, 1), 0, 1);
    return { value: Math.round(clamp(normalizedBpm, 60, 180)), confidence: Number(clamp(0.45 + regularity * 0.5, 0.05, 0.99).toFixed(3)) };
  }

  const scores = [];
  for (let bpm = 60; bpm <= 180; bpm += 1) {
    const lag = Math.max(1, Math.round((60 / bpm) * sampleRate));
    let numerator = 0;
    let left = 0;
    let right = 0;
    for (let index = lag; index < envelope.length; index += 1) {
      const current = envelope[index];
      const previous = envelope[index - lag];
      numerator += current * previous;
      left += current * current;
      right += previous * previous;
    }
    const score = numerator / Math.sqrt(Math.max(left * right, 0.000000001));
    scores.push({ bpm, score });
  }
  scores.sort((left, right) => right.score - left.score);
  const best = scores[0];
  const median = [...scores].sort((left, right) => left.score - right.score)[Math.floor(scores.length / 2)].score;
  return {
    value: best.bpm,
    confidence: Number(clamp((best.score - median) / Math.max(best.score, 0.000001), 0.05, 0.99).toFixed(3))
  };
}

function downsampleChannel(channel, sampleRate) {
  const targetRate = Math.min(sampleRate, 8000);
  if (targetRate === sampleRate) return { samples: channel, sampleRate };
  const ratio = sampleRate / targetRate;
  const output = new Float32Array(Math.floor(channel.length / ratio));
  for (let index = 0; index < output.length; index += 1) output[index] = channel[Math.floor(index * ratio)];
  return { samples: output, sampleRate: targetRate };
}

function analyzePcmSamples({ samples, sampleRate, bytes, mimeType, lyrics, lyricsMode, warnings = [] }) {
  const envelope = buildOnsetEnvelopeFromSamples(samples, sampleRate);
  const bpm = estimateBpm(envelope, 50);
  const beatInterval = bpm ? 60 / bpm.value : null;
  if (!bpm) warnings.push({ code: 'bpm_uncertain', message: 'No reliable periodic beat was detected.' });
  const energyCurve = buildEnergyCurveFromSamples(samples, sampleRate);
  const durationSeconds = samples.length / sampleRate;
  const preparedLyrics = prepareLyrics(lyrics, lyricsMode);
  const sections = classifySections({ energyCurve, durationSeconds, lyrics: preparedLyrics.text, lyricsSource: preparedLyrics.mode });
  if (preparedLyrics.mode === 'auto_tag') warnings.push({ code: 'lyrics_auto_tagged', message: 'Lyrics were tagged from prose heuristics; review the proposed labels before relying on them.' });
  warnings.push(sections.length ? { code: 'section_labels_heuristic', message: preparedLyrics.mode === 'none' ? 'Section labels are inferred from energy and position.' : 'Section boundaries remain energy-based; supplied lyrics anchor labels and receive separate provisional line/word timing.' } : { code: 'sections_not_classified', message: 'The track was too short or lacked enough structure for semantic section labels.' });
  const lyricAlignment = alignLyrics({ lyrics: preparedLyrics.text, lyricsSource: preparedLyrics.mode, sections, beatGrid: bpm ? { intervalSeconds: Number(beatInterval.toFixed(4)) } : null, durationSeconds });
  if (lyricAlignment) warnings.push(...lyricAlignment.warnings);
  return {
    source: { bytes, mimeType, durationSeconds: Number(durationSeconds.toFixed(3)) },
    analysis: {
      bpm,
      beatGrid: bpm ? { intervalSeconds: Number(beatInterval.toFixed(4)), count: Math.floor(durationSeconds / beatInterval), confidence: bpm.confidence } : null,
      sections,
      lyrics: { mode: preparedLyrics.mode, ...(preparedLyrics.mode === 'auto_tag' ? { taggedText: preparedLyrics.text, suggestions: preparedLyrics.suggestions } : {}) },
      lyricAlignment,
      energyCurve,
      confidence: bpm ? bpm.confidence : 0.2
    },
    warnings
  };
}
export function analyzeAudioBuffer({ buffer, mimeType, filename, lyrics, lyricsMode } = {}) {
  const validation = validateAudioInput({ buffer, mimeType, filename });
  if (!validation.ok) {
    const error = new Error('audio input failed validation');
    error.code = validation.errors[0]?.code || 'invalid_audio';
    error.details = validation.errors;
    throw error;
  }

  const bytes = asBuffer(buffer);
  const warnings = [];
  let wav = null;
  try {
    if (validation.mimeType === 'audio/wav' || validation.mimeType === 'audio/x-wav' || readFourCc(bytes, 0) === 'RIFF') wav = parseWav(bytes);
  } catch (error) {
    const wrapped = new Error(`audio analysis failed: ${error.message}`);
    wrapped.code = 'analysis_failed';
    throw wrapped;
  }

  if (wav && wav.durationSeconds > MAX_AUDIO_SECONDS) {
    const error = new Error(`audio duration exceeds the ${MAX_AUDIO_SECONDS}-second limit`);
    error.code = 'media_too_long';
    throw error;
  }

  if (!wav) {
    warnings.push({ code: 'compressed_analysis_pending', message: 'MP3 and M4A metadata and beat analysis require the configured decoder.' });
    return {
      source: { bytes: bytes.length, mimeType: validation.mimeType, durationSeconds: null },
      analysis: { bpm: null, beatGrid: null, sections: [], energyCurve: [], confidence: 0 },
      warnings
    };
  }

  if (![8, 16, 24, 32].includes(wav.bitsPerSample)) {
    const error = new Error('unsupported PCM bit depth');
    error.code = 'analysis_failed';
    throw error;
  }

  const envelope = buildOnsetEnvelope(bytes, wav);
  const envelopeRate = 50;
  const bpm = estimateBpm(envelope, envelopeRate);
  const beatInterval = bpm ? 60 / bpm.value : null;
  if (!bpm) warnings.push({ code: 'bpm_uncertain', message: 'No reliable periodic beat was detected.' });
  const energyCurve = buildEnergyCurve(bytes, wav);
  const preparedLyrics = prepareLyrics(lyrics, lyricsMode);
  const sections = classifySections({ energyCurve, durationSeconds: wav.durationSeconds, lyrics: preparedLyrics.text, lyricsSource: preparedLyrics.mode });
  if (preparedLyrics.mode === 'auto_tag') warnings.push({ code: 'lyrics_auto_tagged', message: 'Lyrics were tagged from prose heuristics; review the proposed labels before relying on them.' });
  warnings.push(sections.length ? { code: 'section_labels_heuristic', message: preparedLyrics.mode === 'none' ? 'Section labels are inferred from energy and position.' : 'Section boundaries remain energy-based; supplied lyrics anchor labels and receive separate provisional line/word timing.' } : { code: 'sections_not_classified', message: 'The track was too short or lacked enough structure for semantic section labels.' });
  const lyricAlignment = alignLyrics({ lyrics: preparedLyrics.text, lyricsSource: preparedLyrics.mode, sections, beatGrid: bpm ? { intervalSeconds: Number(beatInterval.toFixed(4)) } : null, durationSeconds: wav.durationSeconds });
  if (lyricAlignment) warnings.push(...lyricAlignment.warnings);

  return {
    source: {
      bytes: bytes.length,
      mimeType: validation.mimeType,
      durationSeconds: Number(wav.durationSeconds.toFixed(3))
    },
    analysis: {
      bpm,
      beatGrid: bpm ? {
        intervalSeconds: Number(beatInterval.toFixed(4)),
        count: Math.floor(wav.durationSeconds / beatInterval),
        confidence: bpm.confidence
      } : null,
      sections,
      lyrics: { mode: preparedLyrics.mode, ...(preparedLyrics.mode === 'auto_tag' ? { taggedText: preparedLyrics.text, suggestions: preparedLyrics.suggestions } : {}) },
      lyricAlignment,
      energyCurve,
      confidence: bpm ? bpm.confidence : 0.2
    },
    warnings
  };
}

async function applyAcousticAlignment(result, { lyrics, lyricsMode, acousticAligner, audioPcm, audioBytes } = {}) {
  if (typeof acousticAligner !== 'function' || !result.analysis.lyricAlignment) return result;
  try {
    const refined = await alignLyricsWithBackend({
      lyrics,
      lyricsSource: result.analysis.lyrics.mode,
      sections: result.analysis.sections,
      beatGrid: result.analysis.beatGrid,
      durationSeconds: result.source.durationSeconds,
      audioPcm,
      audioBytes
    }, { acousticAligner });
    result.analysis.lyricAlignment = refined;
    result.warnings = result.warnings.filter((warning) => warning.code !== 'alignment_provisional');
    if (refined?.warnings?.length) result.warnings.push(...refined.warnings);
  } catch (error) {
    result.warnings.push({ code: 'acoustic_alignment_failed', message: `Acoustic alignment failed; provisional timing retained (${error.message}).` });
  }
  return result;
}

export async function analyzeAudioBufferAsync({ buffer, mimeType, filename, lyrics, lyricsMode, acousticAligner } = {}) {
  const validation = validateAudioInput({ buffer, mimeType, filename });
  if (!validation.ok) {
    const error = new Error('audio input failed validation');
    error.code = validation.errors[0]?.code || 'invalid_audio';
    error.details = validation.errors;
    throw error;
  }
  if (validation.mimeType !== 'audio/mpeg') {
    const result = analyzeAudioBuffer({ buffer, mimeType, filename, lyrics, lyricsMode });
    return applyAcousticAlignment(result, { lyrics, lyricsMode, acousticAligner, audioBytes: asBuffer(buffer) });
  }

  const bytes = asBuffer(buffer);
  const decoder = new MPEGDecoder({ enableGapless: true });
  try {
    await decoder.ready;
    const decoded = decoder.decode(new Uint8Array(bytes));
    const channel = decoded.channelData?.[0];
    if (!channel || !channel.length || !decoded.sampleRate) {
      const error = new Error('MP3 decoder returned no PCM samples');
      error.code = 'analysis_failed';
      throw error;
    }
    const decodedDuration = channel.length / decoded.sampleRate;
    if (decodedDuration > MAX_AUDIO_SECONDS) {
      const error = new Error(`audio duration exceeds the ${MAX_AUDIO_SECONDS}-second limit`);
      error.code = 'media_too_long';
      throw error;
    }
    const warnings = (decoded.errors || []).map((item) => ({ code: 'decode_warning', message: item.message || 'MP3 decoder reported a recoverable error.' }));
    const sampled = downsampleChannel(channel, decoded.sampleRate);
    const result = analyzePcmSamples({ samples: sampled.samples, sampleRate: sampled.sampleRate, bytes: bytes.length, mimeType: validation.mimeType, lyrics, lyricsMode, warnings });
    return applyAcousticAlignment(result, { lyrics, lyricsMode, acousticAligner, audioPcm: sampled.samples, audioBytes: bytes });
  } finally {
    decoder.free();
  }
}
