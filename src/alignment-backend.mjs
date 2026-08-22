import { alignLyrics } from './alignment.mjs';

export const PROVISIONAL_ALIGNMENT_BACKEND = 'meter_estimate';
export const ACOUSTIC_ALIGNMENT_BACKEND = 'acoustic_forced';

/**
 * Resolve the alignment implementation without coupling the request path to a
 * heavyweight ML runtime. An acoustic adapter is intentionally injected by a
 * worker or host process; the local/default path remains deterministic.
 */
export function createAlignmentBackend({ acousticAligner } = {}) {
  if (typeof acousticAligner === 'function') {
    return {
      name: ACOUSTIC_ALIGNMENT_BACKEND,
      align: (input) => acousticAligner(input)
    };
  }
  return {
    name: PROVISIONAL_ALIGNMENT_BACKEND,
    align: (input) => alignLyrics(input)
  };
}

export async function alignLyricsWithBackend(input, options = {}) {
  const backend = createAlignmentBackend(options);
  const result = await backend.align(input);
  if (!result) return null;
  return {
    ...result,
    backend: result.backend || backend.name,
    ...(backend.name === ACOUSTIC_ALIGNMENT_BACKEND
      ? { mode: 'acoustic_forced', source: 'acoustic_forced_alignment' }
      : {})
  };
}
