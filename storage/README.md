# Durable VerseVision alignment storage

Run `supabase-alignment.sql` in a dedicated Supabase project. The service uses:

- Postgres table `versevision_alignment_jobs` for durable status, request metadata, results, and errors;
- private Storage bucket `versevision-audio` for bounded audio payloads;
- a `FOR UPDATE SKIP LOCKED` RPC so multiple Node instances can claim different queued jobs safely.

Configure the Node service with:

```text
VERSEVISION_ALIGNMENT_STORE=supabase
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<masked service-role key>
VERSEVISION_ALIGNMENT_BUCKET=versevision-audio
```

When `VERSEVISION_ALIGNMENT_STORE=supabase` is set, the VerseVision server selects this adapter automatically. If the
setting is omitted, it intentionally falls back to a bounded process-local memory queue for development. If durable
configuration is present but invalid, startup logs a warning and uses that same safe fallback rather than accepting
jobs that cannot be persisted.

Never expose the service-role key to browsers or client responses. Audio objects are stored under `jobs/<job-id>.audio` and are deleted after a successful or failed processing attempt.
