-- RPC wrappers so edge functions (via service role) can query pg_cron tables.
-- Requires pg_cron extension to be enabled first.

CREATE OR REPLACE FUNCTION public.get_cron_jobs()
RETURNS TABLE (
  jobid bigint,
  jobname text,
  schedule text,
  command text,
  nodename text,
  nodeport integer,
  database text,
  username text,
  active boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jobid, jobname, schedule, command, nodename, nodeport, database, username, active
  FROM cron.job
  ORDER BY jobid;
$$;

CREATE OR REPLACE FUNCTION public.get_cron_job_run_details(row_limit integer DEFAULT 100)
RETURNS TABLE (
  runid bigint,
  jobid bigint,
  job_pid integer,
  database text,
  username text,
  command text,
  status text,
  return_message text,
  start_time timestamptz,
  end_time timestamptz,
  jobname text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    d.runid,
    d.jobid,
    d.job_pid,
    d.database,
    d.username,
    d.command,
    d.status,
    d.return_message,
    d.start_time,
    d.end_time,
    j.jobname
  FROM cron.job_run_details d
  LEFT JOIN cron.job j ON j.jobid = d.jobid
  ORDER BY d.start_time DESC
  LIMIT row_limit;
$$;
