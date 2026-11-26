# CodeWiki 작업 지침

## 배포 전 검사 — 사용자 요청

사용자가 배포를 요청하면 아래 검사를 배포 작업에 자동으로 포함한다. 지금까지의 로컬 변경을 임의로 배포하지 말고, 명시적인 배포 요청이 있을 때만 진행한다.

1. 현재 브랜치, 작업 트리, 실제 배포된 버전과의 차이를 확인한다. 사용자 작업과 기존 세이브포인트를 보존한다.
2. 변경 코드를 검토한다. 중복/불필요한 로직, 상태 관리, 이벤트 중복 등록, 비동기 경쟁, 데이터 유실, 기존 기능의 회귀 가능성을 확인한다. 검사만을 이유로 무관한 대규모 리팩터링을 하지 않는다.
3. 편집기·인증 전송 소스나 의존성이 바뀌었다면 `pnpm install --frozen-lockfile` 및 `node scripts/build-study-editor.cjs` / `node scripts/build-auth.cjs`로 산출물을 준비한다. `node scripts/update-assets.cjs`, `node scripts/check.cjs`, `git diff --check`를 실행한다. 변경된 주요 사용자 흐름도 적절하게 확인한다.
4. 실제 배포 예정 변경 전체에 대해 일반적인 코드 직접 검토와 보안 점검을 수행한다. 인증/세션, 관리자 권한, 사용자별 데이터 접근, XSS/입력 처리, SQL/RPC/RLS, 비밀정보 유출을 관련 코드에 맞게 확인한다. `pnpm audit --prod` 등으로 의존성 취약점도 확인하고 탐지 결과의 실제 영향을 검토한다. Daybreak나 별도 보안 플러그인은 필수 조건이 아니며, 플러그인을 사용할 수 없어도 직접 검토와 테스트를 수행할 수 있으면 진행한다. 비밀번호나 토큰을 출력하거나 커밋하지 않는다. 검증을 위해 운영 데이터에 테스트 쓰기를 하지 않는다.
5. 검사 실패, 확인된 문제, 해결되지 않은 보안 경고 또는 필수 검사의 실행 불가가 있으면 **푸시와 배포를 멈춘다**. 원인, 영향, 필요한 수정/조치를 한국어로 간단히 보고한다. 검사를 생략하고 통과했다고 말하지 않는다. 수정이 승인되어 해결했다면 해당 검사들을 다시 통과한 뒤 진행한다.
6. 검사에서 문제가 발견되지 않았다면 사용자의 배포 요청을 근거로 **추가 승인 질문 없이 업로드와 배포를 진행**한다. 이 저장소는 main 푸시가 배포를 유발할 수 있으므로 검사는 반드시 푸시 전에 끝낸다.
7. 배포 작업의 성공 상태와 실제 공개 사이트의 반영을 확인한 뒤 완료를 보고한다. 수행한 검사와 배포 결과를 요약하되, 점검 통과를 모든 버그/취약점의 부재를 보증하는 것으로 표현하지 않는다.

이 절차는 배포 요청에 적용되는 작업 규칙이다. 예약 작업이나 반복 실행 자동화를 만들라는 뜻은 아니다. 사용자의 이후 명시적 지시가 우선한다.

## CodeWiki 핵심 대원칙 — 문서의 유기적 연동 & 원서 표현 준수

1. **문서의 유기적 연동 (사이트 전역 핵심 기능)**
   - CodeWiki의 핵심 가치는 단일 페이지 나열이 아니라 **검색창 · 자동 키워드 링크 · 수동 명시 링크(`[[docId|라벨]]`) · 우측 `연결된 문서`(백링크) · `관련 문서` 섹션**이 사이트 전역에서 거미줄처럼 유기적으로 이어지는 것이다.
   - Basic Session뿐 아니라 **어떤 문서·섹션·가이드를 추가하거나 수정할 때도 절대 고립된 문서로 두지 말고**, 관련된 `BC400`/`BC430` Unit · `Basic Session Review` · `ABAP 사고 흐름` · `ABAP SQL 가이드` · `SAP GUI 프로그램 정리표` · `자주 쓰는 T-Code 모음` · `단축키 모음` · `교재 목차`와의 양방향 연결(`[[...]]`, `connections`/`관련 문서`)과 충돌 없는 검색 별칭(`aliases`)을 함께 점검·갱신한다.
   - 새로운 T-Code(`SE09`, `SE11`, `SE24`, `SE37`, `SE38`, `SE80`, `SE91`, `SE93`, `SM30`, `SE14` 등)나 객체 생성 절차(`Change Request`, `Package`, `Program`, `Message Class`, `Function Module` 등)가 등장하면 `자주 쓰는 T-Code 모음`(`js/data.js`)과 해당 단원의 단계별 생성 가이드(`practice` 블록)까지 연동해 시험·실습 중 검색창에서 즉시 찾아 이동할 수 있게 유지한다.
