-- Transaction-only verification for 20261120-security-review-hardening.sql.
begin;
do $test$
declare
  v_admin_token uuid := gen_random_uuid();
  v_user_token uuid := gen_random_uuid();
  v_rejected_token uuid := gen_random_uuid();
  v_user_id uuid;
  v_other_id uuid;
  v_post_id bigint;
  v_note_id uuid := gen_random_uuid();
  v_folder_id uuid := gen_random_uuid();
  v_denied boolean;
begin
  insert into public.cw_users(username,password_hash,full_name,class_name,role,status,session_token,session_expires_at)
  values
    ('rev-admin-'||v_admin_token,'invalid','Admin','운영진','admin','approved',v_admin_token,now()+interval '1 hour'),
    ('rev-user-'||v_user_token,'invalid','Student','2반','student','approved',v_user_token,now()+interval '1 hour');

  select id into v_user_id from public.cw_users where session_token = v_user_token;

  insert into public.cw_users(username,password_hash,full_name,class_name,role,status,session_token,session_expires_at)
  values ('rev-rej-'||v_rejected_token,'invalid','Rejected','2반','student','rejected',v_rejected_token,now()+interval '1 hour')
  returning id into v_other_id;

  -- 1. Session token index exists and legacy table privileges are revoked.
  assert exists(select 1 from pg_indexes where schemaname='public' and indexname='cw_users_session_token_uidx'), 'session_token unique index missing';
  assert not has_table_privilege('anon','public.cw_users','SELECT'), 'anon must not have table SELECT on cw_users';
  assert not has_table_privilege('anon','public.cw_feedback_posts','SELECT'), 'anon must not have table SELECT on cw_feedback_posts';

  -- 2. Legacy SECURITY DEFINER functions include pg_temp in search_path and revoke PUBLIC execute.
  assert (select exists(
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='cw_me'
      and array_to_string(p.proconfig, ',') like '%pg_temp%'
  )), 'cw_me must pin pg_temp';
  assert not has_function_privilege('public','public.cw_me(uuid)','EXECUTE'), 'PUBLIC execute must be revoked on cw_me';

  -- 3. Post input validation rejects empty/oversized content.
  v_denied := false;
  begin perform public.cw_create_post(v_user_token,'질문·기타',null,null,'   ','body'); exception when invalid_parameter_value then v_denied := true; end;
  assert v_denied, 'empty post title must fail';
  v_denied := false;
  begin perform public.cw_create_post(v_user_token,'질문·기타',null,null,'title',repeat('a',5001)); exception when invalid_parameter_value then v_denied := true; end;
  assert v_denied, 'oversized post content must fail';

  -- 4. Rejected account cannot delete posts or read/write birthdays even if a token row existed.
  perform public.cw_create_post(v_user_token,'질문·기타',null,null,'Owned','Body');
  select id into v_post_id from public.cw_feedback_posts where author_id = v_user_id limit 1;
  v_denied := false;
  begin perform public.cw_delete_post(v_rejected_token, v_post_id); exception when insufficient_privilege then v_denied := true; end;
  assert v_denied, 'rejected user must not delete posts';
  v_denied := false;
  begin perform public.cw_get_my_birthday(v_rejected_token); exception when insufficient_privilege then v_denied := true; end;
  assert v_denied, 'rejected user must not read birthday';
  v_denied := false;
  begin perform public.cw_set_my_birthday(v_rejected_token, '2000-01-01', false); exception when insufficient_privilege then v_denied := true; end;
  assert v_denied, 'rejected user must not set birthday';

  -- 5. Admin revoking status invalidates the student session immediately.
  perform public.cw_admin_set_status(v_admin_token, v_user_id, 'rejected');
  assert public.cw_me(v_user_token) is null, 'rejected student session must be cleared immediately';
  v_denied := false;
  begin perform public.cw_delete_post(v_user_token, v_post_id); exception when insufficient_privilege then v_denied := true; end;
  assert v_denied, 'revoked session must not delete own post';

  -- 6. Cross-owner study folder assignment is rejected at the schema layer.
  insert into public.cw_study_notes(id,owner_id,title,body) values(v_note_id, v_user_id, 'Note', 'Body');
  insert into public.cw_study_folders(id,owner_id,name) values(v_folder_id, v_other_id, 'OtherFolder');
  v_denied := false;
  begin
    insert into public.cw_study_note_folders(note_id,owner_id,folder_id) values(v_note_id, v_user_id, v_folder_id);
    set constraints all immediate;
  exception when foreign_key_violation then v_denied := true; end;
  assert v_denied, 'cross-owner note-folder FK must be enforced';
end;
$test$;
rollback;
