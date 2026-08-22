# VerseVision acoustic alignment jobs

Normal previews never call WhisperX. They use the local `meter_estimate` path and return immediately.

## Enable the job gate

Configure the Node service with a private worker and explicitly enable jobs:

```text
VERSEVISION_ALIGNMENT_WORKER_URL=https://private-worker.example.com
VERSEVISION_ALIGNMENT_WORKER_TOKEN=<masked service token>
VERSEVISION_ALIGNMENT_JOBS_ENABLED=1
```

The worker URL must be HTTPS unless it points to localhost or a Railway `*.railway.internal` private-network hostname.
Railway private traffic is encrypted inside its WireGuard network, so the internal URL uses `http`. The token is used
only for service-to-service authentication.

The Node service retries transient worker failures twice with exponential backoff before retaining provisional timing.
These values can be tuned, but should remain bounded:

```text
VERSEVISION_ALIGNMENT_RETRY_ATTEMPTS=2
VERSEVISION_ALIGNMENT_RETRY_DELAY_MS=1500
```

Configure the worker service with a healthcheck path of `/health`, keep one replica warm (disable scale-to-zero for the
private worker), and enable automatic restart on failure. The worker image preloads WhisperX before becoming ready, and
the health response reports `ready: true` only after the model is loaded. This makes a slow model download a deployment
readiness issue instead of a surprise timeout on the first customer job.

## Create a job

`POST /v1/alignment/jobs` accepts the same JSON-plus-audio multipart transport as preview. Add:

```json
{
  "alignment": { "mode": "acoustic" },
  "creative": {
    "lyrics": "[Verse 1]\nSun in the sky",
    "lyricsMode": "provided"
  }
}
```

The response is `202 Accepted` with a `jobId`. `Idempotency-Key` may be supplied to prevent duplicate remote jobs.

## Poll status

`GET /v1/alignment/jobs/{jobId}` returns `queued`, `running`, `completed`, or `failed`. A completed result contains the acoustic `lyricAlignment`, confidence-gated scene prompts, and warnings. Audio bytes are discarded from the in-process queue after processing.

## Durable production storage

For a single-process local prototype, the default memory store is sufficient. For staging or production, configure the
Supabase adapter so a restart does not lose queued jobs or uploaded audio:

```text
VERSEVISION_ALIGNMENT_STORE=supabase
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<masked service-role key>
VERSEVISION_ALIGNMENT_BUCKET=versevision-audio
```

Run `storage/supabase-alignment.sql` in the VerseVision Supabase SQL editor first. The service creates (or reuses) the
private bucket, stores audio under `jobs/<job-id>.audio`, and removes the object after completion or failure. A
`FOR UPDATE SKIP LOCKED` RPC claims queued rows, so multiple Node replicas can process different jobs without duplicate
claims. The service-role key is server-only and must never be sent to browsers, committed, or included in responses.
