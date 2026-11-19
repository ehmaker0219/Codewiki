-- Disposable in-memory DB only. No production writes.
begin;
do $fixtures$
declare token uuid;
begin
  foreach token in array array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid()] loop
    insert into public.cw_users(username,password_hash,full_name,role,status,session_token,session_expires_at)
      values('folder-test-'||token,'not-a-password-hash','Folder fixture','admin','approved',token,now()+interval '1 hour');
    if current_setting('test.folder_a',true) is null then perform set_config('test.folder_a',token::text,true);
    elsif current_setting('test.folder_b',true) is null then perform set_config('test.folder_b',token::text,true);
    else
      update public.cw_users set role='student' where session_token=token;
      perform set_config('test.folder_s',token::text,true);
    end if;
  end loop;
end;
$fixtures$;
set local role anon;
do $test$
declare a uuid:=current_setting('test.folder_a')::uuid; b uuid:=current_setting('test.folder_b')::uuid;
  s uuid:=current_setting('test.folder_s')::uuid; n uuid:=gen_random_uuid(); f uuid:=gen_random_uuid(); other uuid:=gen_random_uuid(); t uuid; r jsonb; before_note jsonb;
begin
  perform public.cw_save_study_note(a,n,'Original','private body',0);
  before_note:=public.cw_get_study_note(a,n);
  r:=public.cw_save_study_folder(a,f,'  ABAP 필기  ',0);
  assert r->>'name'='ABAP 필기';assert (r->>'revision')::int=1;
  perform public.cw_save_study_folder(b,other,'ABAP 필기',0); -- names are owner-scoped
  begin perform public.cw_save_study_folder(a,gen_random_uuid(),'ABAP 필기',0);raise exception 'duplicate allowed';exception when unique_violation then null;end;
  begin perform public.cw_save_study_folder(a,gen_random_uuid(),' ',0);raise exception 'blank allowed';exception when invalid_parameter_value then null;end;
  begin perform public.cw_save_study_folder(a,gen_random_uuid(),repeat('x',61),0);raise exception 'long name allowed';exception when invalid_parameter_value then null;end;
  begin perform public.cw_save_study_folder(b,f,'stolen',1);raise exception 'foreign rename';exception when sqlstate 'PT409' then null;end;
  begin perform public.cw_delete_study_folder(b,f,1);raise exception 'foreign delete';exception when sqlstate 'PT409' then null;end;
  begin perform public.cw_move_study_note(b,n,other);raise exception 'foreign note';exception when sqlstate 'PT409' then null;end;
  begin perform public.cw_move_study_note(a,n,other);raise exception 'foreign folder';exception when sqlstate 'PT409' then null;end;
  perform public.cw_move_study_note(a,n,f);
  assert public.cw_get_study_note(a,n)=before_note,'moving changes body or revision';
  assert jsonb_array_length(public.cw_get_study_folders(a)->'folders')=1;
  assert public.cw_get_study_folders(a)->'assignments'->0->>'folder_id'=f::text;
  assert jsonb_array_length(public.cw_get_study_folders(b)->'assignments')=0;
  perform public.cw_move_study_note(a,n,null);
  assert jsonb_array_length(public.cw_get_study_folders(a)->'assignments')=0;
  perform public.cw_move_study_note(a,n,f);
  perform public.cw_save_study_folder(a,f,'수업 필기',1);
  begin perform public.cw_delete_study_folder(a,f,1);raise exception 'stale delete';exception when sqlstate 'PT409' then null;end;
  begin perform public.cw_save_study_folder(a,f,'stale',1);raise exception 'stale rename';exception when sqlstate 'PT409' then null;end;
  foreach t in array array[s,gen_random_uuid(),null::uuid] loop
    begin perform public.cw_get_study_folders(t);raise exception 'unauthorized read';exception when insufficient_privilege then null;end;
    begin perform public.cw_save_study_folder(t,gen_random_uuid(),'bad',0);raise exception 'unauthorized create';exception when insufficient_privilege then null;end;
    begin perform public.cw_delete_study_folder(t,f,2);raise exception 'unauthorized delete';exception when insufficient_privilege then null;end;
    begin perform public.cw_move_study_note(t,n,f);raise exception 'unauthorized move';exception when insufficient_privilege then null;end;
  end loop;
  begin perform 1 from public.cw_study_folders;raise exception 'direct folder read';exception when insufficient_privilege then null;end;
  begin perform 1 from public.cw_study_note_folders;raise exception 'direct mapping read';exception when insufficient_privilege then null;end;
  perform public.cw_delete_study_folder(a,f,2);
  assert public.cw_get_study_note(a,n)=before_note,'folder deletion removed/changed a note';
  assert jsonb_array_length(public.cw_get_study_folders(a)->'assignments')=0;
  perform public.cw_save_study_folder(a,f,'Recreated',0);
  perform public.cw_move_study_note(a,n,f);
  perform public.cw_delete_study_note(a,n,1);
  assert jsonb_array_length(public.cw_get_study_folders(a)->'assignments')=0,'deleted note left an assignment';
end;
$test$;
reset role;
rollback;
