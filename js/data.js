/**
 * ============================================================================
 * [데이터 저장소 틀: js/data.js]
 * ============================================================================
 */

window.WIKI_CATEGORIES = [
  { id: "abap-curriculum", track: "abap", name: "커리큘럼" },
  { id: "abap-concept", track: "abap", name: "Syntax" },
  { id: "abap-tcode", track: "abap", name: "T-Code" },
  { id: "abap-shortcuts", track: "abap", name: "단축키" },

  { id: "ui5-curriculum", track: "ui5", name: "커리큘럼" },
  { id: "ui5-concept", track: "ui5", name: "개념 사전" },
  { id: "ui5-control", track: "ui5", name: "컨트롤 · API" }
];

window.WIKI_TCODES = [];

window.WIKI_DOCS = {
  "abap-useful-syntax": {
    id: "abap-useful-syntax", track: "abap", stepNum: "",
    title: "유용한 함수 · 문법 모음",
    subtitle: "문자열·계산·조건식·반복문에서 자주 쓰는 표현",
    categoryId: "abap-concept",
    aliases: ["strlen", "charlen", "abs", "ipow", "CONCATENATE", "CONTINUE", "IS NOT INITIAL"],
    tcodes: [], specs: {},
    summary: "수업 필기를 바탕으로 자주 쓰는 함수와 문법을 짧은 예제로 정리했습니다. 함수, 연산자, 실행문을 구분해서 익혀 보세요.",
    sections: [
      { title: "문자열 길이 · strlen과 charlen", blocks: [
        { type: "table", headers: ["함수", "의미", "참고"], rows: [
          ["strlen( text )", "문자열 전체 길이", "고정 길이 문자 필드의 뒤쪽 공백은 제외하고, string의 뒤쪽 공백은 포함"],
          ["charlen( text )", "첫 번째 문자의 길이", "전체 문자열 길이가 아님. 문자 표현과 코드 페이지에 따라 달라짐"]
        ] },
        { type: "code", label: "길이 비교", code: "DATA lv_text TYPE string VALUE `ABAP`.\nDATA(lv_length) = strlen( lv_text ).  \" 4\nDATA(lv_first) = charlen( lv_text ).  \" 1" }
      ] },
      { title: "문자열 연결 · &&와 CONCATENATE", blocks: [
        { type: "text", paragraphs: ["&&는 문자열을 이어 붙이는 연산자입니다. 구분자가 필요하면 공백 등을 직접 넣습니다. CONCATENATE는 여러 값을 INTO 뒤의 변수에 합치며, SEPARATED BY로 구분자를 지정할 수 있습니다."] },
        { type: "code", label: "연결과 구분자", code: "DATA lv_result TYPE string.\nlv_result = `Hello` && ` ` && `ABAP`.\n\" 결과: Hello ABAP\n\nCONCATENATE 'SAP' 'ABAP' INTO lv_result SEPARATED BY space.\n\" 결과: SAP ABAP\n\nCONCATENATE '2026' '11' '17' INTO lv_result SEPARATED BY '-'.\n\" 결과: 2026-11-17" }
      ] },
      { title: "일부 문자 추출 · offset(length)", blocks: [
        { type: "text", paragraphs: ["변수+위치(길이) 형식으로 일부 문자를 읽습니다. 시작 위치는 0부터 세며, +0은 생략할 수 있습니다. 지정한 범위가 대상 길이를 벗어나지 않도록 확인하세요."] },
        { type: "code", label: "시스템 날짜에서 연·월·일 추출", code: "DATA lv_year TYPE c LENGTH 4.\nDATA lv_month TYPE c LENGTH 2.\nDATA lv_day TYPE c LENGTH 2.\n\nlv_year = sy-datum+0(4).  \" 연도: 처음부터 4자리\nlv_year = sy-datum(4).    \" +0 생략 가능\nlv_month = sy-datum+4(2). \" 월\nlv_day = sy-datum+6(2).   \" 일\n\" sy-datum은 YYYYMMDD 형식의 시스템 날짜" }
      ] },
      { title: "숫자 계산 · abs와 ipow", blocks: [
        { type: "table", headers: ["함수", "기능", "예"], rows: [
          ["abs( n )", "절대값", "abs( -7 ) → 7"],
          ["ipow( base = n exp = m )", "정수 지수 m으로 n의 거듭제곱 계산", "ipow( base = 2 exp = 3 ) → 8"]
        ] },
        { type: "code", label: "계산 결과 저장", code: "DATA(lv_absolute) = abs( -7 ).\nDATA(lv_power) = ipow( base = 2 exp = 3 )." }
      ] },
      { title: "조건식 · 초기값·범위·같지 않음", blocks: [
        { type: "table", headers: ["표현", "의미", "주의"], rows: [
          ["value IS NOT INITIAL", "자료형의 초기값이 아닌지 검사", "SQL의 IS NOT NULL과 다름"],
          ["value BETWEEN a AND b", "a 이상 b 이하", "양쪽 경계값 모두 포함"],
          ["a NE b 또는 a <> b", "두 값이 같지 않음", "NE와 <>는 같은 비교 의미"]
        ] },
        { type: "text", paragraphs: ["INITIAL은 자료형마다 다릅니다. 정수는 0, 고정 길이 문자형은 공백, string은 빈 문자열이 초기값입니다. 따라서 숫자 0은 NULL이 아니어도 IS INITIAL 조건을 만족합니다."] },
        { type: "code", label: "초기값과 범위 검사", code: "DATA lv_count TYPE i.\nIF lv_count IS INITIAL.\n  WRITE / '초기값 0입니다'.\nENDIF.\n\nlv_count = 5.\nIF lv_count IS NOT INITIAL AND lv_count BETWEEN 1 AND 10.\n  WRITE / '1부터 10 사이입니다'.\nENDIF.\n\nIF lv_count NE 3.  \" lv_count <> 3과 동일\n  WRITE / '3이 아닙니다'.\nENDIF." }
      ] },
      { title: "문자 포함 검사 · CA", blocks: [
        { type: "text", paragraphs: ["CA는 Contains Any입니다. text CA 'abc'는 a, b, c 중 하나라도 들어 있으면 참입니다. 'abc'라는 문자열 전체가 연속으로 포함됐는지를 검사하는 표현은 아닙니다. CA는 대소문자를 구분합니다."] },
        { type: "code", label: "문자 집합과 부분 문자열 구분", code: "DATA lv_text TYPE string VALUE `cat`.\nIF lv_text CA 'abc'.\n  WRITE / 'a, b, c 중 하나 이상 포함'.\nENDIF.\n\nIF lv_text CS 'abc'.\n  WRITE / 'abc라는 연속 문자열 포함'.\nENDIF.\n\" cat: CA 조건은 참, CS 조건은 거짓" }
      ] },
      { title: "반복문 · CONTINUE", blocks: [
        { type: "text", paragraphs: ["CONTINUE는 현재 반복 회차의 남은 문장을 건너뛰고 다음 회차로 진행합니다. 반복문 자체를 종료하지 않습니다. LOOP에서는 다음 행으로, DO나 WHILE에서는 다음 반복으로 넘어갑니다. 반복문을 끝내려면 EXIT를 사용합니다."] },
        { type: "code", label: "3을 건너뛰고 출력", code: "DO 5 TIMES.\n  IF sy-index = 3.\n    CONTINUE.\n  ENDIF.\n  WRITE / sy-index.\nENDDO.\n\" 출력: 1, 2, 4, 5" }
      ] },
      { title: "메시지 · MESSAGE TYPE 'E'", blocks: [
        { type: "code", label: "오류 메시지", code: "MESSAGE '입력 내용을 확인해 주세요.' TYPE 'E'." },
        { type: "text", paragraphs: ["'E'는 오류(Error) 메시지 유형이며, 문자열 값은 대문자로 지정합니다. E 메시지 이후의 처리 흐름은 선택 화면·Dynpro·백그라운드 등 실행 문맥에 따라 달라집니다.", "ABAP에서 줄 중간 주석은 큰따옴표(\")로 시작합니다. 별표(*) 주석은 행의 첫 번째 칸에서 시작하므로, MESSAGE 문 뒤에 *를 붙여 주석을 적지 않습니다."] }
      ] },
      { title: "참고 자료", blocks: [
        { type: "text", paragraphs: [
          "<a href=\"https://learning.sap.com/courses/deepening-your-abap-programming-knowledge/processing-strings-using-functions-and-regular-expressions_abe828f3-4e84-45ce-9c39-0cf9eb2a9f2f\" target=\"_blank\" rel=\"noopener noreferrer\">SAP 공식 학습 자료 · 문자열 함수</a>",
          "<a href=\"https://help.sap.com/docs/abap-cloud/abap-keyword/cstring-func-charlen-dbmaxlen-numofchar-strlen\" target=\"_blank\" rel=\"noopener noreferrer\">ABAP Keyword Documentation · 길이 함수</a>",
          "<a href=\"https://help.sap.com/docs/ABAP_Cloud/abap-cloud-docs_abap-keyword-documentation_abap-for-cloud-development/ABENLOGEXP_INITIAL.html\" target=\"_blank\" rel=\"noopener noreferrer\">ABAP Keyword Documentation · IS INITIAL</a>",
          "<a href=\"https://help.sap.com/docs/abap-cloud/abap-keywords/continue\" target=\"_blank\" rel=\"noopener noreferrer\">ABAP Keyword Documentation · CONTINUE</a>"
        ] }
      ] }
    ]
  },
  "sap-gui-shortcuts": {
    id: "sap-gui-shortcuts",
    track: "abap",
    stepNum: "",
    title: "SAP GUI · ABAP 단축키",
    subtitle: "명령 필드부터 개발 편집기까지 자주 사용하는 기능",
    categoryId: "abap-shortcuts",
    aliases: ["단축키", "Command Field", "Pretty Printer"],
    tcodes: [],
    summary: "명령 필드는 화면과 세션을 이동할 때, 편집기 단축키는 저장·문법 검사·활성화·실행할 때 사용합니다.",
    specs: {},
    sections: [
      {
        title: "명령 필드 · Command Field",
        blocks: [
          { type: "text", paragraphs: ["SAP GUI 상단 명령 필드에 입력한 뒤 Enter를 누릅니다. /n은 현재 세션에서 이동하고, /o는 다른 세션을 여는 명령입니다. 새 창은 external session(외부 세션)이라고 부릅니다."] },
          { type: "table", headers: ["명령어", "기능", "사용 예·참고"], rows: [
            ["/n", "현재 트랜잭션을 종료하고 SAP Easy Access로 이동", "/nSE38은 현재 창에서 SE38 시작"],
            ["/o", "현재 시스템의 세션 목록 표시", "목록에서 새 세션 생성 가능"],
            ["/o + T-Code", "새 세션에서 해당 트랜잭션 시작", "/oSE38은 새 창에서 ABAP Editor 열기"],
            ["/i", "현재 세션 닫기", "현재 창만 종료"],
            ["/nend", "확인 창을 거친 뒤 로그오프", "현재 로그온의 모든 세션 종료"],
            ["/nex", "확인 창 없이 즉시 로그오프", "저장하지 않은 작업이 사라질 수 있으므로 주의"]
          ] },
          { type: "text", paragraphs: ["세션 수는 서버 설정과 버전에 따라 달라집니다. 수업 필기 기준으로 기본 6개, 설정에 따라 최대 16개이며 실제 사용 가능한 수는 실습 시스템 설정을 확인하세요.", "명령어 동작 참고: <a href=\"https://learning.sap.com/courses/technical-implementation-and-operation-i-of-sap-s-4hana-and-sap-business-suite/describing-sap-gui-functions-help-and-personalization\" target=\"_blank\" rel=\"noopener noreferrer\">SAP 공식 학습 자료</a>"] }
        ]
      },
      {
        title: "화면 이동 · 도움말 · 복사",
        blocks: [
          { type: "table", headers: ["단축키", "기능", "사용 위치"], rows: [
            ["Ctrl + N", "새 SAP GUI 세션 열기", "SAP GUI 창 기준 (`/o` 세션 목록에서도 생성 가능)"],
            ["Alt + F4", "현재 창 닫기", "현재 활성화된 창 기준 (`/i`와 동일 역할)"],
            ["F3", "뒤로 가기", "SAP GUI 화면"],
            ["F1", "선택한 항목의 자세한 도움말", "필드 또는 ABAP 키워드를 클릭한 뒤 실행"],
            ["F4", "Search Help · 가능한 값(Possible Entries) 표시", "Search Help가 제공되는 입력 필드를 클릭한 뒤 실행"],
            ["Ctrl + Y", "마우스로 긁어서 복사 (영역 선택 모드)", "SAP GUI 화면에서 `Ctrl + Y` 후 드래그하여 `Ctrl + C`로 복사"],
            ["Shift + F12", "전체화면 전환", "수업에서 사용하는 ABAP Editor 기준"]
          ] }
        ]
      },
      {
        title: "ABAP Editor · 개발 단축키",
        blocks: [
          { type: "table", headers: ["단축키", "기능", "설명"], rows: [
            ["Ctrl + S", "저장", "현재 소스 저장"],
            ["Ctrl + F2", "문법 검사", "활성화 전에 구문 오류 확인"],
            ["Ctrl + F3", "활성화 · Activate", "변경한 소스를 활성 버전으로 반영"],
            ["F8", "실행", "Program 시작·실행"],
            ["Shift + F1", "Pretty Printer", "들여쓰기와 코드 형식 정리"],
            ["Ctrl + ,", "주석 처리", "선택한 코드 줄을 주석으로 전환"],
            ["Ctrl + .", "주석 해제", "선택한 코드 줄의 주석 해제"],
            ["F5", "Text Elements", "텍스트 요소 화면으로 이동 · 해당 편집기 화면 기준"]
          ] },
          { type: "text", paragraphs: ["중복된 항목은 한 번씩 정리했습니다. 위 표는 수업에서 사용하는 SAP GUI 기반 ABAP Editor 기준입니다. 편집기 종류·키보드 설정·현재 화면에 따라 키 배정이 다를 수 있으므로 메뉴에 표시된 단축키를 우선 확인하세요. 예를 들어 디버거에서는 F5가 다른 기능으로 동작합니다."] }
        ]
      },
      {
        title: "자주 쓰는 개발 순서",
        blocks: [
          { type: "text", paragraphs: ["코드 작성 → `Shift + F1`(Pretty Printer) → (`Ctrl + S` 저장 · `Ctrl + F2` 문법 검사) → `Ctrl + F3`(Activate) → `F8`(실행)", "문법 오류가 있으면 먼저 수정하고 다시 검사합니다. 저장과 활성화는 서로 다른 단계이므로, 변경한 내용을 실행하기 전에 Activate 여부를 확인하세요."] }
        ]
      }
    ]
  },
  "welcome-abap": {
    id: "welcome-abap", track: "abap", isHome: true, stepNum: "",
    title: "코드위키: 대문", subtitle: "ABAP · SAP 개발 지식 모음",
    categoryId: "", aliases: [], tcodes: [], specs: {},
    summary: "ABAP 수업 노트와 개발 중 자주 찾는 내용을 모으는 위키입니다. 아래 목차에서 필요한 문서를 찾아보세요.",
    sections: [
      { title: "학습 목차", blocks: [
        { type: "text", paragraphs: ["[[learning-roadmap|전체 학습 목차]]에서 ABAP 기초부터 SAP 모듈까지 살펴볼 수 있습니다. 일부 문서는 목차를 먼저 구성했으며 본문은 순차적으로 보강합니다."] },
        { type: "table", headers: ["분야", "문서"], rows: [
          ["시작하기", "[[erp-setup|실습 준비]] · [[abap-basics|ABAP 기초]]"],
          ["ABAP 개발", "[[abap-dictionary|데이터 사전]] · [[abap-modularization|프로그램 모듈화]] · [[abap-data-report|데이터 처리와 리포트]]"],
          ["SAP 모듈", "[[erp-fi|FI]] · [[erp-co|CO]] · [[erp-mm|MM]] · [[erp-sd|SD]] · [[erp-pp|PP]]"],
          ["참고 자료", "[[erp-resources|부록과 참고 자료]]"]
        ] }
      ] },
      { title: "자주 찾는 문서", blocks: [
        { type: "table", headers: ["문서", "내용"], rows: [
          ["[[sap-tcode-reference|T-Code 모음]]", "개발 도구 · 시스템 조회 · 전송 관리"],
          ["[[sap-gui-shortcuts|단축키 모음]]", "명령 필드 · 화면 이동 · ABAP 편집기"],
          ["[[abap-useful-syntax|유용한 함수 · 문법 모음]]", "문자열 · 계산 · 조건식 · 반복문"]
        ] }
      ] }
    ]
  },

  "welcome-ui5": {
    id: "welcome-ui5",
    track: "ui5",
    isHome: true,
    stepNum: "",
    title: "UI5 / Fiori",
    subtitle: "",
    categoryId: "",
    aliases: [],
    tcodes: [],
    summary: "",
    specs: {},
    sections: []
  }
};


