-- Apply before publishing the signup UI, then load the PRIVATE roster seed.
-- Never commit real student names/numbers to this public repository.
begin;

create table if not exists public.cw_class_roster (
  class_name text not null,
  student_number integer not null check (student_number between 1 and 30),
  full_name text not null check (length(trim(full_name)) between 1 and 50),
  primary key (class_name, student_number)
);
alter table public.cw_class_roster enable row level security;
revoke all on public.cw_class_roster from public, anon, authenticated;
alter table public.cw_users add column if not exists student_number integer;

-- INSERT enforcement also protects old signup RPCs which have no number argument.
-- Existing members, logins and profile edits are unaffected.
create or replace function public.cw_check_signup_roster()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $fn$
begin
  if new.role = 'student' and trim(new.class_name) = '6반' then
    if not exists (
      select 1 from public.cw_class_roster r
      where r.class_name = '6반' and r.student_number = new.student_number
        and r.full_name = trim(new.full_name)
    ) then
      raise exception '6반 출석부의 이름과 출석번호가 일치하지 않습니다. 입력 내용을 확인해 주세요.' using errcode='22023';
    end if;
  end if;
  return new;
end;
$fn$;
revoke all on function public.cw_check_signup_roster() from public, anon, authenticated;
drop trigger if exists cw_signup_roster_guard on public.cw_users;
create trigger cw_signup_roster_guard before insert on public.cw_users
  for each row execute function public.cw_check_signup_roster();

create or replace function public.cw_signup_with_roster(
  p_username text, p_password text, p_full_name text, p_class_name text, p_mbti text,
  p_birth_date date, p_share_with_class boolean, p_student_number integer
)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp
as $fn$
declare
  v_id text := lower(trim(p_username));
  v_name text := trim(p_full_name);
  v_class text := trim(p_class_name);
  v_user public.cw_users;
begin
  if v_id is null or length(v_id) < 2 then
    raise exception '아이디는 2자 이상 입력해 주세요.' using errcode='22023';
  end if;
  if p_password is null or length(p_password) = 0 then
    raise exception '비밀번호를 입력해 주세요.' using errcode='22023';
  end if;
  if v_name is null or length(v_name) not between 1 and 50 then
    raise exception '이름을 확인해 주세요.' using errcode='22023';
  end if;
  if v_class is null or v_class not in ('1반','2반','3반','4반','5반','6반','7반') then
    raise exception '소속 반을 확인해 주세요.' using errcode='22023';
  end if;
  if exists(select 1 from public.cw_users where lower(username)=v_id) then
    raise exception '이미 사용 중인 아이디입니다.' using errcode='23505';
  end if;
  insert into public.cw_users (
    username,password_hash,full_name,class_name,mbti,role,status,
    student_number,session_token,session_expires_at
  ) values (
    v_id,crypt(p_password,gen_salt('bf')),v_name,v_class,
    upper(trim(coalesce(p_mbti,''))),'student','pending',
    case when v_class='6반' then p_student_number else null end,
    gen_random_uuid(),now()+interval '24 hours'
  ) returning * into v_user;
  perform public.cw_set_my_birthday(v_user.session_token,p_birth_date,p_share_with_class);
  return jsonb_build_object(
    'id',v_user.id,'username',v_user.username,'full_name',v_user.full_name,
    'class_name',v_user.class_name,'mbti',v_user.mbti,'role',v_user.role,
    'status',v_user.status,'session_token',v_user.session_token
  );
end;
$fn$;
revoke all on function public.cw_signup_with_roster(text,text,text,text,text,date,boolean,integer) from public;
grant execute on function public.cw_signup_with_roster(text,text,text,text,text,date,boolean,integer) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
