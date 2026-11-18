-- Synthetic account only; always roll back the entire test transaction.
begin;
do $test$
declare
  username text := 'session-test-' || gen_random_uuid()::text;
  password text := gen_random_uuid()::text;
  profile jsonb;
  uid uuid;
  token uuid;
  old_token uuid;
begin
  profile := public.cw_signup(username,password,'Session test');
  uid := (profile->>'id')::uuid;
  old_token := (profile->>'session_token')::uuid;
  assert (select session_expires_at = now() + interval '24 hours' from public.cw_users where id=uid);
  update public.cw_users set status='approved' where id=uid;
  profile := public.cw_login(username,password);
  token := (profile->>'session_token')::uuid;
  assert (select session_expires_at = now() + interval '24 hours' from public.cw_users where id=uid);
  assert public.cw_me(old_token) is null, 'replaced token stays invalid';
  update public.cw_users set role='admin' where id=uid;
  old_token := token;
  profile := public.cw_login(username,password);
  token := (profile->>'session_token')::uuid;
  assert (select session_expires_at = now() + interval '12 hours' from public.cw_users where id=uid), 'admins retain 12-hour limit';
  assert public.cw_me(old_token) is null, 'replaced member token stays invalid';
  update public.cw_users set session_expires_at=now()+interval '1 second' where id=uid;
  assert public.cw_me(token) is not null, 'unexpired session restores';
  update public.cw_users set session_expires_at=now()-interval '1 second' where id=uid;
  assert public.cw_me(token) is null, 'expired session stays invalid';
  profile := public.cw_login(username,password);
  token := (profile->>'session_token')::uuid;
  perform public.cw_logout(token);
  assert public.cw_me(token) is null, 'logout immediately revokes session';
end;
$test$;
rollback;
