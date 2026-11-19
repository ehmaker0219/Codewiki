-- Depends on profile and class-roster migrations. The update API stays unchanged.
begin;
set local lock_timeout='5s';
create or replace function public.cw_get_my_profile(p_token uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp
as $fn$
declare v_user jsonb; v_number integer;
begin
  v_user:=public.cw_me(p_token);
  if v_user is null then raise exception '로그인이 필요합니다.' using errcode='42501'; end if;
  select student_number into v_number from public.cw_users where id=(v_user->>'id')::uuid;
  return v_user || public.cw_get_my_birthday(p_token) || jsonb_build_object('student_number',v_number);
end;
$fn$;
revoke all on function public.cw_get_my_profile(uuid) from public;
grant execute on function public.cw_get_my_profile(uuid) to anon,authenticated;
notify pgrst,'reload schema';
commit;
