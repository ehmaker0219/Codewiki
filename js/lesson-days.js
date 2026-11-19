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
      from('sap-architecture', '요청 처리 흐름'),
      from('sap-architecture', '워크 프로세스와 잠금'),
      from('sap-architecture', '통신 구성 요소'),
      section('sap-gui-shortcuts', 'SAP GUI 명령과 도움말', table(['입력 / 키', '용도'], [
        ['/nend', '확인 후 로그오프'], ['/nex', '확인 없이 로그오프'],
        ['/o', '세션 목록 확인 및 새 세션 열기'], ['/i', '현재 세션 닫기'],
        ['/n', '현재 트랜잭션 종료 후 초기 화면'], ['/nSE38 · /oSE38', '현재 세션 / 새 세션에서 SE38 실행'],
        ['F1 · F4', '필드 도움말 / 입력 가능한 값 도움말'], ['F8', '프로그램 실행'],
        ['Ctrl+F3', '활성화'], ['Ctrl+, · Ctrl+.', '주석 처리 / 해제']
      ]), text('새 창 수의 제한이나 단축키 동작은 시스템 설정과 SAP GUI 환경에 따라 확인합니다. 전체 화면 전환과 실행 중단은 현재 화면의 메뉴를 확인하세요.')),
      section('sap-tcode-reference', '처음 확인한 T-Code', table(['코드', '도구'], [
        ['SM50', 'Work Process Overview'], ['SM04', '사용자·세션 조회'], ['SE16', 'Data Browser'],
        ['SE84', 'Repository Information System'], ['SE80', 'Object Navigator'], ['SE11', 'ABAP Dictionary'],
        ['SE37', 'Function Builder'], ['SE24', 'Class Builder'], ['SE38', 'ABAP Editor'],
        ['SE41', 'Menu Painter'], ['SE51', 'Screen Painter'], ['SE09', 'Transport Organizer']
      ])),
      from('abap-development', '개발·품질·운영 시스템'),
      from('abap-development', '패키지와 요청'),
      from('abap-basics', '문장과 주석'),
      section('abap-basics', '입력·변수·대입·출력', table(['문장', '역할'], [
        ['PARAMETERS', '선택 화면의 입력 필드'], ['DATA', '변수 선언'],
        ['MOVE 원본 TO 대상 / 대상 = 원본', '값 대입'], ['WRITE', '클래식 리스트 출력']
      ]), text('SE80에서 프로그램을 생성하고 활성화한 뒤 실행합니다. 문법을 확인할 때는 F1 도움말을 사용하고 obsolete로 표시된 구문의 대안을 확인합니다.'))
    ]},
    {date: '2026-11-12', source: '261112THU.txt', sections: [
      from('abap-development', '트랜잭션 코드 생성'),
      section('abap-development', '릴리스와 패키지 변경', text('문법 검사와 활성화·실행 확인을 거친 뒤 SE09에서 태스크와 요청을 릴리스합니다. 대상 시스템 반영에는 임포트 절차가 이어집니다.', '패키지 이동은 객체의 Additional Functions → Change Package에서 확인합니다. 새 패키지와 요청의 전송 설정도 확인하세요.')),
      section('abap-debug-messages', '런타임 오류 조회', text('ST22에서 ABAP 런타임 오류의 덤프 내역을 확인합니다. 발생 시각, 프로그램과 오류 위치를 살펴봅니다.')),
      from('abap-types', '주요 기본 타입'), from('abap-types', '길이를 지정하는 타입'),
      from('abap-basics', '변수 선언과 대입'),
      ...docs['abap-types'].sections.filter(s => /초기값 확인|텍스트 심볼과 번역/.test(s.title)).map(s => ({...s, sourceDocId: 'abap-types'}))
    ]},
    {date: '2026-11-13', source: '261113FRI.txt', sections: [
      from('abap-loops', '반복문 비교'),
      section('abap-loops', '반복 종료와 횟수', text('DO ... ENDDO는 내부에 종료 조건을 두고 EXIT로 종료할 수 있습니다. DO n TIMES는 지정한 횟수만 반복하고, WHILE은 조건이 참인 동안 반복합니다.', 'SELECT ... ENDSELECT는 조회 결과를, LOOP AT ... ENDLOOP는 내부 테이블의 행을 처리합니다. sy-dbcnt와 sy-tabix를 일반 반복 회차인 sy-index와 구분하세요.')),
      from('abap-loops', '자주 보는 시스템 필드'),
      section('abap-debug-messages', '중단점과 한 단계 실행', text('편집기에서 중단점을 설정하고 프로그램을 실행하면 해당 위치에서 디버거가 열립니다. F5로 한 단계씩 실행하며 변수와 시스템 필드의 변화를 확인합니다.')),
      from('abap-debug-messages', '메시지 유형'),
      from('abap-debug-messages', '직접 문구와 메시지 클래스')
    ]},
    {date: '2026-11-16', source: '261116MON.txt', sections: [
      section('abap-debug-messages', '디버깅으로 실행', text('프로그램의 Execute → Debugging 메뉴 또는 중단점을 이용해 실행 흐름을 확인합니다.')),
      section('abap-modularization', '서브루틴 생성과 호출', text('FORM ... ENDFORM으로 처리 단위를 정의하고 PERFORM으로 호출합니다. 편집기의 서브루틴 생성 기능이나 드래그 앤 드롭으로 호출 틀을 만들 수 있습니다.')),
      from('abap-modularization', '서브루틴 매개변수'),
      section('abap-modularization', '함수 모듈 호출', text('SE37에서 함수 모듈과 인터페이스를 확인하고 CALL FUNCTION으로 호출합니다.')),
      from('abap-modularization', '호출자와 함수의 방향')
    ]},
    {date: '2026-11-17', source: '261117TUE.txt', sections: [
      from('abap-modularization', '함수 그룹과 함수 모듈'),
      section('abap-modularization', '함수 모듈 테스트 입력', text('함수 그룹의 글로벌 데이터와 상수는 TOP Include에서 관리합니다. 함수 모듈과 관련 Include의 활성화 상태를 확인하세요.', 'SE37 테스트에서 문자 입력의 대소문자를 보존해야 한다면 해당 테스트 화면의 대소문자 구분 설정을 확인합니다.')),
      from('abap-bapi', 'BAPI와 RFC의 관계'), from('abap-bapi', '입출력과 오류 처리'),
      section('abap-bapi', 'BAPI 탐색', text('BAPI Explorer에서 업무 객체별 메서드를 확인합니다. GetList, GetDetail, Create, Change, Delete 등은 기능 이름의 예이며 실제 제공 여부는 객체마다 다릅니다.')),
      from('abap-objects', '글로벌 클래스와 로컬 클래스'), from('abap-objects', '정적 호출과 인스턴스 호출'),
      section('abap-objects', '글로벌 클래스 생성과 접근 범위', text('SE24에서 클래스를 생성하고 메서드 이름과 매개변수를 정의합니다. PRIVATE 메서드는 클래스 외부에서 직접 호출할 수 없으므로 외부에 공개할 동작은 접근 범위를 확인합니다.')),
      from('abap-debug-messages', '예외와 반환 코드'),
      from('abap-program-types', '프로그램과 저장소 객체'), from('abap-program-types', 'Include와 모듈화')
    ]},
    {date: '2026-11-18', source: '261118 수요일 (2).md', sections: [
      from('abap-objects', '로컬 클래스의 정의와 구현'),
      from('abap-types', '구조체 선언과 컴포넌트'),
      from('abap-types', '구조체 간 MOVE-CORRESPONDING'),
      from('abap-data-report', '내부 테이블의 종류와 접근'),
      from('abap-data-report', '내부 테이블 타입과 변수 선언'),
      from('abap-data-report', '행 추가·조회·수정·삭제'),
      from('abap-data-report', '내부 테이블 정렬'),
      from('abap-data-report', 'CLEAR·REFRESH·FREE'),
      from('abap-data-report', 'Header Line과 OCCURS — 기존 코드 읽기')
    ]},
    {date: '2026-11-19', source: '261119 목요일.md', sections: [
      from('abap-open-sql', 'Open SQL과 Transparent Table'),
      from('abap-open-sql', 'SELECT 기본 구조와 호스트 변수'),
      from('abap-open-sql', '한 행 조회와 정렬된 첫 행'),
      from('abap-open-sql', '작업 영역·내부 테이블·CORRESPONDING'),
      from('abap-open-sql', 'INTO TABLE과 APPENDING TABLE'),
      from('abap-open-sql', 'WHERE 조건과 NULL'),
      from('abap-open-sql', 'DISTINCT·집계·GROUP BY·HAVING'),
      from('abap-open-sql', '조회 결과가 없을 때와 시스템 필드'),
      from('abap-open-sql', 'JOIN과 ON·WHERE의 차이'),
      from('abap-open-sql', '보완: 서브쿼리와 FOR ALL ENTRIES'),
      from('abap-open-sql', 'INSERT·UPDATE·MODIFY·DELETE'),
      from('abap-open-sql', '보완: 트랜잭션과 안전한 변경'),
      from('abap-open-sql', '보완: 성능과 다음 문법'),
      from('abap-open-sql', '필기와 참고 자료')
    ]}
  ];
  // Dates are rebuilt from explicit source associations, including split topics.
  for (const doc of Object.values(docs)) if (doc.track === 'abap') doc.lessonDates = [];
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  window.WIKI_LESSON_DAYS = days.map(day => {
    const id = 'lesson-' + day.date;
    const title = `${day.date} (${weekdays[new Date(day.date + 'T12:00:00').getDay()]})`;
    for (const topic of new Set(day.sections.map(s => s.sourceDocId))) docs[topic].lessonDates.push(day.date);
    docs[id] = {id, title, track:'abap', isDailyLesson:true, aliases:[], tcodes:[], specs:{},
      sourceFile:day.source, sourceTopics:[...new Set(day.sections.map(s => s.sourceDocId))],
      summary:'해당 날짜의 원본 필기 범위로 정리했습니다. 설명과 학습용 예제는 이해를 돕기 위해 보완했습니다.', sections:day.sections};
    return {date:day.date, title, docId:id, track:'abap'};
  });
})();
