import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMultipartBody } from '../src/multipart.mjs';

test('parses spec JSON and binary audio fields', () => {
  const boundary = 'versevision-test-boundary';
  const audio = Buffer.from([0, 1, 2, 255, 128]);
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="spec"\r\nContent-Type: application/json\r\n\r\n{"schema":"versevision/blueprint-request/v1","source":{"kind":"upload"}}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="track.wav"\r\nContent-Type: audio/wav\r\n\r\n`),
    audio,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);
  const parsed = parseMultipartBody(body, `multipart/form-data; boundary=${boundary}`);
  assert.match(parsed.spec, /versevision\/blueprint-request\/v1/);
  assert.equal(parsed.audio.filename, 'track.wav');
  assert.equal(parsed.audio.mimeType, 'audio/wav');
  assert.deepEqual(parsed.audio.data, audio);
});

test('rejects duplicate or unknown multipart fields', () => {
  const boundary = 'versevision-test-boundary';
  const unknown = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="other"\r\n\r\nvalue\r\n--${boundary}--\r\n`);
  assert.throws(() => parseMultipartBody(unknown, `multipart/form-data; boundary=${boundary}`), { code: 'invalid_multipart' });
});
