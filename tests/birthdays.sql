-- Transaction-only fixtures: never retain personal or test data.
begin;
do $test$
declare
  a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid();
  admin uuid:=gen_random_uuid(); pending uuid:=gen_random_uuid(); expired uuid:=gen_random_uuid(); hidden uuid:=gen_random_uuid();
begin
  insert into public.cw_users(username,password_hash,full_name,class_name,role,status,session_token,session_expires_at)
  values ('verify-'||a,'invalid','Birthday A','verify-class-a','student','approved',a,now()+interval '1 hour'),
    ('verify-'||b,'invalid','Birthday B','verify-class-a','student','approved',b,now()+interval '1 hour'),
    ('verify-'||c,'invalid','Other class','verify-class-b','student','approved',c,now()+interval '1 hour'),
    ('verify-'||admin,'invalid','Admin','verify-class-a','admin','approved',admin,now()+interval '1 hour'),
    ('verify-'||pending,'invalid','Pending','verify-class-a','student','pending',pending,now()+interval '1 hour'),
    ('verify-'||expired,'invalid','Expired','verify-class-a','student','approved',expired,now()-interval '1 hour'),
    ('verify-'||hidden,'invalid','Private','verify-class-a','student','approved',hidden,now()+interval '1 hour');
  perform set_config('test.bday_a',a::text,true);perform set_config('test.bday_b',b::text,true);
  perform set_config('test.bday_c',c::text,true);perform set_config('test.bday_admin',admin::text,true);
  perform set_config('test.bday_pending',pending::text,true);perform set_config('test.bday_expired',expired::text,true);
  perform set_config('test.bday_hidden',hidden::text,true);
end;
$test$;
set local role anon;
do $test$
declare
  a uuid:=current_setting('test.bday_a')::uuid; b uuid:=current_setting('test.bday_b')::uuid;
  c uuid:=current_setting('test.bday_c')::uuid; admin uuid:=current_setting('test.bday_admin')::uuid;
  pending uuid:=current_setting('test.bday_pending')::uuid; expired uuid:=current_setting('test.bday_expired')::uuid;
  hidden uuid:=current_setting('test.bday_hidden')::uuid; t uuid; result jsonb; item jsonb; signup jsonb;
begin
  perform public.cw_set_my_birthday(a,'2000-02-29',true);
  perform public.cw_set_my_birthday(b,'1998-11-18',true);
  perform public.cw_set_my_birthday(c,'1999-11-18',true);
  perform public.cw_set_my_birthday(pending,'2001-11-18',true);
  perform public.cw_set_my_birthday(hidden,'1997-11-18',false);
  result:=public.cw_list_birthdays(a);
  if jsonb_array_length(result)<>2 then raise exception 'class/status/consent isolation failed'; end if;
  for item in select * from jsonb_array_elements(result) loop
    if item - array['full_name','month','day'] <> '{}'::jsonb then raise exception 'private fields in peer RPC'; end if;
  end loop;
  if (public.cw_get_my_birthday(a)->>'birth_date')<>'2000-02-29' then raise exception 'own birthday missing'; end if;
  if (public.cw_get_my_birthday(b)->>'birth_date')<>'1998-11-18' then raise exception 'own birthday isolation failed'; end if;
  if not exists(select 1 from jsonb_array_elements(public.cw_admin_birthdays(admin)) e where e->>'birth_date'='1997-11-18') then raise exception 'admin missing private birthday'; end if;
  foreach t in array array[null::uuid,gen_random_uuid(),a,pending,expired] loop
    begin perform public.cw_admin_birthdays(t);raise exception 'admin guard failed'; exception when insufficient_privilege then null; end;
  end loop;
  foreach t in array array[null::uuid,gen_random_uuid(),pending,expired] loop
    begin perform public.cw_list_birthdays(t);raise exception 'peer guard failed'; exception when insufficient_privilege then null; end;
  end loop;
  foreach t in array array[null::uuid,gen_random_uuid(),expired] loop
    begin perform public.cw_get_my_birthday(t);raise exception 'self read guard failed'; exception when insufficient_privilege then null; end;
    begin perform public.cw_set_my_birthday(t,'2000-01-01',true);raise exception 'self write guard failed'; exception when insufficient_privilege then null; end;
  end loop;
  begin perform 1 from public.cw_birthdays;raise exception 'direct read allowed'; exception when insufficient_privilege then null; end;
  begin delete from public.cw_birthdays;raise exception 'direct write allowed'; exception when insufficient_privilege then null; end;
  begin perform public.cw_set_my_birthday(a,current_date+1,true);raise exception 'future date allowed'; exception when invalid_parameter_value then null; end;
  begin perform public.cw_set_my_birthday(a,'1899-12-31',true);raise exception 'invalid date allowed'; exception when invalid_parameter_value then null; end;
  perform public.cw_set_my_birthday(b,'1998-11-18',false);
  if jsonb_array_length(public.cw_list_birthdays(a))<>1 then raise exception 'opt out failed'; end if;
  perform public.cw_set_my_birthday(a,null,false);
  if public.cw_get_my_birthday(a)->>'birth_date' is not null then raise exception 'clear failed'; end if;
  signup:=public.cw_signup_with_birthday('verify-signup-'||gen_random_uuid(),gen_random_uuid()::text,'Signup fixture','verify-class-a','','2002-12-03',true);
  if public.cw_get_my_birthday((signup->>'session_token')::uuid)->>'birth_date'<>'2002-12-03' then raise exception 'signup birthday not saved'; end if;
  begin
    perform public.cw_signup_with_birthday('verify-invalid-'||a,gen_random_uuid()::text,'Invalid fixture','verify-class-a','',current_date+1,true);
    raise exception 'invalid signup allowed';
  exception when invalid_parameter_value then null; end;
end;
$test$;
reset role;
do $test$
begin
  if exists(select 1 from public.cw_users where username='verify-invalid-'||current_setting('test.bday_a')) then raise exception 'signup not atomic'; end if;
end;
$test$;
rollback;
