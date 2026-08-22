import test from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseAlignmentJobManager } from '../src/alignment-jobs-supabase.mjs';

test('persists alignment metadata and audio through the Supabase adapter contract', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url, options });
    if (url.endsWith('/storage/v1/bucket')) return new Response('{}', { status: 200 });
    if (url.includes('/storage/v1/object/')) return new Response('{}', { status: 200 });
    if (url.includes('idempotency_key=eq.')) return new Response('[]', { status: 200 });
    if (url.endsWith('/rest/v1/versevision_alignment_jobs')) return new Response(JSON.stringify([{
      job_id: 'vv_align_test', status: 'queued', request: { alignment: { mode: 'acoustic' } }, filename: 'track.mp3', mime_type: 'audio/mpeg', audio_path: 'jobs/vv_align_test.audio', idempotency_key: 'test-1', attempts: 0, created_at: '2026-08-21T00:00:00.000Z', updated_at: '2026-08-21T00:00:00.000Z'
    }]), { status: 201, headers: { 'content-type': 'application/json' } });
    throw new Error(`unexpected test URL ${url}`);
  };
  try {
    const manager = new SupabaseAlignmentJobManager({ url: 'https://supabase.example', serviceRoleKey: 'service-role-test', enabled: false, acousticAligner: async () => ({}) });
    const job = await manager.create({ input: { alignment: { mode: 'acoustic' }, creative: { lyrics: 'Sun in the sky' } }, audioBytes: Buffer.from('audio'), filename: 'track.mp3', mimeType: 'audio/mpeg', idempotencyKey: 'test-1' });
    assert.equal(manager.kind, 'supabase');
    assert.equal(job.id, 'vv_align_test');
    assert.equal(job.audioPath, 'jobs/vv_align_test.audio');
    assert.equal(requests.some((request) => request.url.includes('/storage/v1/object/')), true);
    assert.equal(requests.some((request) => request.url.includes('/rest/v1/versevision_alignment_jobs')), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
