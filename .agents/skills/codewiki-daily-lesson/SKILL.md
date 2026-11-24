---
name: codewiki-daily-lesson
description: >-
  Integrates daily SAP/ABAP or UI5 class note files (.txt or .md, such as
  "261123 월요일.md") into CodeWiki's topic pages, curated daily lesson pages,
  code example guides, textbook mappings, and regression tests. Use this skill
  whenever the user provides a daily lesson note file or asks to reflect
  today's learned class content onto the CodeWiki site.
---

# CodeWiki 일일 수업 필기 반영 절차

사용자가 매일 전달하는 `.txt` 또는 `.md` 수업 필기를 CodeWiki의 주제별 문서와 일자별 수업 페이지에 일관되게 반영하기 위한 절차다.

## 1. 원본 필기 파싱 및 보완 기준

1. **날짜 · 원본 파일명 확인**: 파일명(예: `261123 월요일.md`, `261124TUE.txt`) 또는 본문에서 수업 날짜(`YYYY-MM-DD`)와 `source` 문자열(원본 파일명 그대로)을 확인한다. 날짜가 불명확하면 추측하지 말고 사용자에게 먼저 확인한다.
2. **`codewiki-rich-v1` 블록 복원 및 제거**:
   - CodeWiki `#study` 학습 노트 에디터에서 내보낸 `.md` 파일에는 ```` ```codewiki-rich-v1 ... ``` ```` JSON 블록과 마크다운 이스케이프(`1\.`, `\-`, `\_`, `\~`)가 포함될 수 있다.
   - JSON 블록 내부의 문단·인용문·목록 텍스트와 빈칸으로 남겨 둔 순서 번호(`orderedList`의 빈 `listItem` 등)를 빠짐없이 해석한다.
   - 최종 생성된 `window.WIKI_DOCS` 데이터에는 `codewiki-rich-v1` 원문이나 불필요한 백슬래시 이스케이프가 절대 남지 않아야 한다.
3. **빈칸 · 약칭 보완**:
   - 수업 중 필기 속도로 인해 번호만 적혀 비어 있는 항목(예: `SE11`의 4가지 View 중 2·3번 누락)이나 명백한 철자 오타는 SAP 공식 문서 기준(실습 시스템 Standard ABAP `7.5` / `7.52`)으로 정확히 보완하고, 보완한 항목임을 본문에 짧게 밝힌다.

## 2. 용어 및 ABAP 예제 작성 규칙 (`AGENTS.md` 준수)

- **원어 · 사용자 표기 유지**: 사용자가 필기에 적었거나 수업에서 사용하는 영문·한글 SAP/ABAP 용어 표기를 임의로 번역하지 않고 그대로 유지한다(예: `Change Request`, `Task`, `Package`, `Program`, `ABAP Dictionary`, `Type Definitions`, `DB Objects`, `Services`, `Search Help`, `Domain`, `Data Element`, `Technical Attribute`, `Semantic Attribute`, `Field Label`, `SET/GET Parameters`, `Structure`, `Flat structure`, `Simple structure`, `Nested structure`, `Deep structure`, `.INCLUDE`, `Table Type`, `Line Type` 등). 한글 검색 편의를 위한 표현은 `aliases` 배열에만 추가한다.
- **SAP 항공 실습 모델 사용**: 수업 중 이해를 돕기 위해 든 개념 비유(예: `사람-이름-성` 접근, 오븐·트레이 비유)는 설명 문단에 살리되, **ABAP `TYPES`·`DATA`·`SELECT` 코드 예제는 학생/더미 데이터 대신 반드시 SAP 항공 실습 모델(`SCARR`, `SPFLI`, `SFLIGHT`, `SBOOK`, `SCUSTOM`, `SAPLANE`, `S_CARR_ID`, `S_CONN_ID`, `BC400_*` 등)로 작성**한다.
- **Report 선언 규칙**: 실행 가능한 ABAP Report 전체 예제는 첫 줄을 `REPORT zabap_f##_##.`으로 작성한다.

## 3. 코드베이스 반영 체크리스트

### 필수 수정 파일

