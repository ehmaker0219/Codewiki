-- Idempotent security-review hardening. Apply after 20261120-encrypted-auth.sql.
-- Does not reopen any credential/plaintext RPCs restricted by encrypted-auth.
begin;
set local lock_timeout = '5s';

-- 1. Explicitly revoke direct table privileges on legacy tables (defense-in-depth with RLS).
revoke all on table public.cw_users, public.cw_feedback_posts from public, anon, authenticated;

-- 2. Index active session tokens for O(log n) RPC lookup and uniqueness enforcement.
create unique index if not exists cw_users_session_token_uidx
  on public.cw_users (session_token)
  where session_token is not null;

-- 3. Revoke active sessions immediately when an admin changes a user out of 'approved',
--    lock the admin caller row with FOR SHARE, and validate status input.
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
    raise exception '관리자 권한이 필요합니다.' using errcode = '42501';
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

-- 4. Require approved/admin status to delete feedback posts (matches list/create checks).
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
  select * into v_user
  from public.cw_users
  where session_token = p_token and session_expires_at > now()
    and (status = 'approved' or role = 'admin');
  if not found then
    raise exception '승인된 회원만 삭제할 수 있습니다.' using errcode = '42501';
  end if;

  delete from public.cw_feedback_posts
  where id = p_post_id
    and (v_user.role = 'admin' or author_id = v_user.id);
end;
$fn$;

-- 5. Enforce non-empty and bounded inputs on feedback posts.
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
  where session_token = p_token and session_expires_at > now()
    and (status = 'approved' or role = 'admin');
  if not found then
    raise exception '승인된 멤버만 작성할 수 있습니다.' using errcode = '42501';
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

-- 6. Block rejected accounts from reading or mutating birthdays while keeping pending signup atomic.
create or replace function public.cw_set_my_birthday(p_token uuid, p_birth_date date, p_share_with_class boolean)
returns void language plpgsql security definer set search_path = pg_catalog, public, pg_temp
as $fn$
declare v_id uuid;
begin
  select id into v_id from public.cw_users
    where session_token = p_token and session_expires_at > now() and status <> 'rejected';
  if v_id is null then raise exception '로그인이 필요합니다.' using errcode = '42501'; end if;
  if p_birth_date is null then
    delete from public.cw_birthdays where user_id = v_id;
    return;
  end if;
  if p_birth_date < date '1900-01-01' or p_birth_date > (now() at time zone 'Asia/Seoul')::date then
    raise exception '생년월일을 확인해 주세요.' using errcode = '22023';
  end if;
  insert into public.cw_birthdays values(v_id, p_birth_date, coalesce(p_share_with_class, false))
    on conflict(user_id) do update set birth_date = excluded.birth_date, share_with_class = excluded.share_with_class;
end;
$fn$;

create or replace function public.cw_get_my_birthday(p_token uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp
as $fn$
declare v_id uuid;
begin
  select id into v_id from public.cw_users
    where session_token = p_token and session_expires_at > now() and status <> 'rejected';
  if v_id is null then raise exception '로그인이 필요합니다.' using errcode = '42501'; end if;
  return coalesce((select jsonb_build_object('birth_date', birth_date, 'share_with_class', share_with_class)
    from public.cw_birthdays where user_id = v_id), jsonb_build_object('birth_date', null, 'share_with_class', false));
end;
$fn$;

-- 7. Pin pg_temp in search_path for all legacy SECURITY DEFINER functions and tighten PUBLIC execute grants.
alter function public.cw_me(uuid) set search_path = pg_catalog, public, pg_temp;
alter function public.cw_admin_list_users(uuid) set search_path = pg_catalog, public, pg_temp;
alter function public.cw_list_posts(uuid) set search_path = pg_catalog, public, pg_temp;
alter function public.cw_update_post(uuid, bigint, text, text) set search_path = pg_catalog, public, pg_temp;
alter function public.cw_logout(uuid) set search_path = pg_catalog, public, pg_temp;

do $sp$
begin
  if to_regprocedure('cw_auth_private.cw_login(text,text)') is not null then
    alter function cw_auth_private.cw_login(text, text) set search_path = pg_catalog, public, extensions, pg_temp;
  end if;
  if to_regprocedure('cw_auth_private.cw_signup(text,text,text,text,text)') is not null then
    alter function cw_auth_private.cw_signup(text, text, text, text, text) set search_path = pg_catalog, public, extensions, pg_temp;
  end if;
end;
$sp$;

revoke all on function
  public.cw_me(uuid),
  public.cw_admin_list_users(uuid),
  public.cw_admin_set_status(uuid, uuid, text),
  public.cw_list_posts(uuid),
  public.cw_create_post(uuid, text, text, text, text, text),
  public.cw_update_post(uuid, bigint, text, text),
  public.cw_delete_post(uuid, bigint),
  public.cw_logout(uuid),
  public.cw_set_my_birthday(uuid, date, boolean),
  public.cw_get_my_birthday(uuid)
from public;

grant execute on function
  public.cw_me(uuid),
  public.cw_admin_list_users(uuid),
  public.cw_admin_set_status(uuid, uuid, text),
  public.cw_list_posts(uuid),
  public.cw_create_post(uuid, text, text, text, text, text),
  public.cw_update_post(uuid, bigint, text, text),
  public.cw_delete_post(uuid, bigint),
  public.cw_logout(uuid),
  public.cw_set_my_birthday(uuid, date, boolean),
  public.cw_get_my_birthday(uuid)
to anon, authenticated, service_role;

-- 8. Enforce same-owner study note/folder assignments at the schema layer (deferrable for owner transfer).
do $fk$
begin
  if to_regclass('public.cw_study_notes') is not null
     and to_regclass('public.cw_study_folders') is not null
     and to_regclass('public.cw_study_note_folders') is not null then
    if not exists (
      select 1 from pg_constraint where conname = 'cw_study_notes_id_owner_uk' and conrelid = 'public.cw_study_notes'::regclass
    ) then
      alter table public.cw_study_notes add constraint cw_study_notes_id_owner_uk unique (id, owner_id);
    end if;
    if not exists (
      select 1 from pg_constraint where conname = 'cw_study_folders_id_owner_uk' and conrelid = 'public.cw_study_folders'::regclass
    ) then
      alter table public.cw_study_folders add constraint cw_study_folders_id_owner_uk unique (id, owner_id);
    end if;
    if not exists (
      select 1 from pg_constraint where conname = 'cw_study_note_folders_note_owner_fk' and conrelid = 'public.cw_study_note_folders'::regclass
    ) then
      alter table public.cw_study_note_folders
        add constraint cw_study_note_folders_note_owner_fk
        foreign key (note_id, owner_id) references public.cw_study_notes (id, owner_id)
        on delete cascade deferrable initially deferred;
    end if;
    if not exists (
      select 1 from pg_constraint where conname = 'cw_study_note_folders_folder_owner_fk' and conrelid = 'public.cw_study_note_folders'::regclass
    ) then
      alter table public.cw_study_note_folders
        add constraint cw_study_note_folders_folder_owner_fk
        foreign key (folder_id, owner_id) references public.cw_study_folders (id, owner_id)
        on delete cascade deferrable initially deferred;
    end if;
  end if;
end;
$fk$;

notify pgrst, 'reload schema';
commit;
