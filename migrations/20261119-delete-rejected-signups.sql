-- Admin-only deletion of rejected student accounts; never bulk-delete requests.
begin;
create or replace function public.cw_admin_delete_rejected_user(p_token uuid, p_target_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp
as $fn$
begin
  -- Hold the caller row while deleting so a concurrent logout/role change cannot race this check.
  perform 1 from public.cw_users
    where session_token=p_token and session_expires_at>now() and role='admin'
    for share;
  if not found then
    raise exception '관리자 권한이 필요합니다.' using errcode='42501';
  end if;
  -- Predicate is rechecked after concurrent status changes; approved/pending/admin accounts are protected.
  delete from public.cw_users
    where id=p_target_id and role='student' and status='rejected';
  if not found then
    raise exception '거절된 학생 가입 요청만 삭제할 수 있습니다. 목록을 새로 불러와 주세요.' using errcode='22023';
  end if;
end;
$fn$;
revoke all on function public.cw_admin_delete_rejected_user(uuid,uuid) from public;
grant execute on function public.cw_admin_delete_rejected_user(uuid,uuid) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
