-- Private dates of birth. Peer RPC returns only month/day, never a birth year.
begin;
create table if not exists public.cw_birthdays (
  user_id uuid primary key references public.cw_users(id) on delete cascade,
  birth_date date not null check (birth_date >= date '1900-01-01'),
  share_with_class boolean not null default false
);
alter table public.cw_birthdays enable row level security;
revoke all on public.cw_birthdays from public, anon, authenticated;

create or replace function public.cw_set_my_birthday(p_token uuid, p_birth_date date, p_share_with_class boolean)
returns void language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare v_id uuid;
begin
  select id into v_id from public.cw_users where session_token=p_token and session_expires_at>now();
  if v_id is null then raise exception '로그인이 필요합니다.' using errcode='42501'; end if;
  if p_birth_date is null then
    delete from public.cw_birthdays where user_id=v_id;
    return;
  end if;
  if p_birth_date < date '1900-01-01' or p_birth_date > (now() at time zone 'Asia/Seoul')::date then
    raise exception '생년월일을 확인해 주세요.' using errcode='22023';
  end if;
  insert into public.cw_birthdays values(v_id,p_birth_date,coalesce(p_share_with_class,false))
    on conflict(user_id) do update set birth_date=excluded.birth_date,share_with_class=excluded.share_with_class;
end;
$fn$;

create or replace function public.cw_get_my_birthday(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare v_id uuid;
begin
  select id into v_id from public.cw_users where session_token=p_token and session_expires_at>now();
  if v_id is null then raise exception '로그인이 필요합니다.' using errcode='42501'; end if;
  return coalesce((select jsonb_build_object('birth_date',birth_date,'share_with_class',share_with_class)
    from public.cw_birthdays where user_id=v_id),jsonb_build_object('birth_date',null,'share_with_class',false));
end;
$fn$;

-- Existing signup remains compatible; the new signup and birthday save are atomic.
create or replace function public.cw_signup_with_birthday(
  p_username text, p_password text, p_full_name text, p_class_name text, p_mbti text,
  p_birth_date date, p_share_with_class boolean
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare v_result jsonb;
begin
  v_result := public.cw_signup(p_username,p_password,p_full_name,p_class_name,p_mbti);
  perform public.cw_set_my_birthday((v_result->>'session_token')::uuid,p_birth_date,p_share_with_class);
  return v_result;
end;
$fn$;

create or replace function public.cw_list_birthdays(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare v_class text;
begin
  select class_name into v_class from public.cw_users where session_token=p_token and session_expires_at>now()
    and (status='approved' or role='admin');
  if v_class is null then raise exception '승인된 회원만 조회할 수 있습니다.' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('full_name',u.full_name,
      'month',extract(month from b.birth_date)::int,'day',extract(day from b.birth_date)::int)
      order by extract(month from b.birth_date),extract(day from b.birth_date),u.full_name)
    from public.cw_birthdays b join public.cw_users u on u.id=b.user_id
    where b.share_with_class and u.class_name=v_class and u.status='approved'), '[]'::jsonb);
end;
$fn$;

create or replace function public.cw_admin_birthdays(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $fn$
begin
  if not exists(select 1 from public.cw_users where session_token=p_token and session_expires_at>now() and role='admin') then
    raise exception '관리자 권한이 필요합니다.' using errcode='42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('user_id',user_id,'birth_date',birth_date,'share_with_class',share_with_class))
    from public.cw_birthdays),'[]'::jsonb);
end;
$fn$;
revoke all on function public.cw_set_my_birthday(uuid,date,boolean) from public;
revoke all on function public.cw_get_my_birthday(uuid) from public;
revoke all on function public.cw_signup_with_birthday(text,text,text,text,text,date,boolean) from public;
revoke all on function public.cw_list_birthdays(uuid) from public;
revoke all on function public.cw_admin_birthdays(uuid) from public;
grant execute on function public.cw_set_my_birthday(uuid,date,boolean) to anon, authenticated;
grant execute on function public.cw_get_my_birthday(uuid) to anon, authenticated;
grant execute on function public.cw_signup_with_birthday(text,text,text,text,text,date,boolean) to anon, authenticated;
grant execute on function public.cw_list_birthdays(uuid) to anon, authenticated;
grant execute on function public.cw_admin_birthdays(uuid) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
