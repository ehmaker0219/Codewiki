-- Extend private study access to approved students, preserving owner-only RPCs.
-- Apply after study-notes and study-folders; does not change auth RPCs or data.
begin;
set local lock_timeout='5s';
create or replace function public.cw_study_owner(p_token uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare uid uuid;
begin
  select id into uid from public.cw_users
    where session_token=p_token and session_expires_at>now()
      and (role='admin' or (role='student' and status='approved'));
  if uid is null then raise exception '승인된 회원 로그인이 필요합니다.' using errcode='42501'; end if;
  return uid;
end;
$fn$;
revoke all on function public.cw_study_owner(uuid) from public, anon, authenticated;
notify pgrst, 'reload schema';
commit;
