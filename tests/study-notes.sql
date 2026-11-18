-- Disposable fixtures. The caller must roll back the entire transaction.
begin;
do $fixtures$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); e uuid:=gen_random_uuid();
begin
  insert into public.cw_users(username,password_hash,full_name,role,status,session_token,session_expires_at)
  values ('notes-test-'||a,'not-a-password-hash','Notes test','admin','approved',a,now()+interval '1 hour'),
    ('notes-test-'||b,'not-a-password-hash','Notes test','admin','approved',b,now()+interval '1 hour'),
    ('notes-test-'||s,'not-a-password-hash','Notes test','student','approved',s,now()+interval '1 hour'),
    ('notes-test-'||e,'not-a-password-hash','Notes test','admin','approved',e,now()-interval '1 second');
  perform set_config('test.notes_a',a::text,true);perform set_config('test.notes_b',b::text,true);
  perform set_config('test.notes_s',s::text,true);perform set_config('test.notes_e',e::text,true);
end;
$fixtures$;
set local role anon;
do $test$
declare a uuid:=current_setting('test.notes_a')::uuid; b uuid:=current_setting('test.notes_b')::uuid;
  s uuid:=current_setting('test.notes_s')::uuid; e uuid:=current_setting('test.notes_e')::uuid;
  n uuid:=gen_random_uuid(); t uuid; saved jsonb;
begin
  saved:=public.cw_save_study_note(a,n,'시험 노트','**굵게** ==중요== <script>not HTML</script>',0);
  assert (saved->>'revision')::int=1;
  assert jsonb_array_length(public.cw_list_study_notes(a))=1;
  assert public.cw_get_study_note(a,n)->>'body'='**굵게** ==중요== <script>not HTML</script>';
  assert public.cw_get_study_note(b,n) is null;
  assert jsonb_array_length(public.cw_list_study_notes(b))=0;
  begin perform public.cw_save_study_note(b,n,'stolen','stolen',1);raise exception 'cross-owner update permitted';exception when serialization_failure then null;end;
  begin perform public.cw_delete_study_note(b,n,1);raise exception 'cross-owner delete permitted';exception when serialization_failure then null;end;
  begin perform public.cw_save_study_note(b,n,'stolen','stolen',0);raise exception 'cross-owner insert permitted';exception when serialization_failure then null;end;
  saved:=public.cw_save_study_note(a,n,'수정','version 2',1);
  assert (saved->>'revision')::int=2;
  begin perform public.cw_save_study_note(a,n,'old','old',1);raise exception 'stale overwrite permitted';exception when serialization_failure then null;end;
  begin perform public.cw_delete_study_note(a,n,1);raise exception 'stale delete permitted';exception when serialization_failure then null;end;
  begin perform public.cw_save_study_note(a,n,' ','',2);raise exception 'empty title permitted';exception when invalid_parameter_value then null;end;
  begin perform public.cw_save_study_note(a,n,'large',repeat('x',200001),2);raise exception 'oversize permitted';exception when invalid_parameter_value then null;end;
  foreach t in array array[s,e,gen_random_uuid(),null::uuid] loop
    begin perform public.cw_list_study_notes(t);raise exception 'unauthorized list';exception when insufficient_privilege then null;end;
    begin perform public.cw_get_study_note(t,n);raise exception 'unauthorized get';exception when insufficient_privilege then null;end;
    begin perform public.cw_save_study_note(t,n,'bad','bad',2);raise exception 'unauthorized save';exception when insufficient_privilege then null;end;
    begin perform public.cw_delete_study_note(t,n,2);raise exception 'unauthorized delete';exception when insufficient_privilege then null;end;
  end loop;
  begin perform 1 from public.cw_study_notes;raise exception 'direct table access';exception when insufficient_privilege then null;end;
  begin perform public.cw_study_owner(a);raise exception 'private helper access';exception when insufficient_privilege then null;end;
  assert public.cw_get_study_note(a,n)->>'body'='version 2';
  perform public.cw_delete_study_note(a,n,2);
  assert public.cw_get_study_note(a,n) is null;
end;
$test$;
reset role;
rollback;
