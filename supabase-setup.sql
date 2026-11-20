-- ============================================================================
-- [코드위키 (CodeWiki) — 자체 로그인/승인 & 건의 게시판 DB 세팅 SQL]
-- ----------------------------------------------------------------------------
-- ⚠️ 실행 시 주의: SQL Editor 안에 일부 영역만 마우스로 드래그(블록 선택)되어 있으면
--    선택된 줄만 실행되어 에러가 납니다! 빈 곳을 한 번 클릭해 선택을 풀고 [Run]을 눌러주세요.
-- ============================================================================

begin;

-- Initial setup must not replace the guarded login/signup RPCs on a hardened DB.
-- Apply incremental migrations instead; see SECURITY-UPDATE.md.
do $guard$
begin
  if to_regnamespace('cw_auth_private') is not null then
    raise exception '인증 보완이 적용된 DB입니다. 기본 설정을 재실행하지 말고 SECURITY-UPDATE.md의 추가 마이그레이션 절차를 따르세요.'
      using errcode = '55000';
  end if;
end;
$guard$;

create extension if not exists pgcrypto with schema extensions;

-- 1. 자체 회원 및 승인 상태 테이블
create table if not exists public.cw_users (
  id uuid default gen_random_uuid() primary key,
  username text not null unique,
  password_hash text not null,
  full_name text not null,
  class_name text not null default '기본반',
  mbti text not null default '',
  role text not null default 'student' check (role in ('admin', 'student')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  session_token uuid default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.cw_users add column if not exists mbti text not null default '';
alter table public.cw_users add column if not exists class_name text not null default '기본반';
-- NULL expires legacy sessions immediately; members get 24 hours, admins 12 hours.
alter table public.cw_users add column if not exists session_expires_at timestamptz;
alter table public.cw_users alter column session_token drop default;

-- 2. 수정·업데이트 건의 게시판 테이블
create table if not exists public.cw_feedback_posts (
  id bigint generated always as identity primary key,
  author_id uuid references public.cw_users(id) on delete set null,
  author_name text not null,
  author_class text default '',
  author_mbti text default '',
  category text not null default '내용 추가' check (category in ('내용 추가', '수정 요청', '오타·오류', '질문·기타')),
  target_doc_id text,
  target_doc_title text,
  title text not null,
  content text not null,
  status text not null default 'open' check (status in ('open', 'done')),
  admin_note text default '',
  created_at timestamptz not null default now()
);

alter table public.cw_feedback_posts add column if not exists author_class text default '';
alter table public.cw_feedback_posts add column if not exists author_mbti text default '';

alter table public.cw_users enable row level security;
alter table public.cw_feedback_posts enable row level security;
revoke all on table public.cw_users, public.cw_feedback_posts from public, anon, authenticated;
create unique index if not exists cw_users_session_token_uidx
  on public.cw_users (session_token)
  where session_token is not null;

-- 기존 함수 충돌 방지 정리
drop function if exists public.cw_signup(text, text, text, text);
drop function if exists public.cw_signup(text, text, text, text, text);

-- (1) 가입 신청
create or replace function public.cw_signup(
  p_username text,
  p_password text,
  p_full_name text,
  p_class_name text default '기본반',
  p_mbti text default ''
)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, public, extensions, pg_temp
as $fn$
declare
  v_clean_id text := lower(trim(p_username));
  v_user public.cw_users;
begin
  if length(v_clean_id) < 2 then
    raise exception '아이디는 2자 이상 입력해 주세요.';
  end if;

  if exists (select 1 from public.cw_users where lower(username) = v_clean_id) then
    raise exception '이미 사용 중인 아이디입니다.';
  end if;

  insert into public.cw_users (username, password_hash, full_name, class_name, mbti, role, status, session_token, session_expires_at)
  values (
    v_clean_id,
    crypt(p_password, gen_salt('bf')),
    trim(p_full_name),
    coalesce(nullif(trim(p_class_name), ''), '기본반'),
    upper(trim(coalesce(p_mbti, ''))),
    'student',
    'pending',
    gen_random_uuid(),
    now() + interval '24 hours'
  )
  returning * into v_user;

  return jsonb_build_object(
    'id', v_user.id,
    'username', v_user.username,
    'full_name', v_user.full_name,
    'class_name', v_user.class_name,
    'mbti', v_user.mbti,
    'role', v_user.role,
    'status', v_user.status,
    'session_token', v_user.session_token
  );
end;
$fn$;

-- (2) 자체 로그인
create or replace function public.cw_login(
  p_username text,
  p_password text
)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, public, extensions, pg_temp
as $fn$
declare
  v_user public.cw_users;
  v_new_token uuid := gen_random_uuid();
begin
  select * into v_user
  from public.cw_users
  where lower(username) = lower(trim(p_username))
    and password_hash = crypt(p_password, password_hash);

  if not found then
    raise exception '아이디 또는 비밀번호를 확인해 주세요.';
  end if;

  update public.cw_users
  set session_token = v_new_token, session_expires_at = now() + case when v_user.role = 'admin' then interval '12 hours' else interval '24 hours' end
  where id = v_user.id;

  return jsonb_build_object(
    'id', v_user.id,
    'username', v_user.username,
    'full_name', v_user.full_name,
    'class_name', v_user.class_name,
    'mbti', v_user.mbti,
    'role', v_user.role,
    'status', v_user.status,
    'session_token', v_new_token
  );
end;
$fn$;

-- (3) 현재 세션 상태 및 승인 대기 건수 확인
create or replace function public.cw_me(p_token uuid)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, public, pg_temp
as $fn$
declare
  v_user public.cw_users;
  v_pending_count int := 0;
begin
  select * into v_user
  from public.cw_users
  where session_token = p_token and session_expires_at > now();

  if not found then
    return null;
  end if;

  if v_user.role = 'admin' then
    select count(*) into v_pending_count
    from public.cw_users
    where role <> 'admin' and status = 'pending';
  end if;

  return jsonb_build_object(
    'id', v_user.id,
    'username', v_user.username,
    'full_name', v_user.full_name,
    'class_name', v_user.class_name,
    'mbti', v_user.mbti,
    'role', v_user.role,
    'status', v_user.status,
    'pending_count', v_pending_count
  );
end;
$fn$;

-- (4) 관리자 전용: 전체 신청자/멤버 목록 조회
create or replace function public.cw_admin_list_users(p_token uuid)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, public, pg_temp
as $fn$
declare
  v_caller public.cw_users;
begin
  select * into v_caller from public.cw_users where session_token = p_token and session_expires_at > now() and role = 'admin';
  if not found then
    raise exception '관리자 권한이 필요합니다.';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', u.id,
          'username', u.username,
          'full_name', u.full_name,
          'class_name', u.class_name,
          'mbti', u.mbti,
          'role', u.role,
          'status', u.status,
          'created_at', to_char(u.created_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI')
        )
        order by u.created_at desc
      )
      from public.cw_users u
      where u.role <> 'admin'
    ),
    '[]'::jsonb
  );