1. **`js/class-notes.js` (주제별 커리큘럼 문서)**
   - 하루치 필기에 여러 주제가 함께 들어 있으면(예: 앞부분 이전 단원 보충 + 뒷부분 신규 단원) 각 주제 문서(`WIKI_DOCS[<topic-id>]`)에 맞게 나누어 배치한다.
   - **기존 일자 페이지 호환성 유지**: 이미 `js/lesson-days.js`의 이전 날짜들이 `from(docId, sectionTitle)`로 참조하고 있는 섹션의 제목을 바꾸거나 삭제하지 않는다. 기존 문서에 새 날짜 내용을 더할 때는 새 `section(...)`을 추가하고 `source(...)`의 날짜 표기(예: `'11/18 · 11/20 · 11/23'`)를 갱신한다.
   - 목차 스텁(`js/data.js`의 `chapters`)이던 문서를 처음 본문으로 채울 때는 `put(...)`으로 작성하고 `connections` 객체에 연관 문서 ID 배열을 추가한다(`learning-roadmap`의 상태가 자동으로 `'필기 정리 · 예제'`로 바뀌고 지식 맵에서도 활성 노드로 표시됨; 단, `connections` 순회 시점에는 그보다 아래에서 선언되는 `abap-thinking-flow`가 아직 생성 전이므로 `connections` 배열에는 `data.js` 또는 위쪽 `put(...)`에서 이미 정의된 문서 ID만 넣는다).
   - 파일 상단 날짜 주석, `docs['learning-roadmap'].summary`, `docs['welcome-abap']` 분야 표(`이후 학습`에 있던 주제를 해당 학습 분야 행으로 이동)를 최신 날짜에 맞게 갱신한다.
   - **별칭(`aliases`) 충돌 금지**: 비-UI5 문서 전체에서 `title`과 `aliases`는 대소문자 무시 기준으로 유일해야 한다(`tests/wiki-links.cjs` 검증).
   - 절차 설명에는 `practice` 블록, 대비 개념에는 `compare`·`table` 블록, 핵심 요약에는 `callout`(`style: 'point' | 'tip'`) 블록, 실행 예제에는 `code(label, code)` 블록을 적절히 활용한다.
   - **참고 자료(`programs`)**: 별도 요청이 없는 한 외부 SAP/ABAP 사이트 링크는 넣지 않으며, `SE80`(`ZBC400_F##`) 실습 Program 목록이 있을 때만 `put(..., dates, [['\`ZABAP_F##_XX\`', '설명'], ...])` 형식으로 `필기와 참고 자료` 표에 기록하고 `docs['sap-gui-programs']`(SAP GUI 프로그램 정리표)에도 함께 반영한다(개인 번호는 항상 `F##`으로 일반화).

2. **`js/lesson-days.js` (일자별 수업 페이지)**
   - `days` 배열 끝에 `{ date: 'YYYY-MM-DD', source: '<원본 파일명>', sections: [...] }`를 추가한다.
   - 해당 날짜 필기에서 실제로 다룬 섹션만 필기 흐름 순서대로 `from(topicId, sectionTitle)` 또는 날짜 전용 요약 `section(topicId, title, ...blocks)`으로 연결한다.

3. **`js/example-notes.js` (코드 블록 실행 안내 — 필수)**
   - 새로 추가한 모든 ABAP `code(label, code)` 블록의 `label`을 키로 `{ input, expected, requirements }` 메타데이터를 추가한다. 하나라도 빠지면 `tests/learning-tools.cjs`가 실패한다.

### 선택적 연동 파일

- **`js/textbook.js`**: 새로 채운 주제가 교재 `Unit 1–13`의 Lesson/Exercise 항목과 대응하면 해당 항목의 대상 문서 배열에 문서 ID를 연결한다.
- **`js/app.js`**: 예제 코드에 새로운 ABAP 핵심 키워드가 추가되어 코드 하이라이팅이 필요하면 `renderEditorCode`의 `keywords` 집합을 보강한다.
- **`js/knowledge-map.js`**: 기존 `CLUSTER_SPECS`에 없는 완전히 새로운 커리큘럼 문서 ID를 신설한 경우에만 해당 클러스터의 `docs`·`angles`에 반영한다.
- **`js/object-game-bank.js` · `js/practice.js`**: 사용자가 함께 요청했거나 새로 배운 객체/문법이 데이터 미니게임·연습문제 보강 대상일 때 반영한다(`js/practice.js`의 기존 문항 `id`는 멘토링 데이터와 연결되므로 절대 변경·삭제하지 않는다).

## 4. 회귀 테스트 갱신 및 검증

1. **`tests/lesson-navigation.cjs`**:
   - 날짜 목록(`day`), 총 날짜 링크 개수(`href=`), 주차 순서 단언을 새 날짜에 맞게 갱신한다.
   - 새 날짜가 새로운 주차(`2026-11-09` 월요일 1주차 기준)의 첫 수업일이면 `nav-week-divider` 개수도 함께 갱신한다.
2. **`tests/learning-tools.cjs`**:
   - `daily('<DD>')`의 `sourceFile`, `title`, 핵심 섹션 존재 여부, 각 주제 문서의 `lessonDates` 배열, 신규 키워드 검색 결과, `!JSON.stringify(daily('<DD>')).includes('codewiki-rich-v1')` 단언을 추가한다.
3. **정적 에셋 동기화 및 통합 검사 실행**:
   - `node scripts/update-assets.cjs`
   - `node scripts/check.cjs`
   - `git diff --check`
4. **배포 주의**:
   - `AGENTS.md` 지침에 따라 사용자의 **명시적인 배포 요청**이 있을 때만 커밋·푸시·배포를 진행하며, 필기 반영만 요청받은 경우에는 로컬 반영과 위 검증 통과까지만 완료하고 결과를 보고한다.
