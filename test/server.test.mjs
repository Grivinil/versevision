import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPreviewResponse, createVerseVisionServer } from '../src/server.mjs';

test('builds the preview response from analysis without inventing scene data', () => {
  const response = buildPreviewResponse({
    id: 'vv_test',
    input: { source: { kind: 'url', title: 'Test track' }, output: { sceneGranularity: 'standard' } },
    analysis: {
      source: { mimeType: 'audio/wav', durationSeconds: 16 },
      analysis: {
        bpm: { value: 120, confidence: 0.91 },
        sections: [],
        energyCurve: [{ timeSeconds: 0, value: 0.2 }],
        confidence: 0.91
      },
      warnings: [{ code: 'sections_not_classified', message: 'Semantic labels are pending.' }]
    }
  });
  assert.equal(response.schema, 'versevision/blueprint-preview/v1');
  assert.equal(response.status, 'preview');
  assert.equal(response.source.title, 'Test track');
  assert.equal(response.analysisSummary.bpm.value, 120);
  assert.equal(response.analysisSummary.sectionCount, 0);
  assert.equal(response.analysisSummary.sceneBlockCount, 0);
  assert.equal(response.analysisSummary.estimatedSceneCount, 0);
  assert.equal(response.analysisSummary.estimatedShotCount, 2);
  assert.deepEqual(response.sampleScenes, []);
  assert.equal(response.sampleSceneCount, 0);
  assert.equal(response.warnings.length, 1);
  assert.equal(response.next.requiresPayment, true);
});

test('preview response exposes two narrative sample scenes when sections exist', () => {
  const response = buildPreviewResponse({
    id: 'vv_samples',
    input: {
      source: { kind: 'url', title: 'Sample track' },
      creative: { narrativeMode: 'meditation', lyrics: 'Breathe in\nBreathe out', visualStyle: 'soft cosmic light' },
      output: { aspectRatio: '16:9' }
    },
    analysis: {
      source: { mimeType: 'audio/wav', durationSeconds: 16 },
      analysis: {
        bpm: { value: 90, confidence: 0.8 },
        beatGrid: { intervalSeconds: 2 },
        sections: [
          { id: 'intro_01', label: 'intro', startSeconds: 0, endSeconds: 8, confidence: 0.7 },
          { id: 'verse_02', label: 'verse', startSeconds: 8, endSeconds: 16, confidence: 0.7 },
          { id: 'outro_03', label: 'outro', startSeconds: 16, endSeconds: 20, confidence: 0.6 }
        ],
        energyCurve: [],
        confidence: 0.8,
        lyricAlignment: { sections: [] }
      },
      warnings: []
    }
  });
  assert.equal(response.sampleSceneCount, 2);
  assert.equal(response.sampleScenes[0].sectionLabel, 'intro');
  assert.equal(response.sampleScenes[0].narrative.arcRole, 'grounding preparation');
  assert.equal(response.sampleScenes[1].narrative.continuityFrom, response.sampleScenes[0].id);
  assert.equal(response.samplePreviewSeconds, 16);
});

