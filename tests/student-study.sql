-- Isolated PostgreSQL fixtures only; never run against production.
begin;
do $fixtures$
declare tokens uuid[]:=array[]::uuid[]; token uuid; i int;
begin
  for i in 1..7 loop
    token:=gen_random_uuid();tokens:=array_append(tokens,token);
    insert into public.cw_users(username,password_hash,full_name,role,status,session_token,session_expires_at)
    values('student-study-'||token,'not-a-password-hash','Private study fixture',
      case when i=3 then 'admin' else 'student' end,
      case when i=4 then 'pending' when i=5 then 'rejected' else 'approved' end,
      case when i=7 then null else token end,
      now()+case when i=6 then interval '-1 second' else interval '1 hour' end);
  end loop;
  perform set_config('test.study_members',tokens::text,true);
end;
$fixtures$;
set local role anon;
do $test$
declare tokens uuid[]:=current_setting('test.study_members')::uuid[];
  notes uuid[]:=array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
  folders uuid[]:=array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
  i int; j int; t uuid; saved jsonb; snapshot jsonb;
begin
  for i in 1..3 loop
    saved:=public.cw_save_study_note(tokens[i],notes[i],'My note','private body '||i,0);
    assert (saved->>'revision')::int=1;
    perform public.cw_save_study_folder(tokens[i],folders[i],'Same folder name',0);
    snapshot:=public.cw_get_study_note(tokens[i],notes[i]);
    perform public.cw_move_study_note(tokens[i],notes[i],folders[i]);
    assert public.cw_get_study_note(tokens[i],notes[i])=snapshot;
  end loop;
  for i in 1..3 loop
    assert jsonb_array_length(public.cw_list_study_notes(tokens[i]))=1;
    assert jsonb_array_length(public.cw_get_study_folders(tokens[i])->'folders')=1;
    assert jsonb_array_length(public.cw_get_study_folders(tokens[i])->'assignments')=1;
    assert public.cw_get_study_folders(tokens[i])->'assignments'->0->>'note_id'=notes[i]::text;
    for j in 1..3 loop
      if i=j then continue; end if;
      -- Student/student, student/admin and admin/student are all owner-isolated.
      assert public.cw_get_study_note(tokens[i],notes[j]) is null;
      begin perform public.cw_save_study_note(tokens[i],notes[j],'stolen','stolen',1);raise exception 'foreign note update';exception when sqlstate 'PT409' then null;end;
      begin perform public.cw_save_study_note(tokens[i],notes[j],'stolen','stolen',0);raise exception 'foreign note claim';exception when sqlstate 'PT409' then null;end;
      begin perform public.cw_delete_study_note(tokens[i],notes[j],1);raise exception 'foreign note delete';exception when sqlstate 'PT409' then null;end;
      begin perform public.cw_save_study_folder(tokens[i],folders[j],'stolen',1);raise exception 'foreign folder update';exception when sqlstate 'PT409' then null;end;
      begin perform public.cw_delete_study_folder(tokens[i],folders[j],1);raise exception 'foreign folder delete';exception when sqlstate 'PT409' then null;end;
      begin perform public.cw_move_study_note(tokens[i],notes[j],folders[i]);raise exception 'foreign note move';exception when sqlstate 'PT409' then null;end;
      begin perform public.cw_move_study_note(tokens[i],notes[i],folders[j]);raise exception 'foreign folder move';exception when sqlstate 'PT409' then null;end;
    end loop;
  end loop;
  for i in 1..3 loop
    saved:=public.cw_save_study_note(tokens[i],notes[i],'Edited','edited body',1);
    assert (saved->>'revision')::int=2;
    begin perform public.cw_save_study_note(tokens[i],notes[i],'stale','stale',1);raise exception 'stale save';exception when sqlstate 'PT409' then null;end;
    perform public.cw_save_study_folder(tokens[i],folders[i],'Renamed',1);
    perform public.cw_delete_study_folder(tokens[i],folders[i],2);
    assert public.cw_get_study_note(tokens[i],notes[i])->>'body'='edited body';
    assert jsonb_array_length(public.cw_get_study_folders(tokens[i])->'assignments')=0;
    perform public.cw_delete_study_note(tokens[i],notes[i],2);
  end loop;
  foreach t in array array[tokens[4],tokens[5],tokens[6],tokens[7],gen_random_uuid(),null::uuid] loop
    begin perform public.cw_list_study_notes(t);raise exception 'unauthorized list';exception when insufficient_privilege then null;end;
    begin perform public.cw_get_study_note(t,notes[1]);raise exception 'unauthorized get';exception when insufficient_privilege then null;end;
    begin perform public.cw_save_study_note(t,gen_random_uuid(),'bad','bad',0);raise exception 'unauthorized save';exception when insufficient_privilege then null;end;
    begin perform public.cw_delete_study_note(t,notes[1],1);raise exception 'unauthorized delete';exception when insufficient_privilege then null;end;
    begin perform public.cw_get_study_folders(t);raise exception 'unauthorized folders';exception when insufficient_privilege then null;end;
    begin perform public.cw_save_study_folder(t,gen_random_uuid(),'bad',0);raise exception 'unauthorized folder save';exception when insufficient_privilege then null;end;
    begin perform public.cw_delete_study_folder(t,folders[1],1);raise exception 'unauthorized folder delete';exception when insufficient_privilege then null;end;
    begin perform public.cw_move_study_note(t,notes[1],folders[1]);raise exception 'unauthorized move';exception when insufficient_privilege then null;end;
  end loop;
  begin perform 1 from public.cw_study_notes;raise exception 'direct notes read';exception when insufficient_privilege then null;end;
  begin perform 1 from public.cw_study_folders;raise exception 'direct folders read';exception when insufficient_privilege then null;end;
  begin perform 1 from public.cw_study_note_folders;raise exception 'direct mappings read';exception when insufficient_privilege then null;end;
  begin perform public.cw_study_owner(tokens[1]);raise exception 'helper access';exception when insufficient_privilege then null;end;
end;
$test$;
reset role;
-- Approval withdrawn while the same token remains must take effect immediately.
update public.cw_users set status='rejected' where session_token=(current_setting('test.study_members')::uuid[])[1];
set local role anon;
do $test$
begin
  begin perform public.cw_list_study_notes((current_setting('test.study_members')::uuid[])[1]);raise exception 'approval revocation ignored';exception when insufficient_privilege then null;end;
end;
$test$;
reset role;
rollback;
