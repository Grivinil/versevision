const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_RETRY_ATTEMPTS = 2;
const DEFAULT_RETRY_DELAY_MS = 1_500;

function workerUrl(value) {
  if (!value) return null;
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('alignment worker URL must use HTTP(S)');
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  const isRailwayPrivate = url.hostname === 'railway.internal' || url.hostname.endsWith('.railway.internal');
  if (url.protocol === 'http:' && !isLocal && !isRailwayPrivate) throw new Error('remote alignment workers must use HTTPS unless using Railway private networking');
  return url.href.replace(/\/$/, '');
}

export function createWhisperXAligner({ endpoint = process.env.VERSEVISION_ALIGNMENT_WORKER_URL, token = process.env.VERSEVISION_ALIGNMENT_WORKER_TOKEN, timeoutMs = Number(process.env.VERSEVISION_ALIGNMENT_TIMEOUT_MS || DEFAULT_TIMEOUT_MS), retryAttempts = Number(process.env.VERSEVISION_ALIGNMENT_RETRY_ATTEMPTS || DEFAULT_RETRY_ATTEMPTS), retryDelayMs = Number(process.env.VERSEVISION_ALIGNMENT_RETRY_DELAY_MS || DEFAULT_RETRY_DELAY_MS) } = {}) {
  const baseUrl = workerUrl(endpoint);
  if (!baseUrl) return null;
  const normalizedTimeout = Number.isFinite(timeoutMs) ? Math.min(600_000, Math.max(5_000, timeoutMs)) : DEFAULT_TIMEOUT_MS;
  const normalizedRetryAttempts = Math.min(4, Math.max(0, Number(retryAttempts) || 0));
  const normalizedRetryDelayMs = Math.min(15_000, Math.max(100, Number(retryDelayMs) || DEFAULT_RETRY_DELAY_MS));
  return async ({ lyrics, lyricsSource, sections, beatGrid, durationSeconds, audioBytes }) => {
    if (!audioBytes?.length) throw new Error('alignment worker requires audio bytes');
    const form = new FormData();
    form.append('audio', new Blob([audioBytes], { type: 'audio/mpeg' }), 'versevision-audio.mp3');
    form.append('lyrics', lyrics || '');
    form.append('context', JSON.stringify({ lyricsSource, sections, beatGrid, durationSeconds }));
    let lastError;
    for (let attempt = 0; attempt <= normalizedRetryAttempts; attempt += 1) {
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
        if (!response.ok) {
          const error = new Error(`alignment worker returned HTTP ${response.status}: ${body.slice(0, 240)}`);
          error.statusCode = response.status;
          error.retryable = response.status >= 500 || response.status === 429;
          throw error;
        }
        try {
          return JSON.parse(body);
        } catch {
          throw new Error('alignment worker returned invalid JSON');
        }
      } catch (error) {
        lastError = error;
        const retryable = error.retryable === true || error.name === 'AbortError' || error.message === 'fetch failed' || error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED';
        if (!retryable || attempt >= normalizedRetryAttempts) {
          const wrapped = new Error(`alignment worker request failed after ${attempt + 1} attempt(s): ${error.message}`);
          wrapped.cause = error;
          wrapped.code = error.code;
          wrapped.statusCode = error.statusCode;
          throw wrapped;
        }
        await new Promise((resolve) => setTimeout(resolve, normalizedRetryDelayMs * (2 ** attempt)));
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError;
  };
}

export { workerUrl };
