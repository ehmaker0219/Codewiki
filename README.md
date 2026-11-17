# 코드위키

SAP / ABAP 수업 필기를 정리한 정적 위키입니다. HTML·CSS·JavaScript로 구성하며 로그인과 게시판은 기존 Supabase 프로젝트를 사용합니다.

## 다른 노트북에서 시작하기

Git과 Node.js LTS를 설치한 후 실행합니다. 별도 npm 패키지 설치는 필요하지 않습니다.

```sh
git clone --branch main https://github.com/ehmaker0219/Codewiki.git
cd Codewiki
node scripts/preview.cjs
```

브라우저에서 http://localhost:4175/ 를 열고 기존 사이트 계정으로 로그인하세요. 서버 종료는 Ctrl+C입니다. 이미 4175 포트를 쓰고 있다면 환경 변수 PORT로 다른 포트를 지정할 수 있습니다.

기존 DB에 연결하므로 노트북을 옮긴다는 이유로 SQL을 다시 실행할 필요는 없습니다. 게시판 작성·관리 작업은 실제 DB에 반영됩니다. DB 비밀번호는 로컬 사이트 실행에 필요하지 않습니다.

## 작업을 옮기는 순서

작업 시작 전 `git pull --ff-only`를 실행합니다. 작업 종료 후 변경 파일을 확인하고 커밋·푸시한 다음 다른 노트북에서 pull하세요. 두 노트북에서 동시에 같은 파일을 수정하면 충돌 조정이 필요할 수 있습니다.

## 파일 구성

- `index.html`: 화면 구조와 스크립트 로딩 순서
- `css/style.css`, `css/theme.css`: 기본 스타일과 블루 위키 테마
- `js/data.js`: 기본 문서·단축키·T-Code와 목차
- `js/class-notes.js`: 11/11~17 필기 기반 문서와 최종 목차 구성
- `js/ui5-data.js`: UI5 자료 (화면 접근은 준비 중으로 비활성화)
- `js/app.js`: 문서 렌더링·검색·링크·역링크
- `js/auth.js`, `js/board.js`: 인증과 게시판
- `supabase-setup.sql`, `SECURITY-UPDATE.md`: DB 구성·보안 업데이트 안내

원본 PPT·PDF·필기는 이 저장소에 포함하지 않았습니다. 위키에 정리한 내용은 포함되어 있습니다. 비밀번호 메모와 `.env` 파일은 커밋하지 마세요.

## 검증

```sh
node tests/wiki-links.cjs
node tests/board-reply.cjs
node tests/security-regression.cjs
```

ABAP 예제는 SAP 시스템에서 별도로 실행·검증해야 합니다. SQL 회귀 테스트는 운영 DB가 아닌 별도 테스트 DB에서만 실행하세요.

## 소스와 배포

`main`은 작업 소스이자 GitHub Pages 배포 브랜치입니다. main에 푸시하면 Pages 빌드 후 공개 사이트에 자동 반영됩니다. 새 디자인은 `codex/design-v2`에서 개발하며 main에 통합하기 전에는 공개 사이트가 변경되지 않습니다. 1일차 소스와 배포는 `day1-savepoint`, `day1-deploy` 태그에 보존되어 있습니다.
