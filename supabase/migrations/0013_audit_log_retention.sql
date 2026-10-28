-- ---------------------------------------------------------------------------
-- 0013_audit_log_retention.sql
-- Automatic 30-day retention policy for KAIRO audit_logs:
-- 1. Stored function cleanup_expired_audit_logs() deletes rows older than 30 days.
-- 2. Statement-level trigger automatically executes cleanup on new log inserts.
-- 3. Daily cron schedule registered via pg_cron when available.
-- ---------------------------------------------------------------------------

-- 1. Core cleanup function
create or replace function cleanup_expired_audit_logs()
returns integer
language plpgsql
security definer
as $$
declare
  deleted_count integer;
begin
  delete from audit_logs
  where created_at < now() - interval '30 days';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- 2. Statement-level trigger function for automated deletion upon insert
create or replace function trigger_cleanup_expired_audit_logs()
returns trigger
language plpgsql
security definer
as $$
begin
  delete from audit_logs
  where created_at < now() - interval '30 days';
  return new;
end;
$$;

drop trigger if exists trg_audit_logs_30d_cleanup on audit_logs;
create trigger trg_audit_logs_30d_cleanup
  after insert on audit_logs
  for each statement
  execute function trigger_cleanup_expired_audit_logs();

-- Grant permissions to authenticated users and service role
grant execute on function cleanup_expired_audit_logs to authenticated, service_role;

-- 3. Schedule daily cron job at 02:00 UTC if pg_cron is available
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('purge_30d_audit_logs')
      where exists (select 1 from cron.job where jobname = 'purge_30d_audit_logs');

      perform cron.schedule(
        'purge_30d_audit_logs',
        '0 2 * * *',
        'select cleanup_expired_audit_logs();'
      );
    exception
      when others then null;
    end;
  end if;
exception
  when others then null;
end $$;
