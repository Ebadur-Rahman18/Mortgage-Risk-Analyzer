-- ──────────────────────────────────────────────────────────────────────────────
-- Memory Lifecycle Automation (L4)
--
-- Two scheduled pg_cron jobs:
--
--   1. prune_expired_memories       — runs every 30 min; hard-deletes rows whose
--                                     expires_at is in the past.
--
--   2. consolidate_short_term_memories — runs hourly; promotes short-term memories
--                                        to long-term when they have been accessed
--                                        3+ times and are < 7 days old.
--
-- Prerequisites: pg_cron and pg_net extensions (both available on Supabase Pro).
-- On non-Pro plans that lack pg_cron, these cron schedules will simply be skipped.
-- ──────────────────────────────────────────────────────────────────────────────

-- Enable pg_cron (no-op if already enabled)
create extension if not exists pg_cron;

-- Grant usage on cron schema to postgres (required on some Supabase versions)
grant usage on schema cron to postgres;

-- ── Helper: prune expired memories ───────────────────────────────────────────
create or replace function public.prune_expired_memories()
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.agent_memories
  where expires_at is not null
    and expires_at < now();

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

comment on function public.prune_expired_memories() is
  'Deletes agent_memories rows whose expires_at has passed. Called by pg_cron every 30 min.';

-- ── Helper: consolidate short-term → long-term ────────────────────────────────
create or replace function public.consolidate_short_term_memories()
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  promoted_count integer;
begin
  -- Promote memories that:
  --   • Are still short_term
  --   • Have been accessed 3 or more times (high signal)
  --   • Are less than 7 days old (recent knowledge is relevant)
  --   • Have not yet expired
  update public.agent_memories
  set
    memory_type  = 'long_term',
    expires_at   = null,                          -- long-term memories don't expire
    importance_score = least(importance_score + 0.1, 1.0),
    updated_at   = now()
  where memory_type   = 'short_term'
    and access_count  >= 3
    and created_at    >= now() - interval '7 days'
    and (expires_at is null or expires_at > now());

  get diagnostics promoted_count = row_count;
  return promoted_count;
end;
$$;

comment on function public.consolidate_short_term_memories() is
  'Promotes heavily-accessed short-term memories to long-term. Called by pg_cron every hour.';

-- ── Schedule the cron jobs ────────────────────────────────────────────────────

-- Remove stale schedules first (idempotent re-run safety)
select cron.unschedule('prune_expired_memories')
  where exists (
    select 1 from cron.job where jobname = 'prune_expired_memories'
  );

select cron.unschedule('consolidate_short_term_memories')
  where exists (
    select 1 from cron.job where jobname = 'consolidate_short_term_memories'
  );

-- Prune expired memories: every 30 minutes
select cron.schedule(
  'prune_expired_memories',
  '*/30 * * * *',
  $$ select public.prune_expired_memories(); $$
);

-- Consolidate short-term → long-term: every hour at minute 5
select cron.schedule(
  'consolidate_short_term_memories',
  '5 * * * *',
  $$ select public.consolidate_short_term_memories(); $$
);
