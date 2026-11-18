-- Private study notes. Only a valid administrator can access their own notes.
begin;
create table if not exists public.cw_study_notes (
  id uuid primary key,
  owner_id uuid not null references public.cw_users(id) on delete cascade,
  title text not null check (length(title) between 1 and 120),
  body text not null default '' check (length(body) <= 200000),
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cw_study_notes_owner_updated on public.cw_study_notes(owner_id, updated_at desc);
alter table public.cw_study_notes enable row level security;
revoke all on public.cw_study_notes from public, anon, authenticated;

create or replace function public.cw_study_owner(p_token uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare uid uuid;
begin
  select id into uid from public.cw_users
    where session_token=p_token and session_expires_at>now() and role='admin';
  if uid is null then raise exception '관리자 로그인이 필요합니다.' using errcode='42501'; end if;
  return uid;
end;
$fn$;
revoke all on function public.cw_study_owner(uuid) from public, anon, authenticated;

create or replace function public.cw_list_study_notes(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare uid uuid:=public.cw_study_owner(p_token);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'title',n.title,
    'updated_at',n.updated_at,'revision',n.revision) order by n.updated_at desc)
    from public.cw_study_notes n where n.owner_id=uid),'[]'::jsonb);
end;
$fn$;

create or replace function public.cw_get_study_note(p_token uuid,p_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare uid uuid:=public.cw_study_owner(p_token);
begin
  return (select to_jsonb(n) from public.cw_study_notes n where n.owner_id=uid and n.id=p_id);
end;
$fn$;

create or replace function public.cw_save_study_note(p_token uuid,p_id uuid,p_title text,p_body text,p_revision integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare uid uuid:=public.cw_study_owner(p_token); saved public.cw_study_notes;
begin
  if p_id is null or p_revision is null or p_revision<0 or p_title is null or
     length(trim(p_title)) not between 1 and 120 or p_body is null or length(p_body)>200000 then
    raise exception '제목은 120자, 본문은 20만 자까지 입력할 수 있습니다.' using errcode='22023';
  end if;
  if p_revision=0 then
    insert into public.cw_study_notes(id,owner_id,title,body)
      values(p_id,uid,trim(p_title),p_body) on conflict(id) do nothing returning * into saved;
  else
    update public.cw_study_notes set title=trim(p_title),body=p_body,revision=revision+1,updated_at=clock_timestamp()
      where id=p_id and owner_id=uid and revision=p_revision returning * into saved;
  end if;
  if saved.id is null then raise exception '다른 창에서 수정되거나 삭제된 노트입니다.' using errcode='40001'; end if;
  return to_jsonb(saved);
end;
$fn$;

create or replace function public.cw_delete_study_note(p_token uuid,p_id uuid,p_revision integer)
returns void language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare uid uuid:=public.cw_study_owner(p_token);
begin
  delete from public.cw_study_notes where id=p_id and owner_id=uid and revision=p_revision;
  if not found then raise exception '다른 창에서 수정되거나 삭제된 노트입니다.' using errcode='40001'; end if;
end;
$fn$;
revoke all on function public.cw_list_study_notes(uuid),public.cw_get_study_note(uuid,uuid),
  public.cw_save_study_note(uuid,uuid,text,text,integer),public.cw_delete_study_note(uuid,uuid,integer) from public;
grant execute on function public.cw_list_study_notes(uuid),public.cw_get_study_note(uuid,uuid),
  public.cw_save_study_note(uuid,uuid,text,text,integer),public.cw_delete_study_note(uuid,uuid,integer) to anon,authenticated;
notify pgrst, 'reload schema';
commit;
