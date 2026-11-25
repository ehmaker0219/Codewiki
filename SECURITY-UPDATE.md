# 보안 업데이트 적용

## 기존 사이트 업데이트

기본 설정 SQL을 재실행하지 않습니다. 이번 변경에 필요한 추가 마이그레이션만 DB 소유자 권한으로 적용합니다. `cw_auth_private`가 이미 있는 DB에서는 `supabase-setup.sql`이 변경 전에 중단되어 기존 인증 보호를 보존합니다. 이 차단을 삭제하거나 해당 스키마를 지워서 우회하지 마세요.

로그인·가입·관리자 조회 함수를 변경하는 구 마이그레이션을 재실행했다면, **반드시 아래 순서의 최종 마이그레이션(`migrations/20261124-review-hardening.sql`)을 마지막에 다시 적용**해 최신 인증 보호·bcrypt cost 10·가입 초기 로그인 기록·관리자 조회 함수를 보존합니다. 구 마이그레이션(`20261119-auth-hardening.sql`, `20261119-admin-members.sql`)도 `cw_secure_auth` 존재 시 평문 인증 API를 재개방하지 않도록 인자 수 무관 가드를 포함합니다. 기존 회원과 게시글을 삭제할 필요는 없습니다. 암호화 인증은 아래 Edge Function 설정까지 함께 필요합니다.

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
15. `migrations/20261119-presence.sql` — 회원별 접속 신호, 관리자 전용 접속자 조회
16. `migrations/20261119-profile-student-number.sql` — 본인 프로필의 출석번호 읽기 전용 반환
17. `migrations/20261120-encrypted-auth.sql` — 암호화 게이트웨이 전용 RPC 및 평문 인증 API 차단
18. `migrations/20261120-security-review-hardening.sql` — 반려 시 즉시 세션 폐기, `session_token` 유니크 인덱스, `pg_temp` 고정 및 권한 정리
19. `migrations/20261121-login-history.sql` — 관리자 전용 학생 로그인 내역 기록(`cw_auth_private.login_logs`) 및 조회 RPC(`cw_admin_login_history`) 추가
20. **`migrations/20261123-auth-review-hardening.sql`** — 존재하지 않는 아이디도 같은 횟수 제한·bcrypt 비용을 거쳐 아이디 존재 여부 추측 차단, 가입 MBTI 서버 검증, `lower(username)` 인덱스 추가, 접속 IP(해시)별 요청 제한(로그인 5분 120회, 가입 1시간 60회, 비밀번호 재설정 5분 60회)과 전체 상한 상향. DB를 먼저 적용한 뒤 `secure-auth` Edge Function을 재배포합니다. 기존 4개 인자 게이트웨이는 그대로 동작하므로 순서 사이에도 로그인은 유지됩니다. 이후 `20261119-auth-hardening.sql`이나 `20261120-encrypted-auth.sql`을 다시 실행했다면 이 파일을 다시 적용합니다.
21. `migrations/20261124-signup-login-log.sql` — 학생 회원가입 시 즉시 발급되는 24시간 초기 세션도 `cw_auth_private.login_logs`에 기록되도록 보강하고, 이미 활성 가입 세션을 보유한 신규 학생의 초기 로그인 기록을 멱등 보정합니다.
22. `migrations/20261124-review-hardening.sql` — 신규 가입·관리자 재설정 및 로그인 시 점진적 재해싱으로 bcrypt 작업 계수를 cost 10으로 상향하고, 미존재 아이디는 고정 cost-10 더미 해시 비교(단일 조회)로 타이밍 차이를 제거하며, 반려(`rejected`) 계정의 로그인 기록 제외·180일 보관 정리·`FOR UPDATE SKIP LOCKED` 제한 삭제로 데드락을 방지합니다. IP 헤더 누락 시 폴백 버킷(`client:missing:*`)을 강제하고, `cw_admin_login_history(uuid, integer, uuid)`에 학생별 `p_user_id` 정확 필터링을 추가합니다. `secure-auth` Edge Function은 IPv4/IPv6(`/64`) 엄격 정규화와 서버 비밀키 기반 HMAC-SHA-256 클라이언트 해시, 503 CORS 헤더를 포함해 함께 재배포합니다(선택 비밀값 `CW_AUTH_CLIENT_HASH_KEY`, 미설정 시 서버 개인키 기반으로 자동 파생).
23. **`migrations/20261125-auto-revisit-login-log.sql` — 반드시 마지막에 적용.** 학생이 기존 24시간 세션 토큰으로 다음 날(KST 기준) 다시 접속하거나 2시간 이상 비활동 후 재방문할 때(`cw_me`, `cw_presence_heartbeat`), `cw_auth_private.record_student_revisit`를 통해 중복 없이 1건의 재방문 기록을 `cw_auth_private.login_logs`에 자동 기록합니다(연속 접속 중에는 중복 생성하지 않음, 관리자·반려 계정 제외). 당일 이미 접속 중인 기존 세션 학생의 누락 기록도 멱등 보정합니다.

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

정적 프런트엔드 수정만으로 운영 DB가 갱신되지는 않습니다. 데모 인증과 데모 회원 저장 기능은 제거했습니다. 브라우저 시작 시 이전 데모 회원·세션 저장 키 두 개만 삭제하며, 실제 세션·메모는 삭제하지 않습니다. 서버/암호화 모듈이 없으면 로그인을 차단하고 평문 API로 우회하지 않습니다.

## 암호화 인증 서버 적용 (별도 배포 요청 시)

