-- Isolated test database ONLY. Every fixture is rolled back.
begin;
do $test$
declare admin_token uuid:=gen_random_uuid(); expired_token uuid:=gen_random_uuid(); student_token uuid:=gen_random_uuid();
  admin_id uuid; rejected_id uuid; approved_id uuid; pending_id uuid; target uuid; invalid_token uuid;
begin
  insert into public.cw_users(username,password_hash,full_name,class_name,role,status,session_token,session_expires_at)
    values('delete-test-admin','invalid','Admin','1반','admin','approved',admin_token,now()+interval '1 hour') returning id into admin_id;
  insert into public.cw_users(username,password_hash,full_name,class_name,role,status,session_token,session_expires_at)
    values('delete-test-expired','invalid','Expired','1반','admin','approved',expired_token,now()-interval '1 hour');
  insert into public.cw_users(username,password_hash,full_name,class_name,role,status,session_token,session_expires_at)
    values('delete-test-rejected','invalid','Rejected','1반','student','rejected',student_token,now()+interval '1 hour') returning id into rejected_id;
  insert into public.cw_users(username,password_hash,full_name,class_name,role,status)
    values('delete-test-approved','invalid','Approved','1반','student','approved') returning id into approved_id;
  insert into public.cw_users(username,password_hash,full_name,class_name,role,status)
    values('delete-test-pending','invalid','Pending','1반','student','pending') returning id into pending_id;
  insert into public.cw_birthdays values(rejected_id,date '2000-01-01',false);
  insert into public.cw_feedback_posts(author_id,author_name,title,content)
    values(rejected_id,'Test','Preserved post','Existing content');
  perform set_config('test.delete_admin',admin_token::text,true);
  perform set_config('test.delete_target',rejected_id::text,true);
  foreach invalid_token in array array[null::uuid,gen_random_uuid(),expired_token,student_token] loop
    begin
      perform public.cw_admin_delete_rejected_user(invalid_token,rejected_id);
      raise exception 'Unauthorized deletion allowed';
    exception when insufficient_privilege then null; end;
  end loop;
  foreach target in array array[admin_id,approved_id,pending_id,gen_random_uuid(),null::uuid] loop
    begin
      perform public.cw_admin_delete_rejected_user(admin_token,target);
      raise exception 'Non-rejected target deleted';
    exception when invalid_parameter_value then null; end;
  end loop;
end;
$test$;
set local role anon;
select public.cw_admin_delete_rejected_user(current_setting('test.delete_admin')::uuid,current_setting('test.delete_target')::uuid);
reset role;
do $test$
begin
  if exists(select 1 from public.cw_users where id=current_setting('test.delete_target')::uuid) then raise exception 'Account not deleted'; end if;
  if exists(select 1 from public.cw_birthdays where user_id=current_setting('test.delete_target')::uuid) then raise exception 'Private birthday not deleted'; end if;
  if not exists(select 1 from public.cw_feedback_posts where title='Preserved post' and author_id is null) then raise exception 'Existing post lost'; end if;
  -- Deleted usernames are available for reapplication, still pending approval.
  if public.cw_signup_with_birthday('delete-test-rejected','test-password','New request','1반','',null,false)->>'status' <> 'pending' then
    raise exception 'Reapplication failed';
  end if;
end;
$test$;
rollback;
