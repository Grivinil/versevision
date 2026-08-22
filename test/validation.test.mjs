import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBlueprintRequest } from '../src/validation.mjs';

const validRequest = {
  schema: 'versevision/blueprint-request/v1',
  source: { kind: 'url', audioUrl: 'https://example.com/track.mp3', title: 'Night Drive' },
  creative: {
    brief: 'A neon city journey that becomes hopeful at the final chorus.',
    genre: ['electronic'],
    mood: ['restless', 'hopeful'],
    visualStyle: 'Anamorphic night photography with cyan and amber light.',
    referenceUrls: ['https://example.com/reference.jpg']
  },
  output: { durationSeconds: 180, aspectRatio: '16:9', sceneGranularity: 'standard', generatorProfile: 'generic', includeAlternates: false }
};

test('accepts a valid URL request', () => {
  const result = validateBlueprintRequest(validRequest);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('accepts an upload transport request', () => {
  const result = validateBlueprintRequest({
    schema: 'versevision/blueprint-request/v1',
    source: { kind: 'upload', title: 'Uploaded track' },
    output: { aspectRatio: '9:16' }
  });
  assert.equal(result.ok, true);
});

test('rejects non-HTTPS audio URLs', () => {
  const result = validateBlueprintRequest({ ...validRequest, source: { ...validRequest.source, audioUrl: 'http://example.com/track.mp3' } });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.path === 'source.audioUrl'));
});

test('rejects unknown fields', () => {
  const result = validateBlueprintRequest({ ...validRequest, unexpected: true });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.path === '$.unexpected'));
});

test('rejects oversized creative input and invalid output limits', () => {
  const result = validateBlueprintRequest({
    ...validRequest,
    creative: { brief: 'x'.repeat(4001) },
    output: { durationSeconds: 301, aspectRatio: '21:9' }
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.path === 'creative.brief'));
  assert.ok(result.errors.some((error) => error.path === 'output.durationSeconds'));
  assert.ok(result.errors.some((error) => error.path === 'output.aspectRatio'));
});

test('accepts auto-tag mode only when lyrics are supplied', () => {
  const valid = validateBlueprintRequest({ ...validRequest, creative: { lyrics: 'unstructured lyric prose', lyricsMode: 'auto_tag' } });
  assert.equal(valid.ok, true);
  const invalid = validateBlueprintRequest({ ...validRequest, creative: { lyricsMode: 'auto_tag' } });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.some((error) => error.path === 'creative.lyrics'));
});

test('accepts acoustic alignment only with supplied lyrics', () => {
  const valid = validateBlueprintRequest({ ...validRequest, alignment: { mode: 'acoustic' }, creative: { lyrics: '[Verse 1]\nSun in the sky' } });
  assert.equal(valid.ok, true);
  const invalid = validateBlueprintRequest({ ...validRequest, alignment: { mode: 'acoustic' } });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.some((error) => error.path === 'creative.lyrics'));
});

test('accepts transcription benchmark mode without supplied lyrics', () => {
  const result = validateBlueprintRequest({ ...validRequest, alignment: { mode: 'transcription' } });
  assert.equal(result.ok, true);
});
