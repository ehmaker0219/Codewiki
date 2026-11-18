-- Disposable fixtures. Always rolled back, including any test progress rows.
begin;
do $test$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); expired uuid := gen_random_uuid(); pending uuid := gen_random_uuid();
begin
  insert into public.cw_users(username,password_hash,full_name,role,status,session_token,session_expires_at)
    values ('verify-'||a, 'not-a-password-hash','Progress fixture','student','approved',a,now()+interval '1 hour'),
           ('verify-'||b, 'not-a-password-hash','Progress fixture','student','approved',b,now()+interval '1 hour'),
           ('verify-'||expired, 'not-a-password-hash','Progress fixture','student','approved',expired,now()-interval '1 hour'),
           ('verify-'||pending, 'not-a-password-hash','Progress fixture','student','pending',pending,now()+interval '1 hour');
  perform set_config('test.progress_a',a::text,true);
  perform set_config('test.progress_b',b::text,true);
  perform set_config('test.progress_expired',expired::text,true);
  perform set_config('test.progress_pending',pending::text,true);
end;
$test$;
set local role anon;
do $test$
declare a uuid := current_setting('test.progress_a')::uuid; b uuid := current_setting('test.progress_b')::uuid; t uuid;
begin
  perform public.cw_set_progress(a, 'abap-basics', true);
  if not exists(select 1 from public.cw_get_progress(a) where doc_id='abap-basics' and completed) then raise exception 'save failed'; end if;
  if exists(select 1 from public.cw_get_progress(b)) then raise exception 'account isolation failed'; end if;
  perform public.cw_set_progress(a, 'abap-basics', false);
  if not exists(select 1 from public.cw_get_progress(a) where doc_id='abap-basics' and not completed) then raise exception 'unread failed'; end if;
  if (select count(*) from public.cw_get_progress(a)) <> 1 then raise exception 'upsert duplicated'; end if;
  begin
    perform 1 from public.cw_learning_progress;
    raise exception 'direct read unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.cw_learning_progress;
    raise exception 'direct write unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  foreach t in array array[null::uuid, gen_random_uuid(), current_setting('test.progress_expired')::uuid, current_setting('test.progress_pending')::uuid] loop
    begin
      perform public.cw_get_progress(t);
      raise exception 'unauthorized read allowed';
    exception when insufficient_privilege then null; end;
    begin
      perform public.cw_set_progress(t,'abap-basics',true);
      raise exception 'unauthorized write allowed';
    exception when insufficient_privilege then null; end;
  end loop;
  begin
    perform public.cw_set_progress(a,'invalid/doc',true);
    raise exception 'invalid id allowed';
  exception when invalid_parameter_value then null; end;
end;
$test$;
reset role;
rollback;
