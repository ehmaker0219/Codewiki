-- Private folder metadata is independent of note bodies/revisions.
begin;
set local lock_timeout = '5s';
create table if not exists public.cw_study_folders (
  id uuid primary key,
  owner_id uuid not null references public.cw_users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  revision integer not null default 1,
  unique(owner_id,name)
);
create table if not exists public.cw_study_note_folders (
  note_id uuid primary key references public.cw_study_notes(id) on delete cascade,
  owner_id uuid not null references public.cw_users(id) on delete cascade,
  folder_id uuid not null references public.cw_study_folders(id) on delete cascade
);
create index if not exists cw_study_note_folders_owner on public.cw_study_note_folders(owner_id);
create index if not exists cw_study_note_folders_folder on public.cw_study_note_folders(folder_id);
alter table public.cw_study_folders enable row level security;
alter table public.cw_study_note_folders enable row level security;
revoke all on public.cw_study_folders,public.cw_study_note_folders from public,anon,authenticated;

create or replace function public.cw_get_study_folders(p_token uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare uid uuid:=public.cw_study_owner(p_token);
begin
  return jsonb_build_object(
    'folders',coalesce((select jsonb_agg(to_jsonb(f) order by f.name,f.id) from public.cw_study_folders f where f.owner_id=uid),'[]'::jsonb),
    'assignments',coalesce((select jsonb_agg(jsonb_build_object('note_id',n.note_id,'folder_id',n.folder_id)) from public.cw_study_note_folders n where n.owner_id=uid),'[]'::jsonb));
end;
$fn$;

create or replace function public.cw_save_study_folder(p_token uuid,p_id uuid,p_name text,p_revision integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare uid uuid:=public.cw_study_owner(p_token); saved public.cw_study_folders;
begin
  if p_id is null or p_name is null or length(trim(p_name)) not between 1 and 60 or p_revision is null or p_revision<0 then
    raise exception '폴더 이름은 1~60자로 입력해 주세요.' using errcode='22023';
  end if;
  if p_revision=0 then
    insert into public.cw_study_folders(id,owner_id,name) values(p_id,uid,trim(p_name))
      on conflict(id) do nothing returning * into saved;
  else
    update public.cw_study_folders set name=trim(p_name),revision=revision+1
      where id=p_id and owner_id=uid and revision=p_revision returning * into saved;
  end if;
  if saved.id is null then raise exception '폴더가 변경되었습니다. 목록을 새로 불러와 주세요.' using errcode='PT409'; end if;
  return to_jsonb(saved);
end;
$fn$;

create or replace function public.cw_delete_study_folder(p_token uuid,p_id uuid,p_revision integer)
returns void language plpgsql security definer set search_path=public,pg_temp as $fn$
declare uid uuid:=public.cw_study_owner(p_token);
begin
  -- Only assignments cascade; the notes themselves are never deleted.
  delete from public.cw_study_folders where id=p_id and owner_id=uid and revision=p_revision;
  if not found then raise exception '폴더가 변경되었습니다. 목록을 새로 불러와 주세요.' using errcode='PT409'; end if;
end;
$fn$;

create or replace function public.cw_move_study_note(p_token uuid,p_note_id uuid,p_folder_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare uid uuid:=public.cw_study_owner(p_token);
begin
  -- Serialize moves with note deletion, without changing body/save revisions.
  perform 1 from public.cw_study_notes where id=p_note_id and owner_id=uid for update;
  if not found then raise exception '노트를 찾을 수 없습니다.' using errcode='PT409'; end if;
  if p_folder_id is null then
    delete from public.cw_study_note_folders where note_id=p_note_id and owner_id=uid;
  else
    perform 1 from public.cw_study_folders where id=p_folder_id and owner_id=uid for key share;
    if not found then raise exception '폴더를 찾을 수 없습니다.' using errcode='PT409'; end if;
    insert into public.cw_study_note_folders(note_id,owner_id,folder_id) values(p_note_id,uid,p_folder_id)
      on conflict(note_id) do update set folder_id=excluded.folder_id where cw_study_note_folders.owner_id=uid;
  end if;
  return jsonb_build_object('note_id',p_note_id,'folder_id',p_folder_id);
end;
$fn$;
revoke all on function public.cw_get_study_folders(uuid),public.cw_save_study_folder(uuid,uuid,text,integer),
  public.cw_delete_study_folder(uuid,uuid,integer),public.cw_move_study_note(uuid,uuid,uuid) from public;
grant execute on function public.cw_get_study_folders(uuid),public.cw_save_study_folder(uuid,uuid,text,integer),
  public.cw_delete_study_folder(uuid,uuid,integer),public.cw_move_study_note(uuid,uuid,uuid) to anon,authenticated;
notify pgrst,'reload schema';
commit;
