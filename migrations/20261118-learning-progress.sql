-- Additive migration: does not alter accounts, posts, passwords or existing sessions.
begin;
create table if not exists public.cw_learning_progress (
  user_id uuid not null references public.cw_users(id) on delete cascade,
  doc_id text not null check (doc_id ~ '^[a-z0-9-]{1,100}$'),
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, doc_id)
);
alter table public.cw_learning_progress enable row level security;
revoke all on public.cw_learning_progress from public, anon, authenticated;

create or replace function public.cw_get_progress(p_token uuid)
returns table(doc_id text, completed boolean, updated_at timestamptz)
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare v_user_id uuid;
begin
  select u.id into v_user_id from public.cw_users u
    where u.session_token = p_token and u.session_expires_at > now()
      and (u.status = 'approved' or u.role = 'admin');
  if v_user_id is null then raise exception '로그인이 필요합니다.' using errcode = '42501'; end if;
  return query select p.doc_id, p.completed, p.updated_at
    from public.cw_learning_progress p where p.user_id = v_user_id;
end;
$fn$;

create or replace function public.cw_set_progress(p_token uuid, p_doc_id text, p_completed boolean)
returns void language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare v_user_id uuid;
begin
  select u.id into v_user_id from public.cw_users u
    where u.session_token = p_token and u.session_expires_at > now()
      and (u.status = 'approved' or u.role = 'admin');
  if v_user_id is null then raise exception '로그인이 필요합니다.' using errcode = '42501'; end if;
  if p_doc_id is null or p_doc_id !~ '^[a-z0-9-]{1,100}$' or p_completed is null then
    raise exception '잘못된 학습 기록입니다.' using errcode = '22023';
  end if;
  insert into public.cw_learning_progress(user_id, doc_id, completed)
    values (v_user_id, p_doc_id, p_completed)
    on conflict (user_id, doc_id) do update set completed = excluded.completed, updated_at = now();
end;
$fn$;
revoke all on function public.cw_get_progress(uuid) from public;
revoke all on function public.cw_set_progress(uuid, text, boolean) from public;
grant execute on function public.cw_get_progress(uuid) to anon, authenticated;
grant execute on function public.cw_set_progress(uuid, text, boolean) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