/** 학습 목차 뼈대. 본문은 수업 내용에 맞춰 순차적으로 보강합니다. */
(function () {
  const chapters = [
    ["erp-setup", "실습 준비", ["SAP 실습 환경 설치", "접속과 화면 탐색"]],
    ["abap-basics", "ABAP 기초", ["ABAP과 개발 환경", "자료형·변수·상수", "연산과 조건 표현", "문자열 다루기", "날짜·시간과 출력 형식", "예외 처리"]],
    ["abap-dictionary", "데이터 사전", ["ABAP Dictionary 개요", "데이터 요소", "데이터베이스 테이블", "구조와 뷰"]],
    ["abap-modularization", "프로그램 모듈화", ["서브루틴 · FORM / PERFORM", "Function Module", "Include 프로그램"]],
    ["abap-data-report", "데이터 처리와 리포트", ["Open SQL", "내부 테이블", "리포트 프로그램", "ALV 화면 구성"]],
    ["erp-fi", "FI · 재무회계", ["FI 개요와 조직 설정", "계정과목 체계와 총계정원장", "회계 기간·환율·재무제표", "전표 유형·번호·입력 제어", "전표 입력과 역분개", "매출채권과 고객 관리", "매입채무와 공급업체 관리", "외화 거래"]],
    ["erp-co", "CO · 관리회계", ["원가요소와 코스트센터", "배부·정산과 활동유형", "표준원가와 실제원가"]],
    ["erp-mm", "MM · 자재관리", ["구매 기준정보와 공급원", "구매오더", "입고와 입고 취소", "재고 관리와 평가", "관련 트랜잭션 코드"]],
    ["erp-sd", "SD · 판매관리", ["SD 개요와 영업 기준정보", "판매오더", "가격 결정", "관련 테이블과 트랜잭션"]],
    ["erp-pp", "PP · 생산관리", ["BOM·작업장·라우팅", "장기계획 · LTP", "생산오더", "자재원장과 재고 조회", "관련 테이블"]],
    ["erp-resources", "부록과 참고 자료", ["테이블 관계 정리", "학습 자료와 참고문헌"]]
  ];
  const reference = '<a href="https://wikidocs.net/226022" target="_blank" rel="noopener noreferrer">참고 목차 · SAP ERP 따라하기 (위키독스)</a>';
  window.WIKI_DOCS["learning-roadmap"] = {
    id: "learning-roadmap", track: "abap", stepNum: "00",
    title: "전체 학습 목차", subtitle: "실습 준비부터 ABAP 개발과 ERP 업무 모듈까지",
    categoryId: "abap-curriculum", aliases: ["학습 로드맵"], tcodes: [], specs: {},
    summary: "학습 순서와 주제만 먼저 구성했습니다. 각 페이지의 설명과 실습 예제는 이후 보강합니다.",
    sections: [
      { title: "학습 순서", blocks: [{ type: "table", headers: ["순서", "학습 분야", "상태"], rows:
        chapters.map(([id, title], i) => [String(i + 1).padStart(2, "0"), `[[${id}|${title}]]`, "목차 준비 · 본문 예정"])
      }] },
      { title: "지금 볼 수 있는 자료", blocks: [{ type: "text", paragraphs: [
        "[[sap-gui-shortcuts|SAP GUI · ABAP 단축키]]", "[[abap-useful-syntax|유용한 함수 · 문법 모음]]"
      ] }] },
      { title: "참고", blocks: [{ type: "text", paragraphs: [reference, "참고 자료의 큰 흐름을 바탕으로 코드위키의 학습 단위에 맞게 재구성했습니다."] }] }
    ]
  };
  chapters.forEach(([id, title, topics], i) => {
    window.WIKI_DOCS[id] = {
      id, track: "abap", stepNum: String(i + 1).padStart(2, "0"), title,
      subtitle: "학습 목차 · 본문 준비 중", categoryId: "abap-curriculum",
      aliases: [], tcodes: [], specs: {},
      summary: "아래 주제 순서대로 설명과 실습 예제를 채울 예정입니다. [[learning-roadmap|전체 학습 목차]]에서 다른 분야도 확인할 수 있습니다.",
      sections: topics.map(topic => ({ title: topic, blocks: [] }))
    };
  });
})();


