# CodeWiki · 코드위키

**SAP를 배우며 쌓은 필기를, 서로 연결된 개발 문서로.**

ABAP 개념, 코드 예제, SAP GUI 단축키와 T-Code를 모아 보는 학습 위키입니다. 문서에 등장하는 용어를 따라 이동하고, 관련 문서와 역링크로 학습 내용을 연결합니다.

[배포 사이트](https://ehmaker0219.github.io/Codewiki/) · [기준 소스](https://github.com/ehmaker0219/Codewiki/tree/main) · [디자인 V2](https://github.com/ehmaker0219/Codewiki/tree/codex/design-v2)

> 현재 브랜치 `codex/design-v2`는 클래식 SAP GUI 스타일을 개발하는 공간입니다. 공개 사이트에는 기존 1일차 디자인이 배포되어 있습니다.

## 주요 기능

- **문서 탐색** — 카테고리 트리, 문서 검색, 본문 목차, 이전·다음 문서 이동
- **위키 링크** — 등록된 용어의 자동 링크, 관련 문서, 역링크, 링크 미리보기
- **ABAP 학습 자료** — 시스템 구조, 개발·전송 관리, 자료형, 반복문, 디버깅, 모듈화, BAPI와 클래스
- **빠른 참고** — T-Code 모음, SAP GUI 단축키, 유용한 함수·문법, 코드 복사
- **학습 기록** — 브라우저에 읽음 상태 저장
- **회원·건의 게시판** — 가입 승인, 수정 요청, 관리자 답변과 반영 상태 관리

## 디자인 V2

SAP GUI의 클래식 작업 화면에서 착안한 문서 인터페이스입니다.

- 청회색 제목줄과 촘촘한 툴바
- 노란 폴더·선택 행을 사용하는 Repository Browser
- 고정된 화면 틀과 독립적으로 스크롤되는 본문
- 파란 제목줄, 각진 입력칸, 노란 저장 버튼의 대화상자
- 검색창 오른쪽의 학습 트랙 선택 영역

UI5/Fiori 자료는 소스에 포함되어 있지만 현재 트랙 전환은 비활성화되어 있습니다. UI5용 BAS 스타일은 추후 작업 예정입니다.

## 로컬 실행

Git과 Node.js LTS가 필요합니다. 별도 npm 패키지 설치나 빌드 과정은 없습니다.

### 새 디자인 미리보기

```sh
git clone --branch codex/design-v2 https://github.com/ehmaker0219/Codewiki.git CodeWiki-design-v2
cd CodeWiki-design-v2
node scripts/preview.cjs
```

[http://localhost:4176/](http://localhost:4176/)에서 확인합니다. 종료는 `Ctrl+C`입니다.

이 브랜치의 미리보기 서버는 인증 스크립트를 **샘플 전용 구현**으로 대체합니다. 가상 관리자와 게시글로 디자인을 확인하며, 게시판 변경은 해당 브라우저의 로컬 저장소에만 남습니다. 운영 Supabase 데이터는 변경하지 않습니다. 실제 로그인·승인·권한 검증에는 사용하지 않습니다.

이 분리는 `scripts/preview.cjs`로 실행할 때 적용됩니다. 다른 정적 서버로 열면 실제 인증 코드가 로드될 수 있습니다.

### 기존 버전 실행

```sh
git clone --branch main https://github.com/ehmaker0219/Codewiki.git CodeWiki
cd CodeWiki
node scripts/preview.cjs
```

[http://localhost:4175/](http://localhost:4175/)에서 기존 계정으로 로그인합니다. 이 버전은 실제 Supabase에 연결되므로 게시판·회원 관리 작업이 실제 데이터에 반영됩니다. 노트북을 바꾼다는 이유로 DB 설정 SQL을 다시 실행할 필요는 없습니다.

## 브랜치와 세이브포인트

| 이름 | 용도 |
| --- | --- |
| `main` | 기준 소스와 테스트·실행 안내 |
| `gh-pages` | 공개 사이트에 게시하는 정적 파일 |
| `codex/design-v2` | SAP GUI 스타일의 새 디자인 개발 |
| `day1-savepoint` | 1일차 소스를 보존한 태그 |
| `day1-deploy` | 1일차 배포 파일을 보존한 태그 |

소스 브랜치에 푸시하는 것과 사이트 배포는 별개입니다. 새 디자인은 검토 후 UI 변경을 통합하고 `gh-pages`에 반영합니다. 세이브포인트 태그는 유지하며, DB 백업은 Git 저장소와 별도로 보관합니다.

다른 노트북에서 작업을 시작하기 전 `git pull --ff-only`로 최신 내용을 받고, 작업을 마친 뒤 변경 사항을 커밋·푸시합니다.

## 기술 구성

| 영역 | 사용 기술 |
| --- | --- |
| 화면 | HTML, CSS, Vanilla JavaScript |
| 문서 | JavaScript 데이터 객체, 해시 기반 라우팅 |
| 회원·게시판 | Supabase PostgreSQL, RPC 기반 자체 인증·승인 |
| 미리보기 | Node.js HTTP 서버 |
| 배포 | GitHub Pages |

## 파일 안내

```text
CodeWiki/
├── index.html                 # 화면 구조와 스크립트 로딩
├── css/
│   ├── style.css              # 공통 스타일
│   ├── theme.css              # 기존 위키 테마
│   └── design-v2.css          # 클래식 SAP GUI 테마
├── js/
│   ├── data.js                # 기본 문서·단축키·T-Code
│   ├── class-notes.js         # 필기 기반 문서와 최종 학습 목차
│   ├── ui5-data.js            # UI5 학습 자료
│   ├── app.js                 # 렌더링·검색·문서 연결
│   ├── auth.js                # 실제 인증과 회원 승인
│   ├── board.js               # 건의 게시판
│   ├── design-shell.js        # 클래식 작업 화면 제목·상태 표시
│   └── visualizers.js         # 문서 시각화
├── scripts/
│   ├── preview.cjs            # 로컬 미리보기 서버
│   └── design-preview.js      # 디자인 미리보기용 샘플 인증·데이터
├── tests/                     # 링크·게시판·보안 회귀 검사
├── supabase-setup.sql         # DB 구성 및 함수
└── SECURITY-UPDATE.md          # DB 보안 업데이트 안내
```

`class-notes.js`는 기본 문서를 보완하고 목차를 재구성합니다. 수업 내용 수정 시 `data.js`뿐 아니라 이 파일의 최종 정의도 확인하세요. 문서 연결은 `[[문서ID|표시 이름]]` 형식을 사용할 수 있습니다.

## 검증

저장소 루트에서 실행합니다.

```sh
node tests/wiki-links.cjs
node tests/board-reply.cjs
node tests/security-regression.cjs
```

이 검사는 문서 연결과 일부 게시판·인증 동작을 확인합니다. 실제 Supabase 연동, 브라우저 화면, SAP에서의 ABAP 예제 실행까지 보장하지는 않습니다. SQL 회귀 검사는 별도 테스트 DB에서만 실행합니다.

## 자료와 데이터 관리

- 원본 PPT·PDF·필기는 저장소에 포함하지 않았습니다. 위키에 정리한 내용만 포함됩니다.
- 일부 과정은 목차만 준비되어 있으며 본문은 순차적으로 보강합니다.
- 회원·게시글 백업, 비밀번호 메모, 비공개 키와 `.env`는 공개 저장소에 올리지 않습니다.
- 새 DB 구성이나 보안 업데이트는 [SECURITY-UPDATE.md](SECURITY-UPDATE.md)를 확인합니다.

학습 목적으로 제작한 비공식 프로젝트이며 SAP의 공식 제품이 아닙니다.
