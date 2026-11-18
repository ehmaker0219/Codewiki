-- New member sessions last 24 hours; administrator sessions last 12 hours.
-- Existing sessions retain their expiry, including expired/revoked sessions.
-- Modify only the lifetime so existing validation and function privileges remain intact.
begin;
do $migration$
declare
  signature text;
  definition text;
  lifetime text;
begin
  foreach signature in array array[
    'public.cw_login(text,text)',
    'public.cw_signup(text,text,text,text,text)'
  ] loop
    definition := pg_get_functiondef(signature::regprocedure);
    lifetime := case when signature = 'public.cw_login(text,text)'
      then 'now() + case when v_user.role = ''admin'' then interval ''12 hours'' else interval ''24 hours'' end'
      else 'now() + interval ''24 hours''' end;
    if position(lifetime in definition) > 0 then
      continue;
    elsif position('now() + interval ''12 hours''' in definition) > 0 then
      execute replace(definition, 'now() + interval ''12 hours''', lifetime);
    elsif position('now() + interval ''7 days''' in definition) > 0 then
      execute replace(definition, 'now() + interval ''7 days''', lifetime);
    else
      raise exception 'Unexpected session lifetime in %', signature;
    end if;
  end loop;
end;
$migration$;
commit;