/** 수업에서 자주 쓰는 SAP GUI 트랜잭션 코드. */
(function () {
  const groups = [
    ["시스템 상태와 오류 확인", [
      ["SM50", "Work Process Overview", "현재 애플리케이션 서버의 워크 프로세스 상태와 실행 작업 확인"],
      ["SM04", "User Overview", "현재 애플리케이션 서버의 로그인 사용자와 세션 확인"],
      ["ST22", "ABAP Dump Analysis", "런타임 오류의 덤프·발생 위치·원인 확인"]
    ]],
    ["데이터와 개발 객체 탐색", [
      ["SE16", "Data Browser", "테이블 이름과 조회 조건을 입력하여 저장된 데이터 조회"],
      ["SE84", "Repository Information System", "Program 등 저장소의 개발 객체를 조건별로 검색"],
      ["SE80", "Object Navigator", "Package·Program·함수 그룹·클래스 등 개발 객체를 통합 탐색"],
      ["SE11", "ABAP Dictionary", "테이블·구조·데이터 요소 등 데이터 사전 객체 정의와 유지보수"]
    ]],
    ["Program과 화면 개발", [
      ["SE38", "ABAP Editor", "ABAP Program 생성·소스 편집·검사·활성화·실행"],
      ["SE37", "Function Builder", "함수 모듈 생성·유지보수·테스트"],
      ["SE24", "Class Builder", "글로벌 클래스와 인터페이스 등 객체지향 개발 객체 관리"],
      ["SE41", "Menu Painter", "메뉴·툴바·기능 키를 구성하는 GUI 상태와 제목 관리"],
      ["SE51", "Screen Painter", "Dynpro 화면의 레이아웃과 흐름 로직 편집"]
    ]],
    ["Change Request와 실행 코드 관리", [
      ["SE09", "Transport Organizer", "Change Request와 Task 생성·조회·관리"],
      ["SE93", "Transaction Maintenance", "트랜잭션 코드 생성·변경 및 실행 대상 연결"]
    ]]
  ];
  const entries = groups.flatMap(([, rows]) => rows);
  window.WIKI_DOCS["sap-tcode-reference"] = {
    id: "sap-tcode-reference", track: "abap", stepNum: "",
    title: "자주 쓰는 T-Code 모음", subtitle: "개발 도구·데이터 조회·시스템 점검 빠른 찾기",
    categoryId: "abap-tcode", aliases: ["트랜잭션 코드", ...entries.map(([code]) => code)],
    tcodes: entries.map(([code]) => code), specs: {},
    summary: "SAP GUI 명령 필드에 T-Code를 입력하면 해당 도구로 이동합니다. 현재 창에서 이동할 때는 /nSE38, 새 창에서 열 때는 /oSE38처럼 사용합니다.",
    sections: [
      ...groups.map(([title, rows]) => ({ title, blocks: [{ type: "table", headers: ["T-Code", "도구 이름", "주요 용도"], rows }] })),
      { title: "헷갈리기 쉬운 구분", blocks: [{ type: "text", paragraphs: [
        "SE16의 Initial Screen은 데이터 브라우저의 첫 화면을 뜻합니다. SAP Easy Access로 돌아가는 명령은 /n이며, SE16 자체는 테이블 데이터 조회 도구입니다.",
        "SE11은 데이터 구조를 정의하고, SE16은 저장된 데이터를 조회합니다. SE84는 객체 검색, SE80은 객체를 탐색하며 개발하는 통합 작업 공간에 가깝습니다.",
        "SM50·SM04는 현재 애플리케이션 서버 기준입니다. 화면에 보이는 목록을 시스템 전체의 프로세스·사용자 목록으로 혼동하지 마세요.",
        "[[sap-gui-shortcuts|SAP GUI · ABAP 단축키]]에서 명령 필드 사용법도 함께 확인할 수 있습니다."
      ] }] },
      { title: "공식 참고 자료", blocks: [{ type: "text", paragraphs: [
        '<a href="https://help.sap.com/docs/SUPPORT_CONTENT/abapfaq/3353523950.html" target="_blank" rel="noopener noreferrer">SAP Help · 개발 관련 트랜잭션 코드</a>',
        '<a href="https://help.sap.com/docs/SUPPORT_CONTENT/basis/3354611686.html" target="_blank" rel="noopener noreferrer">SAP Help · 시스템 관리 트랜잭션 코드</a>'
      ] }] }
    ]
  };
  window.WIKI_TCODES.push(...entries.map(([code, label]) => ({ code, label, track: "abap", docId: "sap-tcode-reference" })));
})();