test('serves the human-facing landing page and studio with SEO metadata', async () => {
  const server = createVerseVisionServer({ port: 0, host: '127.0.0.1' });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    const pages = [
      { path: '/', required: /Try a free preview/ },
      { path: '/studio', required: /Generate free preview/ }
    ];
    for (const { path, required } of pages) {
      const response = await fetch(`http://127.0.0.1:${address.port}${path}`);
      const body = await response.text();
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type'), /text\/html/);
      assert.match(body, /VerseVision/);
      assert.match(body, required);
      assert.match(body, /rel="canonical"/);
      assert.match(body, /property="og:image"/);
      assert.match(body, /application\/ld\+json/);
    }
    const logo = await fetch(`http://127.0.0.1:${address.port}/assets/versevision-logo.svg`);
    const social = await fetch(`http://127.0.0.1:${address.port}/assets/versevision-social.svg`);
    const robots = await fetch(`http://127.0.0.1:${address.port}/robots.txt`);
    const sitemap = await fetch(`http://127.0.0.1:${address.port}/sitemap.xml`);
    assert.equal(logo.status, 200);
    assert.match(logo.headers.get('content-type'), /image\/svg\+xml/);
    assert.equal(social.status, 200);
    assert.match(social.headers.get('content-type'), /image\/svg\+xml/);
    assert.equal(robots.status, 200);
    assert.match(robots.headers.get('content-type'), /text\/plain/);
    assert.match(await robots.text(), /Sitemap: http:\/\/127\.0\.0\.1/);
    assert.equal(sitemap.status, 200);
    assert.match(sitemap.headers.get('content-type'), /application\/xml/);
    const sitemapBody = await sitemap.text();
    assert.match(sitemapBody, /<loc>http:\/\/127\.0\.0\.1[^<]*<\/loc>/);
    assert.doesNotMatch(sitemapBody, /\/v1\//);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

function makeSilentWav() {
  const sampleRate = 8000;
  const samples = Buffer.alloc(sampleRate * 2);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + samples.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(samples.length, 40);
  return Buffer.concat([header, samples]);
}

test('preview route accepts multipart spec plus audio upload', async () => {
  const server = createVerseVisionServer({ port: 0, host: '127.0.0.1' });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    const form = new FormData();
    form.append('spec', JSON.stringify({
      schema: 'versevision/blueprint-request/v1',
      source: { kind: 'upload', title: 'Uploaded track' },
      creative: { lyrics: '[Verse 1]\nSun in the sky', lyricsMode: 'provided' },
      output: { sceneGranularity: 'coarse' }
    }));
    form.append('audio', new Blob([makeSilentWav()], { type: 'audio/wav' }), 'track.wav');
    const response = await fetch(`http://127.0.0.1:${address.port}/v1/blueprint/preview`, { method: 'POST', body: form });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.schema, 'versevision/blueprint-preview/v1');
    assert.equal(body.source.title, 'Uploaded track');
    assert.equal(body.source.mimeType, 'audio/wav');
    assert.equal(body.analysisSummary.sceneBlockCount, 0);
    assert.equal(body.analysisSummary.estimatedSceneCount, 0);
    assert.equal(body.analysisSummary.estimatedShotCount, 1);
    assert.equal(body.analysisSummary.lyricAlignment.lineCount, 1);
    assert.equal(body.analysisSummary.lyricAlignment.sections[0].lines[0].words[0].text, 'Sun');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('preview never invokes remote acoustic alignment directly', async () => {
  let calls = 0;
  const server = createVerseVisionServer({ port: 0, host: '127.0.0.1', acousticAligner: async () => { calls += 1; return null; } });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/v1/blueprint/preview`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ schema: 'versevision/blueprint-request/v1', source: { kind: 'url', audioUrl: 'https://example.com/track.mp3' }, alignment: { mode: 'acoustic' }, creative: { lyrics: '[Verse 1]\nSun in the sky' } })
    });
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'acoustic_alignment_requires_job');
    assert.equal(calls, 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('full blueprint remains explicitly gated by payment configuration', async () => {
  const server = createVerseVisionServer({ port: 0, host: '127.0.0.1' });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/v1/blueprint`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const body = await response.json();
    assert.equal(response.status, 501);
    assert.equal(body.error.code, 'blueprint_generation_pending');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('full blueprint route can be activated only with an injected payment verifier', async () => {
  const server = createVerseVisionServer({ port: 0, host: '127.0.0.1', blueprintEnabled: true, paymentVerifier: async () => ({ ok: true }) });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    const form = new FormData();
    form.append('spec', JSON.stringify({ schema: 'versevision/blueprint-request/v1', source: { kind: 'upload', title: 'Paid blueprint test' } }));
    form.append('audio', new Blob([makeSilentWav()], { type: 'audio/wav' }), 'track.wav');
    const response = await fetch(`http://127.0.0.1:${address.port}/v1/blueprint`, { method: 'POST', body: form });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.schema, 'versevision/blueprint/v1');
    assert.equal(body.status, 'complete');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('acoustic alignment jobs are opt-in and expose a pollable result', async () => {
  const server = createVerseVisionServer({
    port: 0,
    host: '127.0.0.1',
    alignmentJobsEnabled: true,
    acousticAligner: async () => ({ mode: 'acoustic_forced', source: 'acoustic_forced_alignment', backend: 'acoustic_forced', confidence: 0.9, sections: [], lineCount: 0, wordCount: 0, warnings: [] })
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    const form = new FormData();
    form.append('spec', JSON.stringify({ schema: 'versevision/blueprint-request/v1', source: { kind: 'upload' }, alignment: { mode: 'acoustic' }, creative: { lyrics: '[Verse 1]\nSun in the sky', lyricsMode: 'provided' } }));
    form.append('audio', new Blob([makeSilentWav()], { type: 'audio/wav' }), 'track.wav');
    const createResponse = await fetch(`http://127.0.0.1:${address.port}/v1/alignment/jobs`, { method: 'POST', headers: { 'idempotency-key': 'server-job-1' }, body: form });
    const created = await createResponse.json();
    assert.equal(createResponse.status, 202);
    assert.match(created.jobId, /^vv_align_/);
    let status = created;
    for (let attempt = 0; attempt < 100 && !['completed', 'failed'].includes(status.status); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      status = await (await fetch(`http://127.0.0.1:${address.port}/v1/alignment/jobs/${created.jobId}`)).json();
    }
    assert.equal(status.status, 'completed');
    assert.equal(status.result.lyricAlignment.mode, 'acoustic_forced');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('completed alignment jobs expose downloadable LRC artifacts', async () => {
  const server = createVerseVisionServer({
    port: 0,
    host: '127.0.0.1',
    alignmentJobsEnabled: true,
    acousticAligner: async () => ({
      mode: 'acoustic_forced',
      source: 'acoustic_forced_alignment',
      backend: 'acoustic_forced',
      confidence: 0.9,
      sections: [{
        audioSectionId: 'full_track_01',
        lines: [{
          text: 'Sun in the sky',
          startSeconds: 0.5,
          endSeconds: 2,
          confidence: 0.9,
          source: 'acoustic_forced_alignment',
          words: [{ text: 'Sun', startSeconds: 0.5, endSeconds: 0.9, confidence: 0.9, source: 'acoustic_forced_alignment' }, { text: 'in', startSeconds: 0.9, endSeconds: 1.2, confidence: 0.9, source: 'acoustic_forced_alignment' }, { text: 'the', startSeconds: 1.2, endSeconds: 1.5, confidence: 0.9, source: 'acoustic_forced_alignment' }, { text: 'sky', startSeconds: 1.5, endSeconds: 2, confidence: 0.9, source: 'acoustic_forced_alignment' }]
        }]
      }],
      lineCount: 1,
      wordCount: 4,
      warnings: []
    })
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    const form = new FormData();
    form.append('spec', JSON.stringify({ schema: 'versevision/blueprint-request/v1', source: { kind: 'upload', title: 'LRC test' }, alignment: { mode: 'acoustic' }, creative: { lyrics: 'Sun in the sky', lyricsMode: 'provided' } }));
    form.append('audio', new Blob([makeSilentWav()], { type: 'audio/wav' }), 'track.wav');
    const created = await (await fetch(`http://127.0.0.1:${address.port}/v1/alignment/jobs`, { method: 'POST', body: form })).json();
    let status = created;
    for (let attempt = 0; attempt < 100 && status.status !== 'completed'; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      status = await (await fetch(`http://127.0.0.1:${address.port}/v1/alignment/jobs/${created.jobId}`)).json();
    }
    const response = await fetch(`http://127.0.0.1:${address.port}/v1/alignment/jobs/${created.jobId}/lyrics.enhanced.lrc`);
    const body = await response.text();
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-disposition'), /\.enhanced\.lrc/);
    assert.match(body, /<00:00\.50>Sun/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('keeps transcription benchmark mode private by default', async () => {
  const server = createVerseVisionServer({ port: 0, host: '127.0.0.1', alignmentJobsEnabled: true, acousticAligner: async () => ({}) });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    const form = new FormData();
    form.append('spec', JSON.stringify({ schema: 'versevision/blueprint-request/v1', source: { kind: 'upload' }, alignment: { mode: 'transcription' } }));
    form.append('audio', new Blob([makeSilentWav()], { type: 'audio/wav' }), 'track.wav');
    const response = await fetch(`http://127.0.0.1:${address.port}/v1/alignment/jobs`, { method: 'POST', body: form });
    const body = await response.json();
    assert.equal(response.status, 404);
    assert.equal(body.error.code, 'not_found');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