end;
$fn$;

-- (5) 관리자 전용: 개별 학생 승인/거절/대기 상태 변경
create or replace function public.cw_admin_set_status(
  p_token uuid,
  p_target_id uuid,
  p_next_status text
)
returns void
language plpgsql
security definer set search_path = pg_catalog, public, pg_temp
as $fn$
begin
  perform 1 from public.cw_users
    where session_token = p_token and session_expires_at > now() and role = 'admin'
    for share;
  if not found then
    raise exception '관리자 권한이 필요합니다.';
  end if;

  if p_next_status is null or p_next_status not in ('pending', 'approved', 'rejected') then
    raise exception '잘못된 상태 값입니다.' using errcode = '22023';
  end if;

  update public.cw_users
  set status = p_next_status,
      session_token = case when p_next_status = 'approved' then session_token else null end,
      session_expires_at = case when p_next_status = 'approved' then session_expires_at else null end
  where id = p_target_id and role <> 'admin';
end;
$fn$;

-- (6) 건의 게시판 목록 조회
create or replace function public.cw_list_posts(p_token uuid)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, public, pg_temp
as $fn$
begin
  if not exists (
    select 1 from public.cw_users
    where session_token = p_token and session_expires_at > now() and (status = 'approved' or role = 'admin')
  ) then
    return '[]'::jsonb;
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'author_id', p.author_id,
          'author_name', p.author_name,
          'author_class', p.author_class,
          'author_mbti', p.author_mbti,
          'category', p.category,
          'target_doc_id', p.target_doc_id,
          'target_doc_title', p.target_doc_title,
          'title', p.title,
          'content', p.content,
          'status', p.status,
          'admin_note', p.admin_note,
          'created_at', to_char(p.created_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI')
        )
        order by p.created_at desc
      )
      from public.cw_feedback_posts p
    ),
    '[]'::jsonb
  );
end;
$fn$;

