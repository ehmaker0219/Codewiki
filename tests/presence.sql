-- Isolated fixtures only; never run against production.
begin;
insert into public.cw_users(username,password_hash,full_name,role,status,session_token,session_expires_at)
values ('presence-admin','fixture','Admin','admin','approved','10000000-0000-0000-0000-000000000001',now()+interval '1 hour'),
 ('presence-student','fixture','Student','student','approved','10000000-0000-0000-0000-000000000002',now()+interval '1 hour'),
 ('presence-pending','fixture','Pending','student','pending','10000000-0000-0000-0000-000000000003',now()+interval '1 hour'),
 ('presence-expired','fixture','Expired','student','approved','10000000-0000-0000-0000-000000000004',now()-interval '1 second');
set local role anon;
do $test$
declare a uuid:='10000000-0000-0000-0000-000000000001'; s uuid:='10000000-0000-0000-0000-000000000002'; t uuid; r jsonb;
begin
  foreach t in array array[null::uuid,gen_random_uuid(),'10000000-0000-0000-0000-000000000003'::uuid,'10000000-0000-0000-0000-000000000004'::uuid] loop
    begin perform public.cw_presence_heartbeat(t,false);raise exception 'invalid heartbeat allowed';exception when insufficient_privilege then null;end;
  end loop;
  begin perform public.cw_presence_heartbeat(s,true);raise exception 'student read allowed';exception when insufficient_privilege then null;end;
  begin perform * from public.cw_presence;raise exception 'direct access allowed';exception when insufficient_privilege then null;end;
  assert public.cw_presence_heartbeat(s,false) is null;
  perform public.cw_presence_heartbeat(s,false);
  r:=public.cw_presence_heartbeat(a,true);
  assert jsonb_array_length(r)=2,'accounts should be deduplicated';
  assert (select count(*) from jsonb_object_keys(r->0))=4,'private fields leaked';
end;
$test$;
reset role;
-- Duplicate heartbeats must not cause another row update within 55 seconds.
create temporary table presence_snapshot as select ctid as original_tid from public.cw_presence where session_token='10000000-0000-0000-0000-000000000002';
select public.cw_presence_heartbeat('10000000-0000-0000-0000-000000000002',false);
do $$begin assert (select p.ctid=s.original_tid from public.cw_presence p cross join presence_snapshot s where p.session_token='10000000-0000-0000-0000-000000000002');end;$$;
update public.cw_presence set last_seen=now()-interval '121 seconds' where session_token='10000000-0000-0000-0000-000000000002';
do $$begin assert jsonb_array_length(public.cw_presence_heartbeat('10000000-0000-0000-0000-000000000001',true))=1;end;$$;
select public.cw_presence_heartbeat('10000000-0000-0000-0000-000000000002',false);
update public.cw_users set session_token='10000000-0000-0000-0000-000000000005' where username='presence-student';
do $$begin assert jsonb_array_length(public.cw_presence_heartbeat('10000000-0000-0000-0000-000000000001',true))=1,'replaced session still online';end;$$;
select public.cw_presence_heartbeat('10000000-0000-0000-0000-000000000005',false);
do $$begin assert jsonb_array_length(public.cw_presence_heartbeat('10000000-0000-0000-0000-000000000001',true))=2;end;$$;
update public.cw_users set status='rejected' where username='presence-student';
do $$begin assert jsonb_array_length(public.cw_presence_heartbeat('10000000-0000-0000-0000-000000000001',true))=1,'rejected account still online';end;$$;
update public.cw_users set status='approved',session_token=null where username='presence-student';
do $$begin assert jsonb_array_length(public.cw_presence_heartbeat('10000000-0000-0000-0000-000000000001',true))=1,'logged-out account still online';end;$$;
rollback;
