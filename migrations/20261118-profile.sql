-- Depends on 20261118-birthdays.sql. Only the session owner's editable fields change.
begin;
create or replace function public.cw_get_my_profile(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare v_user jsonb;
begin
  v_user:=public.cw_me(p_token);
  if v_user is null then raise exception '로그인이 필요합니다.' using errcode='42501'; end if;
  return v_user || public.cw_get_my_birthday(p_token);
end;
$fn$;

create or replace function public.cw_update_my_profile(
  p_token uuid, p_full_name text, p_mbti text, p_birth_date date, p_share_with_class boolean
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare v_id uuid; v_name text:=trim(p_full_name); v_mbti text:=upper(trim(coalesce(p_mbti,'')));
begin
  select id into v_id from public.cw_users where session_token=p_token and session_expires_at>now()
    and (status='approved' or role='admin') for update;
  if v_id is null then raise exception '승인된 회원만 수정할 수 있습니다.' using errcode='42501'; end if;
  if v_name is null or length(v_name)<1 or length(v_name)>50 then
    raise exception '이름은 1~50자로 입력해 주세요.' using errcode='22023';
  end if;
  if v_mbti<>'' and v_mbti !~ '^[EI][SN][TF][JP]$' then
    raise exception 'MBTI를 확인해 주세요.' using errcode='22023';
  end if;
  perform public.cw_set_my_birthday(p_token,p_birth_date,p_share_with_class);
  update public.cw_users set full_name=v_name,mbti=v_mbti where id=v_id;
  return public.cw_get_my_profile(p_token);
end;
$fn$;
revoke all on function public.cw_get_my_profile(uuid) from public;
revoke all on function public.cw_update_my_profile(uuid,text,text,date,boolean) from public;
grant execute on function public.cw_get_my_profile(uuid) to anon, authenticated;
grant execute on function public.cw_update_my_profile(uuid,text,text,date,boolean) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
