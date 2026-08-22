const REQUEST_SCHEMA = 'versevision/blueprint-request/v1';
const ASPECT_RATIOS = new Set(['16:9', '9:16', '1:1', '4:5']);
const GRANULARITIES = new Set(['coarse', 'standard', 'dense']);
const GENERATOR_PROFILES = new Set(['generic']);
const AUDIO_MIME_TYPES = new Set(['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a']);

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function add(errors, path, message) {
  errors.push({ path, message });
}

function rejectUnknown(errors, value, allowed, path) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) add(errors, `${path}.${key}`, 'unknown field');
  }
}

function validateString(errors, value, path, { maxLength, required = false } = {}) {
  if (value === undefined) {
    if (required) add(errors, path, 'is required');
    return;
  }
  if (typeof value !== 'string' || value.trim() === '') {
    add(errors, path, 'must be a non-empty string');
    return;
  }
  if (maxLength && value.length > maxLength) add(errors, path, `must be ${maxLength} characters or fewer`);
}

function validateStringArray(errors, value, path) {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length > 5) {
    add(errors, path, 'must be an array of at most 5 strings');
    return;
  }
  value.forEach((item, index) => validateString(errors, item, `${path}[${index}]`, { maxLength: 80, required: true }));
}

function validateSource(errors, source) {
  const path = 'source';
  if (!isObject(source)) {
    add(errors, path, 'must be an object');
    return;
  }
  rejectUnknown(errors, source, new Set(['kind', 'audioUrl', 'title']), path);
  validateString(errors, source.kind, `${path}.kind`, { required: true });
  if (source.kind === 'url') {
    validateString(errors, source.audioUrl, `${path}.audioUrl`, { required: true, maxLength: 2048 });
    if (typeof source.audioUrl === 'string') {
      try {
        const url = new URL(source.audioUrl);
        if (url.protocol !== 'https:') add(errors, `${path}.audioUrl`, 'must use HTTPS');
      } catch {
        add(errors, `${path}.audioUrl`, 'must be a valid URL');
      }
    }
  } else if (source.kind === 'upload') {
    if (hasOwn(source, 'audioUrl')) add(errors, `${path}.audioUrl`, 'must be omitted for upload requests');
  } else if (source.kind !== undefined) {
    add(errors, `${path}.kind`, 'must be either url or upload');
  }
  validateString(errors, source.title, `${path}.title`, { maxLength: 200 });
}

function validateCreative(errors, creative) {
  if (creative === undefined) return;
  const path = 'creative';
  if (!isObject(creative)) {
    add(errors, path, 'must be an object');
    return;
  }
  rejectUnknown(errors, creative, new Set(['brief', 'lyrics', 'lyricsMode', 'genre', 'mood', 'visualStyle', 'referenceUrls']), path);
  validateString(errors, creative.brief, `${path}.brief`, { maxLength: 4000 });
  validateString(errors, creative.lyrics, `${path}.lyrics`, { maxLength: 20000 });
  if (creative.lyricsMode !== undefined && !['provided', 'auto_tag'].includes(creative.lyricsMode)) add(errors, `${path}.lyricsMode`, 'must be provided or auto_tag');
  if (creative.lyricsMode === 'auto_tag' && typeof creative.lyrics !== 'string') add(errors, `${path}.lyrics`, 'is required when lyricsMode is auto_tag');
  validateStringArray(errors, creative.genre, `${path}.genre`);
  validateStringArray(errors, creative.mood, `${path}.mood`);
  validateString(errors, creative.visualStyle, `${path}.visualStyle`, { maxLength: 2000 });
  if (creative.referenceUrls !== undefined) {
    if (!Array.isArray(creative.referenceUrls) || creative.referenceUrls.length > 8) {
      add(errors, `${path}.referenceUrls`, 'must be an array of at most 8 HTTPS URLs');
    } else {
      creative.referenceUrls.forEach((value, index) => {
        const itemPath = `${path}.referenceUrls[${index}]`;
        validateString(errors, value, itemPath, { maxLength: 2048, required: true });
        if (typeof value === 'string') {
          try {
            const url = new URL(value);
            if (url.protocol !== 'https:') add(errors, itemPath, 'must use HTTPS');
          } catch {
            add(errors, itemPath, 'must be a valid URL');
          }
        }
      });
    }
  }
}

function validateOutput(errors, output) {
  if (output === undefined) return;
  const path = 'output';
  if (!isObject(output)) {
    add(errors, path, 'must be an object');
    return;
  }
  rejectUnknown(errors, output, new Set(['durationSeconds', 'aspectRatio', 'sceneGranularity', 'generatorProfile', 'includeAlternates']), path);
  if (output.durationSeconds !== undefined && (!Number.isInteger(output.durationSeconds) || output.durationSeconds < 1 || output.durationSeconds > 300)) {
    add(errors, `${path}.durationSeconds`, 'must be an integer from 1 to 300');
  }
  if (output.aspectRatio !== undefined && !ASPECT_RATIOS.has(output.aspectRatio)) add(errors, `${path}.aspectRatio`, 'unsupported aspect ratio');
  if (output.sceneGranularity !== undefined && !GRANULARITIES.has(output.sceneGranularity)) add(errors, `${path}.sceneGranularity`, 'must be coarse, standard, or dense');
  if (output.generatorProfile !== undefined && !GENERATOR_PROFILES.has(output.generatorProfile)) add(errors, `${path}.generatorProfile`, 'unsupported generator profile');
  if (output.includeAlternates !== undefined && typeof output.includeAlternates !== 'boolean') add(errors, `${path}.includeAlternates`, 'must be boolean');
}

function validateAlignment(errors, alignment, creative) {
  if (alignment === undefined) return;
  const path = 'alignment';
  if (!isObject(alignment)) {
    add(errors, path, 'must be an object');
    return;
  }
  rejectUnknown(errors, alignment, new Set(['mode']), path);
  if (!['provisional', 'acoustic', 'transcription'].includes(alignment.mode)) add(errors, `${path}.mode`, 'must be provisional, acoustic, or transcription');
  if (alignment.mode === 'acoustic' && typeof creative?.lyrics !== 'string') add(errors, 'creative.lyrics', 'is required when alignment.mode is acoustic');
}

export function validateBlueprintRequest(input) {
  const errors = [];
  if (!isObject(input)) return { ok: false, errors: [{ path: '$', message: 'request must be an object' }] };
  rejectUnknown(errors, input, new Set(['schema', 'source', 'creative', 'output', 'alignment']), '$');
  if (input.schema !== REQUEST_SCHEMA) add(errors, 'schema', `must equal ${REQUEST_SCHEMA}`);
  if (!hasOwn(input, 'source')) add(errors, 'source', 'is required');
  else validateSource(errors, input.source);
  validateCreative(errors, input.creative);
  validateOutput(errors, input.output);
  validateAlignment(errors, input.alignment, input.creative);
  return { ok: errors.length === 0, errors };
}

export { AUDIO_MIME_TYPES, REQUEST_SCHEMA };