-- (7) 건의글 작성
create or replace function public.cw_create_post(
  p_token uuid,
  p_category text,
  p_target_doc_id text,
  p_target_doc_title text,
  p_title text,
  p_content text
)
returns void
language plpgsql
security definer set search_path = pg_catalog, public, pg_temp
as $fn$
declare
  v_user public.cw_users;
  v_title text := trim(coalesce(p_title, ''));
  v_content text := trim(coalesce(p_content, ''));
begin
  select * into v_user
  from public.cw_users
  where session_token = p_token and session_expires_at > now() and (status = 'approved' or role = 'admin');

  if not found then
    raise exception '승인된 멤버만 작성할 수 있습니다.';
  end if;

  if p_category is null or p_category not in ('내용 추가', '수정 요청', '오타·오류', '질문·기타') then
    raise exception '건의 유형을 확인해 주세요.' using errcode = '22023';
  end if;
  if char_length(v_title) not between 1 and 200 or char_length(v_content) not between 1 and 5000 then
    raise exception '제목은 200자, 내용은 5,000자 이하로 입력해 주세요.' using errcode = '22023';
  end if;

  insert into public.cw_feedback_posts (
    author_id, author_name, author_class, author_mbti, category, target_doc_id, target_doc_title, title, content, status
  ) values (
    v_user.id, v_user.full_name, v_user.class_name, v_user.mbti, p_category,
    left(p_target_doc_id, 120), left(p_target_doc_title, 200), v_title, v_content, 'open'
  );
end;
$fn$;

-- (8) 관리자 건의글 상태/답변 업데이트
create or replace function public.cw_update_post(
  p_token uuid,
  p_post_id bigint,
  p_status text,
  p_admin_note text
)
returns void
language plpgsql
security definer set search_path = pg_catalog, public, pg_temp
as $fn$
begin
  if not exists (select 1 from public.cw_users where session_token = p_token and session_expires_at > now() and role = 'admin') then
    raise exception '관리자만 상태를 변경할 수 있습니다.';
  end if;

  update public.cw_feedback_posts
  set status = coalesce(p_status, status),
      admin_note = coalesce(p_admin_note, admin_note)
  where id = p_post_id;
end;
$fn$;

-- (9) 건의글 삭제
create or replace function public.cw_delete_post(
  p_token uuid,
  p_post_id bigint
)
returns void
language plpgsql
security definer set search_path = pg_catalog, public, pg_temp
as $fn$
declare
  v_user public.cw_users;
begin
  select * into v_user from public.cw_users
    where session_token = p_token and session_expires_at > now()
      and (status = 'approved' or role = 'admin');
  if not found then
    raise exception '로그인이 필요합니다.';
  end if;

  delete from public.cw_feedback_posts
  where id = p_post_id
    and (v_user.role = 'admin' or author_id = v_user.id);
end;
$fn$;

-- (10) Idempotent logout, including expired sessions.
create or replace function public.cw_logout(p_token uuid)
returns void
language plpgsql
security definer set search_path = pg_catalog, public, pg_temp
as $fn$
begin
  update public.cw_users
  set session_token = null, session_expires_at = null
  where session_token = p_token;
end;
$fn$;

revoke all on function
  public.cw_signup(text, text, text, text, text),
  public.cw_login(text, text),
  public.cw_me(uuid),
  public.cw_admin_list_users(uuid),
  public.cw_admin_set_status(uuid, uuid, text),
  public.cw_list_posts(uuid),
  public.cw_create_post(uuid, text, text, text, text, text),
  public.cw_update_post(uuid, bigint, text, text),
  public.cw_delete_post(uuid, bigint),
  public.cw_logout(uuid)
from public;

grant execute on function
  public.cw_signup(text, text, text, text, text),
  public.cw_login(text, text),
  public.cw_me(uuid),
  public.cw_admin_list_users(uuid),
  public.cw_admin_set_status(uuid, uuid, text),
  public.cw_list_posts(uuid),
  public.cw_create_post(uuid, text, text, text, text, text),
  public.cw_update_post(uuid, bigint, text, text),
  public.cw_delete_post(uuid, bigint),
  public.cw_logout(uuid)
to anon, authenticated, service_role;

-- Revoke only the historical, unchanged bootstrap password.
-- This literal is used solely to retire the old credential, never to create an account.
-- Already-rotated passwords and other accounts are preserved.
update public.cw_users
set password_hash = extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
    session_token = null,
    session_expires_at = null
where username = 'admin' and role = 'admin'
  and password_hash = extensions.crypt('admin1234', password_hash);

-- No default administrator is created. See SECURITY-UPDATE.md for owner provisioning.
commit;
