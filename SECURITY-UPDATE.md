# 보안 업데이트 적용

1. Supabase SQL Editor에서 소유자 권한으로 `supabase-setup.sql` 전체를 실행합니다. 기존 회원과 게시글은 유지됩니다. 기존 만료 시간이 없는 세션은 무효화되므로 다시 로그인해야 합니다.
2. 기존 초기 관리자 비밀번호를 변경하지 않은 `admin` 계정은 임의의 비밀번호로 잠그고 세션을 폐기합니다. 이미 비밀번호를 변경한 계정은 보존합니다.
3. 관리자 계정이 필요하면 사이트에서 본인만 아는 비밀번호로 회원가입한 뒤, SQL Editor에서 해당 회원의 UUID와 아이디를 확인하고 아래 SQL로 승격합니다. 이 작업은 DB 소유자가 직접 수행합니다. 예시 UUID를 실제 본인 계정 UUID로 바꾸세요.

```sql
select id, username, role from public.cw_users;
update public.cw_users
set role = 'admin', status = 'approved',
    session_token = null, session_expires_at = null
where id = '본인-계정-UUID'::uuid;
```

4. SQL 적용 후 수정된 프런트엔드를 배포합니다. SQL 적용 전 새 프런트엔드를 사용하면 로그아웃 RPC가 없어 로그아웃 오류가 표시됩니다.
5. 관리자와 일반 회원으로 다시 로그인해서 게시판, 승인 처리, 로그아웃을 확인합니다. 세션 유효기간은 로그인 또는 가입부터 12시간이며, 로그아웃 즉시 서버에서 폐기됩니다. 네트워크 오류로 폐기에 실패하면 오류를 표시하고 재시도할 수 있도록 토큰을 유지합니다.

정적 프런트엔드 수정만으로 운영 DB가 갱신되지는 않습니다. 로컬 데모 모드는 기본 관리자 계정을 자동 생성하지 않습니다.

검증 명령

```powershell
node --check js/auth.js
node --check js/board.js
node tests/security-regression.cjs
```

DB 회귀 테스트는 별도 테스트 DB에 스키마를 적용한 후 `tests/security-regression.sql`을 실행합니다. 테스트 변경은 마지막에 롤백합니다. 운영 DB에는 테스트 스크립트를 실행하지 마세요.
