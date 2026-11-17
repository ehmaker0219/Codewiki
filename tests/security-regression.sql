-- Run only in a disposable PostgreSQL/Supabase database after supabase-setup.sql.
begin;
do $test$
declare
  v_name text := 'security-test-' || gen_random_uuid()::text;
  v_password text := gen_random_uuid()::text;
  v_profile jsonb;
  v_token uuid;
  v_id uuid;
  v_denied boolean;
begin
  v_profile := public.cw_signup(v_name, v_password, 'Security test');
  v_token := (v_profile->>'session_token')::uuid;
  v_id := (v_profile->>'id')::uuid;
  assert public.cw_me(v_token) is not null, 'signup session must work';
  update public.cw_users set status = 'approved' where id = v_id;
  perform public.cw_create_post(v_token, '질문·기타', 'abap-intro', 'Intro', 'Normal', 'Content');
  assert jsonb_array_length(public.cw_list_posts(v_token)) > 0, 'approved member can post';
  perform public.cw_logout(v_token);
  perform public.cw_logout(v_token);
  assert public.cw_me(v_token) is null, 'logout must revoke token, including retries';
  assert public.cw_list_posts(v_token) = '[]'::jsonb, 'revoked token must not read';
  v_profile := public.cw_login(v_name, v_password);
  v_token := (v_profile->>'session_token')::uuid;
  assert public.cw_me(v_token) is not null, 'fresh login works';
  update public.cw_users set role = 'admin', session_expires_at = now() - interval '1 second' where id = v_id;
  assert public.cw_me(v_token) is null, 'expired admin cannot get profile';
  assert public.cw_list_posts(v_token) = '[]'::jsonb, 'expired admin cannot read posts';
  v_denied := false;
  begin perform public.cw_admin_list_users(v_token); exception when raise_exception then v_denied := true; end;
  assert v_denied, 'expired admin cannot list users';
  v_denied := false;
  begin perform public.cw_admin_set_status(v_token,v_id,'approved'); exception when raise_exception then v_denied := true; end;
  assert v_denied, 'expired admin cannot approve';
  v_denied := false;
  begin perform public.cw_create_post(v_token,'질문·기타',null,null,'test','test'); exception when raise_exception then v_denied := true; end;
  assert v_denied, 'expired admin cannot create';
  v_denied := false;
  begin perform public.cw_update_post(v_token,-1,'done','test'); exception when raise_exception then v_denied := true; end;
  assert v_denied, 'expired admin cannot moderate';
  v_denied := false;
  begin perform public.cw_delete_post(v_token,-1); exception when raise_exception then v_denied := true; end;
  assert v_denied, 'expired admin cannot delete';
  perform public.cw_logout(v_token);
  assert (select session_token is null from public.cw_users where id=v_id), 'expired sessions can be revoked';
  assert not exists(select 1 from public.cw_users where username='admin' and role='admin'
    and password_hash=extensions.crypt('admin1234', password_hash)), 'historical default credential must be disabled';
end;
$test$;
rollback;
