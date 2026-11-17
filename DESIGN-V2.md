# 디자인 V2 작업 공간

브랜치: codex/design-v2
기준: day1-savepoint (43a0ad9)

실행: node scripts/preview.cjs
주소: http://localhost:4176/

이 서버는 로컬 127.0.0.1에서만 열립니다. 인증 스크립트 대신 scripts/design-preview.js를 제공하므로 운영 Supabase에 연결하지 않습니다. 가상 관리자와 게시글 2개로 화면을 확인하며 변경 내용은 4176 포트의 브라우저 저장소에만 저장됩니다. 실제 회원 승인·로그인·DB 저장 검증용 환경은 아닙니다.

기존 main, day1-savepoint, day1-deploy 및 공개 사이트는 그대로입니다. 아직 새로운 디자인은 적용하지 않았습니다.
새 디자인이 확정되면 UI 변경만 main으로 통합하고 검증 후 별도로 배포합니다. 미리보기 서버와 샘플 인증 설정은 운영 배포에 사용하지 않습니다.

다른 노트북: git clone --branch codex/design-v2 https://github.com/ehmaker0219/Codewiki.git CodeWiki-design-v2
