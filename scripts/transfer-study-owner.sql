-- DB-owner maintenance only; never expose as an RPC or embed account IDs here.
-- Caller wraps this script and student-only-study migration in one transaction,
-- sets local codewiki.transfer_from / codewiki.transfer_to to verified UUIDs.
do $transfer$
declare
  source_id uuid:=current_setting('codewiki.transfer_from')::uuid;
  target_id uuid:=current_setting('codewiki.transfer_to')::uuid;
  before_notes jsonb; before_folders jsonb; before_assignments jsonb;
begin
  if source_id is null or target_id is null or source_id=target_id then
    raise exception 'Distinct transfer accounts required' using errcode='22023';
  end if;
  perform 1 from public.cw_users where id in (source_id,target_id) order by id for update;
  if not exists(select 1 from public.cw_users where id=source_id and role='admin')
     or not exists(select 1 from public.cw_users where id=target_id and role='student' and status='approved') then
    raise exception 'Expected an administrator and an approved student' using errcode='22023';
  end if;
  -- Block concurrent note/folder changes while preserving every original field.
  lock table public.cw_study_notes,public.cw_study_folders,public.cw_study_note_folders in share row exclusive mode;
  if exists(select 1 from public.cw_study_folders a join public.cw_study_folders b on a.name=b.name
            where a.owner_id=source_id and b.owner_id=target_id) then
    raise exception 'Folder names overlap; resolve before transfer' using errcode='23505';
  end if;
  if exists(select 1 from public.cw_study_note_folders m
      join public.cw_study_notes n on n.id=m.note_id join public.cw_study_folders f on f.id=m.folder_id
      where (m.owner_id in (source_id,target_id) or n.owner_id in (source_id,target_id) or f.owner_id in (source_id,target_id))
        and (m.owner_id<>n.owner_id or m.owner_id<>f.owner_id)) then
    raise exception 'Inconsistent folder ownership' using errcode='23514';
  end if;
  select coalesce(jsonb_agg(to_jsonb(n)-'owner_id' order by id),'[]') into before_notes
    from public.cw_study_notes n where owner_id in (source_id,target_id);
  select coalesce(jsonb_agg(to_jsonb(f)-'owner_id' order by id),'[]') into before_folders
    from public.cw_study_folders f where owner_id in (source_id,target_id);
  select coalesce(jsonb_agg(to_jsonb(m)-'owner_id' order by note_id),'[]') into before_assignments
    from public.cw_study_note_folders m where owner_id in (source_id,target_id);
  update public.cw_study_notes set owner_id=target_id where owner_id=source_id;
  update public.cw_study_folders set owner_id=target_id where owner_id=source_id;
  update public.cw_study_note_folders set owner_id=target_id where owner_id=source_id;
  if before_notes is distinct from (select coalesce(jsonb_agg(to_jsonb(n)-'owner_id' order by id),'[]') from public.cw_study_notes n where owner_id=target_id)
     or before_folders is distinct from (select coalesce(jsonb_agg(to_jsonb(f)-'owner_id' order by id),'[]') from public.cw_study_folders f where owner_id=target_id)
     or before_assignments is distinct from (select coalesce(jsonb_agg(to_jsonb(m)-'owner_id' order by note_id),'[]') from public.cw_study_note_folders m where owner_id=target_id) then
    raise exception 'Transfer preservation check failed' using errcode='23514';
  end if;
end;
$transfer$;