2. **원서(SAP/ABAP 원어) 표현 준수 — 임의 한국어 번역 금지**
   - 사용자가 작성한 필기나 SAP/ABAP 원서·교재·GUI 화면의 영문 전문 용어를 **임의로 한국어로 해석·번역해서 기입하지 않는다.**
   - 금지 예시: `Class`→`클래스`, `Method`→`메서드`, `Message Class`→`메시지 클래스`, `Subroutine`→`서브루틴`, `Function Module`→`함수 모듈`, `Function Group`→`함수 그룹`, `Internal Table`→`내부 테이블`/`인터널 테이블`, `Work Area`→`작업 영역`/`워크에어리어`, `Structure`→`구조체`, `Structure Type`→`구조 타입`, `Structure Variable`→`구조 변수`, `Selection Screen`→`선택 화면`, `Data Element`→`데이터 요소`, `Domain`→`도메인`, `Text Symbol`→`텍스트 심볼`, `Text Element`→`텍스트 요소`, `Transaction Code`→`트랜잭션 코드`, `ABAP Dictionary`→`데이터 사전`, `Search Help`→`서치헬프`, `Work Process`→`워크 프로세스`, `Table Buffer`→`테이블 버퍼`, `Report`→`리포트`.
   - 제목·소제목·본문·표·콜아웃·예제 안내·연습문제·미니게임 등 **사용자에게 보이는 모든 콘텐츠는 원어 표기를 유지**한다(`Change Request`, `Task`, `Package`, `Program`, `Report`, `Class`, `Local Class`, `Global Class`, `Static`, `Instance`, `Method`, `Message Class`, `Subroutine`, `Function Module`, `Function Group`, `Structure`, `Internal Table`, `Work Area`, `Selection Screen`, `Data Element`, `Domain`, `Text Symbol`, `Text Element`, `ABAP Dictionary`, `Search Help`, `Work Process`, `Table Buffer` 등).
   - 한글 검색 편의를 위한 표현은 오직 `aliases` 배열에만 선택적으로 유지한다.

## 수업 필기 · 예제 작성 규칙

- 사용자가 작성한 필기나 요청의 영문·한글 용어 표기를 임의로 번역하거나 바꾸지 말고, **작성한 그대로** 반영한다.
- ABAP Table·Structure 예시는 학생/더미 데이터 대신 SAP 항공 실습 모델(`SCARR`, `SPFLI`, `SFLIGHT`, `SBOOK`, `SCUSTOM`, `SAPLANE` 등)을 기준으로 작성한다.
- 실행 가능 ABAP Report 예제의 `REPORT` 선언 이름은 수업 규칙에 맞춰 `REPORT zabap_f##_##.` 형식을 사용한다(별도 과제 네이밍 규칙이 명시된 경우에는 개인 번호만 `##`으로 일반화한다).

## 일일 수업 필기 반영 규칙

- 사용자가 오늘 배운 수업 내용이나 일자별 필기 파일(`.txt`, `.md` 등)을 사이트에 반영해 달라고 요청하면 `.agents/skills/codewiki-daily-lesson/SKILL.md`(`codewiki-daily-lesson` 스킬)를 먼저 읽고 정의된 절차(`codewiki-rich-v1` · `codewiki-table-v1` 블록 복원, 주제별 문서 `js/class-notes.js` · 일자별 페이지 `js/lesson-days.js` · 예제 안내 `js/example-notes.js` · 교재 매핑 `js/textbook.js` 동기화, 회귀 테스트 갱신 및 `node scripts/update-assets.cjs` · `node scripts/check.cjs` 실행)에 따라 반영한다.

## 의사결정 · 도구 사용 기본 원칙

- 설계·구현 중 선택지가 필요한 항목에 명확한 추천안(Recommended)이 있으면 사용자에게 되묻고 멈추지 말고 **추천안을 기본값으로 바로 적용한 뒤 선택한 내용과 이유를 결과에 간단히 고지**한다.
- 단, 추천안만으로 정할 수 없는 고유 문구·정책이나, 명시적인 배포 요청이 필요한 프로덕션 배포(`main` 푸시) 및 운영 데이터 파괴 위험이 있는 작업은 기존 안전 규칙을 유지한다.
- 연결된 MCP 도구 풀(예: `supabase_mcp` 등)은 작업·검증에 필요할 때 별도 사전 허락을 구하지 않고 적극 활용한다. 단, 운영 데이터 테스트 쓰기 금지 원칙을 지키고, 클라이언트 확인 프롬프트가 취소되는 등 도구 실행이 차단되면 우회하지 말고 원인과 수동 적용 방법을 보고한다.

## UI · 목차 표기 규칙

- 단원·레슨 등의 **개수** 표기는 번호와 혼동되지 않도록 단위를 명시한다(예: `Lesson 6` 대신 `Lesson 6개`).
- 우측 `연결된 문서` 및 표의 `연결 문서` 열에는 긴 코스/단원 접두어 대신 목차 이름(`unitMeta.koTitle`)만 간결하게 표시하고, 전체 제목은 `title` 툴팁으로 제공한다.
- `교재 목차`는 사이드바 단일 항목으로 유지하고, 페이지 내부에서 교재별(`BC400` · `BC430`) 탭과 연동된 목차 필터로 분리한다.
