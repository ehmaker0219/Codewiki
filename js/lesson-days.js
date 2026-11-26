/** Date pages are curated from original notes, not whole topic copies. */
(() => {
  const docs = window.WIKI_DOCS;
  const text = (...paragraphs) => ({type: 'text', paragraphs});
  const table = (headers, rows) => ({type: 'table', headers, rows});
  const section = (sourceDocId, title, ...blocks) => ({sourceDocId, title, blocks});
  const from = (id, title) => {
    const source = docs[id].sections.find(s => s.title === title);
    if (!source) throw new Error(`Missing lesson section: ${id}/${title}`);
    return {...source, sourceDocId: id};
  };
  const days = [
    {date: '2026-11-11', source: '261111WED.md', sections: [
      from('unit-01', '요청 처리 흐름'),
      from('unit-01', '워크 프로세스와 잠금'),
      from('unit-01', '통신 구성 요소'),
      section('sap-gui-shortcuts', 'SAP GUI 명령과 도움말', table(['입력 / 키', '용도'], [
        ['/nend', '확인 후 로그오프'], ['/nex', '확인 없이 로그오프'],
        ['/o', '세션 목록 확인 및 새 세션 열기'], ['/i', '현재 세션 닫기'],
        ['/n', '현재 트랜잭션 종료 후 초기 화면'], ['/nSE38 · /oSE38', '현재 세션 / 새 세션에서 SE38 실행'],
        ['F1 · F4', '필드 도움말 / 입력 가능한 값 도움말'], ['F8', 'Program 실행'],
        ['Ctrl+F3', '활성화'], ['Ctrl+, · Ctrl+.', '주석 처리 / 해제']
      ]), text('새 창 수의 제한이나 단축키 동작은 시스템 설정과 SAP GUI 환경에 따라 확인합니다. 전체 화면 전환과 실행 중단은 현재 화면의 메뉴를 확인하세요.')),
      section('sap-tcode-reference', '처음 확인한 T-Code', table(['코드', '도구'], [
        ['SM50', 'Work Process Overview'], ['SM04', '사용자·세션 조회'], ['SE16', 'Data Browser'],
        ['SE84', 'Repository Information System'], ['SE80', 'Object Navigator'], ['SE11', 'ABAP Dictionary'],
        ['SE37', 'Function Builder'], ['SE24', 'Class Builder'], ['SE38', 'ABAP Editor'],
        ['SE41', 'Menu Painter'], ['SE51', 'Screen Painter'], ['SE09', 'Transport Organizer']
      ])),
      from('unit-02', '개발·품질·운영 시스템'),
      from('unit-02', 'Package와 Change Request'),
      from('unit-02', '문장과 주석'),
      section('unit-03', '입력·변수·대입·출력', table(['문장', '역할'], [
        ['PARAMETERS', '선택 화면의 입력 필드'], ['DATA', '변수 선언'],
        ['MOVE 원본 TO 대상 / 대상 = 원본', '값 대입'], ['WRITE', '클래식 리스트 출력']
      ]), text('SE80에서 Program을 생성하고 활성화한 뒤 실행합니다. 문법을 확인할 때는 F1 도움말을 사용하고 obsolete로 표시된 구문의 대안을 확인합니다.'))
    ]},
    {date: '2026-11-12', source: '261112THU.txt', sections: [
      from('unit-02', '트랜잭션 코드 생성'),
      section('unit-02', '릴리스와 Package 변경', text('문법 검사와 활성화·실행 확인을 거친 뒤 SE09에서 Task와 Change Request를 릴리스합니다. 대상 시스템 반영에는 임포트 절차가 이어집니다.', 'Package 이동은 객체의 Additional Functions → Change Package에서 확인합니다. 새 Package와 Change Request의 전송 설정도 확인하세요.')),
      section('unit-03', '런타임 오류 조회', text('ST22에서 ABAP 런타임 오류의 덤프 내역을 확인합니다. 발생 시각, Program과 오류 위치를 살펴봅니다.')),
      from('unit-03', '주요 기본 타입'), from('unit-03', '길이를 지정하는 타입'),
      from('unit-03', '변수 선언과 대입'),
      from('unit-03', '초기값 확인'),
      from('unit-03', '텍스트 심볼과 번역')
    ]},
    {date: '2026-11-13', source: '261113FRI.txt', sections: [
      from('unit-03', '반복문 비교'),
      section('unit-03', '반복 종료와 횟수', text('DO ... ENDDO는 내부에 종료 조건을 두고 EXIT로 종료할 수 있습니다. DO n TIMES는 지정한 횟수만 반복하고, WHILE은 조건이 참인 동안 반복합니다.', 'SELECT ... ENDSELECT는 조회 결과를, LOOP AT ... ENDLOOP는 내부 테이블의 행을 처리합니다. sy-dbcnt와 sy-tabix를 일반 반복 회차인 sy-index와 구분하세요.')),
      from('unit-03', '자주 보는 시스템 필드'),
      section('unit-03', '중단점과 한 단계 실행', text('편집기에서 중단점을 설정하고 Program을 실행하면 해당 위치에서 디버거가 열립니다. F5로 한 단계씩 실행하며 변수와 시스템 필드의 변화를 확인합니다.')),
      from('unit-03', '메시지 유형'),
      from('unit-03', '직접 문구와 메시지 클래스')
    ]},
    {date: '2026-11-16', source: '261116MON.txt', sections: [
      section('unit-03', '디버깅으로 실행', text('Program의 Execute → Debugging 메뉴 또는 중단점을 이용해 실행 흐름을 확인합니다.')),
      section('unit-04', '서브루틴 생성과 호출', text('FORM ... ENDFORM으로 처리 단위를 정의하고 PERFORM으로 호출합니다. 편집기의 서브루틴 생성 기능이나 드래그 앤 드롭으로 호출 틀을 만들 수 있습니다.')),
      from('unit-04', '서브루틴 매개변수'),
      section('unit-04', '함수 모듈 호출', text('SE37에서 함수 모듈과 인터페이스를 확인하고 CALL FUNCTION으로 호출합니다.')),
      from('unit-04', '호출자와 함수의 방향')
    ]},
    {date: '2026-11-17', source: '261117TUE.txt', sections: [
      from('unit-04', '함수 그룹과 함수 모듈'),
      section('unit-04', '함수 모듈 테스트 입력', text('함수 그룹의 글로벌 데이터와 상수는 TOP Include에서 관리합니다. 함수 모듈과 관련 Include의 활성화 상태를 확인하세요.', 'SE37 테스트에서 문자 입력의 대소문자를 보존해야 한다면 해당 테스트 화면의 대소문자 구분 설정을 확인합니다.')),
      from('unit-04', 'BAPI와 RFC의 관계'), from('unit-04', '입출력과 오류 처리'),
      section('unit-04', 'BAPI 탐색', text('BAPI Explorer에서 업무 객체별 메서드를 확인합니다. GetList, GetDetail, Create, Change, Delete 등은 기능 이름의 예이며 실제 제공 여부는 객체마다 다릅니다.')),
      from('unit-04', 'Global Class와 Local Class'), from('unit-04', 'Static 호출과 Instance 호출'),
      section('unit-04', 'Global Class 생성과 접근 범위', text('SE24에서 Class를 생성하고 메서드 이름과 매개변수를 정의합니다. PRIVATE 메서드는 Class 외부에서 직접 호출할 수 없으므로 외부에 공개할 동작은 접근 범위를 확인합니다.')),
      from('unit-03', '예외와 반환 코드'),
      from('unit-01', 'Program과 저장소 객체'), from('unit-01', 'Include와 모듈화')
    ]},
    {date: '2026-11-18', source: '261118 수요일 (2).md', sections: [
      from('unit-04', 'Local Class의 정의와 구현'),
      from('unit-05', '구조체 선언과 컴포넌트'),
      from('unit-05', '구조체 간 MOVE-CORRESPONDING'),
      from('unit-05', '내부 테이블의 종류와 접근'),
      from('unit-05', '내부 테이블 타입과 변수 선언'),
      from('unit-05', '행 추가·조회·수정·삭제'),
      from('unit-05', '내부 테이블 정렬'),
      from('unit-05', 'CLEAR·REFRESH·FREE'),
      from('unit-05', 'Header Line과 OCCURS — 기존 코드 읽기')
    ]},
    {date: '2026-11-19', source: '261119 목요일.md', sections: [
      from('unit-06', 'Open SQL과 Transparent Table'),
      from('unit-06', 'SELECT 기본 구조와 호스트 변수'),
      from('unit-06', '한 행 조회와 정렬된 첫 행'),
      from('unit-06', '작업 영역·내부 테이블·CORRESPONDING'),
      from('unit-06', 'INTO TABLE과 APPENDING TABLE'),
      from('unit-06', 'WHERE 조건과 NULL'),
      from('unit-06', 'DISTINCT·집계·GROUP BY·HAVING'),
      from('unit-06', '조회 결과가 없을 때와 시스템 필드'),
      from('unit-06', 'JOIN과 ON·WHERE의 차이'),
      from('unit-06', '보완: 서브쿼리와 FOR ALL ENTRIES'),
      from('unit-06', 'INSERT·UPDATE·MODIFY·DELETE'),
      from('unit-06', '보완: 트랜잭션과 안전한 변경'),
      from('unit-06', '보완: 성능과 다음 문법'),
      from('unit-06', '필기와 참고 자료')
    ]},
    {date: '2026-11-20', source: '261120 금요일 (1).md', sections: [
      from('unit-07', 'Classic ABAP Report와 Selection Screen'),
      from('unit-07', 'Report 처리 순서'),
      from('unit-02', 'SE80에서 Program이 안 보일 때'),
      from('unit-06', '최신 문법(Strict Mode)과 쉼표·@ 규칙')
    ]},
    {date: '2026-11-23', source: '261123 월요일.md', sections: [
      from('unit-07', '리스트 아이콘과 컬럼 서식 참고'),
      from('bc430-01', 'ABAP Dictionary의 역할과 3가지 기능'),
      from('bc430-01', 'View 4가지'),
      from('bc430-02', 'Data의 속성과 Domain · Data Element가 필요한 이유'),
      from('bc430-02', 'Domain — Technical Attribute와 SE11 절차'),
      from('bc430-02', 'Data Element — Semantic Attribute와 SE11 절차'),
      from('bc430-02', 'Structure — 종류(Flat · Deep)와 .INCLUDE'),
      from('bc430-02', 'Table Type — SE11 전역 내부 테이블 타입'),
      from('bc430-02', '필기와 참고 자료')
    ]},
    {date: '2026-11-24', source: '261124 화요일.md', sections: [
      from('bc430-03', 'Transparent Table 생성과 Technical Settings'),
      from('bc430-04', 'Database Access Using Index — Primary · Secondary Index'),
      from('bc430-04', 'Database Access Using the Buffer — Table Buffer와 동기화'),
      from('bc430-05', 'Creating Fixed Values — Domain Value Range 입력 제한'),
      from('bc430-05', 'Defining Foreign Keys — Check Table과 Cardinality')
    ]},
    {date: '2026-11-25', source: '261125 수요일.md', sections: [
      from('bc430-05', 'Creating Text Tables — 언어전환용 테이블과 LANGU(SPRAS)'),
      from('bc430-06', 'Where-Used List로 Dictionary 객체 종속성 확인'),
      from('bc430-07', 'Table Changes — Table Conversion과 Database Utility(SE14)'),
      from('bc430-07', 'Enhancement — Standard Table과 Append Structure'),
      from('bc430-08', 'Creating Database Views — View 생성 · Join 규칙 · Dynamic Attachment'),
      from('bc430-08', 'Creating Maintenance Views — SM30과 Table Maintenance Generator')
    ]}
  ];
  // Dates are rebuilt from explicit source associations, including split topics.
  for (const doc of Object.values(docs)) if (doc.track === 'abap') doc.lessonDates = [];
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const weekOriginMs = Date.UTC(2026, 10, 9);
  const weekOf = date => {
    const [y, m, d] = date.split('-').map(Number);
    const week = Math.floor((Date.UTC(y, m - 1, d) - weekOriginMs) / 604800000) + 1;
    return week > 0 ? week : null;
  };
  window.WIKI_LESSON_DAYS = days.map(day => {
    const id = 'lesson-' + day.date;
    const title = `${day.date} (${weekdays[new Date(day.date + 'T12:00:00').getDay()]})`;
    const week = day.week ?? weekOf(day.date);
    for (const topic of new Set(day.sections.map(s => s.sourceDocId))) docs[topic].lessonDates.push(day.date);
    docs[id] = {id, title, track:'abap', isDailyLesson:true, week, aliases:[], tcodes:[], specs:{},
      sourceFile:day.source, sourceTopics:[...new Set(day.sections.map(s => s.sourceDocId))],
      summary:'해당 날짜의 원본 필기 범위로 정리했습니다. 설명과 학습용 예제는 이해를 돕기 위해 보완했습니다.', sections:day.sections};
    return {date:day.date, title, docId:id, track:'abap', week};
  });
})();
