-- Run only in an isolated test DB. Fake roster is rolled back.
begin;
insert into public.cw_class_roster values ('6반',1,'테스트학생')
on conflict(class_name,student_number) do update set full_name=excluded.full_name;
set local role anon;
do $test$
declare result jsonb; bad_number integer;
begin
  result := public.cw_signup_with_roster('roster-valid','test-password',' 테스트학생 ','6반','',date '2000-01-01',true,1);
  if result->>'status' <> 'pending' or result->>'role' <> 'student' then
    raise exception 'Approval was bypassed';
  end if;
  if public.cw_get_my_birthday((result->>'session_token')::uuid)->>'birth_date' <> '2000-01-01' then
    raise exception 'Birthday missing';
  end if;
  perform public.cw_signup_with_roster('roster-other','test-password','다른학생','3반','',null,false,null);
  perform public.cw_signup_with_birthday('roster-other-legacy','test-password','다른학생','7반','',null,false);
  foreach bad_number in array array[null,0,2,31] loop
    begin
      perform public.cw_signup_with_roster('roster-invalid','test-password','테스트학생','6반','',null,false,bad_number);
      raise exception 'Wrong number allowed';
    exception when invalid_parameter_value then null; end;
  end loop;
  begin
    perform public.cw_signup_with_roster('roster-wrong-name','test-password','틀린이름','6반','',null,false,1);
    raise exception 'Wrong name allowed';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.cw_signup('roster-old','test-password','테스트학생','6반','');
    raise exception 'Legacy signup bypass';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.cw_signup_with_birthday('roster-old-birthday','test-password','테스트학생','6반','',null,false);
    raise exception 'Birthday signup bypass';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.cw_signup_with_roster('roster-birthday-rollback','test-password','테스트학생','6반','',current_date+2,true,1);
    raise exception 'Invalid birthday allowed';
  exception when invalid_parameter_value then null; end;
  begin
    perform * from public.cw_class_roster;
    raise exception 'Roster readable by anon';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.cw_class_roster values('6반',30,'위조');
    raise exception 'Roster writable by anon';
  exception when insufficient_privilege then null; end;
end;
$test$;
reset role;
do $test$
begin
  if exists(select 1 from public.cw_users where username in (
    'roster-invalid','roster-wrong-name','roster-old','roster-old-birthday','roster-birthday-rollback'
  )) then raise exception 'Rejected signup left a user behind'; end if;
  if not exists(select 1 from public.cw_users where username='roster-valid' and student_number=1
    and session_expires_at between now()+interval '23 hours' and now()+interval '25 hours'
    and password_hash <> 'test-password') then raise exception 'Account fields incorrect'; end if;
end;
$test$;
set local role authenticated;
do $test$
begin
  begin
    perform * from public.cw_class_roster;
    raise exception 'Roster readable by authenticated';
  exception when insufficient_privilege then null; end;
end;
$test$;
rollback;
