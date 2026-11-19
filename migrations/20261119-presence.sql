-- Account-level presence; no direct client access or client-supplied timestamps.
begin;
set local lock_timeout='5s';
create table if not exists public.cw_presence (
  user_id uuid primary key references public.cw_users(id) on delete cascade,
  session_token uuid not null,
  last_seen timestamptz not null
);
alter table public.cw_presence enable row level security;
revoke all on public.cw_presence from public,anon,authenticated;
create or replace function public.cw_presence_heartbeat(p_token uuid,p_list boolean default false)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp
as $fn$
declare caller public.cw_users;
begin
  select * into caller from public.cw_users where session_token=p_token and session_expires_at>now()
    and (role='admin' or status='approved');
  if not found or (coalesce(p_list,false) and caller.role<>'admin') then
    raise exception '접근 권한이 없습니다.' using errcode='42501';
  end if;
  insert into public.cw_presence(user_id,session_token,last_seen) values(caller.id,p_token,now())
    on conflict(user_id) do update set session_token=excluded.session_token,last_seen=excluded.last_seen
    where public.cw_presence.last_seen<now()-interval '55 seconds'
       or public.cw_presence.session_token<>excluded.session_token;
  if not coalesce(p_list,false) then return null; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'full_name',u.full_name,
      'class_name',u.class_name,'role',u.role) order by u.full_name,u.id)
    from public.cw_presence p join public.cw_users u on u.id=p.user_id
    where p.last_seen>now()-interval '2 minutes' and p.session_token=u.session_token
      and u.session_expires_at>now() and (u.role='admin' or u.status='approved')),'[]'::jsonb);
end;
$fn$;
revoke all on function public.cw_presence_heartbeat(uuid,boolean) from public;
grant execute on function public.cw_presence_heartbeat(uuid,boolean) to anon,authenticated;
notify pgrst,'reload schema';
commit;
