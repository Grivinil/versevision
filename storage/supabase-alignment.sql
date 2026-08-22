-- VerseVision durable acoustic-alignment job state.
-- Run this in the VerseVision Supabase project's SQL editor.

create table if not exists public.versevision_alignment_jobs (
  job_id text primary key,
  status text not null check (status in ('queued', 'running', 'completed', 'failed')),
  request jsonb not null,
  filename text,
  mime_type text,
  audio_path text not null,
  result jsonb,
  error jsonb,
  idempotency_key text,
  attempts integer not null default 0,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists versevision_alignment_jobs_idempotency_idx
  on public.versevision_alignment_jobs (idempotency_key)
  where idempotency_key is not null;

create index if not exists versevision_alignment_jobs_queue_idx
  on public.versevision_alignment_jobs (status, created_at);

alter table public.versevision_alignment_jobs enable row level security;
revoke all on table public.versevision_alignment_jobs from anon, authenticated;

create or replace function public.claim_versevision_alignment_job()
returns setof public.versevision_alignment_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.versevision_alignment_jobs;
begin
  select * into claimed
  from public.versevision_alignment_jobs
  where status = 'queued'
  order by created_at
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  update public.versevision_alignment_jobs
  set status = 'running', locked_at = now(), attempts = attempts + 1, updated_at = now()
  where job_id = claimed.job_id;

  return query
    select * from public.versevision_alignment_jobs where job_id = claimed.job_id;
end;
$$;

revoke all on function public.claim_versevision_alignment_job() from public;
grant execute on function public.claim_versevision_alignment_job() to service_role;

-- Create a private Storage bucket named versevision-audio in the Storage UI,
-- or let the service create it on first use with its service-role key.