현재 프런트엔드는 `secure-auth` Edge Function을 요구합니다. **DB SQL만 적용하거나 프런트엔드만 올리면 새 로그인·가입·비밀번호 재설정이 실패합니다.** 기존 로그인 세션 조회/로그아웃/메모 API는 계속 동작합니다. 운영 변경은 사용자 배포 요청을 받은 뒤, 조정된 점검 시간에 수행합니다.

1. `pnpm install --frozen-lockfile`, `node scripts/build-auth.cjs` 및 전체 검사를 실행합니다. 키 없이도 격리된 테스트가 가능합니다.
2. 안전한 로컬 경로에서 `node scripts/generate-auth-keys.cjs .env.auth-secrets`를 실행합니다. RSA 3072비트 개인 JWK가 **Git에서 제외되는 파일에만** 생성됩니다. 기존 파일은 덮어쓰지 않습니다. 키 내용을 콘솔/대화/SQL에 붙여 넣지 않습니다. Windows에서는 파일의 읽기 권한을 본인으로 제한합니다. 파일 자체를 사이트에 업로드하지 않습니다.
3. 인증된 Supabase CLI에서 `supabase secrets set --env-file .env.auth-secrets --project-ref <프로젝트 ID>`로 서버 비밀 설정에 등록합니다. 이 파일은 `CW_AUTH_PRIVATE_JWKS`, `CW_AUTH_ALLOWED_ORIGINS` 두 값만 포함합니다. 기본 허용 Origin은 `https://ehmaker0219.github.io`입니다. 로컬 연결이 필요하면 `http://localhost:4175`를 명시적으로 추가합니다. 와일드카드는 금지합니다. 기존 `SUPABASE_SERVICE_ROLE_KEY`는 Edge Function의 서버 환경에서만 사용합니다.
4. `supabase functions deploy secure-auth --project-ref <프로젝트 ID>`로 배포합니다. `verify_jwt = false`는 기존 Supabase Auth JWT가 없는 자체 로그인 진입점이기 때문입니다. 함수 내부에서는 암호문 검증 후 **기존 비밀번호·세션·관리자 권한 검사**를 모두 실행합니다. CORS는 권한 검사 대체 수단이 아닙니다.
5. 키 조회 응답에 공개 JWK(`n`, `e`)만 있는지 확인한 다음 `20261120-encrypted-auth.sql`을 DB 소유자로 적용합니다. 공개 스키마의 로그인·가입·재설정 함수는 `anon`/`authenticated`/`PUBLIC` 실행 권한을 모두 제거합니다. `cw_secure_auth`만 `service_role`에 허용합니다. 기존 계정·비밀번호 해시·세션은 보존합니다.
6. 새 프런트엔드를 배포하고 새로고침 안내를 합니다. 이전 프런트의 평문 로그인 호출은 거부됩니다. 운영 데이터에 테스트 쓰기를 하지 않으며, 실제 계정 로그인/가입/재설정 확인은 사용자가 수행합니다.
7. 실제 Network 요청에 `envelope`만 있고 응답·로그에 비밀번호/개인키가 없는지 확인합니다. Supabase API/Postgres의 요청 본문·SQL 바인드 인자 로깅 설정도 따로 확인해야 합니다. 서버 복호화 이후의 비밀번호가 로그에 남도록 설정하면 안 됩니다. 프런트 테스트만으로 운영 로그 무노출을 보증하지 않습니다.

JWE는 고정 버전 `jose`와 표준 `RSA-OAEP-256`/`A256GCM`을 사용합니다. 요청은 60초 후 만료하며, DB의 원자적 고유키 삽입으로 같은 요청 ID의 재사용을 차단합니다. 실패한 인증도 요청 ID를 소비하며, 전역/계정별 시도 제한을 유지합니다. 응답 유실 시 자동 재전송하지 않습니다. 키 조회는 브라우저 메모리에서 5분 캐시하며 비밀번호·암호문은 저장하지 않습니다.

키 교체 시 `CW_AUTH_PRIVATE_JWKS` 배열에 **새 키, 직전 키** 순으로 최대 두 개만 둡니다. 새 키는 공개키 조회에 즉시 사용되며, 직전 키는 기존 캐시와 진행 중 요청을 위해 최소 10분 뒤 제거합니다. 유출된 키는 즉시 제거하고 사용자에게 재시도를 안내합니다. 키를 삭제/덮어쓰는 롤백 대신 신규 키·코드 수정으로 복구하며, 평문 API 권한을 다시 열지 않습니다.

이 기능은 **브라우저 Network 요청 본문에서 원문을 숨기는 추가 보호**입니다. HTTPS와 bcrypt를 대체하지 않으며, 입력값을 읽을 수 있는 XSS·악성 확장 프로그램·브라우저 디버깅을 막지는 못합니다. 세션 토큰의 기존 localStorage 저장 방식은 이번 변경에 포함되지 않습니다.

검증 명령

```powershell
pnpm install --frozen-lockfile
node scripts/check.cjs
```

기본 검사에는 메모리 PostgreSQL 검사가 포함됩니다. 최초 설정, 인증 강화 재실행, 잘못된 기본 설정 재실행 차단, 약한 비밀번호·우회 API 거부, 요청 횟수 유지, 권한·세션·메모 소유권과 수정 충돌을 검증합니다. DB URL이나 운영 자격증명을 사용하지 않습니다. 운영 DB에는 테스트 스크립트를 실행하지 마세요.
