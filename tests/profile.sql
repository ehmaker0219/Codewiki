begin;
do $test$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); expired uuid:=gen_random_uuid(); pending uuid:=gen_random_uuid();
begin
  insert into public.cw_users(username,password_hash,full_name,class_name,mbti,role,status,session_token,session_expires_at)
  values('verify-'||a,'invalid','Original A','verify-class','ISTJ','student','approved',a,now()+interval '1 hour'),
    ('verify-'||b,'invalid','Original B','verify-class','ENFP','student','approved',b,now()+interval '1 hour'),
    ('verify-'||expired,'invalid','Expired','verify-class','','student','approved',expired,now()-interval '1 hour'),
    ('verify-'||pending,'invalid','Pending','verify-class','','student','pending',pending,now()+interval '1 hour');
  perform set_config('test.profile_a',a::text,true);perform set_config('test.profile_b',b::text,true);
  perform set_config('test.profile_expired',expired::text,true);perform set_config('test.profile_pending',pending::text,true);
  update public.cw_users set student_number=5 where session_token=a;
  update public.cw_users set student_number=27 where session_token=b;
end;
$test$;
set local role anon;
do $test$
declare a uuid:=current_setting('test.profile_a')::uuid; b uuid:=current_setting('test.profile_b')::uuid; t uuid; p jsonb;
begin
  p:=public.cw_update_my_profile(a,'  Updated A  ','enfp','2000-02-29',true);
  assert (p->>'student_number')::integer=5,'own number missing or changed on profile save';
  if p->>'full_name'<>'Updated A' or p->>'mbti'<>'ENFP' or p->>'birth_date'<>'2000-02-29' then raise exception 'profile save failed'; end if;
  if p->>'class_name'<>'verify-class' or p->>'role'<>'student' or p->>'status'<>'approved' then raise exception 'protected fields changed'; end if;
  p:=public.cw_get_my_profile(b);
  assert (p->>'student_number')::integer=27,'number belongs to another account';
  assert public.cw_get_my_profile(current_setting('test.profile_pending')::uuid)->'student_number'='null'::jsonb,'missing number must be null';
  begin update public.cw_users set student_number=3 where session_token=b;raise exception 'student changed number directly';exception when insufficient_privilege then null;end;
  if p->>'full_name'<>'Original B' or p->>'birth_date' is not null then raise exception 'cross-account write or read'; end if;
  if public.cw_get_my_profile(a) ?| array['password_hash','session_token'] then raise exception 'secret returned'; end if;
  foreach t in array array[null::uuid,gen_random_uuid(),current_setting('test.profile_expired')::uuid] loop
    begin perform public.cw_get_my_profile(t);raise exception 'unauthorized read';exception when insufficient_privilege then null;end;
    begin perform public.cw_update_my_profile(t,'X','',null,false);raise exception 'unauthorized write';exception when insufficient_privilege then null;end;
  end loop;
  begin perform public.cw_update_my_profile(current_setting('test.profile_pending')::uuid,'X','',null,false);raise exception 'pending write';exception when insufficient_privilege then null;end;
  begin perform public.cw_update_my_profile(a,'','',null,false);raise exception 'empty name accepted';exception when invalid_parameter_value then null;end;
  begin perform public.cw_update_my_profile(a,'Bad edit','NOPE',null,false);raise exception 'invalid mbti accepted';exception when invalid_parameter_value then null;end;
  begin perform public.cw_update_my_profile(a,'Bad edit','ISTJ',(now() at time zone 'Asia/Seoul')::date+1,false);raise exception 'future date accepted';exception when invalid_parameter_value then null;end;
  p:=public.cw_get_my_profile(a);
  if p->>'full_name'<>'Updated A' or p->>'mbti'<>'ENFP' or p->>'birth_date'<>'2000-02-29' or (p->>'share_with_class')::boolean is not true then raise exception 'partial save on failure';end if;
  perform public.cw_update_my_profile(a,'Updated A','',null,false);
  if public.cw_get_my_profile(a)->>'birth_date' is not null then raise exception 'birthday removal failed';end if;
end;
$test$;
reset role;
rollback;