/** Topic names and editorial cross-references shared by the wiki renderer. */
(function () {
  const connections = {
    "erp-setup": [["SAP GUI", "Easy Access", "실습 환경"], ["sap-gui-shortcuts", "sap-tcode-reference", "abap-basics"]],
    "abap-basics": [["자료형", "변수", "상수", "조건식", "문자열"], ["abap-useful-syntax", "sap-gui-shortcuts", "abap-dictionary"]],
    "abap-dictionary": [["ABAP Dictionary", "DATA ELEMENT", "Domain", "데이터 요소", "데이터베이스 테이블", "데이터 사전"], ["sap-tcode-reference", "abap-data-report"]],
    "abap-modularization": [["Function Module", "함수 모듈", "서브루틴", "FORM", "PERFORM", "Include 프로그램"], ["sap-tcode-reference", "abap-basics"]],
    "abap-data-report": [["Open SQL", "내부 테이블", "리포트 프로그램", "ALV"], ["abap-dictionary", "abap-useful-syntax", "abap-modularization"]],
    "erp-fi": [["FI", "재무회계", "총계정원장"], ["erp-co", "erp-mm", "erp-sd"]],
    "erp-co": [["CO", "관리회계", "코스트센터"], ["erp-fi", "erp-pp"]],
    "erp-mm": [["MM", "자재관리", "구매오더"], ["erp-fi", "erp-pp", "erp-sd"]],
    "erp-sd": [["SD", "판매관리", "판매오더"], ["erp-mm", "erp-fi"]],
    "erp-pp": [["PP", "생산관리", "생산오더", "BOM"], ["erp-mm", "erp-co"]],
    "erp-resources": [[], ["learning-roadmap", "sap-tcode-reference", "sap-gui-shortcuts", "abap-useful-syntax"]],
    "abap-useful-syntax": [[], ["abap-basics", "abap-data-report", "sap-gui-shortcuts"]],
    "sap-gui-shortcuts": [["명령 필드", "Pretty Printer", "Activate"], ["sap-tcode-reference", "erp-setup", "abap-useful-syntax"]],
    "sap-tcode-reference": [["T-Code", "ABAP Editor", "Function Builder", "Data Browser"], ["abap-dictionary", "abap-modularization", "sap-gui-shortcuts"]]
  };
  for (const [id, [aliases, related]] of Object.entries(connections)) {
    const doc = window.WIKI_DOCS[id];
    doc.aliases = [...new Set([...(doc.aliases || []), ...aliases])];
    doc.sections.push({ title: "관련 문서", blocks: [{ type: "text", paragraphs: [
      related.map(target => `[[${target}|${window.WIKI_DOCS[target].title}]]`).join(" · ")
    ] }] });
  }
})();
