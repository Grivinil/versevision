import test from 'node:test';
import assert from 'node:assert/strict';
import { createWhisperXAligner, workerUrl } from '../src/acoustic-worker.mjs';

test('does not configure a worker when no endpoint is supplied', () => {
  assert.equal(createWhisperXAligner({ endpoint: '' }), null);
});

test('requires HTTPS for remote alignment workers', () => {
  assert.throws(() => workerUrl('http://alignment.example.test'), /HTTPS/);
  assert.equal(workerUrl('http://127.0.0.1:8090'), 'http://127.0.0.1:8090');
});

test('posts bounded audio and alignment context to the configured worker', async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl;
  let requestOptions;
  globalThis.fetch = async (url, options) => {
    requestUrl = url;
    requestOptions = options;
    return new Response(JSON.stringify({ mode: 'acoustic_forced', sections: [], warnings: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const aligner = createWhisperXAligner({ endpoint: 'http://127.0.0.1:8090', token: 'test-token', timeoutMs: 5000 });
    const result = await aligner({ lyrics: 'Sun in the sky', lyricsSource: 'provided', sections: [], beatGrid: null, durationSeconds: 4, audioBytes: Buffer.from('mp3') });
    assert.equal(requestUrl, 'http://127.0.0.1:8090/align');
    assert.equal(requestOptions.method, 'POST');
    assert.equal(requestOptions.headers.authorization, 'Bearer test-token');
    assert.equal(requestOptions.body instanceof FormData, true);
    assert.equal(result.mode, 'acoustic_forced');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
