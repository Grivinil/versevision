const DEFAULT_TIMEOUT_MS = 180_000;

function workerUrl(value) {
  if (!value) return null;
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('alignment worker URL must use HTTP(S)');
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  const isRailwayPrivate = url.hostname === 'railway.internal' || url.hostname.endsWith('.railway.internal');
  if (url.protocol === 'http:' && !isLocal && !isRailwayPrivate) throw new Error('remote alignment workers must use HTTPS unless using Railway private networking');
  return url.href.replace(/\/$/, '');
}

export function createWhisperXAligner({ endpoint = process.env.VERSEVISION_ALIGNMENT_WORKER_URL, token = process.env.VERSEVISION_ALIGNMENT_WORKER_TOKEN, timeoutMs = Number(process.env.VERSEVISION_ALIGNMENT_TIMEOUT_MS || DEFAULT_TIMEOUT_MS) } = {}) {
  const baseUrl = workerUrl(endpoint);
  if (!baseUrl) return null;
  const normalizedTimeout = Number.isFinite(timeoutMs) ? Math.min(600_000, Math.max(5_000, timeoutMs)) : DEFAULT_TIMEOUT_MS;
  return async ({ lyrics, lyricsSource, sections, beatGrid, durationSeconds, audioBytes }) => {
    if (!audioBytes?.length) throw new Error('alignment worker requires audio bytes');
    const form = new FormData();
    form.append('audio', new Blob([audioBytes], { type: 'audio/mpeg' }), 'versevision-audio.mp3');
    form.append('lyrics', lyrics || '');
    form.append('context', JSON.stringify({ lyricsSource, sections, beatGrid, durationSeconds }));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), normalizedTimeout);
    try {
      const response = await fetch(`${baseUrl}/align`, {
        method: 'POST',
        headers: token ? { authorization: `Bearer ${token}` } : {},
        body: form,
        signal: controller.signal
      });
      const body = await response.text();
      if (!response.ok) throw new Error(`alignment worker returned HTTP ${response.status}: ${body.slice(0, 240)}`);
      try {
        return JSON.parse(body);
      } catch {
        throw new Error('alignment worker returned invalid JSON');
      }
    } finally {
      clearTimeout(timer);
    }
  };
}

export { workerUrl };
