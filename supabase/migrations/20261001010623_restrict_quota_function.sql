create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create or replace function private.reserve_ai_call() returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid()) then return false; end if;
 perform pg_catalog.pg_advisory_xact_lock(724192);
 if (select count(*) from public.ai_usage where created_at>now()-interval '24 hours') >= 300
 or (select count(*) from public.ai_usage where user_id=auth.uid() and created_at>now()-interval '24 hours') >= 40 then return false; end if;
 insert into public.ai_usage(user_id) values(auth.uid()); return true;
end; $$;
revoke all on function private.reserve_ai_call() from public, anon;
grant execute on function private.reserve_ai_call() to authenticated;
create or replace function public.reserve_ai_call() returns boolean
language sql security invoker set search_path='' as $$
 select private.reserve_ai_call();
$$;
revoke all on function public.reserve_ai_call() from public, anon;
grant execute on function public.reserve_ai_call() to authenticated;
create policy usage_no_direct_access on public.ai_usage for all to authenticated using(false) with check(false);
