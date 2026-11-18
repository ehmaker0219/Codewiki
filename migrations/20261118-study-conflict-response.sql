-- Business conflicts must not use serialization_failure (40001):
-- PostgREST retries it and can exhaust the API connection pool.
-- Change only the exception code; preserve ownership, revision checks and grants.
begin;
set local lock_timeout = '5s';
do $migration$
declare
  signature text;
  definition text;
begin
  foreach signature in array array[
    'public.cw_save_study_note(uuid,uuid,text,text,integer)',
    'public.cw_delete_study_note(uuid,uuid,integer)'
  ] loop
    definition := pg_get_functiondef(signature::regprocedure);
    if position('errcode=''40001''' in definition) > 0 then
      execute replace(definition, 'errcode=''40001''', 'errcode=''PT409''');
    elsif position('errcode=''PT409''' in definition) = 0 then
      raise exception 'Unexpected conflict definition in %', signature;
    end if;
  end loop;
end;
$migration$;
notify pgrst, 'reload schema';
commit;
