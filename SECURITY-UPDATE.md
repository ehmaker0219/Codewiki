# 보안 업데이트 적용

## 기존 사이트 업데이트

기본 설정 SQL을 재실행하지 않습니다. 이번 변경에 필요한 추가 마이그레이션만 DB 소유자 권한으로 적용합니다. `cw_auth_private`가 이미 있는 DB에서는 `supabase-setup.sql`이 변경 전에 중단되어 기존 인증 보호를 보존합니다. 이 차단을 삭제하거나 해당 스키마를 지워서 우회하지 마세요.

로그인·가입 함수를 변경하는 마이그레이션을 실행했다면 **`migrations/20261119-auth-hardening.sql`을 반드시 마지막에 다시 적용**합니다. 생일·출석부 가입 API도 같은 원칙을 따릅니다. 기존 회원과 게시글을 삭제할 필요는 없습니다.

## 새 DB 초기 설정 순서

Supabase SQL Editor에서 파일 전체를 아래 순서대로 실행합니다. 부분 선택 실행은 하지 않습니다.

1. `supabase-setup.sql`
2. `migrations/20261118-birthdays.sql`
3. `migrations/20261118-profile.sql`
4. `migrations/20261118-session-retention.sql`
5. `migrations/20261118-learning-progress.sql`
6. `migrations/20261118-study-notes.sql`
7. `migrations/20261118-study-conflict-response.sql`
8. `migrations/20261119-class-roster-signup.sql`
9. `migrations/20261119-delete-rejected-signups.sql`
10. `migrations/20261119-study-folders.sql`
11. `migrations/20261119-student-study.sql`
12. `migrations/20261119-student-only-study.sql`
13. **`migrations/20261119-auth-hardening.sql` — 로그인·가입 함수 변경 후 적용**
14. `migrations/20261119-admin-members.sql` — 인증 강화의 비밀번호 정책·요청 제한 함수 사용

관리자 공부방을 폐기하는 기존 DB에서는 먼저 DB 소유자가 이전 대상 두 계정을 확인합니다. 단일 트랜잭션 안에서 `codewiki.transfer_from`과 `codewiki.transfer_to`를 해당 UUID로 설정하고 `scripts/transfer-study-owner.sql`을 실행한 뒤, `20261119-student-only-study.sql`의 내용을 적용합니다. 실제 계정 UUID·토큰이나 필기 백업은 공개 저장소에 넣지 않습니다. 이전은 본문·저장 시간·수정 버전·폴더 분류를 유지하며, 폴더 이름 충돌이나 소유권 불일치가 있으면 중단합니다. 관리자 계정 자체와 회원 관리 기능은 유지합니다. 브라우저에만 있는 미저장 초안은 이 DB 이전에 포함되지 않습니다.

6반 출석부 데이터는 별도 비공개 자료로 입력합니다. 실명 명단이나 DB 비밀번호는 저장소에 넣지 않습니다.

관리자 계정이 필요하면 사이트에서 본인만 아는 비밀번호로 회원가입한 뒤, SQL Editor에서 해당 회원의 UUID와 아이디를 확인하고 아래 SQL로 승격합니다. 이 작업은 DB 소유자가 직접 수행합니다. 예시 UUID를 실제 본인 계정 UUID로 바꾸세요.

```sql
select id, username, role from public.cw_users;
update public.cw_users
set role = 'admin', status = 'approved',
    session_token = null, session_expires_at = null
where id = '본인-계정-UUID'::uuid;
```

## 적용 확인

필수 SQL 적용 후 프런트엔드를 배포합니다. 세션 유효기간은 **일반 회원 24시간, 관리자 12시간**이며 로그아웃 즉시 서버에서 폐기됩니다. 네트워크 오류로 폐기에 실패하면 오류를 표시하고 재시도할 수 있도록 토큰을 유지합니다.

`cw_auth_private`는 API 노출 스키마에 추가하지 않습니다. 신규 비밀번호는 8자 이상, UTF-8 72바이트 이하이며 로그인·가입 요청 횟수 제한을 유지합니다. 자세한 정책은 [README.md](README.md#로그인가입-보안-보완)를 참고하세요.

정적 프런트엔드 수정만으로 운영 DB가 갱신되지는 않습니다. 로컬 데모 모드는 기본 관리자 계정을 자동 생성하지 않습니다.

검증 명령

```powershell
pnpm install --frozen-lockfile
node scripts/check.cjs
```

기본 검사에는 메모리 PostgreSQL 검사가 포함됩니다. 최초 설정, 인증 강화 재실행, 잘못된 기본 설정 재실행 차단, 약한 비밀번호·우회 API 거부, 요청 횟수 유지, 권한·세션·메모 소유권과 수정 충돌을 검증합니다. DB URL이나 운영 자격증명을 사용하지 않습니다. 운영 DB에는 테스트 스크립트를 실행하지 마세요.
