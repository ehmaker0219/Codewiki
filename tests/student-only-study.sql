-- Run in isolated DB after the student-only migration.
begin;
do $fixtures$
declare a uuid:=gen_random_uuid(); s uuid:=gen_random_uuid();
begin
  insert into public.cw_users(username,password_hash,full_name,role,status,session_token,session_expires_at)
    values ('retired-admin-'||a,'not-a-password-hash','Admin fixture','admin','approved',a,now()+interval '1 hour'),
           ('active-student-'||s,'not-a-password-hash','Student fixture','student','approved',s,now()+interval '1 hour');
  perform set_config('test.retired_admin',a::text,true);perform set_config('test.active_student',s::text,true);
end;
$fixtures$;
set local role anon;
do $test$
declare a uuid:=current_setting('test.retired_admin')::uuid; s uuid:=current_setting('test.active_student')::uuid;
  n uuid:=gen_random_uuid(); f uuid:=gen_random_uuid(); t uuid;
begin
  perform public.cw_save_study_note(s,n,'Student note','private',0);
  perform public.cw_save_study_folder(s,f,'Folder',0);
  perform public.cw_move_study_note(s,n,f);
  assert jsonb_array_length(public.cw_list_study_notes(s))=1;
  assert public.cw_get_study_note(s,n)->>'body'='private';
  assert public.cw_get_study_folders(s)->'assignments'->0->>'note_id'=n::text;
  foreach t in array array[a,gen_random_uuid(),null::uuid] loop
    begin perform public.cw_list_study_notes(t);raise exception 'denied role list';exception when insufficient_privilege then null;end;
    begin perform public.cw_get_study_note(t,n);raise exception 'denied role get';exception when insufficient_privilege then null;end;
    begin perform public.cw_save_study_note(t,gen_random_uuid(),'bad','bad',0);raise exception 'denied role save';exception when insufficient_privilege then null;end;
    begin perform public.cw_delete_study_note(t,n,1);raise exception 'denied role delete';exception when insufficient_privilege then null;end;
    begin perform public.cw_get_study_folders(t);raise exception 'denied role folders';exception when insufficient_privilege then null;end;
    begin perform public.cw_save_study_folder(t,gen_random_uuid(),'bad',0);raise exception 'denied role folder save';exception when insufficient_privilege then null;end;
    begin perform public.cw_delete_study_folder(t,f,1);raise exception 'denied role folder delete';exception when insufficient_privilege then null;end;
    begin perform public.cw_move_study_note(t,n,f);raise exception 'denied role move';exception when insufficient_privilege then null;end;
  end loop;
  perform public.cw_save_study_note(s,n,'Edited','private edited',1);
  perform public.cw_delete_study_folder(s,f,1);
  assert public.cw_get_study_note(s,n)->>'body'='private edited';
  perform public.cw_delete_study_note(s,n,2);
end;
$test$;
reset role;
rollback;
