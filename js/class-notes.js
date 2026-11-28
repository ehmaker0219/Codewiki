/** 2026-11-11 ~ 26 수업 필기를 BC400 (Unit 1–13) · BC430 ABAP Dictionary (Unit 1–9) 구조로 정리한 문서. */
(function () {
  const docs = window.WIKI_DOCS;
  const raw = {};
  const text = (...paragraphs) => ({ type: 'text', paragraphs });
  const table = (headers, rows) => ({ type: 'table', headers, rows });
  const code = (label, code) => ({ type: 'code', label, code });
  const section = (title, ...blocks) => ({ title, blocks });
  const related = ids => section('관련 문서', text(ids.map(id => `[[${id}|${docs[id].title}]]`).join(' · ')));
  const source = (dates, programs = []) => section('필기와 참고 자료',
    text(`수업 필기: ${dates}. 중복 메모는 합치고 설명과 예제를 보완했습니다. SAP GUI 기반 Standard ABAP 학습을 기준으로 하며, ABAP Cloud에서는 사용 가능한 문법과 도구가 다를 수 있습니다.`),
    ...(programs.length ? [table(['실습 Program (`SE80` · `ZBC400_F##`)', '내용'], programs)] : [])
  );
  function put(id, title, summary, aliases, sections, dates, programs) {
    raw[id] = { id, title, summary, aliases, sections: [...sections, source(dates, programs)], dates, programs: programs || [] };
  }
  put('sap-architecture', 'SAP 시스템 구조', '사용자 요청이 처리되는 흐름과 서버 구성 요소의 역할을 구분합니다.', ['Dispatcher', 'Work Process', '워크 프로세스', 'Message Server', 'Gateway', 'ICM', 'SAP GUI'], [
    section('요청 처리 흐름', text('SAP GUI → Dispatcher → 사용 가능한 Work Process → 필요한 경우 데이터베이스 접근 → 결과 반환 순서로 이해할 수 있습니다. 모든 요청이 데이터베이스 작업을 수행하는 것은 아닙니다.', 'Dispatcher는 요청을 받아 작업을 배분합니다. 큐를 단순한 처리 순서 예제로 이해하되, 실제 스케줄링 전체를 항상 FIFO라고 단정하지 않습니다.')),
    section('Work Process와 잠금', table(['구분', '역할'], [
      ['Dialog', '사용자의 대화형 요청 처리'], ['Background', '예약된 배치 작업과 비대화형 처리'], ['Update', '업데이트 Task의 데이터 변경 처리'], ['Spool', '인쇄 요청 처리'], ['Enqueue', 'SAP 논리 잠금 관리. 현대 구성에서는 ASCS의 별도 Enqueue Server가 담당하며 과거 Enqueue Work Process와 구분']
    ]), text('SM50에서 현재 애플리케이션 서버의 프로세스를, SM04에서 해당 서버의 사용자·세션을 확인합니다. 잠금은 동시에 같은 업무 데이터를 변경할 때 충돌을 조정하는 장치입니다.')),
    section('통신 구성 요소', table(['구성 요소', '역할'], [
      ['Message Server', '애플리케이션 서버 간 통신 조정과 로그온 부하 분산 지원'], ['Gateway', 'RFC 통신 처리'], ['ICM', 'HTTP(S) 등 인터넷 프로토콜 통신 처리']
    ]), text('SAP NetWeaver는 SAP의 기술 플랫폼입니다. “SAP의 모든 제품을 포함하는 프레임워크”라는 뜻은 아닙니다.'))
  ], '11/11');

  put('abap-development', '개발 객체와 전송 관리', 'Program을 Package에 담고 Change Request를 통해 다른 시스템으로 전달하는 흐름입니다.', ['패키지', 'Package', 'Change Request', 'Workbench Request', 'Customizing Request', 'Transport'], [
    section('개발·품질·운영 시스템', text('일반적인 시스템 구성은 개발(DEV) → 품질 검증(QAS) → 운영(PRD)입니다. 개발 객체의 변경을 Change Request와 Task로 기록하고 검증 후 대상 시스템으로 전송합니다.', 'Change Request를 누가 만들고 몇 개로 관리하는지는 팀의 정책에 따릅니다. SI는 항상 Change Request 하나, SM은 여러 개라는 고정 규칙은 없습니다.')),
    section('Package와 Change Request', table(['항목', '의미'], [
      ['Package', '관련 개발 객체를 묶고 전송 속성 등을 관리하는 단위'], ['Workbench Request', 'Program·사전 객체 등 저장소 변경을 관리하는 Change Request'], ['Customizing Request', '커스터마이징 설정 변경을 관리하는 Change Request'], ['Task', 'Change Request 아래에서 작업자별 변경을 모으는 단위']
    ]), text('SE80에서 객체와 Package를 탐색하고, SE09에서 Change Request와 Task를 관리합니다. 고객 객체에는 보통 Y/Z 접두어 또는 등록된 네임스페이스를 사용합니다.', 'Transport Layer는 전송 경로와 관련된 설정입니다. 이름의 첫 글자만으로 고객 객체와 SAP 객체를 판정하지 않습니다. 로컬 Package $TMP의 객체는 일반 Change Request에 기록되지 않습니다.'),
      {
        type: 'practice',
        title: 'SE09에서 Change Request (CTS) 만드는 법',
        steps: [
          { step: '1', action: 'SE09 실행 → 상단 Create (F6) 클릭', detail: 'T-Code SE09(Transport Organizer)를 열고 툴바의 Create 아이콘(또는 F6)을 누릅니다.' },
          { step: '2', action: 'Workbench request 선택', detail: 'Program·Package·ABAP Dictionary·Message Class 등 개발 저장소 객체는 반드시 Workbench request를 선택합니다(커스터마이징 설정은 Customizing request).' },
          { step: '3', action: 'Short Description 입력 후 저장', detail: '요구된 네이밍 규칙에 맞춰 Short Description(예: Basic_ABAP1_F_##)을 적고 저장합니다. 프로젝트 지정이 필요 없다면 비워 두고 저장합니다.' },
          { step: '4', action: '생성된 CTS 번호와 하위 Task 확인', detail: 'Request 번호 아래에 본인 계정(User)의 Development/Correction Task가 자동 생성됩니다. 이후 Package·Program·DDIC 저장 시 이 Request를 선택해 묶습니다.' }
        ]
      },
      {
        type: 'practice',
        title: 'SE80에서 Package 만드는 법',
        steps: [
          { step: '1', action: 'SE80 실행 → Repository Browser에서 Package 선택', detail: '왼쪽 객체 유형 드롭다운을 Package로 바꾸고 Z 또는 Y로 시작하는 Package 이름(예: ZPAC_Basic_F_##)을 입력한 뒤 Enter를 누릅니다.' },
          { step: '2', action: '생성 확인 팝업에서 Yes 클릭', detail: '존재하지 않는 Package 생성 여부 팝업이 뜨면 Yes를 눌러 생성 화면으로 진입합니다.' },
          { step: '3', action: 'Short Description · Software Component · Transport Layer 확인', detail: '설명을 입력하고 Software Component(보통 HOME 또는 실습 환경 기본값)와 Transport Layer가 올바른지 확인합니다.' },
          { step: '4', action: 'Change Request (CTS) 연결 후 저장', detail: '저장 팝업에서 SE09로 미리 만들어 둔 Workbench Request를 선택(Own Requests 버튼 활용)해 연결합니다.' }
        ]
      }
    ),
    section('작성에서 전송까지', text('Package와 Change Request 확인 → Program 작성 → 문법 검사 → 활성화 → 실행·디버깅 → Task와 Change Request 릴리스 → 대상 시스템으로 임포트하는 흐름입니다.', '저장은 편집 내용을 보관하고, 활성화는 실행 가능한 활성 버전을 만드는 과정입니다. 릴리스만으로 운영 반영이 끝나는 것은 아니며, 임포트와 검증 절차가 따릅니다. 단축키는 [[sap-gui-shortcuts|단축키 모음]]을 참고하세요.'),
      {
        type: 'practice',
        title: 'SE38 / SE80에서 실행 가능 Report Program 만드는 법',
        steps: [
          { step: '1', action: 'SE38 실행 (또는 SE80 Package 우클릭 → Create → Program)', detail: 'SE38에서 Z/Y로 시작하는 Program 이름(예: ZPROG_BASIC_F_##)을 입력하고 Create를 클릭합니다. (SE80에서 만들 때는 TOP Include 체크 여부를 상황에 맞게 선택합니다.)' },
          { step: '2', action: 'Attributes 입력: Title & Type = Executable program', detail: 'Title을 작성하고 Type은 반드시 Executable program(실행 가능 Report)으로 선택합니다. Status는 Test Program 등 실습 기준에 맞춰 지정하고 Save를 누릅니다.' },
          { step: '3', action: 'Package와 Change Request (CTS) 지정', detail: '전송·제출 대상이라면 미리 만든 Z Package와 Workbench Request를 선택합니다(단순 연습용만 Local Object / $TMP 사용).' },
          { step: '4', action: '코드 작성 → Pretty Printer → 문법 검사 → Activate → 실행', detail: 'Shift + F1(들여쓰기 정리) → Ctrl + S(저장) → Ctrl + F2(문법 검사) → Ctrl + F3(Activate) → F8(실행) 순서로 확인합니다.' }
        ]
      }
    ),
    section('Transaction Code 생성', text('SE93에서 실행 대상에 맞는 트랜잭션 유형을 선택합니다. 클래식 실행 가능 Report는 Report Transaction, 화면 번호를 시작점으로 사용하는 Program은 대화형 트랜잭션을 검토합니다.', '선택 항목의 순서 번호 대신 유형 이름과 실행 대상을 확인하세요. Program 이름과 T-Code 이름을 같게 하는 것은 팀의 명명 관례이며 필수 조건은 아닙니다.'),
      {
        type: 'practice',
        title: 'SE93에서 Report Transaction Code (T-Code) 만드는 법',
        steps: [
          { step: '1', action: 'SE93 실행 → Z/Y T-Code 이름 입력 후 Create', detail: 'T-Code SE93(Transaction Maintenance)에서 고객 네임스페이스 이름(예: ZPROG_BASIC_F_## 또는 ZT_...)을 입력하고 Create를 누릅니다.' },
          { step: '2', action: 'Short Text 입력 및 Start Object 선택', detail: '실행 가능 Report Program에는 반드시 Program and selection screen (report transaction) 라디오 버튼을 선택합니다.' },
          { step: '3', action: 'Program 이름 · Selection Screen(1000) · GUI Support 확인', detail: 'Program 칸에 연결할 Report Program 이름을 입력하고, Selection screen은 기본값 1000을 유지합니다. 하단 GUI Support(HTML · Java · Windows) 체크 상태를 확인합니다.' },
          { step: '4', action: '저장(Package · CTS 지정) 후 명령 필드로 테스트', detail: 'Ctrl + S로 저장하며 Package와 Change Request를 연결합니다. 완료 후 F8 또는 SAP GUI 명령 필드에 /n<T-Code>를 입력해 바로 실행되는지 확인합니다.' }
        ]
      }
    ),
    section('SE80에서 Program이 안 보일 때', text('SE80 Object Navigator에서 Package 아래에 생성한 Program이 목록에 바로 보이지 않을 때가 있습니다.', '해당 Package 또는 객체 목록에서 우클릭 → Additional Functions → Rebuild Object List를 실행하면 저장소 객체 트리가 갱신되어 정상적으로 표시됩니다.'))
  ], '11/11 · 11/12 · 11/20');

  put('abap-basics', 'ABAP 기초', '문장 구조, 변수 선언, 입력과 출력의 기본 흐름을 익힙니다.', ['ABAP 기초', 'DATA', 'PARAMETERS', 'CLEAR', 'TYPE', 'LIKE'], [
    section('문장과 주석', text('ABAP 문장은 마침표(.)로 끝납니다. 키워드와 식별자는 대소문자를 구분하지 않지만, 문자열 리터럴의 내용은 구분됩니다.', '큰따옴표(") 뒤는 해당 줄의 주석이며, 첫 번째 열의 별표(*)는 줄 전체를 주석으로 만듭니다. F1 문서에 obsolete로 표시된 구문은 유지보수 시 의미를 익히되 새 코드에서는 대안을 검토합니다.')),
    section('변수 선언과 대입', code('TYPE · LIKE · VALUE · CLEAR', `REPORT zabap_f##_##.
DATA lv_count TYPE i VALUE 17.
DATA lv_copy LIKE lv_count.
CONSTANTS lc_limit TYPE i VALUE 20.
lv_copy = lv_count.
CLEAR lv_count.
WRITE: / lv_count, / lv_copy, / lc_limit.`), text('TYPE은 타입을, LIKE는 기존 데이터 객체의 타입을 참조합니다. VALUE는 선언 시 값을 지정합니다. 대입은 = 로 표현할 수 있으며 MOVE 원본 TO 대상도 기존 코드에서 볼 수 있습니다.', 'CLEAR는 빈 문자열을 일괄 대입하는 명령이 아니라 타입별 초기값으로 되돌리는 명령입니다. 자세한 값은 [[abap-types|자료형과 초기값]]을 참고하세요.')),
    section('입력과 출력', code('Selection Screen에서 숫자 입력받기', `REPORT zabap_f##_##.
PARAMETERS p_count TYPE i DEFAULT 3.
DATA lv_double TYPE i.

START-OF-SELECTION.
  lv_double = p_count * 2.
  WRITE: / '입력:', p_count,
         / '두 배:', lv_double.`), text('PARAMETERS는 Report의 Selection Screen 입력 필드를 정의합니다. WRITE는 클래식 리스트 출력을 만듭니다. 문자열 함수와 조건 표현은 [[abap-useful-syntax|유용한 함수 · 문법 모음]]으로 연결됩니다.'))
  ], '11/11 · 11/12', [
    ['`ZABAP_F##_01`', 'ABAP Write statement'],
    ['`ZABAP_F##_02`', 'ABAP Syntax'],
    ['`ZABAP_F##_04`', 'ABAP Calculation'],
    ['`ZABAP_F##_05`', 'ABAP IF Conditional Statement'],
    ['`ZBC400_F##_HELLO`', 'Program ZBC400_F##_HELLO'],
    ['`ZBC400_F##_COMPUTE`', 'Program ZBC400_F##_COMPUTE']
  ]);

  put('abap-types', '자료형과 초기값', '문자형·숫자형·바이트형을 구분하고 길이와 소수 자릿수를 명시합니다.', ['자료형', 'DATA TYPE', '초기값', 'DECFLOAT16', 'DECFLOAT34', 'XSTRING'], [
    section('주요 기본 타입', table(['타입', '용도', '주의점'], [
      ['d / t', '날짜 YYYYMMDD / 시간 HHMMSS', '초기값은 각각 00000000 / 000000'], ['i / int8', '4바이트 / 8바이트 정수', 'i 범위는 -2,147,483,648 ~ 2,147,483,647'], ['f', '8바이트 이진 부동소수점', '십진 소수를 정확히 표현하지 못할 수 있음'], ['decfloat16 / decfloat34', '16자리 / 34자리 십진 부동소수점', '자리 수는 고정 소수점 이하 자릿수가 아니라 유효 숫자'], ['string / xstring', '가변 길이 문자열 / 바이트 문자열', '길이가 가변인 타입도 완전 타입일 수 있음']
    ])),
    section('길이를 지정하는 타입', table(['타입', '예', '의미'], [
      ['c', 'TYPE c LENGTH 10', '고정 길이 문자'], ['n', 'TYPE n LENGTH 6', '숫자 문자. 계산용 정수와 구분'], ['x', 'TYPE x LENGTH 4', '고정 길이 바이트'], ['p', 'TYPE p LENGTH 8 DECIMALS 2', '패킹 십진수. 길이는 바이트, DECIMALS는 소수 자릿수']
    ]), text('p의 총 숫자 자릿수는 길이를 L바이트라 할 때 2L−1입니다. 마지막 반바이트는 부호에 사용됩니다. LENGTH 8 DECIMALS 2이면 총 15자리 중 소수 2자리입니다.', '완전 타입은 필요한 타입 속성이 정해진 타입을 뜻합니다. “완전 타입 = 고정 길이”로 외우지 마세요. c/n/x/p는 선언 맥락에 기본 길이가 적용될 수도 있지만 의도를 드러내려면 길이를 명시하는 편이 좋습니다.')),
    section('초기값 확인', code('문자와 숫자의 초기값', `DATA lv_number TYPE i VALUE 7.
DATA lv_text TYPE c LENGTH 5 VALUE 'ABAP'.
DATA lv_digits TYPE n LENGTH 4.
CLEAR: lv_number, lv_text.
IF lv_number IS INITIAL.
  WRITE / '정수 초기값은 0'.
ENDIF.
WRITE / lv_digits.`), text('숫자형은 0, c는 공백, n은 길이만큼의 숫자 문자 0, string/xstring은 길이 0이 초기 상태입니다. IS INITIAL은 SQL의 NULL 검사와 다릅니다.')),
    section('Text Symbol과 번역', text('화면 문구는 Text Symbol로 분리할 수 있습니다. text-001 또는 문자열 리터럴 뒤의 Text Symbol ID를 사용하는 방식이 있습니다.', 'Text Element에서 Text Symbols(화면 문구)와 Selection Texts(PARAMETERS · SELECT-OPTIONS 라벨)를 함께 관리하고 필요한 언어로 번역합니다. Program과 Text Element의 저장·활성화 상태를 함께 확인하세요.'),
      {
        type: 'practice',
        title: 'SE38에서 Text Element (Text Symbols · Selection Texts) 만드는 법',
        steps: [
          { step: '1', action: 'SE38 편집 화면에서 Goto → Text Elements 진입', detail: '상단 메뉴 Goto → Text Elements(또는 편집 화면의 F5 · Text Elements 버튼)를 눌러 Text Element 관리 화면을 엽니다.' },
          { step: '2', action: 'Text Symbols 탭: 3자리 ID(001 등)와 문구 입력', detail: 'Sym 열에 001, 002 같은 3자리 키를, Text 열에 출력 문구를 입력합니다. 코드에서는 text-001 또는 \'기본문구\'(001)로 참조합니다.' },
          { step: '3', action: 'Selection Texts 탭: PARAMETERS · SELECT-OPTIONS 라벨 입력', detail: 'Selection Screen 변수(예: PA_CAR, PA_CON, SO_FDT) 옆에 표시할 라벨(Airline, Connection Number, Flight Date 등)을 직접 적거나, DDIC Ref.를 체크해 Data Element의 Field Label을 자동 가져옵니다.' },
          { step: '4', action: 'Text Element 화면에서 별도로 Activate (Ctrl + F3)', detail: 'Program만 Activate하고 Text Element를 Activate하지 않으면 Selection Screen에 변수명(PA_CAR 등)이 그대로 보입니다. 반드시 Text Element 화면에서 Ctrl + F3으로 활성화하세요.' }
        ]
      },
      code('Text Symbol 사용', `WRITE / text-001.
WRITE / '안녕하세요'(002).`))
  ], '11/12', [
    ['`ZABAP_F##_03`', 'ABAP Data Type & Elementary Data Objects'],
    ['`ZABAP_F##_13`', 'ABAP Structure Variable'],
    ['`ZBC400_F##_STRUCTURE`', 'Program ZBC400_F##_STRUCTURE']
  ]);

  put('abap-loops', '반복문과 시스템 필드', '반복 종류에 맞는 시스템 필드를 읽고 CONTINUE와 EXIT를 구분합니다.', ['DO', 'WHILE', 'sy-index', 'sy-tabix', 'sy-subrc', 'sy-dbcnt', 'sy-uname', '시스템 필드'], [
    section('반복문 비교', table(['문장', '용도', '참고'], [
      ['DO n TIMES', '정해진 횟수 반복', '현재 회차는 sy-index'], ['DO ... ENDDO', '종료 조건을 내부에 둔 반복', 'EXIT 등 종료 경로 필요'], ['WHILE ... ENDWHILE', '조건이 참인 동안 반복', '조건을 바꾸는 코드 필요'], ['LOOP AT ... ENDLOOP', 'Internal Table 행 순회', 'sy-tabix는 테이블 종류와 접근 방식에 따라 해석'], ['SELECT ... ENDSELECT', '조회 결과 행별 처리', 'sy-dbcnt는 처리된 DB 행 수; 일반 루프 인덱스가 아님']
    ])),
    section('CONTINUE와 EXIT', code('짝수는 건너뛰고 7에서 종료', `REPORT zabap_f##_##.
DO 10 TIMES.
  IF sy-index = 7.
    EXIT.
  ENDIF.
  IF sy-index MOD 2 = 0.
    CONTINUE.
  ENDIF.
  WRITE / sy-index.
ENDDO.`), text('출력은 1, 3, 5입니다. CONTINUE는 현재 반복의 남은 문장을 건너뛰고 다음 회차로 진행합니다. EXIT는 현재 반복문을 끝냅니다.')),
    section('자주 보는 시스템 필드', table(['필드', '의미'], [
      ['sy-mandt', '현재 클라이언트 번호'], ['sy-uname', '현재 로그온 사용자 이름; 클라이언트 이름이 아님'], ['sy-langu', '로그온 언어 키'], ['sy-datum / sy-uzeit', '애플리케이션 서버 기준 시스템 날짜 / 시간'], ['sy-tcode', '현재 Transaction Code'], ['sy-repid', '현재 ABAP Program 이름'], ['sy-index', 'DO / WHILE 반복 회차'], ['sy-tabix', '인덱스 테이블 작업의 행 인덱스. 해시 테이블은 일반적으로 0'], ['sy-subrc', '해당 문장이 설정한 반환 코드'], ['sy-dbcnt', '해당 SQL 문장이 처리한 행 수']
    ]), text('sy-subrc의 0은 흔히 성공을 뜻하지만 값과 의미는 문장마다 다릅니다. 0/4/8만 존재하는 것은 아닙니다. 다음 문장에서 덮어쓸 수 있으므로 결과를 설정하는 문장 바로 뒤에서 검사하세요.'))
  ], '11/13', [
    ['`ZABAP_F##_06`', 'ABAP Loop Statement'],
    ['`ZABAP_F##_07`', 'ABAP sy-subrc System Field'],
    ['`ZBC400_F##_LOOP`', 'Program ZBC400_F##_LOOP']
  ]);

  put('abap-debug-messages', '디버깅과 메시지', '중단점에서 값을 추적하고 Message Class 생성·REPORT 선언과 예외의 목적을 구분합니다.', ['디버깅', 'Debugger', '중단점', 'Message Class', 'MESSAGE-ID', '메시지 클래스', 'MESSAGE'], [
    section('디버깅 순서', text('SE38 또는 SE80에서 중단점을 설정하고 실행합니다. 중단된 위치에서 변수 값, 호출 스택, 조건식의 결과를 확인합니다.', '디버거의 F5는 한 단계 실행(Single Step)입니다. 편집 화면의 F5는 Text Element 등 다른 기능일 수 있으므로 화면 맥락을 확인하세요. 런타임 오류는 ST22에서 덤프를 확인합니다.')),
    section('메시지 유형', table(['유형', '의도와 동작'], [
      ['S', '성공 또는 상태 안내'], ['I', '정보 안내'], ['W', '경고'], ['E', '오류 처리'], ['A', '처리 중단'], ['X', '런타임 오류와 숏덤프 발생']
    ]), text('팝업·상태바 표시와 이후 제어 흐름은 메시지 유형뿐 아니라 Selection Screen, 화면 PAI, 배치 등 실행 맥락에 따라 달라집니다. E/W를 “항상 하단 바에만 표시”라고 외우지 않습니다.')),
    section('직접 문구와 Message Class (SE91 · REPORT 선언)',
      text('`Message Class`는 `SE91`에서 `000`~`999` 번호로 메시지 문구를 중앙 관리하고 다국어 번역까지 지원하는 저장소 객체입니다. 문구 안의 `&` 자리표시자(또는 `&1`~`&4`)에 `WITH`의 값을 최대 4개까지 전달할 수 있습니다.'),
      {
        type: 'practice',
        title: 'SE91에서 Message Class 생성 절차 (4단계)',
        steps: [
          { step: '1', action: 'SE91 실행 → Z/Y 이름 입력 후 Create', detail: 'T-Code SE91(Message Maintenance)을 열고 고객 네임스페이스 규칙에 따라 Z 또는 Y로 시작하는 Message Class 이름(예: ZCW, ZBASIC_MSG_F_##)을 입력한 뒤 Create를 클릭합니다.' },
          { step: '2', action: 'Short Text 입력 후 Messages 탭 이동', detail: 'Message Class 설명(Short Text)을 입력하고 Messages 탭으로 이동합니다.' },
          { step: '3', action: '000~999 번호별 메시지 문구 작성 (& 자리표시자 활용)', detail: '예: 000 = 입력값을 입력해주세요., 001 = 안녕하세요 & 처럼 번호별 문구를 작성합니다. &는 문장당 최대 4개까지 WITH 값으로 치환할 수 있습니다.' },
          { step: '4', action: '저장(Ctrl + S) 시 Package · Change Request 지정', detail: 'Package와 Change Request(CTS)를 지정해 저장합니다. SE91의 Message Class 항목은 별도 Activate 버튼 없이 저장으로 반영됩니다.' }
        ]
      },
      table(['Report Program에서 Message Class 선언 · 호출 방식', '문법 예시', '언제 사용하는가'], [
        ['**방법 1 · `REPORT` 선언부 `MESSAGE-ID` 지정 (권장)**', '`REPORT zabap_f##_## MESSAGE-ID zcw.`<br>본문: `MESSAGE e000.` / `MESSAGE i001 WITH sy-uname.`', 'Program 전체에서 같은 `Message Class`를 반복 사용할 때. 호출할 때마다 `(zcw)`를 생략할 수 있어 가장 깔끔합니다.'],
        ['**방법 2 · 개별 `MESSAGE` 문에 직접 지정**', '`MESSAGE i001(zcw) WITH sy-uname.`<br>또는 `MESSAGE ID \'ZCW\' TYPE \'E\' NUMBER \'000\'.`', '`REPORT` 줄에 `MESSAGE-ID`를 선언하지 않았거나, 다른 `Message Class`의 번호를 일회성으로 호출할 때 사용합니다.'],
        ['**직접 문구 (하드코딩)**', '`MESSAGE \'입력값을 확인하세요\' TYPE \'I\'.`', '간단한 임시 테스트용. 번역·공통 관리가 불가능하므로 실무와 시험에서는 `Message Class` 사용을 권장합니다.']
      ]),
      code('직접 문구', `MESSAGE '입력값을 확인하세요' TYPE 'I'.`),
      code('Message Class 예시 — ZCW와 001을 먼저 생성', `MESSAGE i001(zcw) WITH sy-uname.`),
      code('REPORT 선언부 MESSAGE-ID로 Message Class 연결', `REPORT zabap_f##_## MESSAGE-ID zcw.

PARAMETERS p_carr TYPE s_carr_id.

AT SELECTION-SCREEN.
  IF p_carr IS INITIAL.
    MESSAGE e000. " REPORT 선언부 MESSAGE-ID(zcw)의 000번 오류 메시지
  ENDIF.

START-OF-SELECTION.
  MESSAGE i001 WITH sy-uname. " zcw의 001번 문구(&)에 sy-uname 전달`)
    ),
    section('예외와 반환 코드', text('클래식 예외는 호출 시 EXCEPTIONS에 번호를 매핑하고 sy-subrc로 처리하는 방식을 볼 수 있습니다. Class 기반 예외는 TRY … CATCH … ENDTRY로 처리합니다.', '같은 인터페이스의 예외 선언 방식은 해당 문법의 제약을 따릅니다. Program 전체에서 두 방식이 절대 공존할 수 없다는 뜻은 아닙니다.'))
  ], '11/12 · 11/13 · 11/16 · 11/17');

  put('abap-modularization', '프로그램 모듈화', 'Subroutine, Function Module, Method를 구분하고 매개변수 전달 방향을 읽습니다.', ['프로그램 모듈화', '서브루틴', 'FORM', 'PERFORM', 'Function Module', '함수 모듈'], [
    section('모듈화 방식', table(['단위', '호출', '주요 용도'], [
      ['Subroutine', 'PERFORM', '클래식 Program 내 절차 분리'], ['Function Module', 'CALL FUNCTION', 'Function Group에 속하는 재사용 단위'], ['Method', 'Class=>Method / 참조->Method', 'Class의 동작을 캡슐화']
    ])),
    section('Subroutine 매개변수', table(['선언 방식', '전달과 반영'], [
      ['USING VALUE(p)', '값 복사. 내부 변경은 호출자에게 복사되지 않음'], ['CHANGING VALUE(p)', '값을 복사하고 정상 종료 시 결과를 호출자에게 반영'], ['USING p / CHANGING p', '참조 전달. 같은 실제 데이터를 가리키므로 변경이 호출자에 반영']
    ]), text('참조 전달에서 USING은 읽기 전용을 보장하지 않습니다. 입력용은 USING, 변경 의도가 있는 값은 CHANGING으로 드러내는 관례가 중요합니다.', 'FORM의 형식 매개변수에 LENGTH/DECIMALS를 직접 붙이는 대신 미리 정의한 완전 타입을 사용합니다. TYPE ANY 같은 제네릭 타입은 유연하지만 정적 검사와 사용 가능한 연산이 제한됩니다.'),
      {
        type: 'callout', style: 'point', title: 'SELECT-OPTIONS를 Subroutine 파라미터로 넘길 때 (so_date[] 주의)',
        body: '`SELECT-OPTIONS` 변수는 Header Line과 Table Body를 함께 가지므로 `PERFORM` 호출 시 **`so_fdt[]`**처럼 `[]`를 붙여 바디만 전달해야 합니다. `FORM` 쪽에서는 `TYPES tt_fdt TYPE RANGE OF s_date.`로 Range Table Type을 먼저 선언한 뒤 **`USING pt_fdt TYPE tt_fdt`**로 받으면 깔끔합니다. 자세한 리뷰 예제는 [[basic-session-review|Basic Session Review]]를 참고하세요.'
      },
      code('입력은 복사하고 결과는 반영', `REPORT zabap_f##_##.
DATA lv_result TYPE i.
PERFORM double_number USING 3 CHANGING lv_result.
WRITE / lv_result.
FORM double_number USING VALUE(iv_number) TYPE i
                   CHANGING cv_result TYPE i.
  cv_result = iv_number * 2.
ENDFORM.`)),
    section('Function Group과 Function Module', text('SE37에서 Function Module의 인터페이스와 테스트 기능을 확인합니다. Function Group은 관련 Function Module과 공유 글로벌 데이터를 담습니다.', 'Function Group ZDEMO의 생성된 메인 Program은 SAPLZDEMO입니다. 그룹 이름 자체에 SAPL을 붙이는 뜻은 아닙니다. LZDEMOTOP은 글로벌 선언을, LZDEMOUXX는 Function Module 구현 Include들을 포함하는 역할을 합니다.', '한 그룹에 넣는 Function Module 수는 고정 규칙이 아닙니다. 함께 쓰는 목적과 상태를 기준으로 묶고 활성화 상태를 확인합니다.'),
      {
        type: 'practice',
        title: 'SE80에서 Function Group 만드는 법 (Function Module보다 먼저 생성)',
        steps: [
          { step: '1', action: 'SE80 실행 → Repository Browser에서 Function Group 선택', detail: '객체 유형을 Function Group으로 선택하고 Z/Y 이름(예: ZFG_FLIGHT_##)을 입력한 뒤 Enter → 생성 팝업에서 Yes를 누릅니다.' },
          { step: '2', action: 'Short Text 입력 후 Package · Change Request 연결', detail: '설명을 입력하고 저장 시 본인 Package와 Workbench Request(CTS)를 지정합니다.' },
          { step: '3', action: 'Function Group 최상위 노드 우클릭 → Activate', detail: '생성 직후 SAPL... 마스터 Program과 TOP/UXX Include가 비활성 상태이므로, Function Group 노드에서 먼저 Activate(Ctrl + F3)해 두어야 내부 Function Module 호출 시 오류가 나지 않습니다.' }
        ]
      },
      {
        type: 'practice',
        title: 'SE37에서 Function Module 만드는 법 · 테스트 · 호출',
        steps: [
          { step: '1', action: 'SE37 실행 → Z_/Y_ Function Module 이름 입력 후 Create', detail: 'T-Code SE37(Function Builder)에서 Z_ 또는 Y_로 시작하는 이름(예: Z_GET_FLIGHT_##)을 입력하고 Create를 클릭합니다.' },
          { step: '2', action: '미리 만든 Function Group과 Short Text 지정', detail: '팝업에서 소속 Function Group 이름과 설명을 입력하고 Save를 누릅니다.' },
          { step: '3', action: '인터페이스 탭 정의 (Import · Export · Changing · Exceptions)', detail: 'Import(입력), Export(출력), Changing(입출력), Exceptions(예외 이름)를 등록합니다. Associated Type에는 Local Type을 쓸 수 없으므로 반드시 ABAP Dictionary Global Type(Data Element · Global Structure · Table Type)이나 Built-in Type을 지정하세요.' },
          { step: '4', action: 'Source Code 작성 후 Activate (Function Group 함께 활성)', detail: 'Source Code 탭에 로직을 작성하고 필요 시 RAISE <예외명>.을 넣은 뒤, Ctrl + F3으로 Function Module과 Function Group 관련 Include를 모두 활성화합니다.' },
          { step: '5', action: 'F8 단독 테스트 및 SE38 Pattern(Ctrl + F6)으로 호출', detail: 'SE37에서 F8로 값을 직접 넣어 테스트합니다. Report에서 호출할 때는 SE38 툴바의 Pattern 버튼(Ctrl + F6) → CALL FUNCTION을 이용하면 파라미터 방향(EXPORTING/IMPORTING)과 EXCEPTIONS 틀이 자동 생성됩니다.' }
        ]
      }
    ),
    section('호출자와 함수의 방향', table(['함수 인터페이스', '호출 문장', '방향'], [
      ['IMPORTING', 'EXPORTING', '호출자가 함수에 입력 전달'], ['EXPORTING', 'IMPORTING', '함수 결과를 호출자가 수신'], ['CHANGING', 'CHANGING', '값을 전달하고 변경 결과 수신']
    ]), text('호출 예제를 입력할 때는 해당 함수의 실제 매개변수 이름과 타입을 SE37에서 확인하세요.'))
  ], '11/16 · 11/17', [
    ['`ZABAP_F##_08`', 'ABAP Subroutine'],
    ['`ZABAP_F##_09`', 'ABAP Subroutine Parameters'],
    ['`ZABAP_F##_10`', 'ABAP Function Module'],
    ['`ZBC400_F##_SUBROUTINE`', 'Program ZBC400_F##_SUBROUTINE'],
    ['`ZBC400_F##_FUNCTION_MODULE`', 'Function Module 실습 1'],
    ['`ZBC400_F##_FUNCTION_MODULE_2`', 'Function Module 실습 2']
  ]);

  put('abap-bapi', 'BAPI와 RFC', '원격 호출 기술인 RFC와 업무 API인 BAPI를 구분합니다.', ['BAPI', 'RFC', 'RETURN'], [
    section('BAPI와 RFC의 관계', text('RFC는 시스템 간 함수 호출 기술입니다. BAPI는 표준화된 업무 객체 인터페이스이며 전통적인 BAPI 구현에는 원격 호출 가능 Function Module이 사용됩니다. 모든 RFC 함수가 BAPI인 것은 아닙니다.', 'GetList, GetDetail, Create, Change 등은 업무 동작의 예입니다. 실제 제공 Method와 이름은 업무 객체별로 확인합니다.')),
    section('입출력과 오류 처리', text('BAPI는 화면 팝업 대신 RETURN 구조 또는 테이블로 성공·오류 메시지를 전달하도록 설계합니다. 호출자는 RETURN의 TYPE과 메시지 내용을 확인해야 합니다.', '원격 함수의 인터페이스는 RFC 지원 타입과 값 전달 제약을 따릅니다. 일반 로컬 함수의 모든 설정에 그대로 적용할 규칙으로 이해하지 마세요.', '변경 BAPI의 커밋·롤백 책임은 개별 BAPI 문서를 확인해야 합니다. 호출 성공 여부만 보고 저장 완료라고 판단하지 않습니다.'))
  ], '11/17');

  put('abap-objects', 'Class와 Method', 'Class 자체의 Static Method와 객체의 Instance Method를 구분합니다.', ['Global Class', 'Local Class', 'Static Method', 'Instance Method', '정적 메서드', '인스턴스 메서드', '참조 변수', 'TYPE REF TO'], [
    section('Global Class와 Local Class', text('Global Class는 저장소 객체로 관리하며 SE24에서 확인할 수 있습니다. Local Class는 Program 안에 정의합니다. Class는 속성과 Method를 함께 묶는 단위입니다.'),
      {
        type: 'practice',
        title: 'SE24에서 Global Class · Method 만드는 법',
        steps: [
          { step: '1', action: 'SE24 실행 → ZCL_/YCL_ 이름 입력 후 Create → Class', detail: 'T-Code SE24(Class Builder)에서 ZCL_ 또는 YCL_로 시작하는 이름을 입력하고 Create → Object Type에서 Class를 선택합니다.' },
          { step: '2', action: 'Description · Instantiation 확인 후 Package · CTS 저장', detail: '설명을 적고 Instantiation(일반적으로 Public)을 확인한 뒤 Package와 Change Request에 저장합니다.' },
          { step: '3', action: 'Attributes / Methods 탭에서 멤버와 Level · Visibility 정의', detail: 'Methods 탭에 Method 이름을 적고 Level(Instance Method / Static Method)과 Visibility(Public / Protected / Private)를 설정합니다.' },
          { step: '4', action: 'Parameters 버튼으로 매개변수 정의 후 Method 구현', detail: 'Method 행을 선택한 채 Parameters 버튼을 눌러 Importing / Exporting / Changing / Returning 파라미터를 지정한 뒤, Method 이름을 더블클릭해 로직을 작성합니다.' },
          { step: '5', action: 'Activate (Ctrl + F3) 후 F8 테스트', detail: 'Class 전체를 활성화하고 F8로 Static Method 또는 Instance 생성 후 Method 동작을 바로 검증합니다.' }
        ]
      }
    ),
    section('Static 호출과 Instance 호출', table(['종류', '표기', '특징'], [
      ['Static Method', 'Class명=>Method명( )', '객체 생성 없이 Class에 호출'], ['Instance Method', '참조변수->Method명( )', '생성된 객체를 참조하여 호출']
    ]), text('TYPE REF TO는 객체 참조를 보관할 변수를 선언합니다. 선언만으로 객체가 생기지는 않으며 CREATE OBJECT 또는 NEW로 생성합니다.'), code('Local Class의 Instance Method', `REPORT zabap_f##_##.
CLASS lcl_greeter DEFINITION.
  PUBLIC SECTION.
    METHODS greet.
ENDCLASS.
CLASS lcl_greeter IMPLEMENTATION.
  METHOD greet.
    WRITE / 'Hello ABAP'.
  ENDMETHOD.
ENDCLASS.
START-OF-SELECTION.
  DATA lo_greeter TYPE REF TO lcl_greeter.
  CREATE OBJECT lo_greeter.
  lo_greeter->greet( ).`))
  ], '11/17');

  put('abap-program-types', 'Program 종류와 Include', '실행 가능한 Report와 다른 Program에 포함되는 소스 단위를 구분합니다.', ['Include Program', 'Include 프로그램', '리포트 프로그램', 'Module Pool'], [
    section('Program과 저장소 객체', table(['종류', '역할'], [
      ['실행 가능 Program / Report', 'Selection Screen과 이벤트를 사용해 실행·출력'], ['Module Pool', '클래식 Dynpro 화면과 대화형 흐름 처리'], ['Function Pool', 'Function Group의 런타임 Program'], ['Class Pool', 'Global Class의 런타임 Program'], ['Interface Pool', 'Global Interface의 런타임 Program'], ['Include', '다른 Program에 포함되는 소스. 독립 실행 대상이 아님']
    ]), text('“Screen”은 화면 객체를, “OOP”는 객체지향 프로그래밍 방식을 가리킵니다. 이를 그대로 공식 Program 유형 이름과 일대일 대응시키지 않습니다.')),
    section('Include와 모듈화', text('Include는 소스를 나누는 수단입니다. Include 자체가 별도 매개변수나 호출 경계를 만드는 함수는 아닙니다. 동작 단위의 재사용은 Subroutine·Function Module·Method와 구분해서 설계합니다.'))
  ], '11/17');

  // 11/18: retain earlier sections so their curated daily pages stay unchanged.
  raw['abap-objects'].sections.splice(-1, 1,
    section('Local Class의 정의와 구현', text('12번 Program 필기: DEFINITION에서 속성과 Method의 인터페이스를 선언하고 IMPLEMENTATION에서 Method의 동작을 작성합니다. 속성만 선언하고 구현할 Method가 없다면 구현부를 생략할 수 있습니다.', '접근 영역은 PUBLIC → PROTECTED → PRIVATE 순서입니다. 수업에서는 PUBLIC과 PRIVATE를 사용했지만 영역이 두 종류뿐인 것은 아닙니다. CLASS-METHODS는 Static Method, METHODS는 Instance Method 선언입니다.'),
      code('Local Class의 Static Method', `REPORT zabap_f##_##.
CLASS lcl_calculator DEFINITION.
  PUBLIC SECTION.
    CLASS-METHODS double
      IMPORTING iv_number TYPE i
      RETURNING VALUE(rv_result) TYPE i.
  PRIVATE SECTION.
    CONSTANTS c_factor TYPE i VALUE 2.
ENDCLASS.

CLASS lcl_calculator IMPLEMENTATION.
  METHOD double.
    rv_result = iv_number * c_factor.
  ENDMETHOD.
ENDCLASS.

START-OF-SELECTION.
  DATA lv_result TYPE i.
  lv_result = lcl_calculator=>double( iv_number = 5 ).
  WRITE / lv_result.`), text('Class 외부에서는 공개된 double Method를 호출하고, PRIVATE 영역의 c_factor는 Class 내부에서 사용합니다. 호출 방식은 [[unit-04|Unit 4 · ABAP 모듈화 기법]]의 Subroutine·Function Module과 비교해 보세요.')),
    source('11/17 · 11/18', [
      ['`ZABAP_F##_11`', 'ABAP Call Class Method'],
      ['`ZABAP_F##_12`', 'ABAP Local Class'],
      ['`ZBC400_F##_GLOBAL_CLASS_1`', 'Global Class 실습 1'],
      ['`ZBC400_F##_GLOBAL_CLASS_2`', 'Global Class 실습 2']
    ]));

  raw['abap-types'].aliases.push('구조체', 'Structure', 'MOVE-CORRESPONDING');
  const typeSource = raw['abap-types'].sections.pop();
  raw['abap-types'].sections.push(
    section('Structure 선언과 컴포넌트', text('Structure는 서로 다른 타입의 컴포넌트를 하나로 묶습니다. ABAP Dictionary의 글로벌 구조를 참조하거나 Program 안에서 TYPES로 로컬 Structure Type을 정의할 수 있습니다.', 'ts_는 Structure Type, gs_는 Structure Variable에 붙인 학습용 명명 관례입니다. 필드에 접근할 때는 Structure Variable-컴포넌트 형식을 사용합니다. 구조 하나는 한 건의 데이터를, [[unit-05|Internal Table]]은 여러 행을 담습니다.'),
      code('Structure Type과 Structure Variable', `TYPES: BEGIN OF ts_carrier,
         carrid   TYPE scarr-carrid,
         carrname TYPE scarr-carrname,
       END OF ts_carrier.
DATA gs_carrier TYPE ts_carrier.
DATA lv_carrname TYPE ts_carrier-carrname.

gs_carrier-carrid = 'LH'.
gs_carrier-carrname = 'Lufthansa'.
lv_carrname = gs_carrier-carrname.
WRITE: / gs_carrier-carrid, gs_carrier-carrname, / lv_carrname.`), text('TYPE ts_carrier-carrname은 Structure Type의 컴포넌트 타입을 참조합니다. ABAP Dictionary의 구조·테이블 필드도 TYPE scarr-carrid, TYPE spfli-connid처럼 글로벌타입-필드명으로 참조할 수 있습니다. 기존 변수의 컴포넌트를 기준으로 선언할 때는 LIKE gs_carrier-carrname을 사용합니다.')),
    section('Structure 간 MOVE-CORRESPONDING', text('이름이 같은 컴포넌트끼리 값을 전달합니다. 이름이 다른 대상 컴포넌트는 그대로 남으며, 같은 이름이어도 타입이 다르면 변환 가능 여부를 확인해야 합니다.'),
      code('같은 이름의 필드만 복사', `TYPES: BEGIN OF ts_spfli,
         carrid   TYPE spfli-carrid,
         connid   TYPE spfli-connid,
         cityfrom TYPE spfli-cityfrom,
       END OF ts_spfli,
       BEGIN OF ts_flight,
         carrid   TYPE sflight-carrid,
         connid   TYPE sflight-connid,
         seatsocc TYPE sflight-seatsocc,
       END OF ts_flight.
DATA gs_spfli  TYPE ts_spfli.
DATA gs_flight TYPE ts_flight.
gs_spfli-carrid   = 'LH'.
gs_spfli-connid   = '0400'.
gs_spfli-cityfrom = 'FRANKFURT'.
gs_flight-seatsocc = 320.

MOVE-CORRESPONDING gs_spfli TO gs_flight.
WRITE: / gs_flight-carrid, gs_flight-connid, gs_flight-seatsocc.`)));
  typeSource.blocks[0].paragraphs[0] = typeSource.blocks[0].paragraphs[0].replace('11/12.', '11/12 · 11/18.');
  raw['abap-types'].sections.push(typeSource);

  put('abap-data-report', '데이터 처리와 Report', 'Structure를 행 타입으로 사용하는 Internal Table과 Classic ABAP Report의 Selection Screen·처리 순서를 정리합니다.', ['내부 테이블', 'Internal Table', 'STANDARD TABLE', 'SORTED TABLE', 'HASHED TABLE', 'Header Line', 'OCCURS', 'Classic ABAP Report', 'Selection Screen', 'SELECT-OPTIONS', 'INITIALIZATION', 'AT SELECTION-SCREEN', 'START-OF-SELECTION', 'cl_demo_output'], [
    section('Internal Table의 종류와 접근', text('14번 Program 필기: Internal Table은 Program 실행 중 여러 행을 메모리에 보관합니다. 데이터베이스 테이블에 저장하는 것과는 다릅니다. 아래는 기본 키와 기본 인덱스를 기준으로 한 비교입니다.'), table(['구분', 'STANDARD TABLE', 'SORTED TABLE', 'HASHED TABLE'], [
      ['분류', 'Index Table', 'Index Table', 'Hashed Table'],
      ['인덱스 접근', '가능', '가능', '기본 인덱스 없음'],
      ['키 접근', '가능', '가능', '가능'],
      ['기본 키 중복', 'NON-UNIQUE', 'UNIQUE / NON-UNIQUE', 'UNIQUE'],
      ['행 관리', '추가된 순서, SORT로 정렬 가능', '키 순서로 자동 정렬', '키의 해시로 관리']
    ]), text("INDEX 2는 두 번째 행에 접근한다는 뜻입니다. 열 번호가 아닙니다. 키 접근은 carrid = 'LH'처럼 필드 값으로 행을 찾습니다. 보조 키는 이후 학습 범위로 남겨 둡니다.")),
    section('Internal Table 타입과 변수 선언', text('먼저 [[abap-types|Structure]]로 행 타입을 만들고 TYPES로 재사용할 테이블 타입을 정의합니다. DATA에서 테이블 종류와 행 타입을 바로 지정할 수도 있습니다.'),
      {
        type: 'callout', style: 'point', title: '선언 방법별 비교',
        body: '**타입을 기준으로 하면 TYPE**, **이미 선언한 변수를 기준으로 하면 LIKE**를 사용합니다. **TABLE OF**는 여러 행을 담을 테이블을 만들고, **LINE OF**는 테이블의 행 타입으로 Work area를 만듭니다.'
      },
      text('**먼저 준비할 Local Type**', '아래 표는 `bc400_t_flights`·`bc400_s_flight`와 S_* Data Element가 있는 수업 실습 시스템을 기준으로 합니다. Local Type `ts_flight`와 `tt_flights`는 먼저 아래처럼 정의합니다.'),
      code('비교 예제의 Local Type 선언', `*로컬 스트럭쳐 선언
TYPES: BEGIN OF ts_flight,
         carrid     TYPE s_carr_id,
         connid     TYPE s_conn_id,
         fldate     TYPE s_date,
         seatsmax   TYPE s_seatsmax,
         seatsocc   TYPE s_seatsocc,
         percentage TYPE p LENGTH 3 DECIMALS 2,
       END OF ts_flight.

*structure를 이용한 로컬 table type 선언
TYPES tt_flights TYPE TABLE OF bc400_s_flight
                 WITH NON-UNIQUE KEY carrid connid fldate.`),
      text('**1. Internal table 선언 · 4가지**', '표의 **글로벌 / 로컬은 참조하는 타입의 구분**입니다. 글로벌은 ABAP Dictionary에 정의된 타입, 로컬은 이 Program에서 TYPES로 정의한 타입입니다. 아래 네 경우 모두 Internal table 변수를 만듭니다.'),
      table(['기준', '글로벌', '로컬'], [
        ['<span data-no-autolink>table type<br><strong>TYPE</strong></span>', '`DATA gt_flights TYPE bc400_t_flights.`', '`DATA lt_flights1 TYPE tt_flights.`'],
        ['<span data-no-autolink>structure<br><strong>TYPE TABLE OF</strong></span>', '<code>DATA lt_flights2 TYPE <mark class="declaration-modifier">TABLE OF</mark> bc400_s_flight.</code>', '<code>DATA lt_flights3 TYPE <mark class="declaration-modifier">TABLE OF</mark> ts_flight.</code>']
      ]),
      text('**2. Work area 선언 · 타입 기준 4가지**', 'table type에서는 **TYPE LINE OF**로 행 타입을 참조하고, structure는 **TYPE**으로 바로 참조합니다. 아래 네 경우 모두 Work area 변수를 만듭니다.'),
      table(['기준', '글로벌', '로컬'], [
        ['<span data-no-autolink>table type<br><strong>TYPE LINE OF</strong></span>', '<code>DATA gs_itab3 TYPE <mark class="declaration-modifier">LINE OF</mark> bc400_t_flights.</code>', '<code>DATA gs_itab4 TYPE <mark class="declaration-modifier">LINE OF</mark> tt_flights.</code>'],
        ['<span data-no-autolink>structure<br><strong>TYPE</strong></span>', '`DATA gs_itab1 TYPE bc400_s_flight.`', '`DATA gs_itab2 TYPE ts_flight.`']
      ]),
      text('**3. 변수를 기준으로 선언 · 2가지**', '위에서 만든 변수를 기준으로 할 때는 **LIKE**를 사용합니다. Internal table → Work area는 **LIKE LINE OF**, Work area → Internal table은 **LIKE TABLE OF**입니다.'),
      table(['기준이 되는 변수', '선언 코드', '결과'], [
        ['<span data-no-autolink>Internal table<br><code>gt_flights</code></span>', '<code>DATA gs_itab5 LIKE <mark class="declaration-modifier">LINE OF</mark> gt_flights.</code>', '`gs_itab5`<br>Work area'],
        ['<span data-no-autolink>Work area<br><code>gs_itab1</code></span>', '<code>DATA lt_flights4 LIKE <mark class="declaration-modifier">TABLE OF</mark> gs_itab1.</code>', '`lt_flights4`<br>Internal table']
      ]),
      text('위 선언들은 타입을 참조해 새 변수를 만듭니다. **기존 변수의 값이나 테이블의 행을 복사하는 문장이 아닙니다.** Internal table은 비어 있고 Work area는 초기값으로 만들어집니다.'),
      code('행 타입과 세 가지 테이블 선언', `TYPES: BEGIN OF ts_spfli,
         carrid   TYPE spfli-carrid,
         connid   TYPE spfli-connid,
         cityfrom TYPE spfli-cityfrom,
         fltime   TYPE spfli-fltime,
       END OF ts_spfli.
TYPES tt_spfli TYPE STANDARD TABLE OF ts_spfli
               WITH NON-UNIQUE KEY carrid connid.
DATA gt_spfli  TYPE tt_spfli.
DATA gs_spfli  TYPE ts_spfli.
DATA gt_sorted TYPE SORTED TABLE OF ts_spfli
               WITH UNIQUE KEY carrid connid.
DATA gt_hashed TYPE HASHED TABLE OF ts_spfli
               WITH UNIQUE KEY carrid connid.`),
      text('STANDARD TABLE은 TABLE로 줄여 쓸 수 있습니다. 구조 행 타입에 기본 키(DEFAULT KEY)를 쓰면 문자형·바이트형 컴포넌트가 키에 포함됩니다. NUMC도 숫자 계산 타입이 아닌 문자형입니다. 예제처럼 필요한 키를 명시하면 의도를 쉽게 파악할 수 있습니다.')),
    section('행 추가·조회·수정·삭제', table(['문장', '역할'], [
      ['APPEND ... TO', 'Standard Table의 끝에 행 추가'],
      ['INSERT ... INTO TABLE', '테이블 종류와 키 규칙에 따라 행 추가'],
      ['READ TABLE ... INTO', '조건에 맞는 행을 Work Area에 복사'],
      ['MODIFY TABLE ... FROM', '기본 키로 찾은 행 수정'],
      ['DELETE TABLE ... WITH TABLE KEY', '기본 키로 찾은 행 삭제']
    ]), text('INSERT INTO TABLE을 항상 특정 위치에 넣는 명령이라고 생각하지 마세요. Index Table에서 위치를 지정하는 형식은 INSERT ... INTO ... INDEX n입니다. Sorted Table은 정렬 순서를 지켜야 합니다. READ TABLE 후에는 [[abap-loops|sy-subrc]]를 확인합니다.'),
      code('Internal Table 조작 전체 예제', `REPORT zabap_f##_##.
TYPES: BEGIN OF ts_spfli,
         carrid   TYPE spfli-carrid,
         connid   TYPE spfli-connid,
         cityfrom TYPE spfli-cityfrom,
         fltime   TYPE spfli-fltime,
       END OF ts_spfli.
DATA gt_spfli TYPE STANDARD TABLE OF ts_spfli
              WITH NON-UNIQUE KEY carrid connid.
DATA gs_spfli TYPE ts_spfli.

gs_spfli-carrid   = 'LH'.
gs_spfli-connid   = '0400'.
gs_spfli-cityfrom = 'FRANKFURT'.
gs_spfli-fltime   = 545.
APPEND gs_spfli TO gt_spfli.

gs_spfli-carrid   = 'AA'.
gs_spfli-connid   = '0017'.
gs_spfli-cityfrom = 'NEW YORK'.
gs_spfli-fltime   = 361.
INSERT gs_spfli INTO TABLE gt_spfli.

READ TABLE gt_spfli INTO gs_spfli WITH KEY carrid = 'LH' connid = '0400'.
IF sy-subrc = 0.
  gs_spfli-fltime = 560.
  MODIFY TABLE gt_spfli FROM gs_spfli.
ENDIF.

DELETE TABLE gt_spfli WITH TABLE KEY carrid = 'AA' connid = '0017'.
LOOP AT gt_spfli INTO gs_spfli.
  WRITE: / gs_spfli-carrid, gs_spfli-connid, gs_spfli-cityfrom, gs_spfli-fltime.
ENDLOOP.`), text('이 예제의 기본 키는 carrid와 connid입니다. 키가 중복되면 MODIFY TABLE은 일치하는 첫 행을 바꿉니다. 여러 행을 조건으로 지울 때는 DELETE gt_spfli WHERE fltime < 300.처럼 WHERE를 사용합니다.')),
    section('Internal Table 정렬', text('Standard Table에서 SORT로 행 순서를 바꿉니다. BY 뒤에는 정렬할 필드가 필요하며, SORT gt_spfli BY.처럼 비워 두면 안 됩니다. Sorted Table은 선언된 키 순서를 자동으로 유지합니다.'),
      code('비행시간 내림차순·항공사 오름차순', `SORT gt_spfli BY fltime DESCENDING
                 carrid ASCENDING.`), text('비행시간(fltime)이 긴 행이 먼저 오고, 비행시간이 같으면 항공사 코드(carrid) 오름차순으로 정렬됩니다. SORT gt_spfli.는 기본 키 기준 정렬이므로 여기서는 carrid와 connid를 기준으로 정렬합니다.')),
    section('CLEAR·REFRESH·FREE', table(['문장', '의미'], [
      ['CLEAR gs_spfli-fltime.', 'Structure의 한 필드를 초기값으로 변경'],
      ['CLEAR gs_spfli.', 'Structure 전체 필드를 초기값으로 변경'],
      ['CLEAR gt_spfli.', 'Header Line이 없는 Internal Table의 행을 모두 비움'],
      ['REFRESH gt_spfli.', '테이블 본문을 비우는 기존 문법'],
      ['FREE gt_spfli.', '행을 비우고 테이블 본문에 할당된 메모리도 해제']
    ]), text('CLEAR는 변수 선언 자체를 삭제하지 않습니다. 초기화한 Structure와 테이블은 다시 사용할 수 있습니다. 새 코드에서 Header Line 없는 테이블을 비울 때는 CLEAR를 사용할 수 있습니다.')),
    section('Header Line과 OCCURS — 기존 코드 읽기', text('15번 Program 필기: WITH HEADER LINE을 사용한 옛 문법에서는 테이블과 같은 이름의 Work Area가 함께 생깁니다. 문장에 따라 같은 이름이 Work Area 또는 본문을 가리켜 혼동하기 쉽습니다. 새 코드에서는 gs_ Work Area와 gt_ 테이블을 분리하세요.'),
      code('Header Line과 테이블 본문 구분', `REPORT zabap_f##_##.
DATA gt_scarr TYPE STANDARD TABLE OF scarr WITH HEADER LINE.
DATA gv_lines TYPE i.

gt_scarr-carrid   = 'LH'.       " Header Line에 값 대입
gt_scarr-carrname = 'Lufthansa'.
APPEND gt_scarr.                " Header Line을 본문에 추가
CLEAR gt_scarr.                 " Header Line만 초기화, 본문 1행 유지
DESCRIBE TABLE gt_scarr[] LINES gv_lines.
WRITE / gv_lines.
CLEAR gt_scarr[].               " 테이블 본문 초기화
DESCRIBE TABLE gt_scarr[] LINES gv_lines.
WRITE / gv_lines.`),
      text('OCCURS n은 과거 Internal Table 선언에서 초기 메모리 할당 규모를 지정하던 문법입니다. 최대 n건까지만 저장한다는 의미가 아니며 필요하면 테이블은 늘어납니다. 단순 Structure Type 선언에 저장 건수 제한으로 붙이지 않습니다. Header Line과 OCCURS는 기존 Standard ABAP 코드를 읽기 위한 내용입니다.')),
    section('Classic ABAP Report와 Selection Screen', text(
      'Classic ABAP Report는 실행 시 사용자 입력을 받는 Selection Screen을 제공합니다. 입력 방식은 단일 값을 받는 Single Value(PARAMETERS)와 범위·복수 조건을 받는 Selection Condition(SELECT-OPTIONS)으로 구분합니다.'),
      table(['구분', '문장 예', 'Selection Screen 동작과 WHERE 절 사용'], [
        ['Single Value', 'PARAMETERS p_carr TYPE spfli-carrid.', '값 하나만 입력받습니다. Selection Screen에서 부등호·범위 조건을 직접 고를 수 없고, WHERE 절에서 단일 값 비교(= 등)로 사용합니다.'],
        ['Selection Condition', 'SELECT-OPTIONS so_carr FOR gv_carrid.', '입력 칸 두 개(~부터·~까지)와 다중 선택 버튼, 비교 옵션(부호)을 제공합니다. WHERE 절 내에서 IN으로 사용합니다.']
      ]),
      text('SELECT-OPTIONS so_carr FOR ...로 선언하면 so_carr는 Header Line과 Internal Table(Selection Table)을 함께 선언합니다. 내부적으로는 아래 4개 컬럼으로 구성됩니다.'),
      table(['Sign', 'Option', 'Low', 'High'], [
        ['I (포함) 또는 E (제외)', '부등호 · 비교 연산자 (EQ, NE, BT, CP, GT 등)', '~부터 (단일 값 또는 하한)', '~까지 (상한 값)']
      ]),
      text('FOR 뒤에는 타입 이름이 아니라 이미 선언된 데이터 객체(변수 또는 TABLES 선언 필드)를 지정합니다. 화면 입력을 비워 두면 WHERE ... IN so_carr 조건은 제한 없이 전체 데이터를 통과시킵니다.', 'Selection Screen에 변수명 대신 의미 있는 라벨(예: Airline, Flight Date)을 표시하려면 SE38 메뉴 `Goto → Text Elements → Selection Texts`에서 라벨을 입력하거나 `DDIC Ref.`를 체크한 뒤 활성화하세요. 또한 `SELECT-OPTIONS`를 `PERFORM` Subroutine으로 전달할 때는 헤더(`so_carr`)가 아니라 바디(`so_carr[]`)를 넘겨야 합니다([[basic-session-review|Basic Session Review]] 참고).'),
      code('SELECT-OPTIONS와 cl_demo_output 출력', `REPORT zabap_f##_##.

TYPES: BEGIN OF ts_conn,
         carrid   TYPE spfli-carrid,
         connid   TYPE spfli-connid,
         cityfrom TYPE spfli-cityfrom,
         cityto   TYPE spfli-cityto,
       END OF ts_conn.

DATA gv_carrid      TYPE spfli-carrid.
DATA gt_connections TYPE STANDARD TABLE OF ts_conn.

SELECT-OPTIONS so_carr FOR gv_carrid.

START-OF-SELECTION.
  SELECT carrid connid cityfrom cityto
    FROM spfli
    INTO TABLE gt_connections
    WHERE carrid IN so_carr.

  cl_demo_output=>display( gt_connections ).`),
      text('cl_demo_output=>display( gt_connections ).은 학습·테스트용으로 Internal Table을 빠르게 화면에 출력하는 Static Method입니다. 실무 조회 화면용 ALV와는 구분해서 사용하세요.')),
    section('Report 처리 순서', text('Classic ABAP Report는 REPORT 선언 이후 PARAMETERS·SELECT-OPTIONS·DATA 선언을 거쳐 아래 이벤트 순서대로 처리됩니다.'),
      table(['단계', '역할'], [
        ['1. 선언부 (REPORT · PARAMETERS · SELECT-OPTIONS · DATA)', 'Program 헤더, Selection Screen 입력 항목, 데이터 변수 선언'],
        ['2. INITIALIZATION', 'Selection Screen 표시 전 초기값 설정'],
        ['3. DISPLAY SELECTION SCREEN', 'Selection Screen 화면 표시 및 사용자 입력 대기'],
        ['4. AT SELECTION-SCREEN', 'Selection Screen 권한 체크 및 입력값 검증 등 체크 로직'],
        ['5. START-OF-SELECTION', '메인 처리 로직(이벤트를 생략한 실행 코드의 기본 위치). WRITE 출력은 List Buffer로 이동'],
        ['6. Display List Buffer as List', 'List Buffer에 모인 결과를 리스트 화면으로 표시']
      ]),
      code('Classic ABAP Report 이벤트 흐름', `REPORT zabap_f##_##.

TYPES: BEGIN OF ts_conn,
         carrid   TYPE spfli-carrid,
         connid   TYPE spfli-connid,
         cityfrom TYPE spfli-cityfrom,
         cityto   TYPE spfli-cityto,
       END OF ts_conn.

DATA gv_carrid      TYPE spfli-carrid.
DATA gt_connections TYPE STANDARD TABLE OF ts_conn.

SELECT-OPTIONS so_carr FOR gv_carrid.

INITIALIZATION.
  so_carr-sign   = 'I'.
  so_carr-option = 'EQ'.
  so_carr-low    = 'LH'.
  APPEND so_carr.

AT SELECTION-SCREEN.
  IF so_carr[] IS INITIAL.
    MESSAGE '항공사 조건을 입력해 주세요.' TYPE 'E'.
  ENDIF.

START-OF-SELECTION.
  SELECT carrid connid cityfrom cityto
    FROM spfli
    INTO TABLE gt_connections
    WHERE carrid IN so_carr.
  cl_demo_output=>display( gt_connections ).`),
      text('so_carr는 Header Line과 Internal Table 본문을 함께 가지므로 INITIALIZATION에서는 Header Line(so_carr-sign 등)에 값을 채운 뒤 APPEND so_carr.로 본문에 넣고, AT SELECTION-SCREEN에서는 본문이 비었는지 so_carr[] IS INITIAL로 검사합니다.')),
    section('리스트 아이콘과 컬럼 서식 참고', text(
      '클래식 리스트 출력에 사용하는 SAP 아이콘 목록과 코드는 ICON 테이블(SE11 · SE16 조회)에서 확인할 수 있습니다.',
      '아이콘 출력과 컬럼 서식(색상·강조·정렬 등)을 적용한 Classic Report 구현 예시는 표준 데모/해답 Program인 BC400_RPS_REP_A에서 확인할 수 있습니다(SE38 · SE80 조회). 현재 실습 시스템 버전은 ABAP 7.5 기준입니다.')),
    section('이후 학습', text('DB에서 데이터를 읽고 변경하는 문법은 [[abap-open-sql|Open SQL]]에서, 전역 타입과 테이블 정의는 [[abap-dictionary|ABAP Dictionary]]에서 이어집니다. 이 문서는 11월 18일 Internal Table과 11월 20·23일 Classic ABAP Report 필기를 정리한 범위이며, ALV 화면 구성은 준비 중입니다.'))
  ], '11/18 · 11/20 · 11/23', [
    ['`ZABAP_F##_14`', 'ABAP Internal Table'],
    ['`ZABAP_F##_15`', 'ABAP Header Line'],
    ['`ZABAP_F##_16`', 'ABAP Internal table & Work area'],
    ['`ZABAP_F##_17`', 'ABAP Select-Options'],
    ['`ZBC400_F##_REP_A`', 'Report with Select-Options & Classic List (A)'],
    ['`ZBC400_F##_REP_B`', 'Template: Report with Select Options and Classic List (B)'],
    ['`ZBC430S_ITAB_SORTED`', 'Program SAPBC430S_ITAB_SORTED']
  ]);

  put('abap-open-sql', 'Open SQL', 'DB 테이블 조회부터 조건·집계·JOIN과 데이터 변경까지 정리합니다.',
    ['ABAP SQL', 'SELECT SINGLE', 'CORRESPONDING FIELDS', 'APPENDING TABLE', 'GROUP BY', 'HAVING', 'FOR ALL ENTRIES', 'OUTER JOIN'], [
    section('Open SQL과 Transparent Table', text(
      '11월 19일 필기의 SELECT·집계·조건·MODIFY 내용을 중심으로, JOIN·서브쿼리·트랜잭션 등 연결되는 내용을 보완했습니다. Open SQL은 현재 문서에서 ABAP SQL이라고도 부릅니다. ABAP Program의 DB 인터페이스를 통해 데이터베이스를 조회하고 변경합니다.',
      '예제는 수업 기준인 구문법(Classic Open SQL)으로 작성했습니다. 컬럼을 공백으로 구분하고, ABAP 변수 앞에 @를 붙이지 않으며, INTO 절을 FROM 뒤·WHERE 앞에 두고 TYPES/DATA로 변수를 먼저 선언합니다. SCARR·SPFLI·SFLIGHT는 교육용 항공 데이터가 설치된 환경을 전제로 하며, 현재 클라이언트에 데이터가 없으면 조회 결과가 비어 있을 수 있습니다.'),
      table(['구분', '의미', '예'], [
        ['Transparent Table', 'DDIC에서 정의하며 DB에 실제 행을 저장하는 테이블', 'SCARR'],
        ['행의 Structure Type', 'DB 테이블 이름을 TYPE 뒤에 쓰면 한 행의 구조로 사용', 'DATA gs_carrier TYPE scarr.'],
        ['Internal Table', 'Program 메모리에 여러 행을 보관하는 변수', 'DATA gt_carriers TYPE STANDARD TABLE OF scarr.']
      ]), text('Transparent Table 자체가 단순 Structure라는 뜻은 아닙니다. DB 테이블의 행 구조를 ABAP 변수의 타입으로 활용하는 것입니다. SELECT의 FROM은 DB 데이터 소스, INTO는 결과를 받을 ABAP 변수를 지정합니다.')),
    section('SELECT 기본 구조와 호스트 변수', text(
      'SELECT는 열, FROM은 데이터 소스, INTO는 결과 저장 위치, WHERE는 행 조건입니다. 수업 기준 구문법(Classic Open SQL)에서는 SELECT 컬럼을 공백으로 구분하고, INTO 절을 FROM 뒤·WHERE 앞에 배치하며 ABAP 변수 앞에 @를 붙이지 않습니다. WHERE carrid = p_carr의 carrid는 DB 열이고 p_carr는 Program 변수입니다. 여기서 =는 대입이 아닌 비교입니다.',
      '결과를 받을 Structure나 Internal Table은 SELECT 전에 TYPES와 DATA로 미리 선언해 둡니다. 한 열은 단일 변수로, 여러 열은 Structure로, 여러 행은 Internal Table로 받을 수 있습니다.'),
      code('Open SQL 기본 조회', `REPORT zabap_f##_##.

PARAMETERS p_carr TYPE scarr-carrid DEFAULT 'LH'.

TYPES: BEGIN OF ts_carrier,
         carrid   TYPE scarr-carrid,
         carrname TYPE scarr-carrname,
         currcode TYPE scarr-currcode,
       END OF ts_carrier.

DATA: gt_carriers TYPE STANDARD TABLE OF ts_carrier,
      gs_carrier  TYPE ts_carrier.

START-OF-SELECTION.
  SELECT carrid carrname currcode
    FROM scarr
    INTO TABLE gt_carriers
    WHERE carrid = p_carr.

  IF sy-subrc = 0.
    LOOP AT gt_carriers INTO gs_carrier.
      WRITE: / gs_carrier-carrid,
               gs_carrier-carrname, gs_carrier-currcode.
    ENDLOOP.
  ELSE.
    WRITE / '조회 결과가 없습니다.'.
  ENDIF.`), text('sy-subrc는 후속 문장으로 바뀔 수 있으므로 조회 직후 확인합니다. 클라이언트 종속 테이블은 일반 Open SQL에서 현재 클라이언트로 자동 제한됩니다. 이것이 업무 권한 검사까지 대신하는 것은 아닙니다.')),
    section('한 행 조회와 정렬된 첫 행', table(['목적', '문법', '주의'], [
      ['키로 한 행 조회', 'SELECT SINGLE ... FROM ... INTO ... WHERE ...', '키를 모두 지정하지 않으면 여러 후보 중 어느 행인지 보장되지 않음'],
      ['정렬 기준에 따른 첫 행', 'INTO TABLE ... UP TO 1 ROWS ... ORDER BY ...', '동점까지 구분하도록 정렬 열 지정'],
      ['여러 행 제한', 'INTO TABLE ... UP TO n ROWS ... ORDER BY ...', 'ORDER BY가 없으면 반환 순서 보장 안 됨']
    ]), code('항공사 이름과 가장 빠른 운항일', `REPORT zabap_f##_##.

PARAMETERS p_carr TYPE scarr-carrid DEFAULT 'LH'.

TYPES: BEGIN OF ts_first,
         carrid TYPE sflight-carrid,
         connid TYPE sflight-connid,
         fldate TYPE sflight-fldate,
       END OF ts_first.

DATA: gv_name  TYPE scarr-carrname,
      gt_first TYPE STANDARD TABLE OF ts_first,
      gs_first TYPE ts_first.

START-OF-SELECTION.
  CLEAR gv_name.
  SELECT SINGLE carrname
    FROM scarr
    INTO gv_name
    WHERE carrid = p_carr.
  IF sy-subrc = 0.
    WRITE / gv_name.
  ENDIF.

  SELECT carrid connid fldate
    FROM sflight
    INTO TABLE gt_first
    UP TO 1 ROWS
    WHERE carrid = p_carr
    ORDER BY fldate ASCENDING connid ASCENDING.
  LOOP AT gt_first INTO gs_first.
    WRITE: / gs_first-carrid, gs_first-connid, gs_first-fldate.
  ENDLOOP.`), text('SINGLE은 최대 한 행이며 결과가 없으면 0행입니다. 기존 변수에 INTO 했을 때 조회 실패로 이전 값이 남을 수 있으므로 조회 전 CLEAR 하고 반환 코드를 확인하세요.')),
    section('Work Area·Internal Table·CORRESPONDING', text(
      '일반 다중 행 SELECT를 Work Area로 받으면 SELECT ... ENDSELECT에서 한 행씩 처리합니다. INTO TABLE은 결과를 Internal Table에 모으므로 일반적으로 ENDSELECT가 없습니다. PACKAGE SIZE를 쓰는 단위(패킷) 처리에는 별도 반복 규칙이 적용됩니다.',
      '명시한 열들을 CORRESPONDING 없이 Structure로 받으면 열 순서와 대상 컴포넌트의 타입이 맞아야 합니다. CORRESPONDING FIELDS OF는 결과 열의 이름(AS 별칭 포함)과 대상 컴포넌트 이름을 연결합니다. OF 뒤는 필드명이 아니라 대상 Work Area 또는 Internal Table입니다.'),
      code('이름 기준으로 Work Area와 테이블에 받기', `REPORT zabap_f##_##.

TYPES: BEGIN OF ts_carrier,
         carrname TYPE scarr-carrname,
         carrid   TYPE scarr-carrid,
       END OF ts_carrier.

DATA: gs_carrier  TYPE ts_carrier,
      gt_carriers TYPE STANDARD TABLE OF ts_carrier,
      gv_lines    TYPE i.

START-OF-SELECTION.
  SELECT carrid carrname
    FROM scarr
    INTO CORRESPONDING FIELDS OF gs_carrier
    WHERE carrid = 'LH'.
    WRITE: / gs_carrier-carrid, gs_carrier-carrname.
  ENDSELECT.

  SELECT carrid carrname
    FROM scarr
    INTO CORRESPONDING FIELDS OF TABLE gt_carriers
    WHERE carrid = 'LH'.
  DESCRIBE TABLE gt_carriers LINES gv_lines.
  WRITE: / '테이블 행 수:', gv_lines.`), text('Work Area에서 매칭되지 않은 필드는 이전 값이 남을 수 있습니다. 재사용할 때 필요한 초기화를 하세요. 여러 행을 보관하려는 목적이라면 SELECT 루프에서 APPEND를 반복하기보다 INTO TABLE이 간결합니다. 대량 조회는 메모리 크기도 고려합니다.')),
    section('INTO TABLE과 APPENDING TABLE', text(
      '일반 SELECT ... INTO TABLE은 대상 Internal Table의 기존 행을 비운 뒤 조회 결과로 채웁니다. APPENDING TABLE은 기존 행을 유지하고 조회한 행을 추가합니다. 변수를 두 번 정의해서 덮어쓰는 현상과는 다릅니다.',
      'APPENDING이 중복을 자동 제거하지는 않습니다. 아래 Standard Table에는 같은 행이 두 번 들어갈 수 있고, UNIQUE 키를 가진 대상은 키 충돌도 고려해야 합니다.'),
      code('조회 결과를 이어 담기', `REPORT zabap_f##_##.

DATA: gt_carriers TYPE STANDARD TABLE OF scarr,
      gv_lines    TYPE i.

START-OF-SELECTION.
  SELECT *
    FROM scarr
    INTO TABLE gt_carriers
    WHERE carrid = 'LH'.
  SELECT *
    FROM scarr
    APPENDING TABLE gt_carriers
    WHERE carrid = 'AA'.
  DESCRIBE TABLE gt_carriers LINES gv_lines.
  WRITE: / '합친 행 수:', gv_lines.

  SELECT *
    FROM scarr
    INTO TABLE gt_carriers
    WHERE carrid = 'LH'.
  DESCRIBE TABLE gt_carriers LINES gv_lines.
  WRITE: / '다시 채운 행 수:', gv_lines.`), text('이 예제의 *는 행 전체와 SCARR 타입을 비교하기 위한 것입니다. 실제 Program에서는 필요한 열을 명시하는 것을 우선하세요.')),
    section('WHERE 조건과 NULL', table(['조건', '의미 / 예'], [
      ['= / EQ · <> / NE', '같음 / 다름'],
      ['< / LT · > / GT · <= / LE · >= / GE', '크기 비교'],
      ['AND · OR · NOT', '논리 결합. NOT → AND → OR 순으로 결합하므로 괄호로 의도 표현'],
      ['BETWEEN ... AND ...', '양 끝을 포함한 범위'],
      ['IN (...) · IN s_carr', '값 목록 또는 선택 범위 테이블 (SELECT-OPTIONS / Range)'],
      ['LIKE', '%는 길이 0 이상 문자열, _는 한 문자. ABAP의 CP 패턴과 구분'],
      ['IS NULL · IS NOT NULL', 'DB의 NULL 여부. 공백이나 숫자 0 여부와 다름']
    ]), code('선택 범위와 문자열 조건', `REPORT zabap_f##_##.

TYPES: BEGIN OF ts_carrier,
         carrid   TYPE scarr-carrid,
         carrname TYPE scarr-carrname,
       END OF ts_carrier.

DATA: gv_carrid   TYPE scarr-carrid,
      gt_carriers TYPE STANDARD TABLE OF ts_carrier,
      gs_carrier  TYPE ts_carrier.

SELECT-OPTIONS s_carr FOR gv_carrid.

START-OF-SELECTION.
  SELECT carrid carrname
    FROM scarr
    INTO TABLE gt_carriers
    WHERE carrid IN s_carr
      AND ( carrname LIKE 'L%' OR carrname LIKE 'A%' )
    ORDER BY carrid.

  LOOP AT gt_carriers INTO gs_carrier.
    WRITE: / gs_carrier-carrid, gs_carrier-carrname.
  ENDLOOP.`), text('선택 범위는 SIGN·OPTION·LOW·HIGH로 포함/제외와 비교 방법을 표현합니다. 빈 선택 범위의 IN 조건은 제한을 걸지 않으므로 빈 입력이 곧 0건이라는 뜻은 아닙니다.',
      'NULL은 값이 없거나 미정임을 나타냅니다. = NULL로 비교하지 않습니다. OUTER JOIN에서 상대 행이 없을 때도 생깁니다. 보통 ABAP 변수로 전달되면 타입의 초기값으로 보이므로 SQL에서 IS NULL 조건으로 처리할지 먼저 결정하세요.')),
    section('DISTINCT·집계·GROUP BY·HAVING', text(
      'DISTINCT는 SELECT에 나열한 열 조합 전체가 같은 행을 제거합니다. 한 열의 중복 제거와 여러 열 조합의 중복 제거는 결과가 다릅니다. 필기의 disting는 DISTINCT로 정정합니다.'),
      table(['함수 / 절', '역할'], [
        ['MIN · MAX', '최솟값 / 최댓값'], ['SUM · AVG', '합계 / 평균. 결과 타입과 자리수 확인'],
        ['COUNT( * )', '행 수'], ['COUNT( DISTINCT 열 )', 'NULL을 제외한 서로 다른 값의 개수'],
        ['GROUP BY', '지정한 열 조합별로 묶기. 단순 열 조회에서 집계하지 않는 열은 그룹에도 지정'],
        ['WHERE / HAVING', '집계 전 원본 행 필터 / 집계 후 그룹 필터']
      ]), code('항공사별 좌석 집계', `REPORT zabap_f##_##.

TYPES: BEGIN OF ts_total,
         carrid         TYPE sflight-carrid,
         flight_count   TYPE i,
         min_occupied   TYPE sflight-seatsocc,
         max_occupied   TYPE sflight-seatsocc,
         total_occupied TYPE i,
         avg_occupied   TYPE f,
       END OF ts_total.

DATA: gt_totals TYPE STANDARD TABLE OF ts_total,
      gs_total  TYPE ts_total.

START-OF-SELECTION.
  SELECT carrid COUNT( * ) AS flight_count
         MIN( seatsocc ) AS min_occupied
         MAX( seatsocc ) AS max_occupied
         SUM( seatsocc ) AS total_occupied
         AVG( seatsocc ) AS avg_occupied
    FROM sflight
    INTO TABLE gt_totals
    WHERE seatsmax > 0
    GROUP BY carrid
    HAVING COUNT( * ) >= 2
    ORDER BY carrid.

  LOOP AT gt_totals INTO gs_total.
    WRITE: / gs_total-carrid, gs_total-flight_count,
             gs_total-min_occupied, gs_total-max_occupied,
             gs_total-total_occupied, gs_total-avg_occupied.
  ENDLOOP.`), text('예제는 좌석 수를 집계합니다. 금액을 합치거나 평균을 낼 때는 통화가 다른 값을 그대로 섞지 말고 통화별 그룹이나 환산 기준을 정해야 합니다.')),
    section('조회 결과가 없을 때와 시스템 필드', table(['조회 형태', '데이터가 없을 때'], [
      ['일반 SELECT', 'sy-subrc = 4, sy-dbcnt = 0'],
      ['GROUP BY 없는 집계만의 SELECT', '일반적으로 집계 결과 한 행. COUNT는 0, 나머지는 대상 타입 초기값. sy-subrc = 0, sy-dbcnt = 1'],
      ['GROUP BY가 있는 집계', '그룹 자체가 없으면 결과 0행'],
      ['별칭 없는 COUNT( * )만 단독 조회, GROUP BY 없음', '예외: sy-dbcnt가 집계한 원본 행 수. 0건이면 sy-subrc = 4, sy-dbcnt = 0']
    ]), text('따라서 집계 후 sy-dbcnt가 1이라고 해서 원본 데이터가 한 건 있었다고 판단하면 안 됩니다. COUNT 단독 예외는 INTO를 생략할 수 있는 기존 형식과 연결됩니다. 개수를 명시적인 변수에 받아 판단하는 편이 읽기 쉽습니다.'),
      code('집계 결과와 실제 원본 건수 비교', `REPORT zabap_f##_##.

TYPES: BEGIN OF ts_summary,
         matched      TYPE i,
         max_occupied TYPE sflight-seatsocc,
       END OF ts_summary.

DATA: gs_summary TYPE ts_summary,
      gv_subrc   TYPE sy-subrc,
      gv_dbcnt   TYPE sy-dbcnt.

START-OF-SELECTION.
  SELECT COUNT( * ) AS matched
         MAX( seatsocc ) AS max_occupied
    FROM sflight
    INTO gs_summary
    WHERE carrid = 'LH' AND carrid = 'AA'.

  gv_subrc = sy-subrc.
  gv_dbcnt = sy-dbcnt.
  WRITE: / gs_summary-matched, gs_summary-max_occupied,
           gv_subrc, gv_dbcnt.`), text('같은 carrid가 LH와 AA일 수 없으므로 원본은 0건입니다. 별칭 있는 COUNT와 MAX를 함께 쓴 결과는 0, 0, 0, 1입니다. COUNT 결과 0으로 데이터 부재를 판별합니다.')),
    section('JOIN과 ON·WHERE의 차이', table(['종류', '결과'], [
      ['INNER JOIN', 'ON 조건에 서로 맞는 행만'],
      ['LEFT OUTER JOIN', '왼쪽 행을 유지하고 오른쪽이 없으면 해당 열은 NULL'],
      ['RIGHT OUTER JOIN', '오른쪽 행을 유지. 일부 구버전·구문법 환경에서는 제한되므로 테이블 순서를 바꾼 LEFT OUTER JOIN으로 표현하는 경우가 많음'],
      ['CROSS JOIN', '양쪽의 모든 조합. 결과가 급격히 커질 수 있음']
    ]), text('수업 필기의 “Right Outer Join 사용 불가”처럼 구문법 환경에서는 RIGHT OUTER JOIN이 제한될 수 있으므로, 같은 의미를 테이블 순서를 바꾼 LEFT OUTER JOIN으로 표현하는 편이 안전합니다.',
      'AS는 별칭, 별칭~열은 소속 테이블을 명시합니다. ON은 행을 연결하는 조건이고 WHERE는 연결된 결과를 걸러냅니다. LEFT JOIN 오른쪽 열에 대한 WHERE 조건은 NULL 행을 제외해 왼쪽 보존 효과를 잃게 할 수 있습니다.'),
      code('항공사와 독일 출발 노선 연결', `REPORT zabap_f##_##.

TYPES: BEGIN OF ts_route,
         carrid   TYPE scarr-carrid,
         carrname TYPE scarr-carrname,
         connid   TYPE spfli-connid,
         cityfrom TYPE spfli-cityfrom,
         cityto   TYPE spfli-cityto,
       END OF ts_route.

DATA: gt_routes TYPE STANDARD TABLE OF ts_route,
      gs_route  TYPE ts_route.

START-OF-SELECTION.
  SELECT a~carrid a~carrname b~connid b~cityfrom b~cityto
    FROM scarr AS a
    LEFT OUTER JOIN spfli AS b
      ON a~carrid = b~carrid AND b~countryfr = 'DE'
    INTO TABLE gt_routes
    ORDER BY a~carrid b~connid.

  LOOP AT gt_routes INTO gs_route.
    WRITE: / gs_route-carrid, gs_route-carrname,
             gs_route-connid, gs_route-cityfrom, gs_route-cityto.
  ENDLOOP.`), text('독일 출발 노선이 없는 항공사도 남습니다. countryfr 조건을 WHERE b~countryfr = ...로 옮기면 그 행들이 제외됩니다. 한 항공사에 여러 노선이 있으면 항공사 정보가 여러 행에 반복되는 것은 정상입니다.')),
    section('보완: 서브쿼리와 FOR ALL ENTRIES', text(
      'EXISTS는 하위 조회에 맞는 행이 하나라도 있는지 검사합니다. IN ( SELECT ... )는 하위 조회의 값 집합과 비교합니다. JOIN처럼 상대쪽 열을 함께 표시할 필요 없이 존재 여부로 걸러낼 때 유용합니다.'),
      code('노선이 있는 항공사만 조회', `REPORT zabap_f##_##.

TYPES: BEGIN OF ts_carrier,
         carrid   TYPE scarr-carrid,
         carrname TYPE scarr-carrname,
       END OF ts_carrier.

DATA: gt_carriers TYPE STANDARD TABLE OF ts_carrier,
      gs_carrier  TYPE ts_carrier.

START-OF-SELECTION.
  SELECT a~carrid a~carrname
    FROM scarr AS a
    INTO TABLE gt_carriers
    WHERE EXISTS ( SELECT * FROM spfli AS b
                     WHERE b~carrid = a~carrid )
    ORDER BY a~carrid.

  LOOP AT gt_carriers INTO gs_carrier.
    WRITE: / gs_carrier-carrid, gs_carrier-carrname.
  ENDLOOP.`), text('FOR ALL ENTRIES는 이미 가진 Internal Table의 각 행을 조건으로 조회하고 결과의 중복 행을 제거합니다. 기준 테이블이 비어 있으면 WHERE 전체가 무시될 수 있으므로 반드시 비어 있지 않은지 먼저 검사합니다.'),
      code('빈 기준 테이블을 막는 FOR ALL ENTRIES', `REPORT zabap_f##_##.

TYPES: BEGIN OF ts_key,
         carrid TYPE spfli-carrid,
         connid TYPE spfli-connid,
       END OF ts_key.

TYPES: BEGIN OF ts_flight,
         carrid TYPE sflight-carrid,
         connid TYPE sflight-connid,
         fldate TYPE sflight-fldate,
       END OF ts_flight.

DATA: gt_keys    TYPE STANDARD TABLE OF ts_key,
      gt_flights TYPE STANDARD TABLE OF ts_flight,
      gv_lines   TYPE i.

START-OF-SELECTION.
  SELECT carrid connid
    FROM spfli
    INTO TABLE gt_keys
    WHERE countryfr = 'DE'.

  IF gt_keys IS NOT INITIAL.
    SELECT carrid connid fldate
      FROM sflight
      INTO TABLE gt_flights
      FOR ALL ENTRIES IN gt_keys
      WHERE carrid = gt_keys-carrid
        AND connid = gt_keys-connid.
    DESCRIBE TABLE gt_flights LINES gv_lines.
    WRITE: / '조회 건수:', gv_lines.
  ELSE.
    WRITE / '조회할 노선이 없습니다.'.
  ENDIF.`), text('SELECT 열에 키를 빼면 원래 서로 다른 행이 같은 결과 행으로 합쳐질 수 있습니다. 필요 키를 포함하고 JOIN과 비교하세요. FOR ALL ENTRIES는 집계·정렬 등과 결합할 때 제한이 있으므로 일반 SELECT와 똑같이 조합하면 안 됩니다.')),
    section('INSERT·UPDATE·MODIFY·DELETE', table(['DB 변경 문장', '의미', '확인할 점'], [
      ['INSERT dbtab FROM wa', '새 행 삽입', '기본 키·고유 인덱스 중복'],
      ['UPDATE dbtab SET ... WHERE ...', '기존 행의 지정 열 변경', '조건과 실제 변경 행 수'],
      ['MODIFY dbtab FROM wa', '기본 키가 있으면 덮어쓰고 없으면 삽입', '전달한 행의 초기값도 덮어쓸 수 있음'],
      ['DELETE FROM dbtab WHERE ...', '조건에 맞는 행 삭제', 'WHERE 누락·과도한 범위 주의']
    ]), text('이 문장들은 DB 테이블을 대상으로 합니다. [[abap-data-report|Internal Table]]의 INSERT·MODIFY·DELETE와 문장이 비슷해도 저장 위치와 트랜잭션이 다릅니다. 일부 필드만 바꾸려면 완성되지 않은 Work Area로 MODIFY하기보다 UPDATE ... SET으로 의도를 드러내세요.',
      '변경 예제는 별도 Z 연습용 테이블을 정의한 뒤 실습해야 합니다. SCARR·SFLIGHT나 업무 표준 테이블을 실습용으로 직접 변경하지 마세요. 결과 코드는 문장·단일/일괄 처리별로 다르며 DB 오류는 예외로 발생할 수도 있습니다. sy-subrc와 sy-dbcnt를 바로 확인하고 예외 처리도 설계합니다.'),
      table(['문법 형태 — 그대로 실행하는 코드가 아님', '전제'], [
        ['INSERT zcw_scarr_demo FROM gs_scarr.', 'ZCW_SCARR_DEMO의 키(carrid 등)와 모든 필수 값이 준비된 Work Area'],
        ['UPDATE zcw_scarr_demo SET carrname = gv_carrname WHERE carrid = gv_carrid.', '정확한 키 조건과 입력 검증'],
        ['MODIFY zcw_scarr_demo FROM gs_scarr.', '초기값까지 포함한 행 전체를 저장하려는 경우'],
        ['DELETE FROM zcw_scarr_demo WHERE carrid = gv_carrid.', '삭제 권한·대상 확인·복구 계획']
      ])),
    section('보완: 트랜잭션과 안전한 변경', text(
      'COMMIT WORK는 현재 작업 단위의 변경을 확정하고, ROLLBACK WORK는 현재 DB LUW의 미확정 변경을 되돌립니다. 이미 커밋한 변경까지 되돌리는 기능은 아닙니다. 화면 전환·RFC 등에서 암묵적인 커밋이 생길 수 있어 “COMMIT을 안 썼으니 영구 저장되지 않는다”라고 가정하면 안 됩니다.',
      '삭제 전 백업은 복구 수단 중 하나입니다. 먼저 대상·건수를 읽어 확인하고, 권한 검사와 필요한 SAP 잠금, 좁은 키 조건, 오류 처리, 트랜잭션 경계를 함께 설계하세요. 확인 조회와 변경 사이에 다른 사용자가 수정할 수도 있습니다.',
      '한 업무가 끝나는 위치에서 커밋하도록 설계합니다. SELECT ... ENDSELECT 안에서 COMMIT·ROLLBACK을 실행하면 커서가 닫혀 오류가 날 수 있습니다. BAPI·RAP 등은 해당 API/프레임워크의 트랜잭션 규칙을 따릅니다.')),
    section('보완: 성능과 다음 문법', table(['점검', '실천'], [
      ['가져올 데이터', '필요한 열과 WHERE 조건을 지정. 화면용 목록은 건수 제한·페이지 처리 고려'],
      ['반복 DB 호출', 'LOOP 안의 반복 SELECT를 JOIN·집합 조회로 줄일 수 있는지 확인'],
      ['키와 인덱스', '키 조건은 유리할 수 있지만 자동으로 빠르지는 않음. 조건의 선택도·인덱스·실행 계획에 따라 판단'],
      ['정렬', '결과 순서가 필요하면 ORDER BY. Internal Table 순서는 SORT와 구분'],
      ['측정', 'ST05 SQL Trace 등으로 호출 횟수·실행 시간 확인. JOIN이 항상 최선이라고 단정하지 않음'],
      ['입력과 권한', '값은 ABAP 호스트 변수로 전달(구문법에서는 @ 미사용). 동적 테이블/열/WHERE 문자열은 별도 검증. Open SQL 자체가 업무 권한을 자동 보장하지 않음']
    ]), text('구문법(Classic Open SQL)에서는 DB에서 필요한 원본 컬럼을 먼저 조회한 뒤 `LOOP AT` 안에서 계산·분기·기본값 처리를 수행하는 방식이 기본입니다. SQL 단계에서 `CASE`·`COALESCE`·`UNION`·`WITH` 등을 쓰는 확장 문법은 추후 심화 과정에서 필요할 때 [[abap-sql-guide|ABAP SQL 가이드]]와 시스템 F1 문서를 참고해 확장하세요.')),
    section('구문법(Classic Open SQL) 작성 순서와 문법 오류 주의', text(
      '수업에서 사용하는 구문법(Classic Open SQL)에서는 SELECT 컬럼과 ORDER BY·GROUP BY 목록을 공백으로 구분하고, INTO 절을 FROM 뒤·WHERE 앞에 두며, ABAP 변수 앞에 @를 붙이지 않습니다.',
      'INTO 절을 SELECT 문 맨 끝에 적거나, SELECT 컬럼 사이에 쉼표(,) 또는 변수 앞 @를 일부만 섞어 쓰면 컴파일러가 문법 오류를 발생시키므로 하나의 SELECT 문 안에서 구문법 규칙을 일관되게 지켜야 합니다.'),
      table(['자주 발생하는 오류 원인', '구문법(Classic Open SQL) 올바른 작성 방법'], [
        ['`INTO` 절을 `WHERE` 뒤(문장 끝)에 작성함', '`SELECT ... FROM ... INTO [TABLE] ... WHERE ...` 순서로 `INTO`를 `WHERE` 앞에 배치'],
        ['컬럼 사이에 쉼표(`,`)나 변수 앞 `@`를 섞어 씀', '컬럼·`GROUP BY`·`ORDER BY`는 **공백** 구분, ABAP 변수는 `@` 없이 그대로 작성(`p_carr`, `so_carr`, `gt_tab`)'],
        ['결과를 받을 변수를 미리 선언하지 않음', '`SELECT` 전에 `TYPES` · `DATA`로 Work Area 또는 Internal Table을 먼저 선언']
      ]))
  ], '11/19 · 11/20');

  put('abap-dictionary', 'ABAP Dictionary', 'SE11에서 관리하는 Type Definitions·DB Objects·Services와 Domain, Data Element, Structure, Table Type, Transparent Table, Index, Table Buffer, Input Checks(Fixed Values · Foreign Keys), Text Table, Table Conversion(SE14), Append Structure, Views · Maintenance View(SM30) · Dynamic Attachment를 정리합니다.',
    ['ABAP Dictionary', 'DDIC', 'DATA ELEMENT', 'Data Element', 'Domain', 'Domain', '데이터베이스 테이블', 'Transparent Table', 'Technical Attribute', 'Semantic Attribute', 'Search Help', 'SET/GET Parameters', 'Flat structure', 'Simple structure', 'Nested structure', 'Deep structure', 'Table Type', 'Line Type', 'Database view', 'Projection view', 'Help view', 'Maintenance view', 'Delivery Class', 'Technical Settings', 'Secondary Index', 'Table Buffer', 'Full Buffering', 'Generic Buffering', 'Single-Record Buffering', 'Synchronization Table', 'Input Checks', 'Fixed Values', 'Value Table', 'Check Table', 'Foreign Key', 'Cardinality', 'BYPASSING BUFFER', 'Text Table', 'SPRAS', 'Where-Used List', 'Table Conversion', 'QCM', 'Database Utility', 'Append Structure', 'Table Maintenance Generator', 'Maintenance Dialog', 'Dynamic Attachment'], [
    section('ABAP Dictionary의 역할과 3가지 기능', text(
      'ABAP Dictionary(SE11)는 시스템 전체의 Program과 화면이 공유하는 전역 타입, 데이터베이스 객체, 입력 도움말 서비스를 중앙에서 정의·관리하는 저장소입니다. 현재 수업 실습 시스템은 ABAP 7.5 기준입니다.'),
      table(['기능 구분', '포함 객체 · 역할'], [
        ['1. Type Definitions', 'Data Element(기본 타입), Structure(Structure Type), Table Type(Internal Table 타입) 등 전역 타입 정의'],
        ['2. DB Objects', 'Transparent Table, View 등 실제 데이터베이스 객체 정의'],
        ['3. Services', 'Search Help(F4 입력 도움말), Lock Object 등 화면·Program 지원 서비스']
      ])),
    section('View 4가지', text(
      'SE11에서 View를 생성할 때는 목적에 따라 네 가지 유형 중 하나를 선택합니다. 필기에서 비어 있던 2·3번 항목(Projection view, Help view)은 SE11의 표준 4가지 View 기준으로 보완했습니다.'),
      table(['순서 · 유형', '목적과 특징'], [
        ['1. Database view', '하나 이상의 Transparent Table을 Inner Join으로 결합해 DB에 실제 뷰를 생성합니다(읽기 조회 중심).'],
        ['2. Projection view', '단일 테이블에서 필요한 일부 필드(컬럼)만 선택해 노출합니다.'],
        ['3. Help view', 'Search Help의 데이터 조회(Selection Method)에서 Outer Join이 필요할 때 사용합니다.'],
        ['4. Maintenance view', '연관된 여러 테이블의 데이터를 하나의 업무 화면(SM30 등)에서 함께 조회·유지보수할 때 사용합니다.']
      ])),
    section('Data의 속성과 Domain · Data Element가 필요한 이유', text(
      'Data 하나를 제대로 다루려면 어떤 종류·길이인지 나타내는 기술 속성과, 화면 라벨·도움말 같은 의미 속성을 모두 정해 주어야 합니다.'),
      {
        type: 'compare',
        items: [
          {
            tag: 'Domain이 담당',
            title: 'Technical Attribute',
            points: [
              '어떤 종류인지 (Data Type: CHAR, NUMC, DEC, INT4, DATS 등)',
              '몇 글자인지 (길이 · 소수 자릿수)',
              '허용 값 범위 (Value Range · Fixed Values)'
            ]
          },
          {
            tag: 'Data Element가 담당',
            title: 'Semantic Attribute',
            points: [
              '화면에 표시할 단어와 언어별 번역 (Field Label / Translation)',
              '입력 가능한 값 도움말 (Search Help · F4)',
              '화면 간 값 전달 메모리 ID (SET/GET Parameters) 등 필드 의미·동작'
            ]
          }
        ]
      },
      {
        type: 'callout', style: 'point', title: '왜 Data Element와 Domain 두 단계로 나누어 만들어 둘까?',
        body: '변수를 만들 때마다 종류·길이·화면 라벨·Search Help를 매번 하나하나 정하기 번거로우므로, 빈칸만 채워 재사용할 수 있게 미리 만들어 둔 양식이 **Data Element**입니다. 그런데 Data Element마다 또 “종류는 숫자 문자, 길이는 3글자” 같은 기술 속성을 반복 입력하는 것도 번거로우므로, **Technical Attribute만 따로 미리 만들어 여러 Data Element가 공유**하도록 한 틀이 **Domain**입니다.'
      },
      text('전체 참조 흐름(`TABLE → STRUCTURE · WORK AREA → DATA ELEMENT → Domain`)은 [[abap-thinking-flow|ABAP 사고 흐름]]의 ‘전체적인 그림’에서도 한눈에 볼 수 있습니다.')),
    section('Domain — Technical Attribute와 SE11 절차', text(
      'Domain은 필드의 기술적 속성(Technical Attribute)인 데이터 종류(Data Type)와 길이(No. Characters · Decimal Places), 출력 길이, 값 범위(Value Range)를 정의하는 틀입니다. 고객 생성 객체는 보통 Z 또는 Y로 시작하는 이름을 사용합니다.'),
      table(['항목', '설정 내용', '예 (S_CONN_ID)'], [
        ['1. 종류 (Data Type)', '데이터 형식 지정 (CHAR, NUMC, DEC, CURR, QUAN 등)', 'NUMC (숫자 문자)'],
        ['2. 길이 (No. Characters)', '문자·숫자 자릿수 및 소수 자릿수(Decimal Places)', '길이 4 · 소수 없음'],
        ['값 범위 (Value Range)', '고정값(Single Vals), 구간(Intervals), Value Table 지정 가능', '0000 ~ 9999 표현 범위']
      ]),
      {
        type: 'practice',
        title: 'SE11에서 Domain 조회 · 만드는 법',
        steps: [
          { step: '1', action: 'SE11 실행', detail: 'SAP GUI 명령 필드에 SE11을 입력해 ABAP Dictionary 초기 화면을 엽니다.' },
          { step: '2', action: 'Domain 선택 및 이름 설정 후 Display / Create', detail: 'Domain 라디오 버튼을 선택하고 객체 이름(표준 예: S_CARR_ID, 신규 예: ZDO_GRADE_##)을 입력한 뒤 Display 또는 Create를 누릅니다.' },
          { step: '3', action: '구성 입력', detail: 'Short Description을 적고 Definition 탭에서 Data Type(종류)과 No. Characters(길이), 필요 시 Value Range를 입력합니다.' },
          { step: '4', action: 'Activate', detail: '저장 후 Activate(Ctrl + F3)하여 Data Element에서 참조할 수 있는 활성 버전으로 만듭니다.' }
        ]
      }),
    section('Data Element — Semantic Attribute와 SE11 절차', text(
      'Data Element는 필드의 의미적 속성(Semantic Attribute)을 담는 틀입니다. 기술 속성은 주로 Domain을 등록해 가져오며, 아래 세 가지 대표 의미·부가 속성을 설정할 수 있습니다.'),
      table(['속성', '역할'], [
        ['1. Field Label / Translation', 'Selection Screen·리스트·ALV 컬럼에 표시할 단어를 길이별(Short · Medium · Long · Heading)로 설정하고 각 언어별로 번역해 표시되게 할 수 있습니다(필기의 Field ID / Translation).'],
        ['2. Search Help', 'Further Characteristics 탭에 Search Help를 연결해 입력 필드에서 F4 Help 항목을 제공하게 할 수 있습니다.'],
        ['3. SET/GET Parameters', 'Further Characteristics 탭에 Parameter ID를 지정해 SAP Memory에 값을 저장(SET)하고 다른 스크린·트랜잭션으로 이동할 때 기본값을 불러오는(GET) 기능을 연결할 수 있습니다.']
      ]),
      {
        type: 'practice',
        title: 'SE11에서 Data Element 조회 · 만드는 법',
        steps: [
          { step: '1', action: 'SE11 실행', detail: 'ABAP Dictionary 초기 화면으로 이동합니다.' },
          { step: '2', action: 'Data Type(Data Element) 선택 및 이름 설정 후 Display / Create', detail: 'SE11의 Data Type 칸에 이름(표준 예: S_CARR_ID, 신규 예: ZDE_CARRID_##)을 넣고 Display 또는 Create를 누른 뒤, 생성 팝업에서 Data Element를 선택합니다.' },
          { step: '3', action: 'Data Type 설정 (Domain 등록)', detail: 'Data Type 탭의 Elementary Type에서 미리 정의된 Domain 이름을 입력합니다.' },
          { step: '4', action: 'Field Label 등록', detail: 'Field Label 탭에서 Short · Medium · Long · Heading 문구를 입력합니다.' },
          { step: '5', action: 'Activate', detail: '저장 후 Activate(Ctrl + F3)합니다.' }
        ]
      },
      code('Data Element를 참조한 PARAMETERS와 변수 선언', `REPORT zabap_f##_##.

PARAMETERS: p_carr TYPE s_carr_id DEFAULT 'LH',
            p_conn TYPE s_conn_id DEFAULT '0400'.

DATA gv_cityfrom TYPE spfli-cityfrom.
DATA gv_cityto   TYPE spfli-cityto.

START-OF-SELECTION.
  SELECT SINGLE cityfrom cityto
    FROM spfli
    INTO (gv_cityfrom, gv_cityto)
    WHERE carrid = p_carr
      AND connid = p_conn.

  IF sy-subrc = 0.
    WRITE: / p_carr, p_conn, gv_cityfrom, '->', gv_cityto.
  ELSE.
    WRITE / '일치하는 노선이 없습니다.'.
  ENDIF.`),
      text('p_carr와 p_conn은 Data Element(S_CARR_ID, S_CONN_ID)를 참조하므로 Domain에 정의된 길이·타입뿐 아니라 Data Element의 Field Label, F4 Search Help, Parameter ID(CAR, CON) 특성까지 Selection Screen에 그대로 반영됩니다.')),
    section('Structure — 종류(Flat · Deep)와 .INCLUDE', text(
      'Structure는 여러 컴포넌트(필드)를 묶어 하나의 행 모양을 정의하는 데이터 타입이자 다른 Structure·Table의 재료입니다. 데이터베이스에 실제 저장 공간을 만들지 않고 구조 모양만 정의합니다.',
      '수업의 계층 예시처럼 ‘사람’이라는 구조가 ‘이름’과 ‘주소’ 속성으로 이루어지고, ‘이름’은 다시 ‘성’·‘이름’, ‘주소’는 ‘나라’·‘시’·‘구’·‘도로명 주소’로 이루어지면 사람-이름-성처럼 하이픈(-)을 이어 하위 속성에 접근(access)합니다.'),
      table(['분류', '세부 종류', '구성 기준과 특징'], [
        ['1. Flat structure', '1-1. Simple structure', '길이가 정해진 고정 길이 구조 중 Component Type이 모두 Elementary Type(기본 타입 · Data Element)으로만 구성된 일반적인 Structure입니다.'],
        ['1. Flat structure', '1-2. Nested structure', 'Component Type 안에 다른 Structure Type이 포함된 중첩 구조입니다(구조-하위구조-필드 형태로 접근; 하위 끝단 필드가 모두 고정 길이면 Flat에 속함).'],
        ['2. Deep structure', '길이가 정해지지 않은 구조', 'Component Type에 Table Type(Internal Table)이나 string · xstring · 참조 변수 등 동적 요소가 하나라도 포함된 구조입니다.']
      ]),
      {
        type: 'callout', style: 'tip', title: 'Nested structure보다 .INCLUDE를 더 많이 쓰는 이유',
        body: 'SE11에서 Structure를 만들 때 Component 열에 **.INCLUDE**를 적고 Component Type에 다른 Structure를 넣으면(로컬 ABAP 코드의 `INCLUDE TYPE`과 동일 원리), 하위 구조 이름을 두 번 거쳐 접근(`gs_nested-route-cityfrom`)하는 대신 **그 자리에 필드를 그대로 붙여넣어 선언한 것처럼(`gs_included-cityfrom`) 평탄하게 작동**합니다.'
      },
      code('Nested Structure와 INCLUDE TYPE 접근 비교', `REPORT zabap_f##_##.

TYPES: BEGIN OF ts_route_info,
         cityfrom TYPE spfli-cityfrom,
         cityto   TYPE spfli-cityto,
       END OF ts_route_info.

" 1) Nested structure: 하위 구조 이름(route)을 한 번 더 거쳐 접근
TYPES: BEGIN OF ts_flight_nested,
         carrid TYPE sflight-carrid,
         connid TYPE sflight-connid,
         route  TYPE ts_route_info,
       END OF ts_flight_nested.

" 2) INCLUDE TYPE (SE11의 .INCLUDE와 동일 개념): 현재 구조에 평탄하게 포함
TYPES: BEGIN OF ts_flight_included,
         carrid TYPE sflight-carrid,
         connid TYPE sflight-connid.
         INCLUDE TYPE ts_route_info.
TYPES: END OF ts_flight_included.

DATA gs_nested   TYPE ts_flight_nested.
DATA gs_included TYPE ts_flight_included.

gs_nested-carrid         = 'LH'.
gs_nested-connid         = '0400'.
gs_nested-route-cityfrom = 'FRANKFURT'.
gs_nested-route-cityto   = 'NEW YORK'.

gs_included-carrid   = 'LH'.
gs_included-connid   = '0400'.
gs_included-cityfrom = 'FRANKFURT'.
gs_included-cityto   = 'NEW YORK'.

WRITE: / 'Nested  :', gs_nested-carrid, gs_nested-route-cityfrom, gs_nested-route-cityto,
       / 'Include :', gs_included-carrid, gs_included-cityfrom, gs_included-cityto.`),
      {
        type: 'practice',
        title: 'SE11에서 Structure 조회 · 생성 방법',
        steps: [
          { step: '1', action: 'SE11 실행', detail: 'ABAP Dictionary 초기 화면을 엽니다.' },
          { step: '2', action: 'Data Type 선택 및 이름 설정 후 Display / Create', detail: 'Data Type 라디오 버튼을 선택하고 이름(표준 예: BC400_S_FLIGHT, 신규 예: ZST_FLIGHT_##)을 입력한 뒤 Display 또는 Create를 누릅니다(필기의 Data Element 칸 위치가 SE11에서는 Data Type 통합 라디오 버튼입니다).' },
          { step: '3', action: 'Structure 선택', detail: '유형 선택 팝업에서 Structure를 선택하고 Short Description을 입력합니다.' },
          { step: '4', action: '컬럼명(Component) · Component Type 표 채우기', detail: 'Components 탭에서 필드명과 참조할 Data Element/Structure를 입력합니다. 다른 구조의 필드를 평탄하게 합칠 때는 Component에 .INCLUDE를 입력합니다.' },
          { step: '5', action: 'Currency/quantity fields 확인 후 Activate', detail: '금액(CURR)·수량(QUAN) 필드가 있으면 반드시 Currency/quantity fields 탭에서 참조 테이블·필드를 연결한 뒤 Activate(Ctrl + F3)합니다.' }
        ]
      },
      {
        type: 'callout', style: 'warning', title: 'Global Structure Activate 오류 — CURR / QUAN 필드의 Currency/quantity fields 참조 필수',
        body: 'Global Structure(예: `ZBS_FLIGHT_?_##`)에 `PRICE`(`CURR` 타입) 같은 금액 필드나 `QUAN` 수량 필드를 추가하고 그대로 활성화하면 **Reference table/field 누락 오류**가 발생합니다. `SE11`의 **`Currency/quantity fields`** 탭에서 `PRICE` 행에 **Reference Table = 자기 자신(`ZBS_FLIGHT_?_##`)**, **Reference Field = `CURRENCY`**(통화 키 `CUKY` 필드)를 지정한 뒤 Activate하세요([[basic-session-review|Basic Session Review]] 함정 1 참고).'
      }),
    section('Table Type — SE11 전역 Internal Table 타입', text(
      'Table Type은 Program 안에서 TYPES ... TYPE TABLE OF ...로 선언하던 Internal Table 타입을 ABAP Dictionary에 전역으로 등록한 객체입니다(예: BC400_T_FLIGHTS). 행의 모양(Line Type), 접근 방식(Access Mode), 기본 키(Primary Key)를 함께 정의합니다.'),
      {
        type: 'practice',
        title: 'SE11에서 Table Type 조회 · 생성 방법',
        steps: [
          { step: '1', action: 'SE11 실행', detail: 'ABAP Dictionary 초기 화면을 엽니다.' },
          { step: '2', action: 'Data Type 선택 및 이름 설정 후 Display / Create', detail: 'Data Type 라디오 버튼에 이름(표준 예: BC400_T_FLIGHTS, 신규 예: ZTT_FLIGHTS_##)을 넣고 Display 또는 Create를 누릅니다.' },
          { step: '3', action: 'Table Type 선택', detail: '유형 선택 팝업에서 Table Type을 선택하고 Short Description을 입력합니다.' },
          { step: '4', action: 'Line Type 작성', detail: 'Line Type 탭에서 행 타입을 지정합니다. Structure가 가장 흔하지만 Data Element부터 다른 Table Type까지 모두 올 수 있습니다.' },
          { step: '5', action: 'Initialization and Access 탭에서 Table 타입 선택', detail: 'Access Mode에서 Standard Table, Sorted Table, Hashed Table 중 목적에 맞는 테이블 종류를 선택합니다.' },
          { step: '6', action: 'Primary Key에서 키 속성 선택 후 Activate', detail: 'Primary Key 탭에서 Key Definition(Standard Key · Key Components 등)과 Key Category(Unique · Non-Unique)를 선택한 뒤 Activate(Ctrl + F3)합니다.' }
        ]
      },
      code('Deep Structure와 전역 Table Type 활용', `REPORT zabap_f##_##.

TYPES: BEGIN OF ts_route,
         connid   TYPE spfli-connid,
         cityfrom TYPE spfli-cityfrom,
         cityto   TYPE spfli-cityto,
       END OF ts_route.
TYPES tt_routes TYPE STANDARD TABLE OF ts_route WITH NON-UNIQUE KEY connid.

" Component(routes)에 Table Type이 포함되어 길이가 가변인 Deep structure
TYPES: BEGIN OF ts_carrier_deep,
         carrid   TYPE scarr-carrid,
         carrname TYPE scarr-carrname,
         routes   TYPE tt_routes,
       END OF ts_carrier_deep.

DATA: gs_carrier TYPE ts_carrier_deep,
      gv_lines   TYPE i.

START-OF-SELECTION.
  SELECT SINGLE carrid carrname
    FROM scarr
    INTO (gs_carrier-carrid, gs_carrier-carrname)
    WHERE carrid = 'LH'.

  SELECT connid cityfrom cityto
    FROM spfli
    INTO TABLE gs_carrier-routes
    WHERE carrid = 'LH'
    ORDER BY connid.

  DESCRIBE TABLE gs_carrier-routes LINES gv_lines.
  WRITE: / gs_carrier-carrid, gs_carrier-carrname,
         / '보유 노선 수:', gv_lines.`),
      text('위 예제의 tt_routes처럼 Internal Table 타입을 SE11에 전역 Table Type(예: BC400_T_FLIGHTS)으로 만들어 두면 여러 Program과 글로벌 Structure(Deep structure 컴포넌트)·함수/Method 인터페이스에서 그대로 재사용할 수 있습니다.')),
    section('Transparent Table 생성과 Technical Settings', text(
      'SE11에서 Database Table(Transparent Table)을 생성할 때는 Delivery Class와 Data Browser(SE16) 유지보수 설정, Key·일반 Fields, Currency/Quantity 참조, Technical Settings를 순서대로 지정한 뒤 Activate합니다.'),
      {
        type: 'practice',
        title: 'SE11에서 Transparent Table 생성 및 데이터 입력 절차',
        steps: [
          { step: '1', action: 'SE11 실행 후 Database Table 선택', detail: 'Database Table 라디오 버튼을 선택하고 테이블 이름(예: ZCARRIER_##)을 입력한 뒤 Create를 누릅니다.' },
          { step: '2', action: 'Delivery Class 및 Data Browser(SE16) 설정', detail: 'Delivery and Maintenance 탭에서 테이블 용도(Delivery Class: A, C, L, G, E, S, W)와 SE16에서 조회/수정(Display/Maintenance) 허용 여부를 설정합니다.' },
          { step: '3', action: 'Fields 탭 작성', detail: '클라이언트 종속 테이블이면 첫 필드에 MANDT(또는 Client)를 두고, 이어서 carrid·connid 등 필요한 필드를 작성합니다. Key 필드는 반드시 맨 위부터 빈틈(갭) 없이 연속 나열해야 합니다. Initial Values를 체크하면 NULL을 허용하지 않고 타입별 초기값으로 저장됩니다.' },
          { step: '4', action: 'Currency/Quantity Fields 연결', detail: '금액(CURR)이나 수량(QUAN) 필드가 있으면 반드시 대응하는 단위 필드(CUKY, UNIT)를 지정해야 합니다. Currency/Quantity Fields 탭에서 Reference Table(단위 테이블)과 Ref. Field(단위 필드)를 기입합니다.' },
          { step: '5', action: 'Technical Settings 작성 (4가지)', detail: '상단 Technical Settings 버튼에서 Data Class, Size Category, Logging, Table Buffer를 설정하고 저장합니다.' },
          { step: '6', action: 'Activate 및 데이터 입력', detail: 'Activate(Ctrl + F3)로 테이블을 활성화한 뒤, 상단 메뉴 Utilities → Table Contents → Create Entries에서 실제 레코드를 입력합니다.' }
        ]
      },
      table(['Delivery Class', '용도와 특징'], [
        ['A', '마스터 테이블 (Application table: 마스터 데이터 및 트랜잭션 데이터)'],
        ['C', '고객사용 커스터마이징 테이블 (Customizing table: 고객만 유지보수)'],
        ['L', '로컬 데이터 (임시 데이터 저장용, 다른 시스템으로 전송되지 않음)'],
        ['G', 'SAP 업데이트용 커스터마이징 테이블 (SAP 업그레이드 시 고객 데이터 보호, 신규 삽입만 허용)'],
        ['E', '필드 컨트롤 테이블 (Control table: SAP와 고객이 별도 키 영역을 나누어 사용)'],
        ['S', '시스템 테이블 — SAP용 (SAP만 유지보수, 고객 변경 시 수정으로 취급)'],
        ['W', '시스템 테이블 — 자체 전송 객체로 별도 전송 가능한 개발·시스템 구성 테이블 (필기 빈칸 보완)']
      ]),
      {
        type: 'callout', style: 'tip', title: 'KRW(원화) 금액 필드의 100 나눗셈 저장 주의',
        body: 'SAP 내부에서 `CURR` 필드는 기본적으로 소수점 2자리 형식을 기준으로 저장됩니다. 소수 자릿수가 0인 `KRW` 단위로 금액을 입력하면 **RAW 데이터에는 100으로 나누어진 값**으로 저장됩니다(예: 10,000 KRW → RAW 100.00). ALV나 `WRITE ... CURRENCY`로 디스플레이할 때는 통화 설정(`TCURX`)에 따라 자동 보정되지만, RAW 데이터를 직접 읽거나 계산할 때는 100 나누어진 값임을 반드시 염두에 두어야 합니다.'
      },
      table(['Technical Settings 4가지', '의미와 설정 기준'], [
        ['1. Data Class', 'In what physical area of the database should the table be stored — DB의 어느 물리 영역에서 관리할지 지정(`APPL0`, `APPL1`, `APPL2`, `DDIM`, `USER` 등). 일반적으로 마스터/업무 데이터는 `APPL0` 또는 `USER`를 사용합니다. (참고: `BW`는 Business Warehouse, 최근 Business Intelligence로 불리며 Data Analysis로 대시보드를 구성하는 영역)'],
        ['2. Size Category', 'How many records will the table probably contain — 예상 데이터 건수 구간. 예: 항공사 코드(`SCARR`) 같은 Master Table은 작게, 예약 테이블(`SBOOK`)은 크게 잡습니다.'],
        ['3. Logging', 'Log changes to the data records — 데이터 레코드의 수정 이력을 저장할지 여부.'],
        ['4. Table Buffer', 'Should the table records be buffered? — Application Server 메모리 버퍼 사용 여부. 버퍼 유형은 `Full Buffering`, `Generic Buffering`, `Single-Record Buffering` 3가지가 있습니다(필기 빈 번호 보완).']
      ])),
    section('Database Access Using Index — Primary · Secondary Index', text(
      'SELECT 절로 데이터를 조회할 때 Primary Key 조건으로 검색하면 Primary Key에 자동 등록된 Primary Index를 통해 Binary Search 방식으로 빠르게 찾습니다. 반면 Key가 아닌 필드(Secondary Key / Non-Key 필드) 조건만으로 조회하면 테이블을 처음부터 끝까지 하나씩 검토(Full Table Scan)하게 됩니다.',
      '자주 검색하는 Non-Key 필드가 있다면 SE11의 Indexes 메뉴에서 Secondary Index를 추가할 수 있습니다. 예를 들어 학생 테이블에서 학번이 Primary Key지만 학생 이름으로 자주 검색한다면 Create Index로 MANDT + 이름 조합의 Secondary Index를 등록합니다. SAP 항공 모델에서도 SCUSTOM(Primary Key: MANDT, ID)을 고객 이름(NAME)으로 자주 조회할 때 MANDT + NAME으로 Secondary Index를 두는 것과 같은 원리입니다.'),
      {
        type: 'compare',
        items: [
          {
            tag: '자동 생성',
            title: 'Primary Index',
            points: [
              '테이블의 Primary Key 필드로 자동 생성되는 기본 색인',
              'WHERE 절에 Primary Key 조건을 주면 Binary Search로 빠르게 탐색',
              '테이블당 1개 존재하며 별도 생성 불필요'
            ]
          },
          {
            tag: 'SE11 Indexes에서 생성',
            title: 'Secondary Index',
            points: [
              'Non-Key 필드 조건 조회의 순차 탐색 비용을 줄이기 위해 추가 등록',
              'Create Index로 MANDT + [자주 조회하는 Secondary 필드] 구성',
              '인덱스가 너무 많으면 INSERT/UPDATE/DELETE 시 인덱스 갱신 비용이 증가하므로 꼭 필요한 조건에만 생성'
            ]
          }
        ]
      }),
    section('Database Access Using the Buffer — Table Buffer와 동기화', text(
      'SAP에는 DB 접근 횟수를 줄여 조회 속도를 높이기 위한 Table Buffer 개념이 있습니다. Application Server마다 하나의 Table Buffer를 두며, SE11 → Technical Settings에서 활성화와 버퍼링 유형을 설정합니다.'),
      table(['Table Buffer 3가지 종류', '적재 범위와 특징'], [
        ['1. Full Buffering', '테이블의 모든 레코드를 한 번에 Application Server 버퍼에 적재합니다. 크기가 작고 전체 조회가 잦은 코드·설정 테이블에 적합합니다.'],
        ['2. Generic Buffering', '앞쪽 일부 Key 필드를 `Generic Key`로 묶어 해당 키 영역만 버퍼에 적재합니다. `Number of Key Fields`는 `1`부터 `(Key Field 개수 - 1)`까지 지정할 수 있으며, 1번 Key 필드부터 지정한 개수만큼이 `Generic Key`가 됩니다.'],
        ['3. Single-Record Buffering', 'Key Field 전체를 `Generic Key`로 삼은 것과 같은 개념입니다. `SELECT SINGLE *`처럼 한 건의 데이터만 읽어올 때 그 레코드만 버퍼에 올립니다.']
      ]),
      {
        type: 'flow',
        caption: 'Application Server 버퍼와 Synchronization Table 동기화 흐름',
        steps: [
          { badge: '1. 변경 기록', title: 'DB 변경 → Synch Table 기록', desc: '버퍼는 복사본 개념이라 다른 사용자가 원본 DB를 수정하면 즉시 반영되지 않습니다. 테이블 변경이 일어나면 Synchronization Table에 변경 사실을 기록합니다.' },
          { badge: '2. 이벤트 확인', title: '접근 시 Synch Table 확인', desc: '변경된 테이블에 접근하는 동기화 이벤트가 발생하면 각 Application Server가 Synchronization Table을 읽어 변경 이력을 확인합니다.' },
          { badge: '3. 재적재', title: '기존 버퍼 삭제 후 최신 DB 등록', desc: '기존에 복사해 둔 버퍼를 삭제(무효화) 처리하고, 업데이트된 최신 DB 데이터를 다시 버퍼에 적재합니다.' }
        ]
      },
      {
        type: 'callout', style: 'point', title: '실시간 정합성이 필수인 테이블은 버퍼링 금지',
        body: '버퍼 동기화에는 시간차가 생기므로, **버퍼 데이터와 원본 DB 데이터가 실시간으로 정확히 일치해야 하는 테이블**(변경이 잦은 예약·전표·재고 테이블 등)에는 Table Buffer를 사용하면 안 됩니다. (참고: `SE11 Technical Settings`에서는 `Buffering` 허용 여부와 3가지 `Buffering Type` 중 접근 패턴에 맞는 방식을 선택해 적용합니다.)'
      },
      table(['Buffer 사용 Decision Tree 질문', '예 (YES)', '아니오 (NO)'], [
        ['Q1. 동기화가 실시간이 아니어도 괜찮고, 주로 읽기 전용인가요?', 'Q2로 이동', '버퍼 사용 안 함 (Not Allowed)'],
        ['Q2. 테이블 크기가 32 KB보다 작은가요?', 'Full Buffering', 'Q3로 이동'],
        ['Q3. SELECT SINGLE로 한 건씩 불러오는 경우가 많나요?', 'Single-Record Buffering', 'Q4로 이동'],
        ['Q4. 테이블 크기가 1 MB보다 큰가요? (약 1,000건 초과)', '레코드 수에 따라 Secondary Index vs Buffering 적용 여부 검토', 'Q5로 이동'],
        ['Q5. WHERE 절에 주로 앞쪽 Key 필드가 오나요?', 'Generic Buffering', 'Full Buffering']
      ]),
      code('Table Buffer 조회와 BYPASSING BUFFER', `REPORT zabap_f##_##.

DATA gs_scarr TYPE scarr.

START-OF-SELECTION.
  " 1) 일반적인 단일 레코드 조회 (버퍼가 활성화된 테이블이면 Table Buffer 활용)
  SELECT SINGLE *
    FROM scarr
    INTO gs_scarr
    WHERE carrid = 'LH'.

  IF sy-subrc = 0.
    WRITE: / '버퍼/표준 조회:', gs_scarr-carrid, gs_scarr-carrname.
  ENDIF.

  " 2) 버퍼를 우회해 DB 원본에서 최신 값을 직접 읽어야 할 때
  SELECT SINGLE *
    FROM scarr
    INTO gs_scarr
    BYPASSING BUFFER
    WHERE carrid = 'LH'.

  IF sy-subrc = 0.
    WRITE: / 'DB 직접 조회 :', gs_scarr-carrid, gs_scarr-carrname.
  ENDIF.`)),
    section('Input Checks — Fixed Values와 Foreign Keys', text(
      'ABAP Dictionary는 잘못된 데이터가 화면이나 테이블에 들어오는 것을 막기 위해 두 가지 대표적인 Input Checks(인풋 검사)를 제공합니다.'),
      {
        type: 'compare',
        items: [
          {
            tag: 'Domain · Value Range',
            title: '1. Creating Fixed Value',
            points: [
              'Domain의 Value Range 탭에서 정해진 값(Fixed Values / Intervals)만 입력되도록 제한',
              '설정한 고정값 목록이 화면의 F4 Help에 자동으로 디스플레이됨',
              '입력이 들어올 때만 검사하므로 이미 테이블에 들어가 있는 기존 데이터에는 소급 적용되지 않음'
            ]
          },
          {
            tag: 'Table · Check Table 연결',
            title: '2. Defining Foreign Keys',
            points: [
              '데이터 적합성·일치성 측면에서 타 컬럼/테이블과의 연결성(참조 무결성)을 검사',
              '예: 항공사 AA에 Counter 8이 없다면 입력 시 Check Table(예: SCOUNTER)에 존재 여부를 확인해 있으면 Confirm, 없으면 Reject',
              'Domain의 Value Range에 Value Table을 미리 지정해 두면 Foreign Key 생성 시 제안(Proposal)으로 활용 가능'
            ]
          }
        ]
      },
      text('**Foreign Key의 Cardinality(관계성)**', 'Check Table의 한 레코드와 Foreign Key Table의 레코드 간 대응 관계를 설정합니다.'),
      table(['Cardinality', '의미 (Check Table : Foreign Key Table)'], [
        ['1 : 1', '일대일 대응 (모든 값이 정확히 1건과 대응)'],
        ['1 : N', '모든 값이 다수 값(1건 이상)을 가짐'],
        ['1 : C', '일부 값이 일대일 대응됨 (0건 또는 1건)'],
        ['1 : CN', '일부 값이 다수 값을 가짐 (0건, 1건, 또는 여러 건)']
      ]),
      {
        type: 'practice',
        title: 'SE11에서 Foreign Key 설정 방법',
        steps: [
          { step: '1', action: 'Change Table (Fields 탭) 열기', detail: 'SE11에서 대상 테이블을 Change 모드로 열고 Fields 탭으로 이동합니다.' },
          { step: '2', action: '컬럼 선택 후 키 아이콘(Foreign Keys) 클릭', detail: '외래키 검사를 연결할 필드에 커서를 두고 상단 툴바의 Foreign Keys(열쇠 아이콘)를 누릅니다.' },
          { step: '3', action: 'Check Table 입력 후 Create Proposal', detail: 'Check Table 이름을 기입하고 Create Proposal을 눌러 필드 매핑 제안을 생성합니다. (Domain → Value Range에 Value Table을 미리 등록해 두면(예: ZMAJOR_F##) 자동으로 제안됩니다.)' },
          { step: '4', action: '필드 유형·Cardinality 선택 후 Copy', detail: 'Foreign Key Field Type(Key 필드인지, Key 필드가 아닌 Non-key field / Function field인지)과 Cardinality(1:1, 1:N, 1:C, 1:CN)를 선택한 뒤 Copy하고 Activate합니다.' }
        ]
      }),
    section('Text Table과 Where-Used List', text(
      'Text Table은 본체 테이블의 코드 값에 대해 다국어 설명 텍스트를 따로 보관하는 **언어전환용 테이블**입니다. 본체 테이블에 데이터를 입력하거나 조회할 때 Text Table에 선언한 설명 필드가 함께 디스플레이되며, 입력된 텍스트의 언어 코드는 `LANGU`(Data Element: `SPRAS`) 필드에 저장됩니다.'),
      {
        type: 'practice',
        title: 'SE11에서 Text Table 생성 방법',
        steps: [
          { step: '1', action: 'SE11에서 Text Table 생성', detail: 'SE11에서 Database Table을 새로 생성합니다(관례상 본체 테이블명 뒤에 T를 붙인 이름 사용).' },
          { step: '2', action: '본체 테이블의 Key Field만 그대로 복사', detail: '연결할 본체 테이블의 Key Field(예: MANDT + 코드 키 필드)를 동일하게 선언합니다.' },
          { step: '3', action: 'LANGU(SPRAS) 및 텍스트 필드 추가', detail: 'Key Field에 언어 필드 LANGU(Data Element: SPRAS)를 추가하고, 언어별 설명을 담을 텍스트 필드를 일반 필드로 추가합니다.' },
          { step: '4', action: 'Foreign Key 설정', detail: '본체 코드(Key) 필드에 Foreign Key를 연결할 때 Foreign Key Field Type 라디오 버튼을 Key fields of a text table로 설정합니다. LANGU 필드는 본체 테이블 키가 아니므로 본체 Foreign Key 매핑 대상에서 제외하거나 T002 언어 테이블 참조 시 Non-key-fields/candidates(필기의 non-key 필드)로 설정합니다.' }
        ]
      },
      {
        type: 'callout', style: 'tip', title: 'Domain 변경 전 Where-Used List 확인',
        body: '특정 `Domain`(또는 `Data Element`·테이블)이 시스템의 어떤 객체에서 사용되고 있는지 확인하려면 `SE11` 툴바의 **`Where-Used List`**(단축키 `Ctrl + Shift + F3`)를 사용합니다. 특히 Domain 길이나 타입을 변경하기 전에 영향 범위를 미리 파악하는 데 필수입니다.'
      },
      code('Text Table(T005T)과 sy-langu로 언어별 국가명 조회', `REPORT zabap_f##_##.

PARAMETERS p_carr TYPE spfli-carrid DEFAULT 'LH'.

" SPFLI 출발 국가 코드(countryfr)에 대응하는 표준 Text Table(T005T)을
" 현재 로그온 언어(sy-langu) 기준으로 LEFT OUTER JOIN 조회
SELECT a~carrid,
       a~connid,
       a~countryfr,
       t~landx AS country_name,
       a~cityfrom,
       a~cityto
  FROM spfli AS a
  LEFT OUTER JOIN t005t AS t
    ON t~land1 = a~countryfr
   AND t~spras = @sy-langu
  WHERE a~carrid = @p_carr
  ORDER BY a~connid
  INTO TABLE @DATA(gt_routes).

LOOP AT gt_routes INTO DATA(gs_route).
  WRITE: / gs_route-carrid, gs_route-connid,
           gs_route-countryfr, gs_route-country_name,
           gs_route-cityfrom, '->', gs_route-cityto.
ENDLOOP.`)),
    section('Table Changes — Table Conversion과 Database Utility(SE14)', text(
      '이미 데이터가 들어 있는 Transparent Table의 구조를 크게 바꾸면(예: Key 변경, Data Element의 Domain 길이 축소 등) SAP가 **Table Conversion**(필기의 `Table Coneversion` 철자 보완)을 수행합니다. 이때 SAP는 기존 데이터를 **`QCM`** 임시 테이블(`QCM<테이블명>`)로 피신시킨 뒤 새 구조의 테이블을 생성하고 데이터를 다시 옮겨 주며, 중간에 오류가 발생하면 **`SE14`(Database Utility)**에서 수습합니다.',
      '특히 `Data Element`가 참조하는 `Domain` 길이를 **축소**할 때 `SE11`에서 저장·활성화만 시도하면 오류가 발생하므로 Database Utility에서 DB 조정 작업을 함께 진행해야 합니다.'),
      {
        type: 'practice',
        title: 'Domain 축소·구조 변경 시 Database Utility(SE14) 반영 절차',
        steps: [
          { step: '1', action: 'SE11에서 Database Utility 열기', detail: '대상 테이블 화면 상단 메뉴 Utilities → Database Object → Database Utility를 선택하거나 T-Code SE14로 진입합니다.' },
          { step: '2', action: 'Save data 옵션 확인', detail: '기존 레코드를 유지하기 위해 라디오 버튼이 Save data로 선택되어 있는지 반드시 확인합니다.' },
          { step: '3', action: 'Activate and adjust database 실행', detail: 'Activate and adjust database 버튼을 눌러 Table Conversion과 DB 반영을 완료합니다.' }
        ]
      },
      {
        type: 'callout', style: 'warning', title: 'Delete Database Table · Delete data 절대 금지',
        body: 'SE14(Database Utility)에서 **`Delete Database Table`** 또는 **`Delete data`**를 선택하면 현재 로그온한 클라이언트뿐만 아니라 **모든 클라이언트(Client)의 데이터베이스 테이블과 데이터가 전부 삭제**됩니다. 운영·공용 실습 환경에서는 절대 선택하지 마세요.'
      }),
    section('Enhancement — Standard Table과 Append Structure', text(
      '고객사가 `Z`나 `Y`로 만든 자체 테이블이 아니라 **SAP의 Standard Table에 필드를 추가로 붙여 사용하고 싶을 때**(표준 필드 자체의 수정·삭제는 불가) **`Append Structure`**를 사용합니다.',
      '하나의 Standard Table에 Append Structure를 **N개 생성**할 수 있으며, 삭제가 필요할 때는 `SE11`에서 해당 Append Structure를 삭제합니다. 향후 SAP 업그레이드 시 표준 필드와 이름이 충돌하지 않도록 **추가하는 필드(컬럼) 이름은 반드시 `ZZ` 또는 `YY`로 시작**해야 하는 규칙(Rule)이 있습니다.'),
      {
        type: 'practice',
        title: 'SE11에서 Standard Table에 Append Structure 추가 방법',
        steps: [
          { step: '1', action: 'SE11에서 Standard Table 검색', detail: 'SE11에서 필드를 확장할 SAP Standard Table(예: SCARR, SPFLI 등)을 조회(Display)합니다.' },
          { step: '2', action: 'Append Structure 버튼 클릭', detail: '상단 툴바의 Append Structure 버튼을 눌러 고객용 Append Structure 이름(Z/Y 시작)을 생성합니다.' },
          { step: '3', action: 'ZZ/YY 컬럼 정의 및 활성화', detail: 'ZZ 또는 YY로 시작하는 필드명과 Component Type을 정의한 뒤 저장·Activate(Ctrl + F3)합니다.' }
        ]
      }),
    section('Views와 Maintenance View (SM30) · Dynamic Attachment', text(
      '11월 23일에 살펴본 SE11 View 4가지를 실제 생성 절차, **View별 Join 고정 규칙**, **`SM30` 기반 Maintenance View(Table Maintenance Generator)**, 그리고 원본 테이블 변경을 자동 반영하는 **`Dynamic Attachment`**까지 확장해 정리합니다.'),
      {
        type: 'practice',
        title: 'SE11에서 View 만드는 법',
        steps: [
          { step: '1', action: 'SE11에서 View 이름 작성 후 생성', detail: 'View 라디오 버튼을 선택하고 이름을 입력한 뒤 Create를 눌러 4가지 View 유형 중 하나를 선택합니다.' },
          { step: '2', action: 'Table/Join Conditions에서 테이블 입력 후 Relationships 선택', detail: '기준 테이블을 적고 Relationships 버튼을 누르면 테이블 간 Foreign Key를 바탕으로 Join Condition이 자동 처리됩니다.' },
          { step: '3', action: 'View Fields 탭에서 Display할 필드 선택', detail: 'View Fields 탭의 Table fields 버튼으로 각 테이블에서 표시할 컬럼을 선택합니다.' },
          { step: '4', action: 'Selection Conditions 지정', detail: 'Selection Conditions 탭에서 View에 표시할 행의 필터 조건을 선택·입력할 수 있습니다.' }
        ]
      },
      table(['View 4가지 유형', 'Join 고정 규칙', '목적과 특징 (필기 3번 Help view 보완)'], [
        ['1. Database view', '`INNER JOIN` 고정', '여러 개의 테이블에서 컬럼을 골라 Join해 Display 가능 (조인 조건에 매치되는 데이터만 조회)'],
        ['2. Projection view', '단일 테이블 (Join 없음)', '하나의 테이블 안에서만 컬럼을 골라 Display 가능하며, 간단한 `Selection Condition`을 걸어 필요한 행만 추출 가능'],
        ['3. Help view', '`LEFT OUTER JOIN` 고정', 'Search Help의 데이터 조회(Selection Method)에서 기준 테이블 행을 유지하는 Outer Join이 필요할 때 사용'],
        ['4. Maintenance view', '`LEFT OUTER JOIN` 고정', '아주 관련이 깊은 테이블들을 모아 `SM30`에서 유지보수하는 용도(실무에서는 보통 여러 테이블보다 **딱 하나의 테이블**을 대상으로 유지보수하는 경우도 많음)']
      ]),
      {
        type: 'compare',
        items: [
          {
            tag: 'Database view 고정',
            title: 'Inner Join',
            points: [
              'Join Condition에 양쪽 모두 매치되는 데이터만 결과에 표시',
              'Database view에서는 항상 Inner Join으로 동작'
            ]
          },
          {
            tag: 'Help view · Maintenance view 고정',
            title: 'Outer Join (LEFT OUTER JOIN)',
            points: [
              'Join Condition에 매치되는 데이터뿐만 아니라 기준 테이블(왼쪽 테이블)의 행까지 모두 표시',
              'Help view와 Maintenance view는 LEFT OUTER JOIN으로 고정'
            ]
          }
        ]
      },
      {
        type: 'practice',
        title: 'Maintenance View · Table Maintenance Generator 설정 (SM30)',
        steps: [
          { step: '1', action: 'Utilities → Table Maintenance Generator 실행', detail: 'Maintenance View 또는 Customer Table의 SE11 화면에서 Utilities → Table Maintenance Generator로 진입합니다. Maintenance Dialog는 최대 2개 화면(Overview / Detail view)까지 구성할 수 있습니다.' },
          { step: '2', action: 'Authorization Group 및 Maintenance 전용 Function Group 지정', detail: 'Authorization Group은 보통 &NC&(권한 그룹 미지정)로 설정하고, Maintenance Dialog 생성을 위해 일반 로직과 분리된 Maintenance 전용 Function Group을 지정합니다.' },
          { step: '3', action: 'Maint. Screen No. 지정 (Find Scr. Number(s) 활용)', detail: '스크린 번호는 1~9999 중 지정하되 1000~1010은 영구결번이라 사용할 수 없습니다. Find Scr. Number(s)로 세 가지 옵션 중 하나를 선택할 수 있으며, 나중에 스크린을 끼워 넣기 편하도록 보통 한 자리 수는 잘 사용하지 않습니다.' },
          { step: '4', action: 'SM30에서 Overview · Detail view 유지보수', detail: '생성이 끝나면 SM30에서 데이터를 관리합니다. 2-step 구성 시 Overview 목록에서 행을 더블클릭해 Detail view로 접근(access)합니다.' }
        ]
      },
      {
        type: 'compare',
        items: [
          {
            tag: 'Maintenance View 장점',
            title: '간편한 유지보수',
            points: [
              '별도 화면 코딩 없이 SM30에서 간단한 데이터 조회·입력·수정을 빠르게 처리',
              '오직 Customer Table(Z/Y)만 Maintenance View / SM30으로 관리 (Standard Table은 SAP 표준 방식으로 따로 관리)'
            ]
          },
          {
            tag: 'Maintenance View 단점 · 제약',
            title: '동시 수정 Lock · 비동기 업데이트',
            points: [
              '기본적으로 비동기화 업데이트 방식으로 동작',
              '테이블 단위 Lock이 걸려 다른 사용자가 수정 중이면 동시에 수정할 수 없음'
            ]
          }
        ]
      },
      text('**Dynamic Attachment**', '원본 테이블의 필드가 추가·수정돼도 참조된 View에 자동으로 반영되도록 하는 설정입니다. `View Fields` 탭에서 아래 표처럼 `*`를 지정하면 해당 테이블의 모든 필드가 동적으로 연결됩니다.'),
      table(['View Field', 'Table', 'Field'], [
        ['`*`', '테이블 이름', '`*`']
      ]),
      {
        type: 'callout', style: 'point', title: 'Dynamic Attachment에서 - 제외와 중복 필드 에러 주의',
        body: '전체 포함(`*`) 상태에서 원하지 않는 특정 필드는 `View Field` 열에 **`-`**를 입력해 제외할 수 있습니다. 특히 조인된 여러 테이블에 **이름이 같은 필드**가 있을 때 중복 필드를 `-`로 빼주지 않으면 View 활성화 시 **에러**가 발생합니다.'
      })
  ], '11/23 · 11/24 · 11/25', [
    ['`ZABAP_F##_18`', 'ABAP Flat(Simple & Nested) Structure'],
    ['`ZABAP_F##_19`', 'ABAP Deep Structure'],
    ['`ZBC430S_DATA_ELEMENTS`', 'Program SAPBC430S_DATA_ELEMENTS'],
    ['`ZBC430S_F##_STRUCT_NESTED`', 'Report SAPBC430S_STRUCT_NESTED'],
    ['`ZBC430S_F##_STRUCT_DEEP`', 'Report SAPBC430S_STRUCT_DEEP (Deep Structure)']
  ]);

  // Assemble Unit 1–13 documents from the curated raw sections + textbook Exercise guides.
  const normalizeLegacyLinks = obj => JSON.parse(
    JSON.stringify(obj)
      .replaceAll('[[abap-types|자료형과 초기값]]', '[[unit-03|Unit 3 · ABAP 기본 언어 요소]]')
      .replaceAll('[[abap-types|Structure]]', '[[unit-05|Unit 5 · Structure]]')
      .replaceAll('[[abap-loops|sy-subrc]]', '[[unit-03|sy-subrc]]')
      .replaceAll('[[abap-modularization|프로그램 모듈화]]', '[[unit-04|Unit 4 · ABAP 모듈화 기법]]')
      .replaceAll('[[abap-data-report|Internal Table]]', '[[unit-05|Unit 5 · Internal Table]]')
      .replaceAll('[[abap-open-sql|Open SQL]]', '[[unit-06|BC400 Unit 6 · Open SQL]]')
      .replaceAll('[[abap-dictionary|ABAP Dictionary]]', '[[bc430-01|BC430 · ABAP Dictionary]]')
  );

  const take = (rawId, title, tab, badge, page) => {
    const found = raw[rawId]?.sections.find(s => s.title === title);
    if (!found) throw new Error(`Missing raw section: ${rawId}/${title}`);
    return { ...normalizeLegacyLinks(found), tab, badge, page };
  };

  const exSec = (tab, badge, page, title, ...blocks) => ({ tab, badge, page, kind: 'exercise', title, blocks });
  const pendingSec = (tab, badge, page, title, note) => ({
    tab, badge, page, title,
    pendingNote: note || `준비 중 · 교재 p. ${page} 내용을 수업 진도에 맞춰 정리할 예정입니다.`,
    blocks: []
  });

  function putCourseUnit(course, idPrefix, categoryId, stepPrefix, num, koTitle, enTitle, page, summary, aliases, sectionTabs, sections, dates = '', programs = []) {
    const id = `${idPrefix}-${String(num).padStart(2, '0')}`;
    const lessonCount = sectionTabs
      .filter(t => t.kind === 'lesson')
      .reduce((sum, t) => {
        const range = String(t.badge || '').match(/^L(\d+)[–-](\d+)$/);
        return sum + (range ? Number(range[2]) - Number(range[1]) + 1 : 1);
      }, 0);
    const exTab = sectionTabs.find(t => t.kind === 'exercise');
    const fullSections = [...sections];
    if (dates) fullSections.push(source(dates, programs));
    docs[id] = {
      id,
      track: 'abap',
      course,
      categoryId,
      stepNum: `${stepPrefix}${String(num).padStart(2, '0')}`,
      unitNum: num,
      unitMeta: {
        course,
        number: num,
        page,
        koTitle,
        enTitle,
        lessonCount,
        exerciseRange: exTab?.badge || '',
        dates: dates || ''
      },
      title: `${course} Unit ${num} · ${koTitle}`,
      subtitle: `${enTitle} · ${course} 교재 p. ${page}${exTab?.badge ? ` · ${exTab.badge}` : ''}`,
      summary,
      aliases,
      lessonDates: dates ? dates.split(' · ').map(d => '2026-' + d.replace('/', '-')) : [],
      defaultTab: 'all',
      hideSectionNumbers: true,
      sectionTabs,
      sections: fullSections,
      tcodes: [],
      specs: {}
    };
  }
  const putUnit = (...args) => putCourseUnit('BC400', 'unit', 'abap-curriculum', 'U', ...args);
  const putBc430 = (...args) => putCourseUnit('BC430', 'bc430', 'abap-bc430', 'D', ...args);

  putUnit(1, 'ABAP 프로그램의 흐름', 'Flow of an ABAP Program', 1,
    'SAP GUI 요청이 Dispatcher와 Work Process를 거쳐 처리되는 아키텍처 흐름과 ABAP Program 유형·Include 저장소 객체를 정리합니다.',
    ['SAP 시스템 구조', 'Dispatcher', 'Work Process', '워크 프로세스', 'Message Server', 'Gateway', 'ICM', 'SAP GUI', 'Program 종류와 Include', 'Include Program', 'Include 프로그램', '리포트 프로그램', 'Module Pool'],
    [
      { id: 'l1', kind: 'lesson', badge: 'L1', page: 'p. 3', label: 'ABAP 프로그램 처리 과정', desc: 'Lesson: Describing the Processing of ABAP Programs (p. 3) — SAP 요청 처리 흐름, Work Process, 통신 구성 요소, Program 종류와 Include를 정리합니다.' }
    ],
    [
      take('sap-architecture', '요청 처리 흐름', 'l1', 'Lesson 1', 'p. 3'),
      take('sap-architecture', 'Work Process와 잠금', 'l1', 'Lesson 1', 'p. 3'),
      take('sap-architecture', '통신 구성 요소', 'l1', 'Lesson 1', 'p. 3'),
      take('abap-program-types', 'Program과 저장소 객체', 'l1', 'Lesson 1', 'p. 3'),
      take('abap-program-types', 'Include와 모듈화', 'l1', 'Lesson 1', 'p. 3')
    ],
    '11/11 · 11/17'
  );

  putUnit(2, 'ABAP Workbench', 'ABAP Workbench', 19,
    'ABAP Workbench(SE80·SE38·SE09·SE93) 탐색, Package와 Change Request 관리, Program 기본 작성·전송, 트랜잭션 생성과 Exercise 1–3 실습 가이드를 정리합니다.',
    ['개발 객체와 전송 관리', 'ABAP Workbench', '패키지', 'Package', 'Change Request', 'CTS', 'Transport Request', 'Workbench Request', 'Customizing Request', 'Transport'],
    [
      { id: 'l1', kind: 'lesson', badge: 'L1', page: 'p. 21', label: 'Workbench 소개', desc: 'Lesson: Introducing the ABAP Workbench (p. 21) — DEV·QAS·PRD 시스템 구성과 SE80 Object Navigator 활용을 정리합니다.' },
      { id: 'l2', kind: 'lesson', badge: 'L2', page: 'p. 30', label: '개발 프로젝트 구성', desc: 'Lesson: Organizing ABAP Development Projects (p. 30) — Package와 Change Request·Task 관리 원칙을 정리합니다.' },
      { id: 'l3', kind: 'lesson', badge: 'L3', page: 'p. 40', label: 'ABAP 프로그램 개발', desc: 'Lesson: Developing ABAP Programs (p. 40) — ABAP 문장·주석 기초와 작성 → 검사 → 활성화 → 전송 흐름을 정리합니다.' },
      { id: 'l4', kind: 'lesson', badge: 'L4', page: 'p. 55', label: '프로젝트 마무리 · T-Code', desc: 'Lesson: Finalizing ABAP Development Projects (p. 55) — SE93 Transaction Code 생성과 릴리스 절차를 정리합니다.' },
      { id: 'ex', kind: 'exercise', badge: 'Ex 1–3', page: 'p. 37–59', label: 'Exercise 1–3', desc: '교재 Exercise 1(Package 생성), Exercise 2(간단한 Program 개발), Exercise 3(Transaction 생성) 실습 체크포인트를 정리합니다.' }
    ],
    [
      take('abap-development', '개발·품질·운영 시스템', 'l1', 'Lesson 1', 'p. 21'),
      take('abap-development', 'SE80에서 Program이 안 보일 때', 'l1', 'Lesson 1', 'p. 21'),
      take('abap-development', 'Package와 Change Request', 'l2', 'Lesson 2', 'p. 30'),
      take('abap-basics', '문장과 주석', 'l3', 'Lesson 3', 'p. 40'),
      take('abap-development', '작성에서 전송까지', 'l3', 'Lesson 3', 'p. 40'),
      take('abap-development', 'Transaction Code 생성', 'l4', 'Lesson 4', 'p. 55'),
      exSec('ex', 'Exercise 1', 'p. 37', 'Exercise 1: Create a Package',
        text('SE80(Object Navigator)에서 본인 실습용 Package(`ZBC400_F##`)를 생성하고 Workbench Change Request에 연결하는 실습입니다.'),
        { type: 'practice', title: 'Exercise 1 핵심 확인 포인트', steps: [
          { step: '1', action: 'SE80에서 Package 선택 후 이름 입력', detail: 'Repository Browser에서 Package를 고르고 ZBC400_F##(본인 번호)을 입력해 생성합니다.' },
          { step: '2', action: 'Transport Layer · Change Request 확인', detail: '로컬 $TMP와 전송 대상 Package의 차이를 구분하고, Workbench Request와 본인 Task에 기록되는지 확인합니다.' }
        ] }),
      exSec('ex', 'Exercise 2', 'p. 51', 'Exercise 2: Develop a Simple ABAP Program',
        text('SE80/SE38에서 첫 실행 가능 Program(`ZBC400_F##_HELLO` · `ZABAP_F##_01` · `ZABAP_F##_02`)을 만들고 저장 → 문법 검사(`Ctrl + F2`) → 활성화(`Ctrl + F3`) → 실행(`F8`) 흐름을 익힙니다.'),
        table(['연계 실습 Program', '핵심 연습 포인트'], [
          ['`ZBC400_F##_HELLO`', '교재 Exercise 2: 첫 실행 가능 Program 작성·활성화·실행'],
          ['`ZABAP_F##_01` · `ZABAP_F##_02`', '`WRITE` 출력, 마침표(`.`), 주석(`*`, `"`), 체인 문법(`:`)']
        ])),
      exSec('ex', 'Exercise 3', 'p. 59', 'Exercise 3: Create a Transaction',
        text('SE93(Transaction Maintenance)에서 작성한 Report Program을 실행하는 Report Transaction을 생성하고 SAP GUI 명령 필드에서 직접 호출해 봅니다.'),
        { type: 'callout', style: 'tip', title: 'SE93 유형 선택 주의', body: '실행 가능 Report Program에는 **Program and selection screen (report transaction)** 유형을 선택합니다. 생성 후 명령 필드(`/nZ...`)로 바로 실행되는지 확인하세요.' })
    ],
    '11/11 · 11/12 · 11/20',
    [
      ['`ZABAP_F##_01`', 'ABAP Write statement'],
      ['`ZABAP_F##_02`', 'ABAP Syntax'],
      ['`ZBC400_F##_HELLO`', 'Program ZBC400_F##_HELLO (Exercise 2)']
    ]
  );

  putUnit(3, 'ABAP 기본 언어 요소', 'Basic ABAP Language Elements', 73,
    '기본 데이터 객체(자료형·길이·초기값·Text Symbol), 조건·반복문·시스템 필드·Message Class·예외, ABAP Debugger와 Exercise 4–5 실습 가이드를 정리합니다.',
    ['ABAP 기초', '자료형과 초기값', '반복문과 시스템 필드', '디버깅과 메시지', 'DATA', 'PARAMETERS', 'CLEAR', 'TYPE', 'LIKE', '자료형', 'DATA TYPE', '초기값', 'DECFLOAT16', 'DECFLOAT34', 'XSTRING', 'DO', 'WHILE', 'sy-index', 'sy-tabix', 'sy-subrc', 'sy-dbcnt', 'sy-uname', '시스템 필드', '디버깅', 'Debugger', '중단점', 'Text Symbol', 'Text Element', 'Selection Texts', 'Message Class', 'MESSAGE-ID', '메시지 클래스', 'MESSAGE'],
    [
      { id: 'l1', kind: 'lesson', badge: 'L1', page: 'p. 75', label: '기본 데이터 객체', desc: 'Lesson: Defining Elementary Data Objects (p. 75) — 변수 선언, 기본/길이 지정 자료형, 초기값, Text Symbol을 정리합니다.' },
      { id: 'l2', kind: 'lesson', badge: 'L2', page: 'p. 87', label: '기본 ABAP 문장', desc: 'Lesson: Using Basic ABAP Statements (p. 87) — 입출력, 반복문(DO/WHILE), 시스템 필드, Message Class(SE91 · REPORT MESSAGE-ID)와 예외를 정리합니다.' },
      { id: 'l3', kind: 'lesson', badge: 'L3', page: 'p. 104', label: 'ABAP Debugger 분석', desc: 'Lesson: Analyzing Programs with the ABAP Debugger (p. 104) — 중단점 설정, F5 단계 실행, ST22 덤프 확인을 정리합니다.' },
      { id: 'ex', kind: 'exercise', badge: 'Ex 4–5', page: 'p. 97–113', label: 'Exercise 4–5', desc: '교재 Exercise 4(기본 ABAP 문장 활용)와 Exercise 5(Debugger 단계 실행) 실습 체크포인트를 정리합니다.' }
    ],
    [
      take('abap-basics', '변수 선언과 대입', 'l1', 'Lesson 1', 'p. 75'),
      take('abap-types', '주요 기본 타입', 'l1', 'Lesson 1', 'p. 75'),
      take('abap-types', '길이를 지정하는 타입', 'l1', 'Lesson 1', 'p. 75'),
      take('abap-types', '초기값 확인', 'l1', 'Lesson 1', 'p. 75'),
      take('abap-types', 'Text Symbol과 번역', 'l1', 'Lesson 1', 'p. 75'),
      take('abap-basics', '입력과 출력', 'l2', 'Lesson 2', 'p. 87'),
      take('abap-loops', '반복문 비교', 'l2', 'Lesson 2', 'p. 87'),
      take('abap-loops', 'CONTINUE와 EXIT', 'l2', 'Lesson 2', 'p. 87'),
      take('abap-loops', '자주 보는 시스템 필드', 'l2', 'Lesson 2', 'p. 87'),
      take('abap-debug-messages', '메시지 유형', 'l2', 'Lesson 2', 'p. 87'),
      take('abap-debug-messages', '직접 문구와 Message Class (SE91 · REPORT 선언)', 'l2', 'Lesson 2', 'p. 87'),
      take('abap-debug-messages', '예외와 반환 코드', 'l2', 'Lesson 2', 'p. 87'),
      take('abap-debug-messages', '디버깅 순서', 'l3', 'Lesson 3', 'p. 104'),
      exSec('ex', 'Exercise 4', 'p. 97', 'Exercise 4: Use Basic ABAP Statements',
        text('산술 연산, 조건 분기(`IF`/`CASE`), 반복문(`DO`/`WHILE`), `sy-subrc` 반환 코드 확인을 실습합니다.'),
        table(['연계 실습 Program', '핵심 연습 포인트'], [
          ['`ZBC400_F##_COMPUTE` · `ZABAP_F##_04`', '기본 사칙연산, `DIV`/`MOD`, 0으로 나누기 예외 및 결과 출력'],
          ['`ZABAP_F##_03` · `ZABAP_F##_05`', '기본 자료형·초기값(`CLEAR`, `IS INITIAL`)과 `IF`/`ELSEIF` 조건 분기'],
          ['`ZBC400_F##_LOOP` · `ZABAP_F##_06~07`', '`DO`/`WHILE`/`CONTINUE`/`EXIT`, `sy-index`, `sy-subrc` 확인']
        ])),
      exSec('ex', 'Exercise 5', 'p. 113', 'Exercise 5: Debug Statements on Elementary Data Objects',
        text('작성한 Program에 중단점(Session Breakpoint)을 설정하고 ABAP 디버거에서 한 단계씩 실행하며 변수와 `sy-*` 시스템 필드의 변화를 관찰합니다.'),
        { type: 'practice', title: 'Exercise 5 디버깅 점검 체크리스트', steps: [
          { step: '1', action: '중단점 설정 후 실행(F8)', detail: 'SE38/SE80 편집기 왼쪽 회색 여백을 클릭해 Session Breakpoint를 찍고 F8로 실행합니다.' },
          { step: '2', action: 'F5(Single Step)로 변수 값 추적', detail: '변수를 더블클릭해 Variables 탭에 등록하고 대입·CLEAR·반복문마다 값과 sy-index·sy-subrc가 어떻게 바뀌는지 확인합니다.' }
        ] })
    ],
    '11/11 · 11/12 · 11/13 · 11/16 · 11/17',
    [
      ['`ZABAP_F##_03`', 'ABAP Data Type & Elementary Data Objects'],
      ['`ZABAP_F##_04`', 'ABAP Calculation'],
      ['`ZABAP_F##_05`', 'ABAP IF Conditional Statement'],
      ['`ZABAP_F##_06`', 'ABAP Loop Statement'],
      ['`ZABAP_F##_07`', 'ABAP sy-subrc System Field'],
      ['`ZBC400_F##_COMPUTE`', 'Program ZBC400_F##_COMPUTE (Exercise 4)'],
      ['`ZBC400_F##_LOOP`', 'Program ZBC400_F##_LOOP']
    ]
  );

  putUnit(4, 'ABAP 모듈화 기법', 'Modularization Techniques in ABAP', 125,
    'Subroutine(FORM/PERFORM), Function Group·Function Module(SE37), BAPI와 RFC, Global·Local Class(SE24)와 Exercise 6–12 실습 가이드를 정리합니다.',
    ['프로그램 모듈화', 'BAPI와 RFC', '클래스와 메서드', 'Subroutine', '서브루틴', 'FORM', 'PERFORM', 'Function Group', 'Function Module', '함수 모듈', 'BAPI', 'RFC', 'RETURN', 'Global Class', 'Local Class', 'Static Method', 'Instance Method', '글로벌 클래스', '로컬 클래스', '정적 메서드', '인스턴스 메서드', '참조 변수', 'TYPE REF TO'],
    [
      { id: 'l1', kind: 'lesson', badge: 'L1', page: 'p. 127', label: '모듈화 개요', desc: 'Lesson: Explaining Modularization (p. 127) — Subroutine·Function Module·Method 3가지 모듈화 방식을 비교합니다.' },
      { id: 'l2', kind: 'lesson', badge: 'L2', page: 'p. 134', label: 'Subroutine (FORM)', desc: 'Lesson: Defining and Calling Subroutines (p. 134) — USING/CHANGING과 VALUE(...) 값·참조 전달을 정리합니다.' },
      { id: 'l3', kind: 'lesson', badge: 'L3–4', page: 'p. 155 · 172', label: 'Function Module 호출·생성', desc: 'Lesson: Calling & Creating Function Modules (p. 155 · p. 172) — Function Group(SAPL/TOP/UXX)과 호출 방향을 정리합니다.' },
      { id: 'l5', kind: 'lesson', badge: 'L5', page: 'p. 187', label: 'BAPI와 RFC', desc: 'Lesson: Describing Business Application Programming Interfaces (p. 187) — RFC와 BAPI의 관계 및 RETURN 오류 처리를 정리합니다.' },
      { id: 'l6', kind: 'lesson', badge: 'L6–7', page: 'p. 193 · 212', label: 'Global Class · Method', desc: 'Lesson: Calling & Creating Global Classes and Static Methods (p. 193 · p. 212) — Static(`=>`)·Instance(`->`) 호출과 SE24 Class를 정리합니다.' },
      { id: 'l8', kind: 'lesson', badge: 'L8', page: 'p. 225', label: 'Local Class', desc: 'Lesson: Using Local Classes (p. 225) — DEFINITION/IMPLEMENTATION과 PUBLIC·PROTECTED·PRIVATE 접근 제어를 정리합니다.' },
      { id: 'ex', kind: 'exercise', badge: 'Ex 6–12', page: 'p. 149–219', label: 'Exercise 6–12', desc: '교재 Exercise 6(Subroutine), Exercise 7–9(Function Group·Function Module), Exercise 10–12(Global Class·Static Method) 실습 가이드를 정리합니다.' }
    ],
    [
      take('abap-modularization', '모듈화 방식', 'l1', 'Lesson 1', 'p. 127'),
      take('abap-modularization', 'Subroutine 매개변수', 'l2', 'Lesson 2', 'p. 134'),
      take('abap-modularization', 'Function Group과 Function Module', 'l3', 'Lesson 3–4', 'p. 155 · 172'),
      take('abap-modularization', '호출자와 함수의 방향', 'l3', 'Lesson 3–4', 'p. 155 · 172'),
      take('abap-bapi', 'BAPI와 RFC의 관계', 'l5', 'Lesson 5', 'p. 187'),
      take('abap-bapi', '입출력과 오류 처리', 'l5', 'Lesson 5', 'p. 187'),
      take('abap-objects', 'Global Class와 Local Class', 'l6', 'Lesson 6–7', 'p. 193 · 212'),
      take('abap-objects', 'Static 호출과 Instance 호출', 'l6', 'Lesson 6–7', 'p. 193 · 212'),
      take('abap-objects', 'Local Class의 정의와 구현', 'l8', 'Lesson 8', 'p. 225'),
      exSec('ex', 'Exercise 6', 'p. 149', 'Exercise 6: Implement Subroutines',
        text('`FORM ... ENDFORM`과 `PERFORM`으로 계산 로직을 분리하고 `USING VALUE(...)` vs `CHANGING` 전달 방식 차이를 확인합니다.'),
        table(['연계 실습 Program', '핵심 연습 포인트'], [
          ['`ZBC400_F##_SUBROUTINE`', '교재 Exercise 6: Subroutine 정의·호출 및 매개변수 매핑'],
          ['`ZABAP_F##_08` · `ZABAP_F##_09`', 'Subroutine 생성과 값 전달 vs 참조 전달 비교']
        ])),
      exSec('ex', 'Exercise 7–9', 'p. 165 · 175 · 179', 'Exercise 7–9: Call · Create Function Group & Function Module',
        text('SE37에서 기존 Function Module을 호출(Ex 7)한 뒤, 직접 Function Group(Ex 8)과 Function Module(Ex 9)을 생성·활성화해 Report에서 `CALL FUNCTION`으로 호출합니다.'),
        table(['Exercise / Program', '핵심 확인 포인트'], [
          ['Ex 7 (`ZBC400_F##_FUNCTION_MODULE`, `ZABAP_F##_10`)', 'SE37 인터페이스(`IMPORTING`↔`EXPORTING`) 방향 확인 및 `EXCEPTIONS` `sy-subrc` 처리'],
          ['Ex 8–9 (`ZBC400_F##_FUNCTION_MODULE_2`)', 'Function Group 생성(`SAPL...`, `TOP`/`UXX` Include 활성화) 후 직접 만든 Function Module 호출·테스트']
        ])),
      exSec('ex', 'Exercise 10–12', 'p. 205 · 217 · 219', 'Exercise 10–12: Global Class & Static Method',
        text('SE24 Global Class의 Static Method를 호출(Ex 10)하고, 직접 Simple Global Class(Ex 11)와 Static Method(Ex 12)를 구현·활성화합니다.'),
        table(['Exercise / Program', '핵심 확인 포인트'], [
          ['Ex 10 (`ZBC400_F##_GLOBAL_CLASS_1`, `ZABAP_F##_11`)', 'Static Method(`Class=>Method( )`)와 Instance Method(`참조->Method( )`) 구분'],
          ['Ex 11–12 (`ZBC400_F##_GLOBAL_CLASS_2`, `ZABAP_F##_12`)', 'SE24 Global Class 생성·`PUBLIC`/`PRIVATE` 가시성 설정과 Local Class 구현 비교']
        ]))
    ],
    '11/16 · 11/17 · 11/18',
    [
      ['`ZABAP_F##_08`', 'ABAP Subroutine'],
      ['`ZABAP_F##_09`', 'ABAP Subroutine Parameters'],
      ['`ZABAP_F##_10`', 'ABAP Function Module'],
      ['`ZABAP_F##_11`', 'ABAP Call Class Method'],
      ['`ZABAP_F##_12`', 'ABAP Local Class'],
      ['`ZBC400_F##_SUBROUTINE`', 'Program ZBC400_F##_SUBROUTINE (Exercise 6)'],
      ['`ZBC400_F##_FUNCTION_MODULE`', 'Function Module 실습 1 (Exercise 7)'],
      ['`ZBC400_F##_FUNCTION_MODULE_2`', 'Function Module 실습 2 (Exercise 9)'],
      ['`ZBC400_F##_GLOBAL_CLASS_1`', 'Global Class 실습 1 (Exercise 10)'],
      ['`ZBC400_F##_GLOBAL_CLASS_2`', 'Global Class 실습 2 (Exercise 11–12)']
    ]
  );

  putUnit(5, '복합 데이터 객체', 'Complex Data Objects', 239,
    'Structure(MOVE-CORRESPONDING)와 Internal Table(STANDARD · SORTED · HASHED, 선언 10가지, 행 조작, 정렬, CLEAR/Header Line) 및 Exercise 13–14를 정리합니다.',
    ['복합 데이터 객체', '구조체', 'Structure', 'Work Area', 'MOVE-CORRESPONDING', '내부 테이블', 'Internal Table', 'STANDARD TABLE', 'SORTED TABLE', 'HASHED TABLE', 'Header Line', 'OCCURS'],
    [
      { id: 'l1', kind: 'lesson', badge: 'L1', page: 'p. 240', label: 'Structure', desc: 'Lesson: Using Structured Data Objects (p. 240) — 로컬·글로벌 Structure Type 선언과 MOVE-CORRESPONDING을 정리합니다.' },
      { id: 'l2', kind: 'lesson', badge: 'L2', page: 'p. 253', label: 'Internal Table', desc: 'Lesson: Using Internal Tables (p. 253) — 3가지 테이블 종류, TYPE/LIKE 10가지 선언, CRUD·SORT·CLEAR·Header Line을 정리합니다.' },
      { id: 'ex', kind: 'exercise', badge: 'Ex 13–14', page: 'p. 247 · 273', label: 'Exercise 13–14', desc: '교재 Exercise 13(Structure 활용)과 Exercise 14(Internal Table 활용) 실습 체크포인트를 정리합니다.' }
    ],
    [
      take('abap-types', 'Structure 선언과 컴포넌트', 'l1', 'Lesson 1', 'p. 240'),
      take('abap-types', 'Structure 간 MOVE-CORRESPONDING', 'l1', 'Lesson 1', 'p. 240'),
      take('abap-data-report', 'Internal Table의 종류와 접근', 'l2', 'Lesson 2', 'p. 253'),
      take('abap-data-report', 'Internal Table 타입과 변수 선언', 'l2', 'Lesson 2', 'p. 253'),
      take('abap-data-report', '행 추가·조회·수정·삭제', 'l2', 'Lesson 2', 'p. 253'),
      take('abap-data-report', 'Internal Table 정렬', 'l2', 'Lesson 2', 'p. 253'),
      take('abap-data-report', 'CLEAR·REFRESH·FREE', 'l2', 'Lesson 2', 'p. 253'),
      take('abap-data-report', 'Header Line과 OCCURS — 기존 코드 읽기', 'l2', 'Lesson 2', 'p. 253'),
      exSec('ex', 'Exercise 13', 'p. 247', 'Exercise 13: Use Structured Data Objects',
        text('로컬 Structure Type(`ts_`)과 글로벌 구조(`BC400_S_FLIGHT`)를 참조해 Structure Variable(`gs_`)를 선언하고 `MOVE-CORRESPONDING`으로 컴포넌트를 복사합니다.'),
        table(['연계 실습 Program', '핵심 연습 포인트'], [
          ['`ZBC400_F##_STRUCTURE` · `ZABAP_F##_13`', 'Structure 컴포넌트 접근(`gs_carrier-carrid`)과 `MOVE-CORRESPONDING` 필드명 매칭 확인']
        ])),
      exSec('ex', 'Exercise 14', 'p. 273', 'Exercise 14: Use Internal Tables',
        text('`STANDARD` · `SORTED` · `HASHED` Internal Table과 Work Area 선언을 비교하고 `APPEND`/`INSERT`/`READ TABLE`/`MODIFY`/`DELETE`/`SORT`를 실습합니다.'),
        table(['연계 실습 Program', '핵심 연습 포인트'], [
          ['`ZABAP_F##_14` · `ZABAP_F##_16`', 'Internal Table & Work Area 10가지 선언 방식(`TYPE`/`LIKE`, `TABLE OF`/`LINE OF`)과 CRUD'],
          ['`ZABAP_F##_15` · `ZBC430S_ITAB_SORTED`', 'Header Line(`itab` vs `itab[]`) 구분과 `SORTED TABLE` 자동 정렬·키 접근 확인']
        ]))
    ],
    '11/18',
    [
      ['`ZABAP_F##_13`', 'ABAP Structure Variable'],
      ['`ZABAP_F##_14`', 'ABAP Internal Table'],
      ['`ZABAP_F##_15`', 'ABAP Header Line'],
      ['`ZABAP_F##_16`', 'ABAP Internal table & Work area'],
      ['`ZABAP_F##_21`', 'ABAP No -'],
      ['`ZBC400_F##_STRUCTURE`', 'Program ZBC400_F##_STRUCTURE (Exercise 13)'],
      ['`ZBC430S_ITAB_SORTED`', 'Program SAPBC430S_ITAB_SORTED (Exercise 14 연계)']
    ]
  );

  putUnit(6, '데이터 모델링과 데이터 조회', 'Data Modeling and Data Retrieval', 283,
    'SAP 항공 데이터 모델과 Open SQL(단건·다건 조회, 조건·집계, JOIN·서브쿼리·FOR ALL ENTRIES, CUD·트랜잭션·구문법 규칙) 및 Exercise 15–19를 정리합니다. ABAP Dictionary 심화 전체는 BC430 Unit 1–9로 분리되어 있습니다.',
    ['Open SQL', 'ABAP SQL', 'SELECT SINGLE', 'CORRESPONDING FIELDS', 'APPENDING TABLE', 'GROUP BY', 'HAVING', 'FOR ALL ENTRIES', 'OUTER JOIN'],
    [
      { id: 'l1', kind: 'lesson', badge: 'L1', page: 'p. 285', label: '데이터 모델 개요', desc: 'Lesson: Explaining Data Models (p. 285) — SAP 항공 데이터 모델(SCARR·SPFLI·SFLIGHT·SBOOK·SCUSTOM)과 BC430 ABAP Dictionary 연계 목차를 안내합니다.' },
      { id: 'l2', kind: 'lesson', badge: 'L2', page: 'p. 301', label: '단건 DB 조회', desc: 'Lesson: Retrieving Single Database Records (p. 301) — Open SQL 구문법 기본 구조, 호스트 변수, SELECT SINGLE과 UP TO 1 ROWS를 정리합니다.' },
      { id: 'l3', kind: 'lesson', badge: 'L3', page: 'p. 315', label: '다건 DB 조회 · 집계', desc: 'Lesson: Retrieving Multiple Database Records (p. 315) — INTO TABLE, APPENDING, WHERE·NULL, DISTINCT·GROUP BY·HAVING과 0건 시 시스템 필드를 정리합니다.' },
      { id: 'l4', kind: 'lesson', badge: 'L4', page: 'p. 331', label: 'JOIN · CUD · 구문법 규칙', desc: 'Lesson: Describing Other Aspects of Database Access (p. 331) — JOIN, 서브쿼리·FOR ALL ENTRIES, DB 변경(CUD), 트랜잭션·성능·구문법(Classic Open SQL) 규칙을 정리합니다.' },
      { id: 'l5', kind: 'lesson', badge: 'L5', page: 'p. 342', pending: true, label: '권한 검사 (준비 중)', desc: 'Lesson: Implementing Authorization Checks (p. 342) — AUTHORITY-CHECK와 권한 객체 내용은 수업 진도에 맞춰 보강할 예정입니다.' },
      { id: 'ex', kind: 'exercise', badge: 'Ex 15–19', page: 'p. 295–349', label: 'Exercise 15–19', desc: '교재 Exercise 15(Transparent Table 분석), Exercise 16(단건 조회), Exercise 17–18(SELECT Loop · Array Fetch), Exercise 19(권한 체크 · 준비 중)를 정리합니다.' }
    ],
    [
      {
        tab: 'l1', badge: 'Lesson 1', page: 'p. 285', title: 'SAP 항공 데이터 모델과 BC430 ABAP Dictionary 연결',
        blocks: [
          text('BC400 Unit 6에서는 Open SQL로 조회할 데이터베이스 테이블 구조(SAP 항공 모델: `SCARR` → `SPFLI` → `SFLIGHT` → `SBOOK` / `SCUSTOM`)를 이해하고 단건·다건 조회 문법을 익힙니다.',
            'Domain, Data Element, Structure, Table Type, Transparent Table, Index, Table Buffer, Input Checks, Text Table, SE14 Table Conversion, Append Structure, Views/SM30 등 ABAP Dictionary 전 과정은 **BC430 교재(Unit 1–9)** 기준으로 전용 단원에 정리되어 있습니다.'),
          table(['BC430 단원', '핵심 주제', '바로가기'], [
            ['BC430 Unit 1–2', 'ABAP Dictionary 개요 · Domain · Data Element · Structure · Table Type', '[[bc430-01|BC430 Unit 1]] · [[bc430-02|BC430 Unit 2]]'],
            ['BC430 Unit 3–4', 'Transparent Table · Technical Settings · Index · Table Buffer', '[[bc430-03|BC430 Unit 3]] · [[bc430-04|BC430 Unit 4]]'],
            ['BC430 Unit 5–6', 'Input Checks(Fixed Values · Foreign Keys · Text Table) · 종속성(Where-Used List)', '[[bc430-05|BC430 Unit 5]] · [[bc430-06|BC430 Unit 6]]'],
            ['BC430 Unit 7–9', 'Table Conversion(SE14) · Append Structure · Views/SM30 · Search Helps', '[[bc430-07|BC430 Unit 7]] · [[bc430-08|BC430 Unit 8]] · [[bc430-09|BC430 Unit 9]]']
          ])
        ]
      },
      take('abap-open-sql', 'Open SQL과 Transparent Table', 'l2', 'Lesson 2', 'p. 301'),
      take('abap-open-sql', 'SELECT 기본 구조와 호스트 변수', 'l2', 'Lesson 2', 'p. 301'),
      take('abap-open-sql', '한 행 조회와 정렬된 첫 행', 'l2', 'Lesson 2', 'p. 301'),
      take('abap-open-sql', 'Work Area·Internal Table·CORRESPONDING', 'l3', 'Lesson 3', 'p. 315'),
      take('abap-open-sql', 'INTO TABLE과 APPENDING TABLE', 'l3', 'Lesson 3', 'p. 315'),
      take('abap-open-sql', 'WHERE 조건과 NULL', 'l3', 'Lesson 3', 'p. 315'),
      take('abap-open-sql', 'DISTINCT·집계·GROUP BY·HAVING', 'l3', 'Lesson 3', 'p. 315'),
      take('abap-open-sql', '조회 결과가 없을 때와 시스템 필드', 'l3', 'Lesson 3', 'p. 315'),
      take('abap-open-sql', 'JOIN과 ON·WHERE의 차이', 'l4', 'Lesson 4', 'p. 331'),
      take('abap-open-sql', '보완: 서브쿼리와 FOR ALL ENTRIES', 'l4', 'Lesson 4', 'p. 331'),
      take('abap-open-sql', 'INSERT·UPDATE·MODIFY·DELETE', 'l4', 'Lesson 4', 'p. 331'),
      take('abap-open-sql', '보완: 트랜잭션과 안전한 변경', 'l4', 'Lesson 4', 'p. 331'),
      take('abap-open-sql', '보완: 성능과 다음 문법', 'l4', 'Lesson 4', 'p. 331'),
      take('abap-open-sql', '구문법(Classic Open SQL) 작성 순서와 문법 오류 주의', 'l4', 'Lesson 4', 'p. 331'),
      pendingSec('l5', 'Lesson 5', 'p. 342', 'AUTHORITY-CHECK와 권한 검사 (준비 중)', '준비 중 · 교재 p. 342 (Implementing Authorization Checks) 수업 진도에 맞춰 정리할 예정입니다.'),
      exSec('ex', 'Exercise 15', 'p. 295', 'Exercise 15: Analyze Transparent Tables in the Data Dictionary',
        text('SE11에서 항공 모델 표준 테이블(`SCARR`, `SPFLI`, `SFLIGHT`, `SBOOK`)의 Key Field, Data Element, Domain, Foreign Key, Technical Settings를 분석합니다. 자세한 테이블 생성·설계는 [[bc430-03|BC430 Unit 3 · 데이터베이스 테이블]]에서 이어집니다.'),
        { type: 'callout', style: 'tip', title: 'SE11 분석 체크포인트', body: '`SCARR` → `SPFLI` → `SFLIGHT` → `SBOOK` 순으로 Primary Key(`MANDT`, `CARRID`, `CONNID`, `FLDATE`, `BOOKID`)가 어떻게 계층적으로 확장되는지 확인하세요.' }),
      exSec('ex', 'Exercise 16', 'p. 309', 'Exercise 16: Implement Single Record Access',
        text('Primary Key 전체 조건으로 `SELECT SINGLE`을 실행하고 직후 `IF sy-subrc = 0.`으로 조회 성공 여부를 판별합니다. 단건 조회 구문법 패턴은 [[abap-sql-guide|ABAP SQL 가이드]]의 구문법 `SELECT · INTO` 탭에서도 바로 복습할 수 있습니다.'),
        { type: 'callout', style: 'tip', title: '실습 확인 포인트', body: '조회 결과가 없을 때 기존 Work Area에 이전 값이 남지 않도록 조회 전 `CLEAR` 하거나 `sy-subrc` 분기 처리를 빠뜨리지 마세요.' }),
      exSec('ex', 'Exercise 17–18', 'p. 317 · 325', 'Exercise 17–18: SELECT Loop & Array Fetch',
        text('한 행씩 읽는 `SELECT ... ENDSELECT` 루프(Ex 17)와 Internal Table에 한 번에 담는 `INTO TABLE` Array Fetch(Ex 18)의 구조·성능 차이를 비교 실습합니다.'),
        table(['구분', '문법 형태', '실무 권장 여부'], [
          ['Ex 17: SELECT Loop', '`SELECT ... FROM ... INTO gs_row WHERE ... ENDSELECT.`', 'DB 커서를 열어 한 행씩 처리 — 대량·일반 목록 조회에는 비권장'],
          ['Ex 18: Array Fetch', '`SELECT ... FROM ... INTO TABLE gt_rows WHERE ...`', '한 번에 Internal Table로 수신 — 실무 기본 권장 패턴']
        ])),
      pendingSec('ex', 'Exercise 19', 'p. 349', 'Exercise 19: Implement an Authorization Check (준비 중)', '준비 중 · 교재 p. 349 권한 검사 실습은 Lesson 5 학습 후 정리할 예정입니다.')
    ],
    '11/19 · 11/20'
  );

  putUnit(7, 'Classic ABAP Reports', 'Classic ABAP Reports', 363,
    'Classic ABAP List(아이콘·컬럼 서식), Selection Screen(PARAMETERS · SELECT-OPTIONS), Report 이벤트 처리 순서와 Exercise 20–21 실습 가이드를 정리합니다.',
    ['데이터 처리와 리포트', 'Classic ABAP Report', 'Selection Screen', 'SELECT-OPTIONS', 'INITIALIZATION', 'AT SELECTION-SCREEN', 'START-OF-SELECTION', 'cl_demo_output'],
    [
      { id: 'l1', kind: 'lesson', badge: 'L1', page: 'p. 365', label: 'ABAP 리스트', desc: 'Lesson: Implementing ABAP Lists (p. 365) — 클래식 리스트 출력, ICON 테이블, BC400_RPS_REP_A 컬럼 서식을 정리합니다.' },
      { id: 'l2', kind: 'lesson', badge: 'L2', page: 'p. 370', label: 'Selection Screen', desc: 'Lesson: Implementing Selection Screens (p. 370) — PARAMETERS와 SELECT-OPTIONS(SIGN·OPTION·LOW·HIGH)를 정리합니다.' },
      { id: 'l3', kind: 'lesson', badge: 'L3', page: 'p. 386', label: 'Report 이벤트 흐름', desc: 'Lesson: Implementing Events of ABAP Reports (p. 386) — INITIALIZATION → AT SELECTION-SCREEN → START-OF-SELECTION 처리 순서를 정리합니다.' },
      { id: 'ex', kind: 'exercise', badge: 'Ex 20–21', page: 'p. 379 · 395', label: 'Exercise 20–21', desc: '교재 Exercise 20(Selection Screen · Classic List)과 Exercise 21(Report 이벤트 구현) 실습 가이드를 정리합니다.' }
    ],
    [
      take('abap-data-report', '리스트 아이콘과 컬럼 서식 참고', 'l1', 'Lesson 1', 'p. 365'),
      take('abap-data-report', 'Classic ABAP Report와 Selection Screen', 'l2', 'Lesson 2', 'p. 370'),
      take('abap-data-report', 'Report 처리 순서', 'l3', 'Lesson 3', 'p. 386'),
      exSec('ex', 'Exercise 20', 'p. 379', 'Exercise 20: Create a Selection Screen and a Classic ABAP List',
        text('`SELECT-OPTIONS`로 검색 조건을 받고 클래식 리스트에 아이콘·컬럼 서식을 적용해 출력합니다.'),
        table(['연계 실습 Program', '핵심 연습 포인트'], [
          ['`ZABAP_F##_17`', '`SELECT-OPTIONS` 선언(`FOR` 참조 변수)과 `WHERE ... IN` 조건 조회'],
          ['`ZBC400_F##_REP_A` · `BC400_RPS_REP_A`', 'Classic List 출력, `ICON` 테이블 아이콘 표시, 컬럼 색상·정렬 서식']
        ])),
      exSec('ex', 'Exercise 21', 'p. 395', 'Exercise 21: Implement Events of ABAP Reports',
        text('`INITIALIZATION`, `AT SELECTION-SCREEN`, `START-OF-SELECTION` 이벤트 블록으로 Report 흐름을 구조화합니다. 고객별 예약 건수 Report의 전체 설계 흐름은 [[abap-thinking-flow|ABAP 사고 흐름]]에서도 도식으로 볼 수 있습니다.'),
        table(['연계 실습 Program', '핵심 연습 포인트'], [
          ['`ZBC400_F##_REP_B`', '초기값 설정(`INITIALIZATION`), 입력 검증(`AT SELECTION-SCREEN` `so_carr[] IS INITIAL`), 메인 조회 분리']
        ]))
    ],
    '11/20 · 11/23',
    [
      ['`ZABAP_F##_17`', 'ABAP Select-Options'],
      ['`ZBC400_F##_REP_A`', 'Report with Select-Options & Classic List (Exercise 20)'],
      ['`ZBC400_F##_REP_B`', 'Report with Events & Classic List (Exercise 21)']
    ]
  );

  putUnit(8, 'Screens (Dynpro)', 'Screens', 405,
    'Screen Painter(SE51)를 이용한 Dynpro 화면 생성, 입출력 필드 구성, 화면과 ABAP Program 간 데이터 전송(PBO · PAI)과 Exercise 22–24를 다룹니다.',
    ['Dynpro', 'Screens'],
    [
      { id: 'l1', kind: 'lesson', badge: 'L1', page: 'p. 406', pending: true, label: '화면 생성', desc: 'Lesson: Creating Screens (p. 406) — 준비 중' },
      { id: 'l2', kind: 'lesson', badge: 'L2', page: 'p. 432', pending: true, label: '입출력 필드', desc: 'Lesson: Creating Input and Output Fields (p. 432) — 준비 중' },
      { id: 'l3', kind: 'lesson', badge: 'L3', page: 'p. 441', pending: true, label: '데이터 전송', desc: 'Lesson: Implementing Data Transport (p. 441) — 준비 중' },
      { id: 'ex', kind: 'exercise', badge: 'Ex 22–24', page: 'p. 425–449', pending: true, label: 'Exercise 22–24', desc: 'Exercise 22–24 — 준비 중' }
    ],
    [
      pendingSec('l1', 'Lesson 1', 'p. 406', 'Creating Screens (화면 생성)'),
      pendingSec('l2', 'Lesson 2', 'p. 432', 'Creating Input and Output Fields (입출력 필드)'),
      pendingSec('l3', 'Lesson 3', 'p. 441', 'Implementing Data Transport (데이터 전송)'),
      pendingSec('ex', 'Exercise 22', 'p. 425', 'Exercise 22: Create Screens'),
      pendingSec('ex', 'Exercise 23', 'p. 435', 'Exercise 23: Create Input and Output Fields on a Screen'),
      pendingSec('ex', 'Exercise 24', 'p. 449', 'Exercise 24: Implement Data Transport')
    ]
  );

  putUnit(9, 'SAP List Viewer (ALV)', 'SAP List Viewer', 459,
    'ABAP Report에서 Internal Table을 표 형태로 출력하고 정렬·필터·합계 등 표준 UI 기능을 제공하는 SAP List Viewer(ALV)와 Exercise 25–26을 다룹니다.',
    ['SAP List Viewer', 'ALV', 'CL_SALV_TABLE'],
    [
      { id: 'l1', kind: 'lesson', badge: 'L1', page: 'p. 460', pending: true, label: 'SAP List Viewer 활용', desc: 'Lesson: Using the SAP List Viewer (p. 460) — 준비 중' },
      { id: 'ex', kind: 'exercise', badge: 'Ex 25–26', page: 'p. 473 · 481', pending: true, label: 'Exercise 25–26', desc: 'Exercise 25–26 — 준비 중' }
    ],
    [
      pendingSec('l1', 'Lesson 1', 'p. 460', 'Using the SAP List Viewer (ALV 활용)'),
      pendingSec('ex', 'Exercise 25', 'p. 473', 'Exercise 25: Use SAP List Viewer in an ABAP Report'),
      pendingSec('ex', 'Exercise 26', 'p. 481', 'Exercise 26: Display an Internal Table with the SAP List Viewer'),
      section('참고 자료',
        table(['실습 Program (`SE80` · `ZBC400_F##`)', '내용'], [
          ['`ZABAP_F##_23`', 'ABAP ALV (`CL_SALV_TABLE`)']
        ])
      )
    ]
  );

  putUnit(10, 'Web Dynpro ABAP', 'Web Dynpro ABAP', 493,
    '웹 기반 SAP UI 프레임워크인 Web Dynpro ABAP의 구조, 뷰 간 네비게이션, 컨텍스트 데이터 전송과 Exercise 27–28을 다룹니다.',
    ['Web Dynpro ABAP'],
    [
      { id: 'l1', kind: 'lesson', badge: 'L1', page: 'p. 495', pending: true, label: 'Web Dynpro 개요', desc: 'Lesson: Describing Web Dynpro ABAP (p. 495) — 준비 중' },
      { id: 'l2', kind: 'lesson', badge: 'L2', page: 'p. 503', pending: true, label: '네비게이션 구현', desc: 'Lesson: Implementing Navigation in Web Dynpro (p. 503) — 준비 중' },
      { id: 'l3', kind: 'lesson', badge: 'L3', page: 'p. 522', pending: true, label: '데이터 전송 구현', desc: 'Lesson: Implementing Data Transport in Web Dynpro (p. 522) — 준비 중' },
      { id: 'ex', kind: 'exercise', badge: 'Ex 27–28', page: 'p. 515 · 531', pending: true, label: 'Exercise 27–28', desc: 'Exercise 27–28 — 준비 중' }
    ],
    [
      pendingSec('l1', 'Lesson 1', 'p. 495', 'Describing Web Dynpro ABAP (개요)'),
      pendingSec('l2', 'Lesson 2', 'p. 503', 'Implementing Navigation in Web Dynpro (네비게이션)'),
      pendingSec('l3', 'Lesson 3', 'p. 522', 'Implementing Data Transport in Web Dynpro (데이터 전송)'),
      pendingSec('ex', 'Exercise 27', 'p. 515', 'Exercise 27: Implement Navigation in Web Dynpro'),
      pendingSec('ex', 'Exercise 28', 'p. 531', 'Exercise 28: Implement Data Transport in Web Dynpro')
    ]
  );

  putUnit(11, 'Program Analysis Tools', 'Program Analysis Tools', 543,
    'Code Inspector(SCI) 등 정적 분석 도구를 활용해 ABAP 코드 품질·성능·보안 규칙을 점검하는 방법을 다룹니다.',
    ['Code Inspector'],
    [
      { id: 'l1', kind: 'lesson', badge: 'L1', page: 'p. 545', pending: true, label: 'Code Inspector 품질 개선', desc: 'Lesson: Improving the Quality of ABAP Code with the Code Inspector (p. 545) — 준비 중' }
    ],
    [
      pendingSec('l1', 'Lesson 1', 'p. 545', 'Improving the Quality of ABAP Code with the Code Inspector')
    ]
  );

  putUnit(12, 'ADT (Eclipse)', 'ABAP Development Tools for SAP NetWeaver', 555,
    'Eclipse 기반 ABAP Development Tools(ADT) 개요와 ABAP 프로젝트 생성·연결 방법을 다룹니다.',
    ['ABAP Development Tools', 'ADT'],
    [
      { id: 'l1', kind: 'lesson', badge: 'L1', page: 'p. 557', pending: true, label: 'ADT 개요', desc: 'Lesson: Describing ABAP Development Tools for SAP NetWeaver (p. 557) — 준비 중' },
      { id: 'l2', kind: 'lesson', badge: 'L2', page: 'p. 561', pending: true, label: 'Eclipse ABAP 프로젝트', desc: 'Lesson: Creating an ABAP Project in Eclipse (p. 561) — 준비 중' }
    ],
    [
      pendingSec('l1', 'Lesson 1', 'p. 557', 'Describing ABAP Development Tools for SAP NetWeaver'),
      pendingSec('l2', 'Lesson 2', 'p. 561', 'Creating an ABAP Project in Eclipse')
    ]
  );

  putUnit(13, 'SAP 표준 소프트웨어 조정', 'SAP Standard Software Adjustments', 569,
    'SAP Standard 소프트웨어를 원본 수정 없이 고객 요구사항에 맞게 확장(Enhancement · Append Structure 등)하는 원칙을 정리합니다.',
    ['SAP Standard Software Adjustments'],
    [
      { id: 'l1', kind: 'lesson', badge: 'L1', page: 'p. 571', label: 'SAP 표준 소프트웨어 조정', desc: 'Lesson: Adjusting the SAP Standard Software (p. 571) — 표준 테이블 확장(Append Structure)과 BC430 Unit 7 상세 절차를 연결합니다.' }
    ],
    [
      {
        tab: 'l1', badge: 'Lesson 1', page: 'p. 571', title: 'SAP 표준 소프트웨어 조정과 Table Enhancement 연계',
        blocks: [
          text('SAP Standard 객체는 업그레이드 시 덮어쓰기 및 지원 문제가 생기므로 직접 수정·삭제하지 않고 SAP가 제공하는 확장 기법(Enhancement)을 사용합니다.',
            'Standard Table에 고객사 전용 필드(`ZZ`/`YY` 접두어)를 추가하는 **Append Structure** 절차와 규칙은 [[bc430-07|BC430 Unit 7 · 테이블 변경과 확장]]에서 상세히 다루고 있습니다.')
        ]
      }
    ]
  );

  /* ===================== BC430 · ABAP Dictionary (Unit 1–9) ===================== */
  putBc430(1, 'ABAP Dictionary 개요', 'Introduction to the ABAP Dictionary', 1,
    'SE11 ABAP Dictionary의 3가지 핵심 기능(Type Definitions · DB Objects · Services)과 View 4가지 개요를 정리합니다.',
    ['ABAP Dictionary', '데이터 사전', 'DDIC'],
    [
      { id: 'l1', kind: 'lesson', badge: 'L1', page: 'p. 3', label: 'ABAP Dictionary 개요', desc: 'Lesson: Describing the ABAP Dictionary (p. 3) — ABAP Dictionary의 역할, 3가지 기능, View 4가지 개요를 정리합니다.' }
    ],
    [
      take('abap-dictionary', 'ABAP Dictionary의 역할과 3가지 기능', 'l1', 'Lesson 1', 'p. 3'),
      take('abap-dictionary', 'View 4가지', 'l1', 'Lesson 1', 'p. 3')
    ],
    '11/23'
  );

  putBc430(2, 'ABAP Dictionary 데이터 타입', 'Data Types in the ABAP Dictionary', 11,
    'Domain(Technical Attribute) · Data Element(Semantic Attribute), Flat Structure(Simple · Nested · .INCLUDE), Table Type · Deep Structure, Type Groups와 Exercise 1–4를 정리합니다.',
    ['DATA ELEMENT', '데이터 요소', 'Domain', '도메인', 'Technical Attribute', 'Semantic Attribute', 'SET/GET Parameters', 'Flat structure', 'Simple structure', 'Nested structure', 'Deep structure', 'Table Type', 'Line Type'],
    [
      { id: 'l1', kind: 'lesson', badge: 'L1', page: 'p. 12', label: 'Domain · Data Element', desc: 'Lesson: Creating Domains and Data Elements (p. 12) — Technical Attribute와 Semantic Attribute의 분리 및 SE11 생성 절차를 정리합니다.' },
      { id: 'l2', kind: 'lesson', badge: 'L2', page: 'p. 25', label: 'Flat Structure · .INCLUDE', desc: 'Lesson: Creating Flat Structures (p. 25) — Simple · Nested Structure와 .INCLUDE 평탄화 접근 비교를 정리합니다.' },
      { id: 'l3', kind: 'lesson', badge: 'L3', page: 'p. 34', label: 'Table Type · Deep Structure', desc: 'Lesson: Creating Table Types and Deep Structures (p. 34) — 전역 Table Type(Line Type · Access Mode · Primary Key)과 Deep Structure를 정리합니다.' },
      { id: 'l4', kind: 'lesson', badge: 'L4', page: 'p. 47', pending: true, label: 'Type Groups (준비 중)', desc: 'Lesson: Creating Type Groups (p. 47) — 준비 중' },
      { id: 'ex', kind: 'exercise', badge: 'Ex 1–4', page: 'p. 19–41', label: 'Exercise 1–4', desc: 'BC430 Exercise 1(Elementary Data Types), Exercise 2(Simple · Nested Structures), Exercise 3(Table Types), Exercise 4(Deep Structures) 실습 가이드를 정리합니다.' }
    ],
    [
      take('abap-dictionary', 'Data의 속성과 Domain · Data Element가 필요한 이유', 'l1', 'Lesson 1', 'p. 12'),
      take('abap-dictionary', 'Domain — Technical Attribute와 SE11 절차', 'l1', 'Lesson 1', 'p. 12'),
      take('abap-dictionary', 'Data Element — Semantic Attribute와 SE11 절차', 'l1', 'Lesson 1', 'p. 12'),
      take('abap-dictionary', 'Structure — 종류(Flat · Deep)와 .INCLUDE', 'l2', 'Lesson 2', 'p. 25'),
      take('abap-dictionary', 'Table Type — SE11 전역 Internal Table 타입', 'l3', 'Lesson 3', 'p. 34'),
      pendingSec('l4', 'Lesson 4', 'p. 47', 'Creating Type Groups (준비 중)', '준비 중 · BC430 교재 p. 47 (Creating Type Groups) 수업 진도에 맞춰 정리할 예정입니다.'),
      exSec('ex', 'Exercise 1', 'p. 19', 'Exercise 1: Create Elementary Data Types',
        text('SE11에서 Domain(Data Type · 길이 · Value Range)과 Data Element(Domain 참조 · Field Label · Parameter ID)를 만들고 Report에서 참조합니다.'),
        table(['연계 실습 Program', '핵심 연습 포인트'], [
          ['`ZBC430S_DATA_ELEMENTS`', 'Program `SAPBC430S_DATA_ELEMENTS` 기반 Data Element·Field Label·F4 Help 확인']
        ])),
      exSec('ex', 'Exercise 2', 'p. 29', 'Exercise 2: Create Simple and Nested Structures',
        text('SE11에서 Simple structure, Nested structure, `.INCLUDE` 구조를 만들고 컴포넌트 접근 경로 차이를 비교합니다.'),
        table(['연계 실습 Program', '핵심 연습 포인트'], [
          ['`ZABAP_F##_18` · `ZBC430S_F##_STRUCT_NESTED`', '`gs_nested-route-cityfrom` vs `.INCLUDE` `gs_included-cityfrom` 비교']
        ])),
      exSec('ex', 'Exercise 3–4', 'p. 37 · 41', 'Exercise 3–4: Create Table Types & Deep Structures',
        text('SE11에서 전역 `Table Type`(Line Type · Standard/Sorted/Hashed · Primary Key)을 정의(Ex 3)하고, 이를 컴포넌트로 포함하는 `Deep structure`(Ex 4)를 작성합니다.'),
        table(['연계 실습 Program', '핵심 연습 포인트'], [
          ['`ZABAP_F##_19` · `ZBC430S_F##_STRUCT_DEEP`', '컴포넌트에 전역 Table Type이 포함된 가변 길이 Deep structure 조회·활용']
        ]))
    ],
    '11/23',
    [
      ['`ZABAP_F##_18`', 'ABAP Flat(Simple & Nested) Structure'],
      ['`ZABAP_F##_19`', 'ABAP Deep Structure'],
      ['`ZBC430S_DATA_ELEMENTS`', 'Program SAPBC430S_DATA_ELEMENTS (Ex 1)'],
      ['`ZBC430S_F##_STRUCT_NESTED`', 'Report SAPBC430S_STRUCT_NESTED (Ex 2)'],
      ['`ZBC430S_F##_STRUCT_DEEP`', 'Report SAPBC430S_STRUCT_DEEP (Ex 4)']
    ]
  );

  putBc430(3, '데이터베이스 테이블', 'Database Tables', 55,
    'Transparent Table 생성(Delivery Class · Key Fields · Currency/Quantity · Technical Settings), Cluster/Pooled Table 개요와 Exercise 5를 정리합니다.',
    ['데이터베이스 테이블', 'Transparent Table', 'Delivery Class', 'Technical Settings'],
    [
      { id: 'l1', kind: 'lesson', badge: 'L1', page: 'p. 56', label: 'Transparent Table 생성', desc: 'Lesson: Creating Transparent Tables (p. 56) — Delivery Class, Key 필드, Currency/Quantity 참조(KRW 100 나눗셈 주의), Technical Settings 4가지를 정리합니다.' },
      { id: 'l2', kind: 'lesson', badge: 'L2', page: 'p. 79', pending: true, label: 'Cluster · Pooled Table (준비 중)', desc: 'Lesson: Defining Cluster Tables and Pooled Tables (p. 79) — 준비 중' },
      { id: 'ex', kind: 'exercise', badge: 'Ex 5', page: 'p. 69', label: 'Exercise 5', desc: 'BC430 Exercise 5: Create Tables in the ABAP Dictionary (p. 69) 실습 체크포인트를 정리합니다.' }
    ],
    [
      take('abap-dictionary', 'Transparent Table 생성과 Technical Settings', 'l1', 'Lesson 1', 'p. 56'),
      pendingSec('l2', 'Lesson 2', 'p. 79', 'Defining Cluster Tables and Pooled Tables (준비 중)', '준비 중 · BC430 교재 p. 79 (Cluster Tables and Pooled Tables) 수업 진도에 맞춰 정리할 예정입니다.'),
      exSec('ex', 'Exercise 5', 'p. 69', 'Exercise 5: Create Tables in the ABAP Dictionary',
        text('SE11에서 `Z` 연습용 Transparent Table을 생성하고 Delivery Class, Key Field(`MANDT` 포함), Currency/Quantity 참조, Technical Settings를 설정해 활성화한 뒤 데이터를 입력합니다.'),
        { type: 'practice', title: 'Exercise 5 필수 체크포인트', steps: [
          { step: '1', action: 'Key Field 연속 배치 & Initial Values 확인', detail: 'MANDT를 첫 필드로 두고 Key 필드를 맨 위부터 빈틈 없이 나열합니다.' },
          { step: '2', action: 'Technical Settings → Activate → Create Entries', detail: 'Data Class(APPL0/USER) · Size Category를 저장한 뒤 활성화하고 Utilities → Table Contents → Create Entries로 테스트 데이터를 입력합니다.' }
        ] })
    ],
    '11/24',
    [
      ['`ZABAP_F##_20`', 'ABAP KRW Currency']
    ]
  );

  putBc430(4, '테이블 접근 성능', 'Performance During Table Access', 91,
    'Primary · Secondary Index와 Application Server Table Buffer(Full · Generic · Single-Record, Synchronization Table, Decision Tree, BYPASSING BUFFER) 및 Exercise 6–7을 정리합니다.',
    ['Secondary Index', 'Table Buffer', 'Full Buffering', 'Generic Buffering', 'Single-Record Buffering', 'Synchronization Table', 'BYPASSING BUFFER'],
    [
      { id: 'l1', kind: 'lesson', badge: 'L1', page: 'p. 92', label: 'Database Table Index', desc: 'Lesson: Creating Database Table Indexes (p. 92) — Primary Index와 Secondary Index 구성 원리 및 주의사항을 정리합니다.' },
      { id: 'l2', kind: 'lesson', badge: 'L2', page: 'p. 101', label: 'Table Buffering 설정', desc: 'Lesson: Setting Up Table Buffering (p. 101) — 3가지 버퍼링, Synchronization Table 동기화, Decision Tree와 BYPASSING BUFFER를 정리합니다.' },
      { id: 'ex', kind: 'exercise', badge: 'Ex 6–7', page: 'p. 97 · 115', label: 'Exercise 6–7', desc: 'BC430 Exercise 6(Table Indexes 생성)과 Exercise 7(Table Buffering 설정) 실습 체크포인트를 정리합니다.' }
    ],
    [
      take('abap-dictionary', 'Database Access Using Index — Primary · Secondary Index', 'l1', 'Lesson 1', 'p. 92'),
      take('abap-dictionary', 'Database Access Using the Buffer — Table Buffer와 동기화', 'l2', 'Lesson 2', 'p. 101'),
      exSec('ex', 'Exercise 6', 'p. 97', 'Exercise 6: Create Table Indexes',
        text('SE11의 `Indexes` 메뉴에서 자주 검색하는 Non-Key 컬럼에 `MANDT` + 검색 필드 조합의 Secondary Index를 생성하고 활성화합니다.'),
        { type: 'callout', style: 'tip', title: 'Secondary Index 설계 포인트', body: '인덱스를 과도하게 늘리면 변경(INSERT/UPDATE/DELETE) 성능이 떨어지므로, 실제 `WHERE` 조건의 선두 컬럼과 선택도를 고려해 꼭 필요한 인덱스만 생성합니다.' }),
      exSec('ex', 'Exercise 7', 'p. 115', 'Exercise 7: Set Up Table Buffering',
        text('SE11 `Technical Settings`에서 테이블 크기·조회 패턴에 맞는 버퍼링 유형(Full · Generic · Single-Record)을 설정하고, `BYPASSING BUFFER` 조회와 구분합니다.'),
        { type: 'callout', style: 'tip', title: 'Decision Tree 점검', body: '실시간 정합성이 필수이거나 변경이 잦은 테이블은 버퍼링을 끄고, 읽기 중심의 작은 마스터/코드 테이블에만 적절한 Buffering Type을 적용합니다.' })
    ],
    '11/24'
  );

  putBc430(5, '입력 검사 (Input Checks)', 'Input Checks', 125,
    'Domain Fixed Values(고정값 검사), Check Table · Foreign Keys(Cardinality 1:1/1:N/1:C/1:CN), 다국어 Text Table(LANGU · SPRAS)과 Exercise 8–10을 Lesson별로 정리합니다.',
    ['Input Checks', 'Fixed Values', 'Value Table', 'Check Table', 'Foreign Key', 'Cardinality', 'Text Table', 'SPRAS'],
    [
      { id: 'l1', kind: 'lesson', badge: 'L1', page: 'p. 126', label: 'Fixed Values (고정값)', desc: 'Lesson: Creating Fixed Values (p. 126) — Domain Value Range의 고정값/구간 제한과 F4 Help 자동 표시, 소급 미적용 주의를 정리합니다.' },
      { id: 'l2', kind: 'lesson', badge: 'L2', page: 'p. 132', label: 'Foreign Keys (외래키)', desc: 'Lesson: Defining Foreign Keys to Perform Input Checks (p. 132) — Check Table · Value Table, Cardinality(1:1/1:N/1:C/1:CN), SE11 설정 절차를 정리합니다.' },
      { id: 'l3', kind: 'lesson', badge: 'L3', page: 'p. 152', label: 'Text Table (다국어)', desc: 'Lesson: Creating Text Tables (p. 152) — 언어전환용 Text Table 구조(LANGU · SPRAS), Key fields of a text table 설정과 T005T 예제를 정리합니다.' },
      { id: 'ex', kind: 'exercise', badge: 'Ex 8–10', page: 'p. 129–155', label: 'Exercise 8–10', desc: 'BC430 Exercise 8(Fixed Values), Exercise 9(Foreign Key Input Checks), Exercise 10(Text Table 생성) 실습 가이드를 정리합니다.' }
    ],
    [
      {
        tab: 'l1', badge: 'Lesson 1', page: 'p. 126', title: 'Creating Fixed Values — Domain Value Range 입력 제한',
        blocks: [
          text('ABAP Dictionary는 잘못된 데이터가 화면이나 테이블에 들어오는 것을 막기 위해 **Input Checks(인풋 검사)**를 제공합니다. 첫 번째 방식인 **Fixed Values**는 `Domain`의 `Value Range` 탭에서 허용할 고정값(Single Vals)이나 구간(Intervals)을 직접 지정하는 방법입니다.'),
          table(['항목', '동작과 주의사항'], [
            ['설정 위치', '`SE11` → `Domain` → `Value Range` 탭 (`Single Vals` / `Intervals`)'],
            ['입력 도움말 연동', '설정한 고정값 목록과 설명이 입력 화면의 **F4 Help**에 자동으로 디스플레이됨'],
            ['검사 시점 주의', '새 입력이 들어올 때만 검사하므로, 설정 전 **이미 테이블에 저장된 기존 데이터에는 소급 적용되지 않음**']
          ])
        ]
      },
      {
        tab: 'l2', badge: 'Lesson 2', page: 'p. 132', title: 'Defining Foreign Keys — Check Table과 Cardinality',
        blocks: [
          text('두 번째 Input Checks 방식인 **Foreign Keys**는 데이터 적합성·일치성 측면에서 타 테이블(**Check Table**)과의 참조 무결성을 검사합니다. 예를 들어 항공사 `AA`에 `Counter 8`이 없다면 입력 시 Check Table(예: `SCOUNTER`)에 존재 여부를 확인해 있으면 **Confirm**, 없으면 **Reject** 처리합니다.',
            'Domain의 `Value Range` 탭에 **`Value Table`**을 미리 지정해 두면, 해당 Domain을 쓰는 필드에서 Foreign Key를 만들 때 Check Table 제안(Proposal)으로 자동 활용됩니다.'),
          text('**Foreign Key의 Cardinality(관계성)**', 'Check Table의 한 레코드와 Foreign Key Table의 레코드 간 대응 관계를 설정합니다.'),
          table(['Cardinality', '의미 (Check Table : Foreign Key Table)'], [
            ['1 : 1', '일대일 대응 (모든 값이 정확히 1건과 대응)'],
            ['1 : N', '모든 값이 다수 값(1건 이상)을 가짐'],
            ['1 : C', '일부 값이 일대일 대응됨 (0건 또는 1건)'],
            ['1 : CN', '일부 값이 다수 값을 가짐 (0건, 1건, 또는 여러 건)']
          ]),
          {
            type: 'practice',
            title: 'SE11에서 Foreign Key 설정 방법',
            steps: [
              { step: '1', action: 'Change Table (Fields 탭) 열기', detail: 'SE11에서 대상 테이블을 Change 모드로 열고 Fields 탭으로 이동합니다.' },
              { step: '2', action: '컬럼 선택 후 키 아이콘(Foreign Keys) 클릭', detail: '외래키 검사를 연결할 필드에 커서를 두고 상단 툴바의 Foreign Keys(열쇠 아이콘)를 누릅니다.' },
              { step: '3', action: 'Check Table 입력 후 Create Proposal', detail: 'Check Table 이름을 기입하고 Create Proposal을 눌러 필드 매핑 제안을 생성합니다. (Domain → Value Range에 Value Table을 미리 등록해 두면(예: ZMAJOR_F##) 자동으로 제안됩니다.)' },
              { step: '4', action: '필드 유형·Cardinality 선택 후 Copy', detail: 'Foreign Key Field Type(Key 필드인지, Key 필드가 아닌 Non-key field / Function field인지)과 Cardinality(1:1, 1:N, 1:C, 1:CN)를 선택한 뒤 Copy하고 Activate합니다.' }
            ]
          }
        ]
      },
      {
        tab: 'l3', badge: 'Lesson 3', page: 'p. 152', title: 'Creating Text Tables — 언어전환용 테이블과 LANGU(SPRAS)',
        blocks: [
          text('Text Table은 본체 테이블의 코드 값에 대해 다국어 설명 텍스트를 따로 보관하는 **언어전환용 테이블**입니다. 본체 테이블에 데이터를 입력하거나 조회할 때 Text Table에 선언한 설명 필드가 함께 디스플레이되며, 입력된 텍스트의 언어 코드는 `LANGU`(Data Element: `SPRAS`) 필드에 저장됩니다.'),
          {
            type: 'practice',
            title: 'SE11에서 Text Table 생성 방법',
            steps: [
              { step: '1', action: 'SE11에서 Text Table 생성', detail: 'SE11에서 Database Table을 새로 생성합니다(관례상 본체 테이블명 뒤에 T를 붙인 이름 사용).' },
              { step: '2', action: '본체 테이블의 Key Field만 그대로 복사', detail: '연결할 본체 테이블의 Key Field(예: MANDT + 코드 키 필드)를 동일하게 선언합니다.' },
              { step: '3', action: 'LANGU(SPRAS) 및 텍스트 필드 추가', detail: 'Key Field에 언어 필드 LANGU(Data Element: SPRAS)를 추가하고, 언어별 설명을 담을 텍스트 필드를 일반 필드로 추가합니다.' },
              { step: '4', action: 'Foreign Key 설정', detail: '본체 코드(Key) 필드에 Foreign Key를 연결할 때 Foreign Key Field Type 라디오 버튼을 Key fields of a text table로 설정합니다. LANGU 필드는 본체 테이블 키가 아니므로 본체 Foreign Key 매핑 대상에서 제외하거나 T002 언어 테이블 참조 시 Non-key-fields/candidates(필기의 non-key 필드)로 설정합니다.' }
            ]
          },
          code('Text Table(T005T)과 sy-langu로 언어별 국가명 조회', `REPORT zabap_f##_##.

PARAMETERS p_carr TYPE spfli-carrid DEFAULT 'LH'.

TYPES: BEGIN OF ts_route,
         carrid    TYPE spfli-carrid,
         connid    TYPE spfli-connid,
         countryfr TYPE spfli-countryfr,
         cityfrom  TYPE spfli-cityfrom,
         cityto    TYPE spfli-cityto,
       END OF ts_route.

TYPES: BEGIN OF ts_country_text,
         land1 TYPE t005t-land1,
         landx TYPE t005t-landx,
       END OF ts_country_text.

DATA: gt_routes TYPE STANDARD TABLE OF ts_route,
      gs_route  TYPE ts_route,
      gt_texts  TYPE STANDARD TABLE OF ts_country_text,
      gs_text   TYPE ts_country_text.

START-OF-SELECTION.
  " 1) SPFLI 노선 조회
  SELECT carrid connid countryfr cityfrom cityto
    FROM spfli
    INTO TABLE gt_routes
    WHERE carrid = p_carr
    ORDER BY connid.

  " 2) 출발 국가 코드(countryfr)에 대응하는 표준 Text Table(T005T)을
  "    현재 로그온 언어(sy-langu) 기준으로 조회
  IF gt_routes IS NOT INITIAL.
    SELECT land1 landx
      FROM t005t
      INTO TABLE gt_texts
      FOR ALL ENTRIES IN gt_routes
      WHERE land1 = gt_routes-countryfr
        AND spras = sy-langu.
  ENDIF.

  LOOP AT gt_routes INTO gs_route.
    CLEAR gs_text.
    READ TABLE gt_texts INTO gs_text WITH KEY land1 = gs_route-countryfr.
    WRITE: / gs_route-carrid, gs_route-connid,
             gs_route-countryfr, gs_text-landx,
             gs_route-cityfrom, '->', gs_route-cityto.
  ENDLOOP.`)
        ]
      },
      exSec('ex', 'Exercise 8', 'p. 129', 'Exercise 8: Create Fixed Values',
        text('Domain의 `Value Range` 탭에 Fixed Values(Single Vals / Intervals)를 등록하고 입력 화면 F4 Help에 자동 표시되는지 확인합니다.'),
        { type: 'callout', style: 'tip', title: '기존 데이터 주의', body: 'Fixed Values는 새 입력 시점에만 검사하므로, 설정 전 이미 테이블에 들어가 있던 잘못된 기존 레코드에는 소급 적용되지 않습니다.' }),
      exSec('ex', 'Exercise 9', 'p. 141', 'Exercise 9: Perform Input Checks to Ensure Data Consistency',
        text('SE11 Fields 탭에서 `Foreign Keys`(열쇠 아이콘) → Check Table 지정 → `Create Proposal` → Field Type 및 Cardinality(`1:1`, `1:N`, `1:C`, `1:CN`)를 설정해 참조 무결성 검사를 적용합니다.'),
        { type: 'callout', style: 'tip', title: 'Value Table 활용', body: 'Domain의 `Value Range`에 `Value Table`을 미리 지정해 두면 Foreign Key 생성 시 Check Table 제안이 자동으로 채워집니다.' }),
      exSec('ex', 'Exercise 10', 'p. 155', 'Exercise 10: Create a Text Table',
        text('본체 테이블의 Key Field를 복사한 뒤 `LANGU`(Data Element: `SPRAS`)와 텍스트 필드를 추가하고, 본체 코드 필드의 Foreign Key 유형을 **`Key fields of a text table`**로 설정합니다.'),
        { type: 'callout', style: 'tip', title: 'Text Table 연결 확인', body: '활성화 후 본체 테이블에서 `Goto → Text Table` 메뉴로 바로 이동되는지 확인하면 연결이 정상 완료된 것입니다.' })
    ],
    '11/24 · 11/25'
  );

  putBc430(6, 'Dictionary 객체 종속성', 'Dictionary Object Dependencies', 167,
    'Active / Inactive Dictionary 객체 구분과 Where-Used List를 활용한 ABAP Dictionary 객체 종속성(영향도) 추적 및 Exercise 11–12를 정리합니다.',
    ['Where-Used List'],
    [
      { id: 'l1', kind: 'lesson', badge: 'L1', page: 'p. 168', pending: true, label: 'Active · Inactive 객체 (준비 중)', desc: 'Lesson: Differentiating Between Active and Inactive Dictionary Objects (p. 168) — 준비 중' },
      { id: 'l2', kind: 'lesson', badge: 'L2', page: 'p. 177', label: '객체 종속성 (Where-Used List)', desc: 'Lesson: Identifying Dependencies with ABAP Dictionary Objects (p. 177) — Domain·Data Element 변경 전 Where-Used List로 참조 객체를 확인하는 방법을 정리합니다.' },
      { id: 'ex', kind: 'exercise', badge: 'Ex 11–12', page: 'p. 173 · 181', label: 'Exercise 11–12', desc: 'BC430 Exercise 11(Active/Inactive · 준비 중)과 Exercise 12(Where-Used List 종속성 확인)를 정리합니다.' }
    ],
    [
      pendingSec('l1', 'Lesson 1', 'p. 168', 'Differentiating Between Active and Inactive Dictionary Objects (준비 중)', '준비 중 · BC430 교재 p. 168 (Active/Inactive Dictionary Objects) 수업 진도에 맞춰 정리할 예정입니다.'),
      {
        tab: 'l2', badge: 'Lesson 2', page: 'p. 177', title: 'Where-Used List로 Dictionary 객체 종속성 확인',
        blocks: [
          text('ABAP Dictionary의 `Domain`, `Data Element`, `Structure`, `Table`은 서로 참조 관계로 얽혀 있습니다. 예를 들어 하나의 `Domain` 길이를 변경하면 그 Domain을 쓰는 모든 `Data Element`, `Transparent Table`, `View`, `Program`에 연쇄 영향이 미칩니다.',
            '따라서 객체를 수정·축소·삭제하기 전에 반드시 `SE11` 툴바의 **`Where-Used List`**(단축키 `Ctrl + Shift + F3`)로 어디에서 사용 중인지 먼저 확인해야 합니다.'),
          {
            type: 'practice',
            title: 'SE11에서 Where-Used List 확인 방법',
            steps: [
              { step: '1', action: 'SE11에서 대상 객체(Domain · Data Element 등) 입력', detail: '조회하려는 Domain 또는 Data Element 이름을 입력합니다.' },
              { step: '2', action: 'Where-Used List 아이콘(Ctrl + Shift + F3) 클릭', detail: '조회 범위 팝업에서 Data Elements, Tables, Structures, Views, Programs 등 확인할 객체 유형을 선택합니다.' },
              { step: '3', action: '참조 목록으로 변경 영향도 파악', detail: '결과 목록에서 실제 사용 중인 테이블과 프로그램을 확인한 뒤, 구조 축소 등이 필요하면 BC430 Unit 7의 SE14 Table Conversion 절차를 계획합니다.' }
            ]
          }
        ]
      },
      pendingSec('ex', 'Exercise 11', 'p. 173', 'Exercise 11: Differentiate Between Active and Inactive Dictionary Objects (준비 중)', '준비 중 · BC430 교재 p. 173 실습은 Lesson 1 학습 후 정리할 예정입니다.'),
      exSec('ex', 'Exercise 12', 'p. 181', 'Exercise 12: Identify Dependencies with ABAP Dictionary Objects',
        text('SE11에서 `S_CARR_ID` 같은 Domain/Data Element에 대해 `Where-Used List`(`Ctrl + Shift + F3`)를 실행해 어떤 테이블·구조·프로그램이 의존하는지 추적합니다.'),
        { type: 'callout', style: 'tip', title: '변경 전 필수 습관', body: 'Domain을 변경하기 전 `Where-Used List`로 사용처를 먼저 확인하면 예상치 못한 테이블 비활성화나 Table Conversion 사고를 예방할 수 있습니다.' })
    ],
    '11/25'
  );

  putBc430(7, '테이블 변경과 확장', 'Table Changes', 189,
    'Table Conversion(QCM 임시 테이블 · SE14 Database Utility · Activate and adjust database), Standard Table 확장용 Append Structure(ZZ/YY 규칙)와 Exercise 13–14를 정리합니다.',
    ['Table Conversion', 'QCM', 'Database Utility', 'Append Structure'],
    [
      { id: 'l1', kind: 'lesson', badge: 'L1', page: 'p. 190', label: 'Table Conversion (SE14)', desc: 'Lesson: Performing a Table Conversion (p. 190) — QCM 임시 테이블, Domain 축소 시 SE14 Activate and adjust database, Delete 금지 경고를 정리합니다.' },
      { id: 'l2', kind: 'lesson', badge: 'L2', page: 'p. 204', label: 'Append Structure 확장', desc: 'Lesson: Enhancing Tables Using Append Structures (p. 204) — Standard Table에 ZZ/YY 필드를 추가하는 Append Structure 규칙과 절차를 정리합니다.' },
      { id: 'ex', kind: 'exercise', badge: 'Ex 13–14', page: 'p. 199 · 211', label: 'Exercise 13–14', desc: 'BC430 Exercise 13(Table Conversion 수행)과 Exercise 14(Append Structure 추가) 실습 체크포인트를 정리합니다.' }
    ],
    [
      take('abap-dictionary', 'Table Changes — Table Conversion과 Database Utility(SE14)', 'l1', 'Lesson 1', 'p. 190'),
      take('abap-dictionary', 'Enhancement — Standard Table과 Append Structure', 'l2', 'Lesson 2', 'p. 204'),
      exSec('ex', 'Exercise 13', 'p. 199', 'Exercise 13: Perform a Table Conversion',
        text('기존 데이터가 있는 `Z` 테이블의 Domain 길이를 축소하거나 키를 변경한 뒤 `SE14`(Database Utility)에서 `Save data` + `Activate and adjust database`로 안전하게 변환을 완료합니다.'),
        { type: 'callout', style: 'warning', title: 'SE14 실습 시 반드시 확인', body: '`Delete Database Table` 또는 `Delete data`는 **모든 클라이언트**의 테이블과 데이터를 삭제하므로 절대 누르지 마세요. 항상 `Save data` 상태를 확인하세요.' }),
      exSec('ex', 'Exercise 14', 'p. 211', 'Exercise 14: Add Enhancements to a Table Using an Append Structure',
        text('SE11에서 대상 테이블 조회 → `Append Structure` 버튼 클릭 → `ZZ` 또는 `YY`로 시작하는 필드 정의 → Activate 순서로 표준 테이블을 확장합니다.'),
        { type: 'callout', style: 'tip', title: '명명 규칙 확인', body: 'Append Structure 자체는 Z/Y 이름으로 N개 생성 가능하며, 내부 추가 컬럼명은 반드시 `ZZ` 또는 `YY`로 시작해야 합니다.' })
    ],
    '11/25'
  );

  putBc430(8, 'View와 Maintenance View', 'Views and Maintenance Views', 219,
    'SE11 View 생성 4단계, View별 Join 고정 규칙(Database view=INNER JOIN, Help/Maintenance view=LEFT OUTER JOIN), Dynamic Attachment(* / -), SM30 Table Maintenance Generator와 Exercise 15–17을 Lesson별로 정리합니다.',
    ['Database view', 'Projection view', 'Help view', 'Maintenance view', 'Table Maintenance Generator', 'Maintenance Dialog', 'Dynamic Attachment'],
    [
      { id: 'l1', kind: 'lesson', badge: 'L1', page: 'p. 220', label: 'Database View · Dynamic Attachment', desc: 'Lesson: Creating Database Views (p. 220) — SE11 View 생성 4단계, 4가지 View와 Join 고정 규칙, Inner/Outer Join 차이, Dynamic Attachment(* / -)를 정리합니다.' },
      { id: 'l2', kind: 'lesson', badge: 'L2', page: 'p. 237', label: 'Maintenance View (SM30)', desc: 'Lesson: Creating Maintenance Views (p. 237) — SM30 유지보수, Table Maintenance Generator(&NC& · Function Group · 1000~1010 영구결번 · Overview/Detail view)와 장단점을 정리합니다.' },
      { id: 'l3', kind: 'lesson', badge: 'L3', page: 'p. 250', pending: true, label: 'View Clusters (준비 중)', desc: 'Lesson: Creating View Clusters (p. 250) — 준비 중' },
      { id: 'ex', kind: 'exercise', badge: 'Ex 15–17', page: 'p. 233–253', label: 'Exercise 15–17', desc: 'BC430 Exercise 15(Database View), Exercise 16(Maintenance View · SM30), Exercise 17(View Cluster · 준비 중) 실습 가이드를 정리합니다.' }
    ],
    [
      {
        tab: 'l1', badge: 'Lesson 1', page: 'p. 220', title: 'Creating Database Views — View 생성 · Join 규칙 · Dynamic Attachment',
        blocks: [
          text('SE11에서 여러 테이블의 컬럼을 조합하거나 단일 테이블의 일부 컬럼만 추려 조회할 때 View를 생성합니다. View 유형에 따라 사용되는 Join 방식이 고정되어 있습니다.'),
          {
            type: 'practice',
            title: 'SE11에서 View 만드는 법',
            steps: [
              { step: '1', action: 'SE11에서 View 이름 작성 후 생성', detail: 'View 라디오 버튼을 선택하고 이름을 입력한 뒤 Create를 눌러 4가지 View 유형 중 하나를 선택합니다.' },
              { step: '2', action: 'Table/Join Conditions에서 테이블 입력 후 Relationships 선택', detail: '기준 테이블을 적고 Relationships 버튼을 누르면 테이블 간 Foreign Key를 바탕으로 Join Condition이 자동 처리됩니다.' },
              { step: '3', action: 'View Fields 탭에서 Display할 필드 선택', detail: 'View Fields 탭의 Table fields 버튼으로 각 테이블에서 표시할 컬럼을 선택합니다.' },
              { step: '4', action: 'Selection Conditions 지정', detail: 'Selection Conditions 탭에서 View에 표시할 행의 필터 조건을 선택·입력할 수 있습니다.' }
            ]
          },
          table(['View 4가지 유형', 'Join 고정 규칙', '목적과 특징 (필기 3번 Help view 보완)'], [
            ['1. Database view', '`INNER JOIN` 고정', '여러 개의 테이블에서 컬럼을 골라 Join해 Display 가능 (조인 조건에 매치되는 데이터만 조회)'],
            ['2. Projection view', '단일 테이블 (Join 없음)', '하나의 테이블 안에서만 컬럼을 골라 Display 가능하며, 간단한 `Selection Condition`을 걸어 필요한 행만 추출 가능'],
            ['3. Help view', '`LEFT OUTER JOIN` 고정', 'Search Help의 데이터 조회(Selection Method)에서 기준 테이블 행을 유지하는 Outer Join이 필요할 때 사용'],
            ['4. Maintenance view', '`LEFT OUTER JOIN` 고정', '아주 관련이 깊은 테이블들을 모아 `SM30`에서 유지보수하는 용도(실무에서는 보통 여러 테이블보다 **딱 하나의 테이블**을 대상으로 유지보수하는 경우도 많음)']
          ]),
          {
            type: 'compare',
            items: [
              {
                tag: 'Database view 고정',
                title: 'Inner Join',
                points: [
                  'Join Condition에 양쪽 모두 매치되는 데이터만 결과에 표시',
                  'Database view에서는 항상 Inner Join으로 동작'
                ]
              },
              {
                tag: 'Help view · Maintenance view 고정',
                title: 'Outer Join (LEFT OUTER JOIN)',
                points: [
                  'Join Condition에 매치되는 데이터뿐만 아니라 기준 테이블(왼쪽 테이블)의 행까지 모두 표시',
                  'Help view와 Maintenance view는 LEFT OUTER JOIN으로 고정'
                ]
              }
            ]
          },
          text('**Dynamic Attachment**', '원본 테이블의 필드가 추가·수정돼도 참조된 View에 자동으로 반영되도록 하는 설정입니다. `View Fields` 탭에서 아래 표처럼 `*`를 지정하면 해당 테이블의 모든 필드가 동적으로 연결됩니다.'),
          table(['View Field', 'Table', 'Field'], [
            ['`*`', '테이블 이름', '`*`']
          ]),
          {
            type: 'callout', style: 'point', title: 'Dynamic Attachment에서 - 제외와 중복 필드 에러 주의',
            body: '전체 포함(`*`) 상태에서 원하지 않는 특정 필드는 `View Field` 열에 **`-`**를 입력해 제외할 수 있습니다. 특히 조인된 여러 테이블에 **이름이 같은 필드**가 있을 때 중복 필드를 `-`로 빼주지 않으면 View 활성화 시 **에러**가 발생합니다.'
          }
        ]
      },
      {
        tab: 'l2', badge: 'Lesson 2', page: 'p. 237', title: 'Creating Maintenance Views — SM30과 Table Maintenance Generator',
        blocks: [
          text('**Maintenance View**는 서로 관련이 깊은 테이블(실무에서는 주로 단일 Customer Table)의 데이터를 `SM30` 화면에서 직접 조회·입력·수정할 수 있게 해 주는 유지보수용 View입니다. 사용하려면 반드시 **Maintenance Dialog**(최대 2개 화면: Overview · Detail view)를 생성해야 합니다.'),
          {
            type: 'practice',
            title: 'Maintenance View · Table Maintenance Generator 설정 (SM30)',
            steps: [
              { step: '1', action: 'Utilities → Table Maintenance Generator 실행', detail: 'Maintenance View 또는 Customer Table의 SE11 화면에서 Utilities → Table Maintenance Generator로 진입합니다. Maintenance Dialog는 최대 2개 화면(Overview / Detail view)까지 구성할 수 있습니다.' },
              { step: '2', action: 'Authorization Group 및 Maintenance 전용 Function Group 지정', detail: 'Authorization Group은 보통 &NC&(권한 그룹 미지정)로 설정하고, Maintenance Dialog 생성을 위해 일반 로직과 분리된 Maintenance 전용 Function Group을 지정합니다.' },
              { step: '3', action: 'Maint. Screen No. 지정 (Find Scr. Number(s) 활용)', detail: '스크린 번호는 1~9999 중 지정하되 1000~1010은 영구결번이라 사용할 수 없습니다. Find Scr. Number(s)로 세 가지 옵션 중 하나를 선택할 수 있으며, 나중에 스크린을 끼워 넣기 편하도록 보통 한 자리 수는 잘 사용하지 않습니다.' },
              { step: '4', action: 'SM30에서 Overview · Detail view 유지보수', detail: '생성이 끝나면 SM30에서 데이터를 관리합니다. 2-step 구성 시 Overview 목록에서 행을 더블클릭해 Detail view로 접근(access)합니다.' }
            ]
          },
          {
            type: 'compare',
            items: [
              {
                tag: 'Maintenance View 장점',
                title: '간편한 유지보수',
                points: [
                  '별도 화면 코딩 없이 SM30에서 간단한 데이터 조회·입력·수정을 빠르게 처리',
                  '오직 Customer Table(Z/Y)만 Maintenance View / SM30으로 관리 (Standard Table은 SAP 표준 방식으로 따로 관리)'
                ]
              },
              {
                tag: 'Maintenance View 단점 · 제약',
                title: '동시 수정 Lock · 비동기 업데이트',
                points: [
                  '기본적으로 비동기화 업데이트 방식으로 동작',
                  '테이블 단위 Lock이 걸려 다른 사용자가 수정 중이면 동시에 수정할 수 없음'
                ]
              }
            ]
          }
        ]
      },
      pendingSec('l3', 'Lesson 3', 'p. 250', 'Creating View Clusters (준비 중)', '준비 중 · BC430 교재 p. 250 (Creating View Clusters) 수업 진도에 맞춰 정리할 예정입니다.'),
      exSec('ex', 'Exercise 15', 'p. 233', 'Exercise 15: Create a Database View',
        text('SE11에서 Database View를 생성하고 `Relationships` 버튼으로 `INNER JOIN` 조건을 자동 생성한 뒤 `View Fields`(`Dynamic Attachment` `*` 및 `-` 제외 포함)와 `Selection Conditions`를 설정합니다.'),
        { type: 'callout', style: 'tip', title: 'Dynamic Attachment 중복 필드 주의', body: '`View Field: * / Table: 테이블명 / Field: *` 설정 시 조인 테이블 간 이름이 같은 필드를 `-`로 제외하지 않으면 활성화 오류가 발생합니다.' }),
      exSec('ex', 'Exercise 16', 'p. 245', 'Exercise 16: Create a Maintenance View',
        text('Customer Table 대상 Maintenance View(`LEFT OUTER JOIN` 고정)에서 `Utilities → Table Maintenance Generator`로 `&NC&` · Maintenance 전용 Function Group · Screen No.(`1000~1010` 제외)를 생성하고 `SM30`에서 Overview/Detail view를 확인합니다.'),
        { type: 'callout', style: 'tip', title: 'SM30 적용 대상', body: 'Maintenance View / SM30 유지보수는 Customer Table(`Z`/`Y`) 전용이며, 동시 수정 시 테이블 Lock이 걸립니다.' }),
      pendingSec('ex', 'Exercise 17', 'p. 253', 'Exercise 17: Create a View Cluster (준비 중)', '준비 중 · BC430 교재 p. 253 실습은 Lesson 3 학습 후 정리할 예정입니다.')
    ],
    '11/25'
  );

  putBc430(9, 'Search Help', 'Search Helps', 265,
    'SE11 Search Help 생성(Elementary · Collective · Selection Method · Dialog Behavior · LPos/SPos), Table · Structure · Data Element · ABAP 코드 연결, SAP HANA Enhanced Options(Full-Text · Linguistic · Fuzzy Search)와 Exercise 18–20을 정리합니다.',
    ['Search Help', 'Elementary Search Help', 'Collective Search Help', 'Selection Method', 'Dialog Behavior', 'LPos', 'SPos', 'Fuzzy Search', 'Linguistic Search', 'Enhanced Options', 'MATCHCODE OBJECT', 'AS LISTBOX'],
    [
      { id: 'l1', kind: 'lesson', badge: 'L1', page: 'p. 266', label: 'Search Help 생성 · 연결', desc: 'Lesson: Creating Search Helps (p. 266) — SE11 생성 6단계, Dialog Behavior 3종, Parameter(LPos · SPos), Table · Structure · Data Element · ABAP 코드 연결을 정리합니다.' },
      { id: 'l2', kind: 'lesson', badge: 'L2', page: 'p. 285', label: '고급 Search Help · HANA', desc: 'Lesson: Applying Advanced Search Help Techniques (p. 285) — SAP HANA DB의 Full-Text · Linguistic · Fuzzy Search(Enhanced Options)를 정리합니다. Collective · Append Search Help는 후속 진도에 맞춰 보강할 예정입니다.' },
      { id: 'ex', kind: 'exercise', badge: 'Ex 18–20', page: 'p. 281–293', label: 'Exercise 18–20', desc: 'BC430 Exercise 18(Create Search Helps) 실습 체크포인트를 정리합니다. Exercise 19–20은 후속 진도에 맞춰 정리할 예정입니다.' }
    ],
    [
      {
        tab: 'l1', badge: 'Lesson 1', page: 'p. 266', title: 'Search Help 생성 절차와 Dialog Behavior · Parameter(LPos · SPos)',
        blocks: [
          text('**Search Help**는 SAP 화면 입력 필드에서 `F4`를 눌렀을 때 가능한 값 목록을 보여 주는 입력 도움말 객체입니다. `SE11`에서 **Elementary Search Help**(단일 검색 경로) 또는 **Collective Search Help**(여러 Elementary Search Help를 탭으로 묶은 형태) 중 유형을 선택해 생성합니다.'),
          {
            type: 'practice',
            title: 'SE11 Search Help 생성 절차 (1–5단계)',
            steps: [
              { step: '1', action: 'SE11에서 Search help 선택 후 Z/Y 이름 입력 → Create', detail: '고객 객체 명명 규칙에 따라 Z 또는 Y로 시작하는 이름을 입력하고 Create를 클릭합니다.' },
              { step: '2', action: 'Elementary or Collective 선택', detail: '단일 검색 기준을 정의할 때는 Elementary search help를, 여러 Search Help를 하나의 팝업 탭으로 묶을 때는 Collective search help를 선택합니다.' },
              { step: '3', action: 'Selection Method에 대상 DB 테이블(또는 View) 지정', detail: 'Search Help 목록에 띄울 데이터가 들어 있는 DB 테이블(예: SCARR, SPFLI) 또는 View를 Selection Method에 지정합니다.' },
              { step: '4', action: 'Dialog Behavior 선택', detail: 'F4를 눌렀을 때 제한 조건 팝업을 먼저 띄울지, 결과 리스트를 바로 보여 줄지, 데이터 건수에 따라 자동 결정할지 선택합니다.' },
              { step: '5', action: 'Parameter에서 필드 선택 및 LPos · SPos 지정', detail: 'Selection Method의 필드 중 도움말에 포함할 필드를 선택하고, 결과 리스트 열 순서(LPos)와 제한 조건 화면 순서(SPos)를 번호로 지정합니다.' }
            ]
          },
          table(['Dialog Behavior 옵션', '동작 방식'], [
            ['`Dialog with value restriction`', '`Selection Options` 화면(제한 조건 입력 팝업)을 먼저 띄워 조건을 좁힌 뒤 조회합니다.'],
            ['`Display values immediately`', '제한 조건 팝업 없이 결과 리스트(Hit List)를 바로 보여 줍니다.'],
            ['`Dialog depends on set of values`', '조회 대상 데이터 양에 따라 1번(제한 조건 팝업)과 2번(리스트 즉시 표시) 중 자동으로 띄워 줍니다. *(참고 보완: SAP 표준 기준 100건 미만이면 바로 리스트를 표시하고 100건 이상이면 제한 조건 팝업을 표시합니다.)*']
          ]),
          table(['Parameter 설정 항목', '의미와 역할'], [
            ['`LPos` (List Position)', 'F4 결과 리스트(Hit List)에 표시되는 **칼럼 열 번호** (1, 2, 3 … 순서대로 왼쪽부터 배치)'],
            ['`SPos` (Screen Position)', '제한 조건 팝업(`Selection Options` 스크린)에 **표시되는 순서**'],
            ['`IMP` / `EXP` *(참고 보완)*', '`IMP`(Import)는 화면 값을 Search Help 검색 조건으로 전달하고, `EXP`(Export)는 사용자가 선택한 행의 값을 입력 필드로 되돌려 줍니다.']
          ]),
          {
            type: 'callout', style: 'point', title: 'LPos와 SPos 구분',
            body: '`LPos`는 결과 목록의 **칼럼(열) 번호**, `SPos`는 제한 조건 **스크린(Screen Position)의 표시 순서**입니다. 값을 `0` 또는 빈칸으로 두면 해당 화면에서 숨길 수 있습니다.'
          }
        ]
      },
      {
        tab: 'l1', badge: 'Lesson 1', page: 'p. 266', title: 'Search Help 연결 방법 — Table · Structure · Data Element · ABAP 코드',
        blocks: [
          text('Search Help를 생성·활성화한 뒤(6단계) 실제 입력 화면에서 `F4`로 동작하게 하려면 **Table**, **Structure**, **Data Element**에 등록하거나 **ABAP Selection Screen 코드**에서 직접 지정합니다.'),
          table(['연결 대상', '등록 경로와 방법'], [
            ['**Table**', '대상 DB 테이블로 돌아가 필드를 선택한 뒤 `Entry help/check` 탭에서 **`Srch Help`** 버튼을 눌러 Search Help를 등록하고 파라미터-필드 매핑을 하나하나 기입합니다.'],
            ['**Structure**', 'Structure의 **`Input Help`**(`Entry help/check`)에서 **`Srch Help`**를 등록합니다.'],
            ['**Data Element**', 'Data Element의 **`Further Characteristics`** 탭에서 **`Search Help`**를 등록합니다. *(원문 필기의 `Furthure Characteristics` 오타를 SAP SE11 표준 탭명 `Further Characteristics`로 교정했습니다.)*']
          ]),
          text('ABAP Report의 Selection Screen에서는 Dictionary 객체에 Search Help를 붙이지 않았거나 다른 Search Help를 적용하고 싶을 때 **`MATCHCODE OBJECT <Search Help명>.`** 또는 **`AS LISTBOX VISIBLE LENGTH <개수>.`** 옵션을 사용해 코드에서 직접 적용할 수 있습니다. `SELECT-OPTIONS`에도 `MATCHCODE OBJECT`를 붙일 수 있으며, `AS LISTBOX`는 `PARAMETERS` 필드를 드롭다운 목록 형태로 표시합니다.'),
          code('MATCHCODE OBJECT와 AS LISTBOX로 Search Help 적용', `REPORT zabap_f##_##.

TYPES: BEGIN OF ts_scarr,
         carrid   TYPE scarr-carrid,
         carrname TYPE scarr-carrname,
         currcode TYPE scarr-currcode,
       END OF ts_scarr.

PARAMETERS:
  p_carr   TYPE s_carr_id MATCHCODE OBJECT h_scarr, " 직접 만든 Z/Y Search Help명 지정 가능
  p_carrlb TYPE s_carr_id AS LISTBOX VISIBLE LENGTH 20.

DATA: lv_carr  TYPE s_carr_id,
      ls_scarr TYPE ts_scarr.

START-OF-SELECTION.
  IF p_carr IS NOT INITIAL.
    lv_carr = p_carr.
  ELSE.
    lv_carr = p_carrlb.
  ENDIF.

  SELECT SINGLE carrid carrname currcode
    FROM scarr
    INTO ls_scarr
    WHERE carrid = lv_carr.

  IF sy-subrc = 0.
    WRITE: / ls_scarr-carrid, ls_scarr-carrname, ls_scarr-currcode.
  ELSE.
    WRITE: / '조회된 항공사가 없습니다.'.
  ENDIF.`)
        ]
      },
      {
        tab: 'l2', badge: 'Lesson 2', page: 'p. 285', title: 'SAP HANA Enhanced Options — Full-Text · Linguistic · Fuzzy Search',
        blocks: [
          text('**SAP HANA DB**에는 **FULL TEXT SEARCH** 기능이 내장되어 있습니다. `SE11` Search Help의 **`Enhanced Options`** 영역에서 아래 두 옵션을 함께 선택하면 HANA 기반의 향상된 검색(타입어헤드·유사 검색)이 Search Help에 적용됩니다.'),
          table(['Enhanced Options 항목', '역할과 특징'], [
            ['`Linguistic Search`', '언어적 변형(어형 변화 등)을 고려한 텍스트 검색을 지원합니다. *(원문 필기의 `Linguistic Searh` 오타를 `Linguistic Search`로 교정했습니다.)*'],
            ['`Fuzzy Search` (유사성 검색)', '철자가 완전히 일치하지 않더라도 오타나 비슷한 단어를 모두 찾아 띄워 줍니다.']
          ]),
          {
            type: 'callout', style: 'tip', title: 'Enhanced Options 적용 및 후속 학습 안내',
            body: 'SE11 Search Help의 `Enhanced Options`에서 `Linguistic Search`와 `Fuzzy Search`를 **둘 다 선택**하면 적용됩니다. `Collective Search Help`와 `Append Search Help`의 상세 구성은 후속 수업 진도에 맞춰 이 탭에 보강할 예정입니다.'
          }
        ]
      },
      exSec('ex', 'Exercise 18', 'p. 281', 'Exercise 18: Create Search Helps',
        text('`SE11`에서 `Z`/`Y` Elementary Search Help를 생성해 `Selection Method`, `Dialog Behavior`, `Parameter`(`LPos` · `SPos`)를 설정하고 Table · Structure · Data Element 또는 ABAP `MATCHCODE OBJECT` / `AS LISTBOX`로 연결해 `F4` 동작을 확인합니다.'),
        {
          type: 'practice',
          title: 'Exercise 18 필수 체크포인트',
          steps: [
            { step: '1', action: 'Elementary Search Help 생성 및 Dialog Behavior 확인', detail: 'Selection Method에 DB 테이블/View를 지정하고 3가지 Dialog Behavior 차이를 F4 테스트로 확인합니다.' },
            { step: '2', action: 'LPos · SPos 지정 후 Table / Structure / Data Element 연결', detail: '결과 열 번호(LPos)와 제한 조건 화면 순서(SPos)를 배치한 뒤 Table(Srch Help), Structure(Input Help), Data Element(Further Characteristics) 중 대상 위치에 등록합니다.' },
            { step: '3', action: 'ABAP Selection Screen 적용 및 Enhanced Options 확인', detail: 'PARAMETERS에 MATCHCODE OBJECT 또는 AS LISTBOX VISIBLE LENGTH를 적용해 보고, HANA 환경에서는 Enhanced Options(Linguistic · Fuzzy Search)를 확인합니다.' }
          ]
        }),
      pendingSec('ex', 'Exercise 19', 'p. 289', 'Exercise 19: Create Collective Search Helps (준비 중)', '준비 중 · BC430 교재 p. 289 실습은 Collective Search Help 진도에 맞춰 정리할 예정입니다.'),
      pendingSec('ex', 'Exercise 20', 'p. 293', 'Exercise 20: Create Append Search Helps (준비 중)', '준비 중 · BC430 교재 p. 293 실습은 Append Search Help 진도에 맞춰 정리할 예정입니다.')
    ],
    '11/26',
    [
      ['`ZABAP_F##_22`', 'ABAP Search Help']
    ]
  );

  const unitOrder = [
    ...Array.from({ length: 13 }, (_, i) => `unit-${String(i + 1).padStart(2, '0')}`),
    ...Array.from({ length: 9 }, (_, i) => `bc430-${String(i + 1).padStart(2, '0')}`)
  ];
  const connections = {
    'unit-01': ['unit-02', 'sap-tcode-reference', 'sap-gui-shortcuts'],
    'unit-02': ['unit-01', 'unit-03', 'sap-tcode-reference', 'sap-gui-shortcuts'],
    'unit-03': ['unit-02', 'unit-04', 'unit-05', 'abap-useful-syntax', 'sap-tcode-reference'],
    'unit-04': ['unit-03', 'unit-05', 'sap-tcode-reference'],
    'unit-05': ['unit-03', 'unit-06', 'unit-07', 'bc430-02'],
    'unit-06': ['unit-05', 'unit-07', 'bc430-01', 'bc430-03', 'bc430-04'],
    'unit-07': ['unit-05', 'unit-06', 'unit-08', 'unit-09', 'bc430-09'],
    'unit-08': ['unit-07', 'unit-09'],
    'unit-09': ['unit-07', 'unit-08'],
    'unit-10': ['unit-08', 'unit-09'],
    'unit-11': ['unit-03', 'unit-06'],
    'unit-12': ['unit-02', 'unit-11'],
    'unit-13': ['bc430-07', 'sap-tcode-reference'],
    'bc430-01': ['bc430-02', 'bc430-03', 'unit-06', 'sap-tcode-reference'],
    'bc430-02': ['bc430-01', 'bc430-03', 'unit-03', 'unit-05'],
    'bc430-03': ['bc430-02', 'bc430-04', 'bc430-05', 'unit-06'],
    'bc430-04': ['bc430-03', 'unit-06', 'sap-tcode-reference'],
    'bc430-05': ['bc430-03', 'bc430-06', 'bc430-08'],
    'bc430-06': ['bc430-02', 'bc430-07', 'sap-tcode-reference'],
    'bc430-07': ['bc430-03', 'bc430-06', 'unit-13', 'sap-tcode-reference'],
    'bc430-08': ['bc430-01', 'bc430-05', 'bc430-09', 'sap-tcode-reference'],
    'bc430-09': ['bc430-02', 'bc430-05', 'bc430-08', 'unit-07', 'sap-tcode-reference']
  };
  for (const [id, targets] of Object.entries(connections)) docs[id].sections.push(related(targets));

  docs['welcome-abap'].topWidgetId = 'knowledge-map-entry';
  docs['abap-thinking-flow'] = {
    id: 'abap-thinking-flow',
    track: 'abap',
    studentOnly: true,
    stepNum: '',
    categoryId: '학습 가이드',
    hideSectionNumbers: true,
    hideToc: true,
    title: 'ABAP 사고 흐름',
    subtitle: '전체 그림 · Process · Report 구조별 사고 프로세스',
    aliases: ['ABAP 사고 흐름', '사고 흐름', 'ABAP 사고법', '오븐 비유', '오븐 트레이', '트레이', '출력용 테이블', '계산용 테이블'],
    tcodes: [],
    specs: {},
    summary: '',
    sections: [
      section(
        '전체적인 그림',
        {
          type: 'nested',
          caption: 'SBOOK의 CONNID 필드를 예로 든 타입 참조 관계입니다. (Domain 사용)',
          root: {
            title: 'TABLE',
            code: 'gt_bookings',
            desc: 'Internal Table 예시: `DATA gt_bookings TYPE TABLE OF sbook.`',
            children: [
              {
                title: 'STRUCTURE · WORK AREA',
                code: 'SBOOK · gs_booking',
                desc: 'SBOOK의 행 타입을 기준으로 한 Work Area: `DATA gs_booking LIKE LINE OF gt_bookings.`',
                children: [
                  {
                    title: 'DATA ELEMENT',
                    code: 'S_CONN_ID',
                    desc: 'CONNID 필드의 의미(항공편 연결 번호) · 레이블을 정의하고, 기술 속성은 Domain을 참조합니다.',
                    children: [
                      {
                        title: 'Domain',
                        badge: '참조',
                        code: 'S_CONN_ID',
                        desc: '위 Data Element와 이름이 같은 별도 객체입니다. 여러 DATA ELEMENT가 같은 Domain을 공유할 수 있습니다.',
                        items: [
                          { name: 'DATA TYPE', example: 'NUMC', sub: '숫자 문자형' },
                          { name: '길이 · 소수 자릿수', example: '4자리 · 소수 없음' },
                          { name: '값 범위', example: '0000–9999', sub: 'NUMC 4자리의 표현 범위 · 실제 운항편 존재 여부와는 별개' }
                        ]
                      }
                    ]
                  },
                  { title: 'DATA', code: "'0400'", desc: '변수에 담긴 실제 값의 예: `gs_booking-connid = \'0400\'.`' }
                ]
              }
            ]
          }
        }
      ),
      section(
        'Process',
        {
          type: 'flow',
          steps: [
            { badge: '1', title: '파라미터 받기', desc: '검색 조건 입력 (`PARAMETERS`, `SELECT-OPTIONS`)' },
            { badge: '2', title: '변수 · Type 선언', desc: '`ts_`로 구조를 정하고 `gt_` 테이블 → `gs_` Work Area 순서로 선언 (`FOR` 참조 변수 먼저 선언)' },
            { badge: '3', title: 'Data 삽입', desc: '조건에 맞는 DB 데이터 `SELECT`' },
            { badge: '4', title: 'Manipulate', desc: '`LOOP`, `READ TABLE`, `INSERT`, `MODIFY`, `MOVE-CORRESPONDING`' }
          ]
        }
      ),
      section(
        'Report 구조별 사고 프로세스',
        {
          type: 'nested',
          root: {
            badge: 'REPORT',
            title: 'REPORT zabap_f##_##.',
            code: 'SCUSTOM + SBOOK',
            desc: '사전 사고: `SCUSTOM`(고객별 = 출력용 베이스 `gt_output`) + `SBOOK`(예약별 = 날짜별 예약 건수 계산용 `gt_data`)',
            children: [
              {
                badge: '선언부',
                title: '출력용 · 계산용 · 검색조건 선언',
                code: 'TYPES · DATA · SELECT-OPTIONS',
                desc: '어떤 오븐(`gt_`)·트레이(`gs_`)·검색조건(`so_`)이 필요한지 3덩어리로 준비. [[unit-05|다른 선언 방법 보기]] — Unit 5 Internal Table 타입과 변수 선언의 ‘선언 방법별 비교’',
                layout: 'wide',
                items: [
                  {
                    name: '출력용 테이블',
                    sequence: ['ts_output', 'gt_output', 'gs_output'],
                    sub: '화면에 보여 줄 최종 뼈대 구조',
                    snippet: `TYPES: BEGIN OF ts_output,
         id      TYPE scustom-id,
         name    TYPE scustom-name,
         bookcnt TYPE i,
         grade   TYPE c LENGTH 1,
       END OF ts_output.
DATA gt_output TYPE TABLE OF ts_output.
DATA gs_output LIKE LINE OF gt_output.`
                  },
                  {
                    name: '계산용 테이블',
                    sequence: ['ts_data', 'gt_data', 'gs_data'],
                    sub: '연결 키와 집계값(`customid`, `bookcnt`)만 선언',
                    snippet: `TYPES: BEGIN OF ts_data,
         customid TYPE sbook-customid,
         bookcnt  TYPE i,
       END OF ts_data.
DATA gt_data TYPE TABLE OF ts_data.
DATA gs_data LIKE LINE OF gt_data.`
                  },
                  {
                    name: '검색조건 (`so_id` · `so_date`)',
                    sub: '`FOR` 뒤에는 미리 선언한 변수 지정',
                    snippet: `DATA gv_order_date TYPE sbook-order_date.
SELECT-OPTIONS: so_id   FOR gs_output-id,
                so_date FOR gv_order_date.`
                  }
                ]
              },
              {
                badge: 'INITIALIZATION',
                title: 'Selection Screen 표시 전 초기값 세팅 (`so_date`)',
                code: '화면 표시 전',
                snippet: `INITIALIZATION.
  so_date-sign   = 'I'.
  so_date-option = 'BT'.
  so_date-low    = sy-datum(4) && '0101'.
  so_date-high   = sy-datum.
  APPEND so_date.`
              },
              {
                badge: 'DISPLAY SELECTION SCREEN',
                title: 'Selection Screen 화면 표시 · 사용자 입력 대기',
                code: '자동 표시 · PBO',
                desc: '선언한 `PARAMETERS`·`SELECT-OPTIONS` 화면이 표시되어 실행(F8)을 기다림 (필드 숨김·동적 제어가 필요하면 `AT SELECTION-SCREEN OUTPUT` 사용)'
              },
              {
                badge: 'AT SELECTION-SCREEN',
                title: '입력값 검증 · 권한 체크 (`so_date[]`)',
                code: 'PAI · 체크 로직',
                snippet: `AT SELECTION-SCREEN.
  IF so_date[] IS INITIAL.
    MESSAGE '예약일 검색 조건을 입력해 주세요.' TYPE 'E'.
  ENDIF.`
              },
              {
                badge: 'START-OF-SELECTION',
                title: '메인 처리 로직 (조회 → 집계 → 합치기)',
                code: '핵심 처리',
                children: [
                  {
                    badge: 'SELECT 1',
                    title: '출력용 뼈대 테이블 채우기 (`gt_output` ← `SCUSTOM`)',
                    code: 'SCUSTOM',
                    snippet: `SELECT id name
  FROM scustom
  INTO CORRESPONDING FIELDS OF TABLE gt_output
  WHERE id IN so_id.`
                  },
                  {
                    badge: 'SELECT 2',
                    title: '계산용 테이블 채우기 (`gt_data` ← `SBOOK`)',
                    code: 'SBOOK',
                    desc: '취소 예약을 제외해야 하면 `WHERE` 절에 `AND cancelled <> \'X\'` 추가',
                    snippet: `SELECT customid COUNT( * ) AS bookcnt
  FROM sbook
  INTO CORRESPONDING FIELDS OF TABLE gt_data
  WHERE customid   IN so_id
    AND order_date IN so_date
  GROUP BY customid.`
                  },
                  {
                    badge: 'LOOP AT ~ ENDLOOP',
                    title: '오븐(`gt_output`)에서 트레이(`gs_output`)를 꺼내 합치고 다시 밀어 넣기',
                    code: 'gt_output ⇐ gs_output ⇐ gs_data',
                    layout: 'stack',
                    items: [
                      {
                        name: '1. 계산용 트레이 비우기 (`gs_data`)',
                        snippet: `LOOP AT gt_output INTO gs_output.
  CLEAR gs_data.`
                      },
                      {
                        name: '2. 계산용 테이블에서 일치 행 읽기 (`gt_data` → `gs_data`)',
                        snippet: `  READ TABLE gt_data INTO gs_data WITH KEY customid = gs_output-id.`
                      },
                      {
                        name: '3. 트레이 값 대입 · 조건 분기 (`gs_data` → `gs_output`)',
                        snippet: `  IF sy-subrc = 0.
    gs_output-bookcnt = gs_data-bookcnt.
  ENDIF.
  IF gs_output-bookcnt > 10.
    gs_output-grade = 'P'.
  ELSEIF gs_output-bookcnt <= 4.
    gs_output-grade = 'S'.
  ELSE.
    gs_output-grade = 'G'.
  ENDIF.`
                      },
                      {
                        name: '4. 작업 끝난 트레이를 오븐 현재 자리에 반영 (`gs_output` → `gt_output`)',
                        sub: '루프가 현재 행을 기억해 `INDEX` 생략 가능 (`READ TABLE`이 `sy-tabix`를 덮어쓰므로 `INDEX sy-tabix` 직접 사용 주의)',
                        snippet: `  MODIFY gt_output FROM gs_output.
ENDLOOP.`
                      }
                    ]
                  }
                ]
              },
              {
                badge: 'END-OF-SELECTION / 출력',
                title: '완성된 출력용 테이블(`gt_output`) 화면 표시',
                code: 'List Buffer · Display',
                desc: '단축 호출: `cl_demo_output=>display( gt_output ).` (`WRITE`는 List Buffer → `Display List Buffer as List`, 실무는 ALV)',
                snippet: `END-OF-SELECTION.
  CALL METHOD cl_demo_output=>display
    EXPORTING
      data = gt_output.`
              }
            ]
          }
        }
      ),
      section(
        '전체 코드 (SCUSTOM · SBOOK)',
        code('고객별 예약 건수 조회 Report 사고 흐름 전체 예제', `REPORT zabap_f##_##.

" [선언부] 출력용 테이블 (표시할 뼈대)
TYPES: BEGIN OF ts_output,
         id      TYPE scustom-id,
         name    TYPE scustom-name,
         bookcnt TYPE i,
         grade   TYPE c LENGTH 1,
       END OF ts_output.
DATA gt_output TYPE TABLE OF ts_output.
DATA gs_output LIKE LINE OF gt_output.

" [선언부] 계산용 테이블 (고객 ID별 예약 건수)
TYPES: BEGIN OF ts_data,
         customid TYPE sbook-customid,
         bookcnt  TYPE i,
       END OF ts_data.
DATA gt_data TYPE TABLE OF ts_data.
DATA gs_data LIKE LINE OF gt_data.

" [선언부] 검색조건 (FOR 뒤에는 선언된 변수 지정)
DATA gv_order_date TYPE sbook-order_date.
SELECT-OPTIONS: so_id   FOR gs_output-id,
                so_date FOR gv_order_date.

" [INITIALIZATION] Selection Screen 표시 전 초기 검색 기간 설정 (올해 1월 1일 ~ 오늘)
INITIALIZATION.
  so_date-sign   = 'I'.
  so_date-option = 'BT'.
  so_date-low    = sy-datum(4) && '0101'.
  so_date-high   = sy-datum.
  APPEND so_date.

" --> 여기서 Selection Screen이 자동 표시되어 사용자 입력 대기 (DISPLAY SELECTION SCREEN)

" [AT SELECTION-SCREEN] 입력값 검증 · 권한 체크
AT SELECTION-SCREEN.
  IF so_date[] IS INITIAL.
    MESSAGE '예약일 검색 조건을 입력해 주세요.' TYPE 'E'.
  ENDIF.

" [START-OF-SELECTION] 메인 데이터 조회 및 가공
START-OF-SELECTION.
  " 1) 출력용 뼈대 테이블 채우기 (SCUSTOM 기준)
  SELECT id name
    FROM scustom
    INTO CORRESPONDING FIELDS OF TABLE gt_output
    WHERE id IN so_id.

  " 2) 계산용 테이블 채우기 (SBOOK 조건별 예약 건수 집계)
  SELECT customid COUNT( * ) AS bookcnt
    FROM sbook
    INTO CORRESPONDING FIELDS OF TABLE gt_data
    WHERE customid   IN so_id
      AND order_date IN so_date
    GROUP BY customid.

  " 3) 계산용 테이블을 출력용 테이블에 합치기
  LOOP AT gt_output INTO gs_output.
    CLEAR gs_data.
    READ TABLE gt_data INTO gs_data WITH KEY customid = gs_output-id.
    IF sy-subrc = 0.
      gs_output-bookcnt = gs_data-bookcnt.
    ENDIF.

    IF gs_output-bookcnt > 10.
      gs_output-grade = 'P'.
    ELSEIF gs_output-bookcnt <= 4.
      gs_output-grade = 'S'.
    ELSE.
      gs_output-grade = 'G'.
    ENDIF.

    " LOOP 안에서는 현재 순회 행을 기억하므로 INDEX 생략 가능
    MODIFY gt_output FROM gs_output.
  ENDLOOP.

" [END-OF-SELECTION] 완성된 출력용 테이블 화면 표시
END-OF-SELECTION.
  CALL METHOD cl_demo_output=>display
    EXPORTING
      data = gt_output.`)
      )
    ]
  };
  docs['sap-gui-programs'] = {
    id: 'sap-gui-programs',
    track: 'abap',
    studentOnly: true,
    stepNum: '',
    categoryId: '학습 가이드',
    hideSectionNumbers: true,
    title: 'SAP GUI 프로그램 정리표',
    subtitle: 'SE80 · Package ZBC400_F## 실습 Program 파트별 가이드',
    aliases: ['SAP GUI 프로그램 정리표', '프로그램 정리표', '실습 프로그램 정리표', 'ZBC400_F##'],
    tcodes: [],
    specs: {},
    summary: 'SE80 Repository Browser의 Package ZBC400_F## 아래에 있는 실습 Program을 공부 파트별로 정리했습니다. F## 자리에 본인 번호를 넣어 SE80 또는 SE38에서 열어 복습하세요.',
    sections: [
      section('SE80에서 찾는 법',
        {
          type: 'callout',
          style: 'tip',
          title: 'Package ZBC400_F## 열기',
          body: 'SAP GUI에서 **SE80**을 열고 왼쪽 Repository Browser에서 **Package** → **`ZBC400_F##`**(본인 번호)을 입력하면 아래 `Programs` 목록 전체를 펼쳐서 볼 수 있습니다. 새로 만든 Program이 목록에 바로 안 보이면 Package 우클릭 → **Additional Functions → Rebuild Object List**를 실행하세요.'
        }
      ),
      section('파트별 한눈에 보기',
        table(['교재 Unit · 파트', '관련 위키 문서', '열어 볼 실습 Program (`ZBC400_F##`)'], [
          ['Unit 2 · Workbench · 기초 문법', '[[unit-02|Unit 2 · ABAP Workbench]]', '`ZABAP_F##_01`, `02`<br>`ZBC400_F##_HELLO`'],
          ['Unit 3 · 자료형 · 연산 · 반복문 · 시스템 필드', '[[unit-03|Unit 3 · ABAP 기본 언어 요소]]', '`ZABAP_F##_03`, `04`, `05`, `06`, `07`<br>`ZBC400_F##_COMPUTE`, `ZBC400_F##_LOOP`'],
          ['Unit 4 · 모듈화 (FORM · Function Module · Class)', '[[unit-04|Unit 4 · ABAP 모듈화 기법]]', '`ZABAP_F##_08`, `09`, `10`, `11`, `12`<br>`ZBC400_F##_SUBROUTINE`, `ZBC400_F##_FUNCTION_MODULE`, `ZBC400_F##_FUNCTION_MODULE_2`, `ZBC400_F##_GLOBAL_CLASS_1`, `ZBC400_F##_GLOBAL_CLASS_2`'],
          ['Unit 5 · Structure · Internal Table', '[[unit-05|Unit 5 · 복합 데이터 객체]]', '`ZABAP_F##_13`, `14`, `15`, `16`, `21`<br>`ZBC400_F##_STRUCTURE`, `ZBC430S_ITAB_SORTED`'],
          ['BC400 Unit 6 · Open SQL', '[[unit-06|BC400 Unit 6 · 데이터 모델링과 데이터 조회]]', '[[abap-sql-guide|ABAP SQL 가이드]] 연계'],
          ['BC430 Unit 2 · ABAP Dictionary 타입 · Structure', '[[bc430-02|BC430 Unit 2 · ABAP Dictionary 데이터 타입]]', '`ZABAP_F##_18`, `19`<br>`ZBC430S_DATA_ELEMENTS`, `ZBC430S_F##_STRUCT_NESTED`, `ZBC430S_F##_STRUCT_DEEP`'],
          ['BC430 Unit 3 · 데이터베이스 테이블 · 통화 서식', '[[bc430-03|BC430 Unit 3 · 데이터베이스 테이블]]', '`ZABAP_F##_20`'],
          ['BC430 Unit 9 · Search Help · Selection Screen 컨트롤', '[[bc430-09|BC430 Unit 9 · Search Help]]', '`ZABAP_F##_22`'],
          ['Unit 7 · Classic ABAP Report · Select-Options', '[[unit-07|Unit 7 · Classic ABAP Reports]]', '`ZABAP_F##_17`<br>`ZBC400_F##_REP_A`, `ZBC400_F##_REP_B`'],
          ['Unit 9 · SAP List Viewer (ALV)', '[[unit-09|Unit 9 · SAP List Viewer (ALV)]]', '`ZABAP_F##_23`']
        ])
      ),
      section('ZABAP_F##_01 ~ 23 · 수업 진도별 Program',
        text('강사님과 수업 순서대로 작성한 핵심 개념별 Program 목록입니다.'),
        table(['Program', '설명 (Description)', '교재 Unit', '확인 포인트'], [
          ['`ZABAP_F##_01`', 'ABAP Write statement', '[[unit-02|Unit 2]]', '기본 `WRITE` 출력과 줄바꿈(`/`)'],
          ['`ZABAP_F##_02`', 'ABAP Syntax', '[[unit-02|Unit 2]]', '문장 마침표(.), 주석(`*`, `"`), 체인 문법(`:`)'],
          ['`ZABAP_F##_03`', 'ABAP Data Type & Elementary Data Objects', '[[unit-03|Unit 3]]', '기본 자료형(`c`, `n`, `i`, `p`, `d`, `t`, `string`)과 `TYPE`/`LIKE`·초기값'],
          ['`ZABAP_F##_04`', 'ABAP Calculation', '[[unit-03|Unit 3]]', '산술 연산, `DIV`/`MOD`, 계산 결과 변수 저장'],
          ['`ZABAP_F##_05`', 'ABAP IF Conditional Statement', '[[unit-03|Unit 3]]', '`IF` / `ELSEIF` / `ELSE` / `CASE` 조건 분기'],
          ['`ZABAP_F##_06`', 'ABAP Loop Statement', '[[unit-03|Unit 3]]', '`DO`, `WHILE`, `CONTINUE`, `EXIT`, `sy-index`'],
          ['`ZABAP_F##_07`', 'ABAP sy-subrc System Field', '[[unit-03|Unit 3]]', '문장 실행 결과 반환 코드 `sy-subrc` 판별'],
          ['`ZABAP_F##_08`', 'ABAP Subroutine', '[[unit-04|Unit 4]]', '`FORM ... ENDFORM` 정의와 `PERFORM` 호출'],
          ['`ZABAP_F##_09`', 'ABAP Subroutine Parameters', '[[unit-04|Unit 4]]', '`USING` / `CHANGING`, `VALUE(...)` 값 전달 vs 참조 전달'],
          ['`ZABAP_F##_10`', 'ABAP Function Module', '[[unit-04|Unit 4]]', '`SE37` Function Module 인터페이스와 `CALL FUNCTION` 호출 방향'],
          ['`ZABAP_F##_11`', 'ABAP Call Class Method', '[[unit-04|Unit 4]]', 'Static Method(`=>`)와 Instance Method(`->`) 호출'],
          ['`ZABAP_F##_12`', 'ABAP Local Class', '[[unit-04|Unit 4]]', '`CLASS ... DEFINITION / IMPLEMENTATION`, `PUBLIC`/`PRIVATE`'],
          ['`ZABAP_F##_13`', 'ABAP Structure Variable', '[[unit-05|Unit 5]]', '로컬 Structure Type(`ts_`)·Structure Variable(`gs_`) 선언과 `MOVE-CORRESPONDING`'],
          ['`ZABAP_F##_14`', 'ABAP Internal Table', '[[unit-05|Unit 5]]', '`STANDARD`/`SORTED`/`HASHED` Internal Table 선언·행 조작(`APPEND`, `INSERT`, `READ`, `MODIFY`, `DELETE`, `SORT`)'],
          ['`ZABAP_F##_15`', 'ABAP Header Line', '[[unit-05|Unit 5]]', '기존 코드의 `WITH HEADER LINE`과 `CLEAR itab` vs `CLEAR itab[]` 구분'],
          ['`ZABAP_F##_16`', 'ABAP Internal table & Work area', '[[unit-05|Unit 5]]', '글로벌/로컬 `TYPE`, `TYPE TABLE OF`, `TYPE LINE OF`, `LIKE` 선언 비교'],
          ['`ZABAP_F##_17`', 'ABAP Select-Options', '[[unit-07|Unit 7]]', '`SELECT-OPTIONS`(`SIGN`·`OPTION`·`LOW`·`HIGH`), `WHERE ... IN`과 Selection Screen'],
          ['`ZABAP_F##_18`', 'ABAP Flat(Simple & Nested) Structure', '[[bc430-02|BC430 Unit 2]]', '`Simple structure` vs `Nested structure`와 `.INCLUDE` 접근 비교'],
          ['`ZABAP_F##_19`', 'ABAP Deep Structure', '[[bc430-02|BC430 Unit 2]]', '컴포넌트에 `Table Type`이 포함된 `Deep structure` 구성과 활용'],
          ['`ZABAP_F##_20`', 'ABAP KRW Currency', '[[bc430-03|BC430 Unit 3]]', '`SELECT SINGLE` 조회 후 `WRITE ... CURRENCY`로 `KRW`(소수 자릿수 0) 금액 필드 통화 서식 출력'],
          ['`ZABAP_F##_21`', 'ABAP No -', '[[unit-05|Unit 5]]', '`TYPES` 없이 `DATA: BEGIN OF ... END OF`로 `Work Area` 직접 선언, 모든 컴포넌트가 문자형(`CHAR`-like)일 때 `-` 없이 `WRITE: gs_data.` 일괄 출력'],
          ['`ZABAP_F##_22`', 'ABAP Search Help', '[[bc430-09|BC430 Unit 9]]', 'Table · Structure · Data Element 연결 `Search Help` (`PARAMETERS`) 및 `AS LISTBOX VISIBLE LENGTH` · `AS CHECKBOX` · `RADIOBUTTON GROUP` 구성'],
          ['`ZABAP_F##_23`', 'ABAP ALV', '[[unit-09|Unit 9]]', '`SELECT-OPTIONS` · `SFLIGHT` 조회 · `LOOP AT` / `MODIFY`로 점유율(`percentage`) 계산 후 `CL_SALV_TABLE`로 ALV 출력']
        ])
      ),
      section('ZBC400_F##_* · BC400 교재 실습 Program',
        text('BC400 교재 Exercise를 따라 작성·복사한 실습 Program입니다.'),
        table(['Program', '교재 Unit', '확인 포인트'], [
          ['`ZBC400_F##_HELLO`', '[[unit-02|Unit 2]]', '첫 실행 가능 Program 생성·활성화·실행 (Exercise 2)'],
          ['`ZBC400_F##_COMPUTE`', '[[unit-03|Unit 3]]', '기본 연산문과 변수 처리 실습 (Exercise 4)'],
          ['`ZBC400_F##_LOOP`', '[[unit-03|Unit 3]]', '반복문과 디버거 단계 실행 확인'],
          ['`ZBC400_F##_SUBROUTINE`', '[[unit-04|Unit 4]]', 'Subroutine(`FORM` / `PERFORM`) 구현 실습 (Exercise 6)'],
          ['`ZBC400_F##_FUNCTION_MODULE`', '[[unit-04|Unit 4]]', 'Function Module 호출 실습 1 (Exercise 7)'],
          ['`ZBC400_F##_FUNCTION_MODULE_2`', '[[unit-04|Unit 4]]', '직접 만든 Function Module 호출 실습 2 (Exercise 9)'],
          ['`ZBC400_F##_GLOBAL_CLASS_1`', '[[unit-04|Unit 4]]', 'Global Class Static Method 호출 실습 1 (Exercise 10)'],
          ['`ZBC400_F##_GLOBAL_CLASS_2`', '[[unit-04|Unit 4]]', 'Global Class 생성 및 Method 호출 실습 2 (Exercise 11–12)'],
          ['`ZBC400_F##_STRUCTURE`', '[[unit-05|Unit 5]]', 'Structured Data Objects 실습 (Exercise 13)'],
          ['`ZBC400_F##_REP_A`', '[[unit-07|Unit 7]]', 'Select-Options·Classic List·아이콘·컬럼 서식 실습 템플릿 A (Exercise 20)'],
          ['`ZBC400_F##_REP_B`', '[[unit-07|Unit 7]]', 'Select-Options·Classic List·Report 이벤트 실습 템플릿 B (Exercise 21)']
        ])
      ),
      section('ZBC430S_* · BC430(Dictionary · Table) 실습 Program',
        text('BC430 ABAP Dictionary 파트에서 표준 예제(`SAPBC430S_*`)를 기반으로 다루는 Program입니다.'),
        table(['Program', '원본 / 설명', '교재 Unit', '확인 포인트'], [
          ['`ZBC430S_DATA_ELEMENTS`', 'Program `SAPBC430S_DATA_ELEMENTS`', '[[bc430-02|BC430 Unit 2]]', '`Data Element`·`Domain` 참조와 `Field Label`·`F4 Help` 동작 확인 (Ex 1)'],
          ['`ZBC430S_F##_STRUCT_NESTED`', 'Report `SAPBC430S_STRUCT_NESTED`', '[[bc430-02|BC430 Unit 2]]', '`Nested structure`와 `.INCLUDE` 컴포넌트 접근 방식 확인 (Ex 2)'],
          ['`ZBC430S_F##_STRUCT_DEEP`', 'Deep Structure 실습', '[[bc430-02|BC430 Unit 2]]', 'Internal Table(`Table Type`)을 포함하는 `Deep structure` 확인 (Ex 4)'],
          ['`ZBC430S_ITAB_SORTED`', 'Program `SAPBC430S_ITAB_SORTED`', '[[unit-05|BC400 Unit 5]]', '`Sorted Table` 선언·정렬 유지·키 접근 확인']
        ])
      )
    ]
  };
  const basicSec = (tab, badge, title, ...blocks) => ({ tab, badge, title, blocks });
  docs['basic-session-review'] = {
    id: 'basic-session-review',
    track: 'abap',
    studentOnly: true,
    stepNum: '',
    categoryId: '학습 가이드',
    hideSectionNumbers: true,
    filterTocByTab: true,
    defaultTab: 'all',
    title: 'Basic Session Review',
    subtitle: '2026-11-26 ABAP 시험 대비 Basic Session 핵심 강조점 · 실전 코드 리뷰 · 사내 강사님 공식 답안',
    aliases: ['Basic Session Review', 'Basic Session', 'ABAP 시험 대비', 'ZPROG_BASIC_F_##', 'ZPROG_CL5_T14_005', 'ZBS_FLIGHT_F_##', 'ZBASIC_MSG_F_##', 'so_date[]'],
    tcodes: ['SE09', 'SE11', 'SE37', 'SE38', 'SE80', 'SE91', 'SE93'],
    specs: {
      '세션 일자': '2026-11-26 (목) · 수업 후 Basic Session',
      '실습 모델': 'SFLIGHT · SCARR (항공 실습 모델)',
      '네이밍 규칙': '`?_##` (`E`=5반 / `F`=6반 · `##`=본인 번호)',
      '핵심 범위': 'DDIC · Event · Subroutine · Open SQL · LOOP'
    },
    summary: '사내 강사님이 출제한 **ABAP 시험 대비 Basic Session** 문제의 핵심 강조 포인트와, 직접 작성한 Report 코드에서 놓치기 쉬운 **8가지 치명적·실무적 함정**, 그리고 **사내 강사님 공식 답안(`ZPROG_CL5_T14_005`)**을 원문 주석과 함께 한눈에 복습할 수 있게 정리했습니다.',
    sectionTabs: [
      {
        id: 'highlights',
        kind: 'lesson',
        badge: '핵심',
        label: '강사님 강조점',
        desc: 'Basic Session 문제 1~4의 전체 구조, 네이밍 룰, 그리고 사내 강사님이 시험 단골 함정으로 콕 짚은 5가지 포인트를 정리합니다.'
      },
      {
        id: 'review',
        kind: 'exercise',
        badge: '리뷰',
        label: '놓친 포인트 8선',
        desc: '직접 구현한 코드에서 발생한 구조적 오류(Event 누락 · so_fdt[] · WHERE IN · USING/CHANGING · 변수 덮어쓰기)와 실무 디테일을 원인·해결책과 함께 분석합니다.'
      },
      {
        id: 'solution',
        kind: 'lesson',
        badge: '답안',
        label: '강사님 공식 답안',
        desc: '사내 강사님의 공식 답안(ZPROG_CL5_T14_005) 전체 원문과 코드에 담긴 핵심 실무 포인트 6가지를 정리합니다.'
      },
      {
        id: 'checklist',
        kind: 'exercise',
        badge: '점검',
        label: '시험 직전 체크리스트',
        desc: '강사님이 제시한 13개 이해도 체크리스트와 관련 CodeWiki 문서 연결, 심화 실습(Function Module 전환) 가이드입니다.'
      }
    ],
    sections: [
      /* ===================== TAB 1: 강사님 핵심 강조점 ===================== */
      basicSec('highlights', '구조', 'Basic Session 문제 1–4 전체 설계 흐름과 네이밍 룰',
        text(
          '이번 Basic Session은 시험에 자주 출제되는 **Workbench 세팅 → DDIC(Domain · Data Element · Structure) → Message Class → Report Event · Subroutine → Open SQL JOIN · LOOP 출력**의 전 과정을 하나의 프로그램으로 꿰는 종합 점검 과제입니다.',
          '강사님이 안내사항에서 가장 먼저 강조한 두 가지는 **1) AI에 의존하지 않고 내가 막히는 지점을 직접 찾아 개념으로 메우는 것**, **2) 객체명뿐 아니라 변수 Prefix(`gt_`, `gs_`, `pa_`, `so_`, `pv_`, `pt_`, `gv_`, `lv_`)까지 네이밍 룰을 철저히 지키는 것**입니다.'
        ),
        {
          type: 'flow',
          caption: 'Basic Session 4단계 구현 흐름 (? = E:5반 / F:6반, ## = 본인 번호)',
          steps: [
            { badge: '문제 1', title: 'Workbench 기본 세팅', desc: 'CTS → Package → Program → T-Code 생성' },
            { badge: '문제 2', title: 'DDIC · Message Class', desc: 'Domain/DE · Global/Local Structure · ITAB · SE91' },
            { badge: '문제 3', title: 'Event · 입력/데이터 검증', desc: 'INITIALIZATION · AT SELECTION-SCREEN · MESSAGE E' },
            { badge: '문제 4', title: 'JOIN 조회 · LOOP 가공 · 출력', desc: 'START-OF-SELECTION · GET_DATA(USING/CHANGING) · cl_demo_output' }
          ]
        },
        table(['구분', '네이밍 룰 (`?`: E/F, `##`: 번호)', '생성 T-Code · 핵심 조건'], [
          ['CTS (Change Request)', '`Basic_ABAP1_?_##` (Short Description)', '`SE09` — 이후 생성하는 Package · DDIC · Program을 모두 연결'],
          ['Package', '`ZPAC_Basic_?_##`', '`SE80` — 로컬 `$TMP`가 아닌 전송 가능한 Package로 생성'],
          ['Program / T-Code', '`ZPROG_BASIC_?_##` / 기본 T-Code 룰', '`SE38` · `SE93` (Report Transaction 연결)'],
          ['Domain / Data Element', 'DO: `ZDO_SEATRE_?_##` / DE: `ZD_SEATRE_?_##`', '`SE11` — `INT4`, 길이 `10`, Description `Seats Remain` (DO·DE 혼동 주의)'],
          ['Global Structure', '`ZBS_FLIGHT_?_##`', '`SE11` — `SFLIGHT`·`SCARR` 기존 DE 8개 + `SEATS_REMAIN` 1개 (총 9필드)'],
          ['Local Structure & ITAB', '`ts_*` (`BEGIN OF ~ END OF`) → `gt_*`', 'Global Structure를 `INCLUDE TYPE`으로 포함하고 `status TYPE char10` 추가'],
          ['Message Class', '`ZBASIC_MSG_?_##`', '`SE91` — 모든 검증 오류를 하드코딩 문구가 아닌 Message Class로 출력']
        ])
      ),
      basicSec('highlights', 'SE91 · 선언', 'Message Class (SE91) 생성과 Report Program 선언 방법',
        text('Basic Session 문제 2-3과 문제 3에서는 모든 오류 처리를 하드코딩 문자열이 아닌 **`Message Class`(`SE91`)**로 작성해야 합니다. 자세한 원리는 [[unit-03|BC400 Unit 3 · ABAP 기본 언어 요소]]의 `직접 문구와 Message Class (SE91 · REPORT 선언)`에서도 함께 복습할 수 있습니다.'),
        {
          type: 'practice',
          title: 'SE91 Message Class 생성 → Report Program 선언 4단계',
          steps: [
            { step: '1', action: 'SE91에서 Message Class 생성 (ZBASIC_MSG_?_##)', detail: 'T-Code SE91을 열고 Message Class 이름 ZBASIC_MSG_?_##을 입력한 뒤 Create를 누릅니다.' },
            { step: '2', action: 'Short Text 입력 후 Messages 탭에 번호별 문구 등록', detail: '000: 입력값을 입력해주세요. / 001: 작년과 내년 데이터만 조회 가능합니다. / 002: 조회되는 데이터 없습니다. 를 등록하고 Ctrl + S로 저장(Package · CTS 연결)합니다.' },
            { step: '3', action: 'Report Program 첫 줄에 MESSAGE-ID 선언', detail: 'REPORT zprog_basic_?_## MESSAGE-ID zbasic_msg_?_##. 처럼 Program 헤더에 기본 Message Class를 선언합니다.' },
            { step: '4', action: 'AT SELECTION-SCREEN에서 MESSAGE e000. 형태로 호출', detail: 'MESSAGE-ID를 선언해 두면 (zbasic_msg_?_##)를 매번 쓰지 않고 MESSAGE e000. / MESSAGE e002. 만으로 오류 메시지를 띄워 다음 화면 진입을 막을 수 있습니다.' }
          ]
        },
        table(['선언 · 호출 패턴', '코드 표기', '장점 · 참고'], [
          ['**`REPORT` 헤더 `MESSAGE-ID` 선언 (권장)**', '`REPORT zprog_basic_f_## MESSAGE-ID zbasic_msg_f_##.`<br>호출: `MESSAGE e000.`', 'Program 내 모든 `MESSAGE` 호출에서 `Message Class` 이름 반복 생략'],
          ['**개별 `MESSAGE` 문에 직접 지정**', '`MESSAGE e000(zbasic_msg_f_##).`', '`REPORT` 줄에 `MESSAGE-ID`가 없거나 다른 `Message Class`를 섞어 쓸 때 사용'],
          ['**자리표시자 `&` 전달**', '`MESSAGE i001 WITH sy-uname.`', '문구의 `&` 위치에 변수 값을 최대 4개까지 동적으로 삽입']
        ])
      ),
      basicSec('highlights', '핵심 함정', '사내 강사님이 콕 짚은 시험 단골 함정 5가지',
        {
          type: 'callout',
          style: 'warning',
          title: '함정 1 · Global Structure Activate 오류 ("힌트: 금액")',
          body: '`ZBS_FLIGHT_?_##`에 금액 필드 `PRICE`(데이터 타입 `CURR`)를 넣고 그냥 활성화하면 오류가 발생합니다. `SE11`의 **`Currency/quantity fields`** 탭으로 이동해 `PRICE` 행의 **Reference Table = `ZBS_FLIGHT_?_##`(자기 자신)**, **Reference Field = `CURRENCY`**를 연결해야 정상 활성화됩니다.'
        },
        {
          type: 'callout',
          style: 'point',
          title: '함정 2 · SELECT-OPTIONS를 PERFORM 파라미터로 넘길 때 `so_date` vs `so_date[]`',
          body: '`SELECT-OPTIONS`로 선언한 `so_fdt`는 **Header(1행 Structure)**와 **Body(Internal Table)**를 함께 가집니다. `PERFORM ... USING so_fdt`처럼 `[]` 없이 넘기면 **헤더 1행만** 넘어가고, `FORM`에서도 테이블로 받을 수 없습니다. 반드시 **`so_fdt[]`**로 바디만 넘기고 `FORM`에서는 `TYPES tt_fdt TYPE RANGE OF s_date.` 같은 **Range Table Type**으로 받으세요.'
        },
        {
          type: 'compare',
          items: [
            {
              tag: '함정 3 · 구문법 (Classic Open SQL)',
              title: 'FROM → INTO → WHERE (@ · 쉼표 없음)',
              points: [
                '컬럼은 **공백**으로 구분하고 ABAP 변수 앞에 **`@`를 쓰지 않음**',
                '**`INTO TABLE`**이 **`WHERE` 앞**에 위치',
                '구문법 안에 `@`나 쉼표 `,`를 하나라도 섞으면 즉시 문법 에러 발생'
              ]
            },
            {
              tag: '함정 3 · 신문법 (ABAP 7.40+ Strict Mode)',
              title: 'FROM → JOIN ON → WHERE → ORDER BY → INTO',
              points: [
                '컬럼은 **쉼표 `,`**로 구분하고 모든 ABAP 변수 앞에 **`@` 필수**',
                '**`INTO TABLE @gt_tab`**은 **무조건 문장 맨 마지막**에 위치',
                '구문법과 신문법을 한 `SELECT` 안에서 절대 혼용하지 말 것'
              ]
            }
          ]
        },
        table(['추가 강조 함정', '시험 핵심 원리', '꼭 지켜야 할 구현 규칙'], [
          ['**함정 4 · Message Type & Event 위치**', '검증 실패 시 **다음 화면으로 넘어가면 안 됨**', '`AT SELECTION-SCREEN` 이벤트에서 **`MESSAGE E`**를 발생시켜 Selection Screen에 머무르며 재입력 유도'],
          ['**함정 5 · Subroutine 책임 분리**', '`USING`(입력) · `CHANGING`(결과) 분리 및 **내부 출력 금지**', '`GET_DATA`는 데이터 조회·가공만 수행해 `CHANGING`으로 ITAB을 돌려주고, `cl_demo_output=>display( )`는 **`START-OF-SELECTION` 호출부 아래**에서 실행 *(원문 노션의 `cl_demo_ouptut⇒display( )`는 오타 `output` · 연산자 `=>` 주의)*']
        ])
      ),

      /* ===================== TAB 2: 실전 코드 리뷰 (놓친 8가지) ===================== */
      basicSec('review', '치명 · 필수', '작성 코드 정밀 리뷰 ① — 구조적 오류 4가지 (반드시 수정)',
        text('직접 작성한 풀이 코드를 사내 강사님 요구사항과 ABAP 런타임 동작 기준으로 대조했을 때, 가장 먼저 잡아야 할 **치명적·필수 수정 포인트 4가지**입니다.'),
        table(['심각도 · 항목', '작성 코드에서 놓친 부분', '왜 문제가 되는가 (원인)', '올바른 수정 방향'], [
          [
            '**1. `[치명]`<br>AT SELECTION-SCREEN 누락**',
            '`SELECT-OPTIONS:` 직후 `INITIALIZATION.` 위에 `PERFORM input_check / data_check` 배치',
            '명시적 이벤트 없이 적은 실행문은 암묵적 `START-OF-SELECTION`으로 처리되므로, 아래 `INITIALIZATION.` · `START-OF-SELECTION.`과 충돌해 구문 오류가 나거나 Selection Screen 검증이 작동하지 않음',
            '**`AT SELECTION-SCREEN.`** 블록을 명시하고 `INITIALIZATION.` 아래, `START-OF-SELECTION.` 위에 검증 `PERFORM`을 배치'
          ],
          [
            '**2. `[치명]`<br>`so_fdt` 헤더 전달 + `BETWEEN` 사용**',
            '`USING so_fdt` + `VALUE(sv_fdt) LIKE so_fdt`("type으로 안받아짐") + `WHERE fldate BETWEEN so_fdt-low AND so_fdt-high`',
            '`so_fdt`는 헤더 1행만 넘어가 복수/제외 조건이 유실됨. 특히 `BETWEEN`은 사용자가 날짜를 **비워 뒀을 때**(`00000000`) 전체 조회가 아닌 **0건**을 반환하며, 단일 날짜(`EQ`) 조회도 깨짐',
            '`TYPES tt_fdt TYPE RANGE OF s_date.`를 선언해 **`USING so_fdt[]`** → **`pt_fdt TYPE tt_fdt`**로 받고, `WHERE` 절은 반드시 **`fldate IN pt_fdt`** 사용'
          ],
          [
            '**3. `[필수]`<br>`USING`/`CHANGING` 누락 및 전역변수 직접 참조**',
            '`PERFORM get_data.` (파라미터 없음), `FORM data_check`가 `pv_car` 대신 전역 `pa_car`·`so_fdt` 직접 참조',
            '강사님이 강조한 `USING`/`CHANGING` 파라미터 설계 요구사항 미충족. Formal Parameter를 받아 놓고 전역변수를 쓰면 Subroutine 재사용·독립성이 사라짐',
            '`PERFORM get_data USING pa_car pa_con so_fdt[] CHANGING gt_basic.`로 명시하고 모든 `FORM` 내부는 **Formal Parameter와 지역 변수(`lv_`, `ls_`)만** 사용'
          ],
          [
            '**4. `[필수]`<br>`INTO pa_car` 덮어쓰기 & 취약한 `sy-subrc` 체크**',
            '`SELECT SINGLE carrid ... INTO pa_car`, 그리고 `PERFORM data_check` 바깥에서 `IF sy-subrc <> 0` 판별',
            '조회 결과로 사용자 입력 변수 `pa_car`를 덮어씀. 또한 `ENDFORM` 뒤 암묵적 `sy-subrc` 참조는 `FORM` 내부에 다른 명령이 한 줄만 추가되어도 깨지는 취약한 패턴',
            '지역 변수 `DATA lv_carrid TYPE s_carr_id.`로 `INTO lv_carrid` 처리하고, **`CHANGING cv_subrc TYPE sy-subrc`**로 명시 반환(또는 `FORM` 안에서 즉시 `MESSAGE e002.`)'
          ]
        ]),
        {
          type: 'callout',
          style: 'tip',
          title: '왜 주석에 적은 것처럼 "type으로 안받아짐" 오류가 났을까?',
          body: '`so_fdt`는 **타입(Type)**이 아니라 **데이터 객체(Variable)**이기 때문에 `USING sv_fdt TYPE so_fdt`라고 쓰면 문법 오류가 납니다. `TYPE` 뒤에는 반드시 타입명이 와야 하므로, 상단에 **`TYPES tt_fdt TYPE RANGE OF s_date.`**를 먼저 선언한 뒤 **`USING pt_fdt TYPE tt_fdt`**로 받으면 깔끔하게 해결됩니다!'
        }
      ),
      basicSec('review', '주의 · 개선', '작성 코드 정밀 리뷰 ② — 실무 디테일 · 경계값 4가지',
        text('동작은 되는 것처럼 보이지만 시험 채점이나 실무 예외 상황에서 발목을 잡는 **4가지 디테일 인사이트**입니다.'),
        table(['항목', '작성 코드 패턴', '숨어 있는 함정 · 인사이트', '권장 개선 패턴'], [
          [
            '**5. `[주의]`<br>`= \'\'` vs `IS INITIAL` (`NUMC` 함정)**',
            '`IF pv_car = \'\' AND pv_con = \'\'.`',
            '`pa_con`의 타입 `S_CONN_ID`는 `NUMC 4`여서 비어 있을 때 내부 초기값이 공백이 아닌 **`\'0000\'`**입니다. 타입마다 다른 초기값을 안전하게 검사하는 ABAP 표준은 `IS INITIAL`입니다.',
            '`IF pv_car IS INITIAL AND pv_con IS INITIAL.`'
          ],
          [
            '**6. `[주의]`<br>부분 입력 논리 불일치**',
            '`INPUT_CHECK`는 `AND` (둘 다 비었을 때만 차단), `WHERE`는 `carrid = pv_car AND connid = pv_con`',
            '사용자가 `CARRID = \'LH\'`만 넣고 `CONNID`를 비워 실행하면 `INPUT_CHECK`는 통과하지만, `WHERE`에서 `connid = \'0000\'`인 행을 찾아 0건 오류가 발생합니다.',
            '시험 기본 조건(`=` vs `IN` 구분)에 맞춰 둘 다 입력을 전제하되, **둘 중 하나만 입력해도 조회되게 하려면** 로컬 Range로 변환해 `IN` 조건을 쓰거나, 둘 다 필수라면 `INPUT_CHECK`를 `OR`로 일치시켜야 합니다.'
          ],
          [
            '**7. `[주의]`<br>연도 하드코딩과 경계값 오류**',
            '`IF sv_fdt-low(4) < 2025 OR sv_fdt-high(4) > 2028.`',
            '2026년 기준 `±1년`은 **`2025 ~ 2027`**인데 `> 2028`은 2028년을 통과시킵니다. 또한 단건(`EQ`, `high` 미입력)이나 빈 Range일 때 `low(4)`가 `\'0000\'`이 되어 오탐합니다. *(노션에서 취소선으로 선택 사항 처리)*',
            '`sy-datum(4) - 1`, `sy-datum(4) + 1`로 동적 계산하고 `LOOP AT pt_fdt` 안에서 `IS NOT INITIAL` 검사 후 범위 비교'
          ],
          [
            '**8. `[개선]`<br>`SELECT *` · `LOOP MODIFY` · 출력문 간결화**',
            '`SELECT * ... INTO CORRESPONDING FIELDS`, `MODIFY gt_basic FROM gs_basic.`, `CALL METHOD cl_demo_output=>display EXPORTING ...`',
            '두 테이블 전체 컬럼(`*`)을 DB에서 전송하면 불필요한 네트워크 비용이 생깁니다. `LOOP` 내 `MODIFY`는 변경된 2개 필드만 지정하거나 `FIELD-SYMBOL`을 쓰는 것이 깔끔합니다.',
            '필요한 **8개 컬럼만 명시**해 `SELECT`, `MODIFY pt_basic FROM ls_basic TRANSPORTING seats_remain status.`, 출력은 **`cl_demo_output=>display( gt_basic ).`**'
          ]
        ])
      ),
      basicSec('review', 'Before / After', '핵심 습관 Before vs After 한눈에 비교',
        {
          type: 'compare',
          items: [
            {
              tag: 'Before · 놓치기 쉬운 패턴',
              title: '이벤트 누락 · 헤더 전달 · 전역 변수 직접 조작',
              points: [
                '`SELECT-OPTIONS` 바로 밑에 이벤트 없이 `PERFORM` 호출',
                '`PERFORM input_check USING pa_car pa_con so_fdt.` (헤더 1행)',
                '`WHERE a~fldate BETWEEN so_fdt-low AND so_fdt-high`',
                '`PERFORM get_data.` (파라미터 없이 `gt_basic` 직접 수정)',
                '`SELECT SINGLE carrid INTO pa_car` (입력 변수 덮어쓰기)'
              ]
            },
            {
              tag: 'After · 시험·실무 권장 패턴',
              title: '이벤트 분리 · 바디(`[]`) 전달 · 명시적 인터페이스',
              points: [
                '`INITIALIZATION` → `AT SELECTION-SCREEN` → `START-OF-SELECTION` 순서 고정',
                '`TYPES tt_fdt TYPE RANGE OF s_date.` + `USING so_fdt[]` → `pt_fdt TYPE tt_fdt`',
                '`WHERE a~fldate IN pt_fdt` (빈 조건·단건·다건·제외 모두 자동 지원)',
                '`PERFORM get_data USING pa_car pa_con so_fdt[] CHANGING gt_basic.`',
                '`INTO lv_carrid` 지역 변수 수신 + `CHANGING cv_subrc` 명시 반환'
              ]
            }
          ]
        }
      ),

      /* ===================== TAB 3: 사내 강사님 공식 답안 ===================== */
      basicSec('solution', '공식 답안', '사내 강사님 공식 답안 (ZPROG_CL5_T14_005)',
        text('사내 강사님이 작성·공유한 **Basic Session 공식 답안 원문**입니다. `READ-ME` 헤더 양식과 주석 설명까지 그대로 담았습니다. 본인 계정에서 직접 실행할 때는 `zmc_t14`와 `zbs_flight_t_14`를 본인이 생성한 `Message Class`(`ZBASIC_MSG_?_##`)와 `Global Structure`(`ZBS_FLIGHT_?_##`) 이름으로 맞춰 테스트하세요.'),
        code('사내 강사님 공식 답안 (ZPROG_CL5_T14_005)', `*&---------------------------------------------------------------------*
*& Report ZPROG_CL5_T14_005
*&---------------------------------------------------------------------*
*&
*&---------------------------------------------------------------------*
REPORT zprog_cl5_t14_005 MESSAGE-ID zmc_t14.

*&---------------------------------------------------------------------*
*& Program     : ZPROG_CL5_T14_005
*& Title       : ABAP1_시험직전_실습문제
*&---------------------------------------------------------------------*
*& Description :
*&   - CL5 & 6 ABAP 시험직전 실습문제
*&---------------------------------------------------------------------*
*& Author      : 천승환
*& Created     : 2026.11.25
*&---------------------------------------------------------------------*
*& 위는 READ-ME 라는 양식입니다. 본인이 개발한 굵직한 내용의 프로그램이 존재한다면
*& 해당 양식에 따라 정리해두시면 좋습니다. 이유는 본인이 나중에 봤을 때 + 유지보수 입장에서 타인이 프로그램을 처음 봤을 때를 위함
************************************************************************

**----------------------------------------------------------------------*
** 문제 2-1 , 2-2 Structure 및 Internal Table 만들기
**----------------------------------------------------------------------*
DATA : BEGIN OF gs_flight.
         INCLUDE TYPE zbs_flight_t_14.
DATA :   status TYPE c LENGTH 10,
       END OF gs_flight,                  "Local Structure 생성
       gt_flight LIKE TABLE OF gs_flight. "위 구조로 된 Internal tab 생성

DATA : gv_subrc TYPE sy-subrc.            "아래에서 sy-subrc 의 값을 담을 flag 변수 선언
**----------------------------------------------------------------------*
** 문제 3-1 Selection-Screen 구성
**----------------------------------------------------------------------*
PARAMETERS : pa_car TYPE zbs_flight_t_14-carrid,
             pa_con TYPE zbs_flight_t_14-connid.
"parameter -> 단일 입력값


SELECT-OPTIONS : so_date FOR gs_flight-fldate.
"select-options -> 범위 입력값 설정 가능하고 internal table 구조로 이뤄짐

**----------------------------------------------------------------------*
** 문제 3-2 초기값 할당
**----------------------------------------------------------------------*
INITIALIZATION.   "selection screen 안의 초기 입력값을 설정해주는 역할을 한다.
  "초기값 세팅 - Java Script 상 onInit( ) 과 비슷한 느낌

  pa_car = 'LH'.
  pa_con = '0400'.

  so_date-sign = 'I'.
  so_date-option = 'BT'.
  so_date-low    = '20260531'.
  so_date-high   = '20270619'.
  APPEND so_date TO so_date[].   "아래 설명
  CLEAR so_date.

  "본래 Table에 데이터를 추가하기 위해서는 Structure 구조를 가지고 Append/Modify/Delete 해야함
  "select-options는 "Header" 를 가진 Table 구조를 가지고 있음
  " => 본래 테이블 구조를 가진 Structure를 별도로 선언해줘야하는데 이럴 필요가 없고
  " so_date라는 테이블 명과 동일한 이름으로 Header를 가지고 있음
  " 그래서 APPEND so_date. 하면 축약으로 가능하나, 헷갈리지 말라고 위와 같이 작성하였고
  "[ ]이 표시는 위와같은 Header를 가진 테이블의 경우에 구분을 해주기 위해 사용. 없어도 무방.

**----------------------------------------------------------------------*
** 문제 3-2-2) Subroutine으로 메시지 처리
**----------------------------------------------------------------------*
AT SELECTION-SCREEN. "START-OF-SELECTION 에서 본격적인 코드가 시작되기 전에 유효성 처리를 하는 이벤트
                     "유효성 처리라는 말은 내가 작성한 여러 로직들이 실행되는 최소 조건이 갖춰지지 않았을 때
                     "그 아래로 못가게 막는 역할이라고 생각하면 됩니다.

  "입력값 유효성 체크
  PERFORM input_check USING pa_car
                            pa_con
                            so_date
                      CHANGING gv_subrc.

  "입력값에 따른 데이터 조회 유효성 체크
  IF gv_subrc IS INITIAL.
  PERFORM data_check USING pa_car
                           pa_con
                           so_date[]
                     CHANGING gv_subrc.
  ENDIF.

"해당 코드는 취향차이입니다. 저는 하나에 모으고 싶어서 이렇게 진행했고 꼭 이렇게 해야하는 것은 아닙니다.
"이러다보니 위 data_check 라는 subroutine 호출 전 IF 문으로 감싸줘야했습니다. 이유는 각자 디버깅으로 찾아보시길 바랍니다!
"gv_subrc라는 변수를 선언한 뒤, chainging parameter를 사용하여 메시지 처리를 하고자 함.
  IF gv_subrc = 1.
    MESSAGE e000.
  ELSEIF gv_subrc = 2.
    MESSAGE e001 WITH '작년과 내년 데이터만 조회 가능합니다.'.
  ELSEIF gv_subrc = 3.
    MESSAGE e001 WITH '조회되는 데이터 없습니다.'.
  ENDIF.

START-OF-SELECTION. "본격적인 로직 시작
**----------------------------------------------------------------------*
** 문제 4 Subroutine 이용하여 데이터 출력
**----------------------------------------------------------------------*
  PERFORM get_data USING      pa_car
                              pa_con
                              so_date[]
                   CHANGING   gt_flight.

  IF gt_flight IS NOT INITIAL.
    cl_demo_output=>display( gt_flight ).
  ENDIF.



**********************************************************************
*&---------------------------------------------------------------------*
*& Form INPUT_CHECK
*&---------------------------------------------------------------------*
*& text
*&---------------------------------------------------------------------*
*&      --> PA_CAR
*&      --> PA_CON
*&      --> SO_DATE
*&---------------------------------------------------------------------*
FORM input_check  USING VALUE(pv_car) LIKE pa_car     "LIKE 로 사용할 수도 있고
                        VALUE(pv_con) TYPE s_conn_id  "TYPE 으로 사용하려면 이렇게
                        VALUE(ps_date) LIKE so_date  "얘는 LIKE만 되네요 TYPE 으로 선언하면 에러납니다.

                  CHANGING pv_subrc LIKE gv_subrc.

  DATA : pv_year_low  TYPE i,   "select-options 의 low 값에서 년도 추출할 변수
         pv_year_high TYPE i.   "select-options 의 high 값에서 년도 추출할 변수

  CLEAR : pv_subrc.

  pv_year_low = ps_date-low(4).
  "pv_date는 20261031 이런식으로 나오는데 (4)를 통해 앞에서 4자리 자르겠다라는 의미입니다
  "그래서 2026 과 같이 연도만 추출하여 현재 날짜(sy-datum) 년도와 비교하고자 함입니다.
  pv_year_high = ps_date-high(4).


  IF pv_car IS INITIAL OR pv_con IS INITIAL.
    "제가 노션문제에는 AND 조건을 써야하는 것처럼 적어놨더라구요. 제가 모호하게 작성했기 때문에 AND로 설정하셨어도 상관없습니다
    pv_subrc = 1.
      "MESSAGE e000.
    RETURN.
  ELSEIF pv_year_low < sy-datum(4) - 1 OR pv_year_high > sy-datum(4) + 1.
    pv_subrc = 2.
    "MESSAGE e001 WITH '작년과 내년 데이터만 조회 가능합니다.'.
    RETURN.
  ENDIF.

"return 구문 => 해당 에러가 발생하면 아래쪽 추가 로직을 타지 않고 바로 subroutine을 빠져나가
"             호출부에 있는 IF 문쪽으로 가게 됩니다.
ENDFORM.

*&---------------------------------------------------------------------*
*& Form DATA_CHECK
*&---------------------------------------------------------------------*
*& text
*&---------------------------------------------------------------------*
*&      --> PA_CAR
*&      --> PA_CON
*&      <-- GV_SUBRC
*&---------------------------------------------------------------------*
FORM data_check  USING  VALUE(pv_car)
                        VALUE(pv_con)
                        VALUE(pt_date) LIKE so_date[]
                 CHANGING VALUE(pv_subrc).


  DATA : ls_data LIKE LINE OF gt_flight.

  CLEAR pv_subrc.

  SELECT SINGLE carrid connid fldate
    FROM sflight
    INTO CORRESPONDING FIELDS OF ls_data
    WHERE carrid = pv_car
      AND connid = pv_con
      AND fldate IN pt_date.

"데이터가 있는 지 없는 지 확인할 때는 한건만 확인해도 됨 -> select single 사용

  IF sy-subrc <> 0.  "정상적으로 데이터 조회 시, sy-subrc 에 0 값이 담기기 때문에
                     "해당 조건을 통해 pv_subrc 에 값을 임시로 주고 호출부에서 메시지 처리.
    pv_subrc = 3.
  ENDIF.

ENDFORM.

*&---------------------------------------------------------------------*
*& Form GET_DATA
*&---------------------------------------------------------------------*
*& text
*&---------------------------------------------------------------------*
*&      --> PA_CAR
*&      --> PA_CON
*&      <-- GT_FLIGHT
*&---------------------------------------------------------------------*
FORM get_data  USING VALUE(pv_car)  LIKE pa_car
                     VALUE(pv_con)  LIKE pa_con
                     VALUE(pt_date) LIKE so_date[]
               CHANGING VALUE(ct_flight) LIKE gt_flight.

**----------------------------------------------------------------------*
** 문제 4-1) INNER JOIN 이용하여 데이터 출력
**----------------------------------------------------------------------*
  SELECT a~carrid, a~connid, b~carrname,
         a~fldate, a~price, a~currency,
         a~seatsmax, a~seatsocc
    FROM sflight AS a
    INNER JOIN scarr AS b
    ON a~carrid = b~carrid
    WHERE a~carrid = @pv_car
      AND a~connid = @pv_con
      AND a~fldate IN @pt_date
    INTO CORRESPONDING FIELDS OF TABLE @ct_flight.

**----------------------------------------------------------------------*
** 문제 4-2) SEATS_REMAIN = SEATSMAX - SEATSOCC.
**----------------------------------------------------------------------*
  LOOP AT ct_flight INTO DATA(ls_flight).
    ls_flight-seats_remain = ls_flight-seatsmax - ls_flight-seatsocc.

    IF ls_flight-seats_remain < 10.
      ls_flight-status = '매진임박'.
    ELSEIF ls_flight-seats_remain < 30.
      ls_flight-status = '보통'.
    ELSE.
      ls_flight-status = '여유'.
    ENDIF.

    MODIFY ct_flight FROM ls_flight TRANSPORTING seats_remain status.
  ENDLOOP.


ENDFORM.`)
      ),
      basicSec('solution', '핵심 해설', '강사님 공식 답안에서 꼭 챙겨야 할 실무 포인트 6가지',
        table(['답안 핵심 패턴', '동작 원리와 실무 의도'], [
          ['**1. `READ-ME` 헤더 주석 양식**', 'Program 상단에 `Program` · `Title` · `Description` · `Author` · `Created` 블록을 남겨 본인 복습과 타인 유지보수 시 파악 속도를 높입니다.'],
          ['**2. `APPEND so_date TO so_date[].` + `CLEAR so_date.`**', '`SELECT-OPTIONS`는 Header와 Table Body(`[]`)가 함께 있으므로 `APPEND so_date.` 축약 대신 대상을 명시하고 Header를 비워 혼동을 방지합니다.'],
          ['**3. `gv_subrc` 중앙 처리 + `IF gv_subrc IS INITIAL.` 보호**', '`INPUT_CHECK`에서 `gv_subrc = 1` 또는 `2`가 세팅됐을 때 `IF` 없이 `DATA_CHECK`를 호출하면 `DATA_CHECK` 첫 줄의 `CLEAR pv_subrc.`가 이전 에러 코드를 지워 버리기 때문에 반드시 `IF gv_subrc IS INITIAL.`로 감싸야 합니다.'],
          ['**4. `MESSAGE e001 WITH \'...\'` 범용 메시지 재사용**', '`SE91` `Message Class`에 `&`만 등록한 메시지 `001` 하나를 두고 `WITH`로 문구를 동적 전달해 여러 오류 상황에 재사용할 수 있습니다.'],
          ['**5. `LIKE so_date` (Header) vs `LIKE so_date[]` (Body)**', '`INPUT_CHECK`에서는 `ps_date-low(4)`/`high(4)` 추출을 위해 `so_date`를, `DATA_CHECK` · `GET_DATA`에서는 `WHERE fldate IN pt_date` 조건을 위해 반드시 바디 `so_date[]`를 전달합니다.'],
          ['**6. 문장 단위 구문법(`DATA_CHECK`) · 신문법(`GET_DATA`) 분리**', '한 `SELECT` 안에서는 구/신문법을 절대 섞지 않고, `DATA_CHECK`는 구문법(`INTO ... WHERE`), `GET_DATA`는 신문법(쉼표 · `@` · 맨 끝 `INTO`)으로 문장 단위로 깔끔히 작성했습니다. 출력 전 `IF gt_flight IS NOT INITIAL.` 검사도 실무 필수 습관입니다.']
        ])
      ),

      /* ===================== TAB 4: 시험 직전 체크리스트 ===================== */
      basicSec('checklist', '13항목', '시험 직전 이해도 체크리스트 13항목 & 연결 복습 문서',
        text('강사님이 Basic Session 페이지 하단에 제시한 **13개 이해도 체크리스트**입니다. 각 항목의 핵심 확인 질문에 스스로 답할 수 있는지 점검하고, 헷갈리는 항목은 연결 문서로 바로 이동해 복습하세요.'),
        table(['#', '체크리스트 항목', '시험 직전 자가 점검 질문', '복습 문서'], [
          ['1', 'CTS (`Transport Request`)', 'Workbench Request를 생성하고 모든 객체를 동일 CTS에 묶어 관리했는가?', '[[unit-02|Unit 2 · Workbench]]'],
          ['2', 'Package', '`$TMP`가 아닌 `ZPAC_Basic_?_##` Package를 생성해 객체를 담았는가?', '[[unit-02|Unit 2 · Workbench]]'],
          ['3', 'Transaction Code', '`SE93`에서 Report Transaction으로 프로그램을 실행 연결했는가?', '[[unit-02|Unit 2 · Workbench]]'],
          ['4', 'Message Class', '`SE91`에 메시지 번호를 등록하고 `REPORT ... MESSAGE-ID` + `MESSAGE e000`으로 처리했는가?', '[[unit-03|Unit 3 · 기본 언어 요소]]'],
          ['5', 'Domain (신규 1개)', '`SE11`에서 `ZDO_SEATRE_?_##`(`INT4`, 길이 `10`)의 기술 속성을 정의·활성화했는가?', '[[bc430-02|BC430 Unit 2 · DDIC 타입]]'],
          ['6', 'Data Element (신규 1개)', '`ZD_SEATRE_?_##`에 Domain을 연결하고 Field Label(Description)을 입력했는가?', '[[bc430-02|BC430 Unit 2 · DDIC 타입]]'],
          ['7', 'Global Structure', '`ZBS_FLIGHT_?_##`에 `PRICE`의 `Currency/quantity fields` 참조(`CURRENCY`)를 연결해 활성화했는가?', '[[bc430-02|BC430 Unit 2 · DDIC 타입]]'],
          ['8', 'Local Structure', '`BEGIN OF ~ END OF` 안에서 `INCLUDE TYPE`으로 Global Structure를 포함하고 `STATUS`를 추가했는가?', '[[unit-05|Unit 5 · 복합 데이터 객체]]'],
          ['9', 'Text Element', 'Selection Texts에서 `pa_car`, `pa_con`, `so_fdt` 라벨(`Airline` 등)을 활성화했는가?', '[[unit-07|Unit 7 · Classic Reports]]'],
          ['10', 'JOIN 구문 이해', '`SFLIGHT AS a INNER JOIN SCARR AS b ON a~carrid = b~carrid`와 구/신문법 `INTO` 위치를 구분하는가?', '[[abap-sql-guide|ABAP SQL 가이드]]'],
          ['11', 'LOOP문 이해', '`LOOP AT`으로 `SEATS_REMAIN` 계산·`STATUS` 분기 후 `MODIFY ... TRANSPORTING`으로 반영할 수 있는가?', '[[unit-05|Unit 5 · 복합 데이터 객체]]'],
          ['12', 'Subroutine (`USING`/`CHANGING`)', '`so_fdt[]` 바디 전달, Formal Parameter 전용 사용, 호출부 출력 원칙을 지켰는가?', '[[unit-04|Unit 4 · 모듈화 기법]]'],
          ['13', '`WHERE`절 `PARAMETERS` vs `SELECT-OPTIONS`', '단일 값(`PARAMETERS`)은 `=`, 범위 테이블(`SELECT-OPTIONS`)은 `IN`으로 비교하는 이유를 설명할 수 있는가?', '[[abap-thinking-flow|ABAP 사고 흐름]]']
        ])
      ),
      basicSec('checklist', '추가 실습', '심화 확장 — GET_DATA를 Function Module로 전환하기',
        text('기본 과제를 완료한 뒤 강사님이 추천한 **추가 실습(Function Module 전환 · 코드 리팩터링)** 체크포인트입니다.'),
        {
          type: 'practice',
          title: 'Subroutine → Function Module 전환 4단계',
          steps: [
            { step: '1', action: 'SE11에서 Global Structure · Table Type 준비', detail: 'Function Module 인터페이스는 Local Type(`ts_structure`, `tt_fdt`)을 직접 참조할 수 없으므로, `STATUS`까지 포함된 Global Structure(또는 `Table Type`)와 표준 Range Table Type(예: `RANGE_T_DATS` 또는 커스텀 `ZTT_FDATE_?_##`)을 DDIC에 준비합니다.' },
            { step: '2', action: 'SE80 / SE37에서 Function Group · Function Module 생성', detail: 'Import 파라미터(`IV_CARRID`, `IV_CONNID`, `IT_FLDATE`), Export 파라미터(`ET_FLIGHT`), Exceptions(`NO_DATA_FOUND` 등)를 정의합니다.' },
            { step: '3', action: 'GET_DATA 로직 이관 및 CALL FUNCTION 교체', detail: '기존 `PERFORM get_data`를 주석 처리하고 `CALL FUNCTION`으로 교체한 뒤 `sy-subrc` 예외 분기를 확인합니다.' },
            { step: '4', action: '리팩터링 점검 (단순화 · 가독성)', detail: '중복 `WHERE` 조건, 불필요한 `CLEAR`, `IS INITIAL` 일관성, 변수 네이밍 Prefix를 한 번 더 점검합니다.' }
          ]
        }
      )
    ]
  };
  const sqlSection = (tab, mode, title, ...blocks) => ({ tab, mode, title, blocks });
  docs['abap-sql-guide'] = {
    id: 'abap-sql-guide',
    track: 'abap',
    studentOnly: true,
    stepNum: '',
    categoryId: '학습 가이드',
    hideSectionNumbers: true,
    hideToc: true,
    title: 'ABAP SQL 가이드',
    subtitle: 'Open SQL 구문법(Classic) · 신문법(7.40+) 레퍼런스와 브라우저 실습 30제',
    aliases: ['SQL 가이드', 'ABAP SQL 레퍼런스', 'ABAP SQL 연습문제', 'SQL 표현식', 'DB LUW', 'SAP LUW', 'Lock Object', 'ST05'],
    tcodes: ['SE11', 'SE16', 'SE38', 'ST05'],
    specs: {},
    summary: 'ABAP Program 안에서 데이터베이스를 읽고 변경할 때 사용하는 Open SQL 문법을 **구문법(Classic)** · **신문법(7.40+ · Strict Mode)** 탭으로 나누어 정리했고, **연습문제** 탭에서 테이블과 기대 결과를 보며 직접 SQL을 작성·채점할 수 있습니다.',
    defaultSyntaxMode: 'classic',
    syntaxModes: [
      {
        id: 'classic',
        label: '구문법',
        badge: 'Classic · 수업 기준',
        bannerTitle: '구문법 (Classic Open SQL)',
        desc: '현재 수업 기준 문법입니다. 컬럼 공백 구분, @ 미사용, INTO 절을 FROM 뒤·WHERE 앞에 배치하며 사전 TYPES/DATA 선언을 사용합니다.'
      },
      {
        id: 'new',
        label: '신문법',
        badge: '7.40+ · 참고',
        bannerTitle: '신문법 (ABAP 7.40+ / 7.5+ · Strict Mode)',
        desc: 'ABAP 7.40+ / 7.5+ 환경에서 사용하는 신문법 참고용입니다. 쉼표(,)로 컬럼을 구분하고 ABAP 변수 앞에 @를 붙이며, INTO 절을 문장 끝에 두고 @DATA(...) 인라인 선언·SQL 표현식을 활용합니다.'
      },
      {
        id: 'practice',
        label: '연습문제',
        badge: '30제 · 실습',
        bannerTitle: 'ABAP SQL 연습문제 30제',
        desc: 'SE16N 형식 테이블과 기대 결과를 보며 ABAP Open SQL을 직접 작성하고 브라우저에서 즉시 채점합니다. 01~24번은 구문법·신문법 모두 채점하며, 25~30번은 신문법(Strict Mode) 전용 문제입니다.',
        widgetId: 'abap-sql-practice'
      }
    ],
    sectionTabs: [
      {
        id: 'select',
        label: 'SELECT · INTO',
        desc: 'ABAP 안의 SQL 범위(Open SQL vs Native SQL), 단건·다건 조회, INTO TABLE · CORRESPONDING · APPENDING 패턴을 정리합니다.',
        descByMode: {
          classic: '구문법(Classic) 기준의 SELECT 절 순서, 공백 구분 단건·다건 조회, 사전 DATA 선언 기반 INTO TABLE · CORRESPONDING · APPENDING 패턴을 표시합니다.',
          new: '신문법(7.40+ Strict Mode) 기준의 SELECT 절 순서, 쉼표·@·INTO 문장 끝 배치, @DATA(...) 인라인 선언 기반 단건·다건 조회 패턴을 표시합니다.'
        }
      },
      {
        id: 'filter',
        label: '조건 · 집계',
        desc: 'WHERE 연산자, SELECT-OPTIONS, LIKE · NULL, DISTINCT · 집계 함수 · GROUP BY · HAVING과 0건 시 시스템 필드를 정리합니다.',
        descByMode: {
          classic: '구문법 기준의 WHERE(@ 미사용)·SELECT-OPTIONS·LIKE·NULL과 공백 구분 GROUP BY · HAVING 집계 패턴을 표시합니다.',
          new: '신문법 기준의 WHERE(@ 호스트 변수)·SELECT-OPTIONS(IN @so_)·LIKE·NULL과 쉼표 구분 GROUP BY · HAVING 집계 패턴을 표시합니다.'
        }
      },
      {
        id: 'join',
        label: 'JOIN · 서브쿼리 · FAE',
        desc: 'INNER / LEFT OUTER JOIN의 ON vs WHERE 차이, EXISTS · IN 서브쿼리, FOR ALL ENTRIES 안전 규칙을 정리합니다.',
        descByMode: {
          classic: '구문법 기준의 INNER / LEFT OUTER JOIN(ON 제약 포함), EXISTS 서브쿼리, @ 없는 FOR ALL ENTRIES 안전 패턴을 표시합니다.',
          new: '신문법 기준의 INNER / LEFT / RIGHT / CROSS JOIN, EXISTS 서브쿼리, @lt_keys 기반 FOR ALL ENTRIES 안전 패턴을 표시합니다.'
        }
      },
      {
        id: 'dml',
        label: '변경(CUD) · 트랜잭션',
        desc: 'INSERT · UPDATE · MODIFY · DELETE 문법과 DB LUW · SAP LUW · Lock Object 안전 원칙을 정리합니다.',
        descByMode: {
          classic: '구문법 기준의 INSERT · UPDATE · MODIFY · DELETE(@ 미사용 · TABLES 헤더 구문 주의)와 DB LUW · SAP LUW · Lock Object 원칙을 표시합니다.',
          new: '신문법 기준의 @ 호스트 변수 기반 INSERT · UPDATE · MODIFY · DELETE와 DB LUW · SAP LUW · Lock Object 원칙을 표시합니다.'
        }
      },
      {
        id: 'advanced',
        label: '표현식 · 성능 · Strict Mode',
        labelByMode: {
          classic: '구문법 규칙 · 후처리 · 성능',
          new: 'Strict Mode · 표현식 · 성능'
        },
        desc: '문법 규칙, 데이터 가공 패턴, Table Buffer와 ST05 성능 체크리스트를 정리합니다.',
        descByMode: {
          classic: '구문법(Classic Open SQL) 필수 규칙, SQL 표현식 미지원 시 ABAP LOOP 후처리 패턴, Table Buffer · ST05 성능 체크리스트를 표시합니다.',
          new: '신문법(Strict Mode) 필수 규칙, CASE·COALESCE·산술식·UNION·WITH(CTE) SQL 표현식, Table Buffer · ST05 성능 체크리스트를 표시합니다.'
        }
      }
    ],
    sections: [
      /* ===================== SELECT · INTO (신문법) ===================== */
      sqlSection('select', 'new', 'ABAP 안에서의 SQL 범위와 신문법 SELECT 절 순서',
        text(
          'ABAP Program에서 데이터베이스에 접근할 때는 기본적으로 **Open SQL**(ABAP SQL)을 사용합니다. Open SQL은 SAP Application Server의 데이터베이스 인터페이스가 실제 DB(HANA 등) 문법으로 변환해 주므로 DB 종류가 달라져도 ABAP 코드를 그대로 유지할 수 있습니다.',
          '반면 `EXEC SQL` 같은 Native SQL이나 AMDP는 특정 DB 전용 기능이 꼭 필요할 때만 제한적으로 사용하며, 클라이언트(`MANDT`) 자동 처리나 Table Buffer 혜택을 받지 못합니다.'
        ),
        table(['구분', 'Open SQL (ABAP SQL · 기본)', 'Native SQL / AMDP (특수 목적)'], [
          ['DB 독립성', 'SAP 지원 모든 DB에서 동일 코드 실행', '특정 DB(예: SAP HANA SQLScript)에 종속'],
          ['클라이언트(`MANDT`)', '현재 로그온 클라이언트(`sy-mandt`) 자동 필터링', '직접 `MANDT` 조건을 명시해야 함'],
          ['`Table Buffer`', 'SE11 버퍼 설정 테이블이면 자동 활용', '버퍼 우회(항상 DB 직접 접근)'],
          ['문법 · 타입 검사', 'ABAP 컴파일러가 DDIC 테이블·필드명을 정적 검증', '런타임에 DB 오류로 발견되기 쉬움'],
          ['권장 사용처', '일반 Report·화면 조회·업무 CRUD 대부분', '대용량 HANA 전용 계산·DB 고유 프로시저']
        ]),
        table(['신문법 `SELECT` 절 작성 순서 (7.40+ · Strict Mode)', '역할'], [
          ['`SELECT [SINGLE | DISTINCT] 열1, 열2`', '가져올 컬럼·집계 함수·SQL 표현식 지정 (**쉼표 `,` 필수**)'],
          ['`FROM 테이블 [JOIN ... ON ...]`', '조회 대상 ABAP Dictionary 테이블·View와 조인 조건'],
          ['`[FOR ALL ENTRIES IN @itab]`', '이미 보유한 Internal Table 행을 조건으로 집합 조회 (`@` 필수)'],
          ['`[WHERE 조건]`', '원본 행 필터링 (모든 ABAP 호스트 변수 앞 `@` 필수)'],
          ['`[GROUP BY 열1, 열2]` / `[HAVING 조건]`', '그룹 묶기(쉼표 구분)와 집계 결과 필터링'],
          ['`[ORDER BY 열1, 열2]`', 'DB 단계 정렬 (쉼표 구분, `PRIMARY KEY` 포함)'],
          ['`INTO [CORRESPONDING FIELDS OF] [TABLE] @대상`', '**문장 끝**에 배치 · `@DATA(...)` 인라인 선언 지원'],
          ['`[UP TO n ROWS] [OFFSET m]`', '최대 조회 건수 제한 및 건너뛰기(`OFFSET`은 7.51+ · `ORDER BY` 필요)']
        ])
      ),
      sqlSection('select', 'new', '단건 조회 — SELECT SINGLE vs UP TO 1 ROWS',
        text(
          '정확히 한 건만 읽을 때는 **Primary Key 전체**를 조건으로 주는 `SELECT SINGLE`이 가장 명확합니다. 키 전체를 주지 않거나 특정 정렬 기준(예: 가장 빠른 운항일, 최저 운임)의 첫 1건이 필요하면 `SELECT ... ORDER BY ... INTO TABLE @DATA(...) UP TO 1 ROWS`를 사용합니다(`SELECT SINGLE`에는 `ORDER BY`를 붙일 수 없습니다).',
          '조회 결과가 0건(`sy-subrc = 4`)이면 기존 변수나 Work Area에 이전 값이 그대로 남을 수 있으므로, 조회 전 `CLEAR` 하거나 조회 직후 반드시 `IF sy-subrc = 0.`을 검사하세요.'
        ),
        table(['신문법 패턴', '특징', '권장 상황'], [
          ['`SELECT SINGLE col1, col2 FROM dbtab WHERE ... INTO @gs_row.`', '최대 1행 반환, `ORDER BY` 불가, `INTO`를 문장 끝에 배치', 'Primary Key 전체 조건으로 유일한 1건 조회'],
          ['`SELECT ... FROM dbtab ORDER BY ... INTO TABLE @DATA(gt_top) UP TO 1 ROWS.`', '정렬 후 상위 1건만 추출, 인라인 Internal Table 선언', '가장 최근/최소/최대 1건처럼 정렬 기준이 필요한 조회'],
          ['`SELECT SINGLE @abap_true FROM dbtab WHERE ... INTO @DATA(lv_exists).`', '컬럼을 읽지 않고 존재 여부만 경량 확인 (7.40+ 지원)', '데이터 유무만 빠르게 판별할 때']
        ]),
        code('[신문법] 단건 조회: SELECT SINGLE과 UP TO 1 ROWS 비교', `REPORT zabap_f##_##.

PARAMETERS p_carr TYPE scarr-carrid DEFAULT 'LH'.

DATA gs_scarr TYPE scarr.

" 1) Primary Key 전체(carrid)로 단건 조회: SELECT SINGLE (신문법)
CLEAR gs_scarr.
SELECT SINGLE carrid, carrname, currcode
  FROM scarr
  WHERE carrid = @p_carr
  INTO CORRESPONDING FIELDS OF @gs_scarr.

IF sy-subrc = 0.
  WRITE: / '항공사:', gs_scarr-carrid, gs_scarr-carrname, gs_scarr-currcode.
ELSE.
  WRITE: / '해당 항공사를 찾지 못했습니다.'.
ENDIF.

" 2) 정렬 기준 첫 1건 조회: ORDER BY + UP TO 1 ROWS (신문법)
SELECT carrid, connid, fldate, price, currency
  FROM sflight
  WHERE carrid = @p_carr
  ORDER BY price ASCENDING, fldate ASCENDING
  INTO TABLE @DATA(gt_cheapest)
  UP TO 1 ROWS.

IF sy-subrc = 0.
  READ TABLE gt_cheapest INDEX 1 INTO DATA(gs_cheapest).
  WRITE: / '최저 운임:', gs_cheapest-carrid, gs_cheapest-connid,
           gs_cheapest-fldate, gs_cheapest-price, gs_cheapest-currency.
ENDIF.`)
      ),
      sqlSection('select', 'new', '다건 조회 — INTO TABLE · APPENDING · CORRESPONDING',
        text(
          '여러 행을 읽을 때는 `SELECT ... ENDSELECT` 루프보다 **한 번에 Internal Table로 받는 `INTO TABLE`**이 성능과 가독성 모두 유리합니다. 신문법에서는 필요한 컬럼만 쉼표로 나열해 `@DATA(gt_...)` 인라인 선언으로 받으면 별도 `TYPES` 선언 없이 바로 구조가 맞춰집니다.',
          '이미 선언해 둔 커스텀 Structure/Internal Table에 담을 때 컬럼 순서가 다르면 `INTO CORRESPONDING FIELDS OF TABLE @gt_out`으로 이름(`AS` 별칭 포함) 기준 매핑을 사용합니다. 기존 행을 유지하면서 결과를 덧붙여야 할 때만 `APPENDING TABLE`을 씁니다.'
        ),
        table(['신문법 INTO 절 형태', '기존 데이터 처리', '컬럼 매핑 기준'], [
          ['`INTO TABLE @DATA(gt_out)`', '새 Internal Table 인라인 생성·채움', 'SELECT 열 이름·별칭 그대로 컴포넌트 자동 생성'],
          ['`INTO TABLE @gt_out`', '기존 행을 모두 비우고 새로 채움', '열 순서와 타입이 Structure와 일치해야 함'],
          ['`INTO CORRESPONDING FIELDS OF TABLE @gt_out`', '기존 행을 비우고 새로 채움', '컬럼명(`AS` 별칭)과 컴포넌트 이름이 같은 필드만 매핑'],
          ['`APPENDING [CORRESPONDING FIELDS OF] TABLE @gt_out`', '기존 행을 유지하고 뒤에 추가', '중복 자동 제거 안 함(UNIQUE 키 테이블은 충돌 주의)']
        ]),
        code('[신문법] 다건 조회: INTO TABLE과 CORRESPONDING FIELDS OF TABLE', `REPORT zabap_f##_##.

TYPES: BEGIN OF ts_route,
         cityfrom TYPE spfli-cityfrom,
         cityto   TYPE spfli-cityto,
         carrid   TYPE spfli-carrid,
         connid   TYPE spfli-connid,
       END OF ts_route.

DATA gt_routes TYPE STANDARD TABLE OF ts_route WITH EMPTY KEY.

" 1) 컬럼 순서가 ts_route와 달라도 이름 기준으로 매핑 (신문법)
SELECT carrid, connid, cityfrom, cityto
  FROM spfli
  WHERE countryfr = 'DE'
  ORDER BY carrid, connid
  INTO CORRESPONDING FIELDS OF TABLE @gt_routes.

WRITE: / '독일 출발 노선 수:', sy-dbcnt.

" 2) 기존 행을 유지하며 미국 출발 노선 추가
SELECT carrid, connid, cityfrom, cityto
  FROM spfli
  WHERE countryfr = 'US'
  APPENDING CORRESPONDING FIELDS OF TABLE @gt_routes.

WRITE: / '합산 노선 수:', lines( gt_routes ).

" 3) 인라인 선언으로 필요한 컬럼만 간결하게 조회
SELECT carrid, connid, fltime
  FROM spfli
  WHERE carrid = 'LH'
  ORDER BY fltime DESCENDING
  INTO TABLE @DATA(gt_lh_routes).

LOOP AT gt_lh_routes INTO DATA(gs_lh).
  WRITE: / gs_lh-carrid, gs_lh-connid, gs_lh-fltime, '분'.
ENDLOOP.`)
      ),

      /* ===================== SELECT · INTO (구문법) ===================== */
      sqlSection('select', 'classic', 'ABAP 안에서의 SQL 범위와 구문법 SELECT 절 순서',
        text(
          'ABAP Program에서 데이터베이스에 접근할 때는 구문법 환경에서도 기본적으로 **Open SQL**을 사용합니다. Open SQL은 SAP Application Server의 DB 인터페이스가 실제 DB 문법으로 변환해 주므로 DB 독립성, 클라이언트(`MANDT`) 자동 처리, `Table Buffer`, 정적 타입 검사를 그대로 활용할 수 있습니다.',
          '구문법(Classic Open SQL)은 ABAP 7.40 SP05 이전이나 기존 레거시 프로그램·BC400 교재에서 널리 쓰이는 형식입니다. 컬럼·정렬 목록을 **공백으로 구분**하고, ABAP 변수에 `@`를 붙이지 않으며, `INTO` 절을 `FROM` 바로 뒤(`WHERE` 앞)에 두는 것이 일반적입니다.'
        ),
        table(['구분', 'Open SQL (Classic · 기본)', 'Native SQL (특수 목적)'], [
          ['DB 독립성', 'SAP 지원 모든 DB에서 동일 코드 실행', '특정 DB 문법에 종속'],
          ['클라이언트(`MANDT`)', '현재 로그온 클라이언트(`sy-mandt`) 자동 필터링', '직접 `MANDT` 조건을 명시해야 함'],
          ['`Table Buffer`', 'SE11 버퍼 설정 테이블이면 자동 활용', '버퍼 우회(항상 DB 직접 접근)'],
          ['문법 · 타입 검사', 'ABAP 컴파일러가 DDIC 테이블·필드명을 정적 검증', '런타임에 DB 오류로 발견되기 쉬움']
        ]),
        table(['구문법 `SELECT` 절 작성 순서 (Classic Open SQL)', '역할 및 주의사항'], [
          ['`SELECT [SINGLE | DISTINCT] 열1 열2`', '가져올 컬럼·집계 함수 지정 (**공백 구분 · 쉼표 사용 안 함**)'],
          ['`FROM 테이블 [JOIN ... ON ...]`', '조회 대상 ABAP Dictionary 테이블·View와 조인 조건'],
          ['`INTO [CORRESPONDING FIELDS OF] [TABLE] 대상`', '`FROM` 뒤·`WHERE` 앞 배치(사전 `DATA` 선언 필수 · `@` 미사용)'],
          ['`[UP TO n ROWS]`', '최대 조회 건수 제한 (`OFFSET`은 구문법 미지원)'],
          ['`[FOR ALL ENTRIES IN itab]`', '이미 보유한 Internal Table 행을 조건으로 집합 조회 (`@` 미사용)'],
          ['`[WHERE 조건]`', '원본 행 필터링 (ABAP 변수 그대로 기재, `@` 미사용)'],
          ['`[GROUP BY 열1 열2]` / `[HAVING 조건]`', '그룹 묶기(**공백 구분**)와 집계 결과 필터링'],
          ['`[ORDER BY 열1 열2]`', 'DB 단계 정렬 (**공백 구분** · `PRIMARY KEY` 포함)']
        ])
      ),
      sqlSection('select', 'classic', '단건 조회 — SELECT SINGLE vs UP TO 1 ROWS',
        text(
          '구문법에서도 Primary Key 전체로 유일한 1건을 읽을 때는 `SELECT SINGLE`, 정렬 기준의 첫 1건이 필요할 때는 `UP TO 1 ROWS` + `ORDER BY`를 사용합니다. 단, 구문법에서는 `@DATA(...)` 인라인 선언이나 `@abap_true` 리터럴 조회를 쓸 수 없으므로 **받는 Structure·Internal Table·존재 확인용 변수를 반드시 `TYPES`와 `DATA`로 먼저 선언**해야 합니다.',
          '조회 결과가 0건(`sy-subrc = 4`)이면 기존 Work Area에 이전 값이 남을 수 있으므로 조회 전 `CLEAR` 하고 직후 `IF sy-subrc = 0.`을 확인하세요.'
        ),
        table(['구문법 패턴', '특징', '권장 상황'], [
          ['`SELECT SINGLE col1 col2 FROM dbtab INTO gs_row WHERE ...`', '공백 구분, `@` 없음, `INTO`를 `WHERE` 앞에 배치', 'Primary Key 전체 조건으로 유일한 1건 조회'],
          ['`SELECT ... FROM dbtab INTO TABLE gt_top UP TO 1 ROWS WHERE ... ORDER BY ...`', '사전 선언된 `gt_top`에 정렬 후 첫 1건 수신', '가장 최근/최소/최대 1건처럼 정렬 기준이 필요한 조회'],
          ['`SELECT SINGLE carrid FROM scarr INTO lv_carrid WHERE ...`', '가벼운 키 컬럼 1개만 읽어 존재 여부 판별 (`@abap_true` 미지원)', '데이터 유무만 빠르게 확인할 때']
        ]),
        code('[구문법] 단건 조회: SELECT SINGLE과 UP TO 1 ROWS 비교', `REPORT zabap_f##_##.

PARAMETERS p_carr TYPE scarr-carrid DEFAULT 'LH'.

TYPES: BEGIN OF ts_cheapest,
         carrid   TYPE sflight-carrid,
         connid   TYPE sflight-connid,
         fldate   TYPE sflight-fldate,
         price    TYPE sflight-price,
         currency TYPE sflight-currency,
       END OF ts_cheapest.

DATA: gs_scarr    TYPE scarr,
      gt_cheapest TYPE STANDARD TABLE OF ts_cheapest,
      gs_cheapest TYPE ts_cheapest.

" 1) Primary Key 전체(carrid)로 단건 조회: SELECT SINGLE (구문법)
CLEAR gs_scarr.
SELECT SINGLE carrid carrname currcode
  FROM scarr
  INTO CORRESPONDING FIELDS OF gs_scarr
  WHERE carrid = p_carr.

IF sy-subrc = 0.
  WRITE: / '항공사:', gs_scarr-carrid, gs_scarr-carrname, gs_scarr-currcode.
ELSE.
  WRITE: / '해당 항공사를 찾지 못했습니다.'.
ENDIF.

" 2) 정렬 기준 첫 1건 조회: UP TO 1 ROWS + ORDER BY (구문법)
SELECT carrid connid fldate price currency
  FROM sflight
  INTO TABLE gt_cheapest
  UP TO 1 ROWS
  WHERE carrid = p_carr
  ORDER BY price ASCENDING fldate ASCENDING.

IF sy-subrc = 0.
  READ TABLE gt_cheapest INTO gs_cheapest INDEX 1.
  WRITE: / '최저 운임:', gs_cheapest-carrid, gs_cheapest-connid,
           gs_cheapest-fldate, gs_cheapest-price, gs_cheapest-currency.
ENDIF.`)
      ),
      sqlSection('select', 'classic', '다건 조회 — INTO TABLE · APPENDING · CORRESPONDING',
        text(
          '구문법에서도 `SELECT ... INTO gs_row ... ENDSELECT.` 루프보다는 **Internal Table로 한 번에 받는 `INTO TABLE gt_out`**을 사용해야 DB 왕복과 성능 저하를 피할 수 있습니다. 구문법에서는 `@DATA(...)`와 `lines( ... )` 대신 사전 `TYPES`·`DATA` 선언과 `DESCRIBE TABLE gt_out LINES lv_cnt.` 패턴을 자주 봅니다.',
          '기존 Internal Table의 행을 유지하면서 조회 결과를 이어 붙일 때는 `APPENDING [CORRESPONDING FIELDS OF] TABLE gt_out`을 사용합니다.'
        ),
        table(['구문법 INTO 절 형태', '기존 데이터 처리', '컬럼 매핑 · 참고'], [
          ['`INTO TABLE gt_out`', '기존 행을 모두 비우고 새로 채움', '사전 선언된 `gt_out`의 열 순서·타입이 SELECT 목록과 일치해야 함'],
          ['`INTO CORRESPONDING FIELDS OF TABLE gt_out`', '기존 행을 비우고 새로 채움', '컬럼명(`AS` 별칭)과 Structure 컴포넌트 이름이 같은 필드만 매핑'],
          ['`APPENDING [CORRESPONDING FIELDS OF] TABLE gt_out`', '기존 행을 유지하고 뒤에 추가', '중복 자동 제거 안 함(UNIQUE 키 테이블 충돌 주의)'],
          ['`SELECT ... INTO gs_row ... ENDSELECT.` (레거시)', '1행씩 반복 수신', '기존 코드 해석용으로만 알고, 신규 작성은 `INTO TABLE` 권장']
        ]),
        code('[구문법] 다건 조회: INTO TABLE과 CORRESPONDING FIELDS OF TABLE', `REPORT zabap_f##_##.

TYPES: BEGIN OF ts_route,
         cityfrom TYPE spfli-cityfrom,
         cityto   TYPE spfli-cityto,
         carrid   TYPE spfli-carrid,
         connid   TYPE spfli-connid,
       END OF ts_route,
       BEGIN OF ts_lh,
         carrid TYPE spfli-carrid,
         connid TYPE spfli-connid,
         fltime TYPE spfli-fltime,
       END OF ts_lh.

DATA: gt_routes    TYPE STANDARD TABLE OF ts_route,
      gt_lh_routes TYPE STANDARD TABLE OF ts_lh,
      gs_lh        TYPE ts_lh,
      lv_cnt       TYPE i.

" 1) 컬럼 순서가 ts_route와 달라도 이름 기준으로 매핑 (구문법)
SELECT carrid connid cityfrom cityto
  FROM spfli
  INTO CORRESPONDING FIELDS OF TABLE gt_routes
  WHERE countryfr = 'DE'
  ORDER BY carrid connid.

WRITE: / '독일 출발 노선 수:', sy-dbcnt.

" 2) 기존 행을 유지하며 미국 출발 노선 추가
SELECT carrid connid cityfrom cityto
  FROM spfli
  APPENDING CORRESPONDING FIELDS OF TABLE gt_routes
  WHERE countryfr = 'US'.

DESCRIBE TABLE gt_routes LINES lv_cnt.
WRITE: / '합산 노선 수:', lv_cnt.

" 3) 사전 선언한 Structure·Internal Table로 조회
SELECT carrid connid fltime
  FROM spfli
  INTO TABLE gt_lh_routes
  WHERE carrid = 'LH'
  ORDER BY fltime DESCENDING.

LOOP AT gt_lh_routes INTO gs_lh.
  WRITE: / gs_lh-carrid, gs_lh-connid, gs_lh-fltime, '분'.
ENDLOOP.`)
      ),

      /* ===================== 조건 · 집계 (신문법) ===================== */
      sqlSection('filter', 'new', 'WHERE 조건 · SELECT-OPTIONS · LIKE · NULL',
        text(
          '`WHERE` 절은 DB 서버에서 먼저 데이터를 걸러 네트워크 전송량과 메모리를 줄여 줍니다. 신문법에서는 모든 ABAP 프로그램 변수·`PARAMETERS`·`SELECT-OPTIONS` 앞에 `@`를 붙여 호스트 변수로 전달하며, `AND`가 `OR`보다 우선하므로 조건이 섞일 때는 반드시 괄호 `( ... )`로 묶어야 합니다.',
          '`SELECT-OPTIONS`를 `WHERE col IN @so_...`로 연결할 때 사용자가 아무 값도 입력하지 않아 **Range 테이블이 비어 있으면 조건이 생략되어 전체 행이 조회**됩니다(0건이 아님).'
        ),
        table(['신문법 연산자 / 표현', '의미 및 주의사항'], [
          ['`=`, `<>`, `<`, `>`, `<=`, `>=`', '비교 연산자 (`EQ`, `NE`, `LT`, `GT`, `LE`, `GE`도 동일)'],
          ['`BETWEEN @v1 AND @v2`', '`v1`과 `v2` 양 끝 값을 모두 포함하는 범위'],
          ['`IN ( \'LH\', \'AA\' )` / `IN @so_carr`', '고정 목록 또는 `SELECT-OPTIONS`/Range 테이블 조건 (`@` 필수)'],
          ['`LIKE \'L%\'` / `LIKE \'_A%\'`', '`%`: 0글자 이상, `_`: 정확히 1글자 (ABAP 문자열 연산자 `CP`의 `*`/`+`와 다름!)'],
          ['`IS NULL` / `IS NOT NULL`', 'DB NULL 검사 (`= NULL` 불가 · ABAP 초기값 공백/0과 개념이 다름)'],
          ['`AND` · `OR` · `NOT`', '우선순위 `NOT` → `AND` → `OR`. 혼합 시 괄호 `( ... )` 필수']
        ]),
        code('[신문법] SCUSTOM 조건 조회: SELECT-OPTIONS·LIKE·BETWEEN', `REPORT zabap_f##_##.

DATA gv_custid TYPE scustom-id.
SELECT-OPTIONS so_id FOR gv_custid.
PARAMETERS p_cntry TYPE scustom-country DEFAULT 'DE'.

SELECT id, name, city, country, discount
  FROM scustom
  WHERE id IN @so_id
    AND country = @p_cntry
    AND ( name LIKE 'A%' OR name LIKE 'S%' )
    AND discount BETWEEN '000' AND '020'
  ORDER BY id
  INTO TABLE @DATA(gt_customers)
  UP TO 20 ROWS.

IF sy-subrc = 0.
  LOOP AT gt_customers INTO DATA(gs_cust).
    WRITE: / gs_cust-id, gs_cust-name, gs_cust-city, gs_cust-discount.
  ENDLOOP.
ELSE.
  WRITE: / '조건에 맞는 고객이 없습니다.'.
ENDIF.`)
      ),
      sqlSection('filter', 'new', '집계 함수 · DISTINCT · GROUP BY · HAVING · 0건 주의',
        text(
          '집계 함수(`COUNT`, `SUM`, `AVG`, `MIN`, `MAX`)와 `GROUP BY`를 사용하면 ABAP `LOOP`에서 직접 합산하지 않고 DB에서 요약 결과만 받아올 수 있습니다. 집계 전 원본 행을 거를 때는 `WHERE`, 집계된 그룹을 거를 때는 `HAVING`을 사용합니다.',
          '일반 컬럼과 집계 함수를 함께 조회할 때는 **집계하지 않는 모든 일반 컬럼을 `GROUP BY`에 쉼표로 빠짐없이 명시**해야 하며, 금액을 `SUM`/`AVG` 할 때는 통화(`currency`/`loccurkey`)를 함께 `GROUP BY` 해 서로 다른 통화가 섞이지 않게 해야 합니다.'
        ),
        table(['집계 / 절 (신문법)', '역할', '자주 하는 실수'], [
          ['`DISTINCT`', 'SELECT에 나열한 컬럼 조합 전체의 중복 제거', '특정 1개 컬럼만 중복 제거하는 기능이 아님'],
          ['`COUNT( * ) AS cnt`', '조건에 맞는 전체 행 수 (인라인 선언 시 `AS` 별칭 필수)', '`GROUP BY` 없는 집계에서 0건이어도 `sy-subrc = 0, sy-dbcnt = 1`'],
          ['`COUNT( DISTINCT col )`', 'NULL 제외한 서로 다른 값의 개수', '괄호 안쪽 공백(`COUNT( DISTINCT ... )`) 지키기'],
          ['`SUM( col )` / `AVG( col )`', '합계 / 평균 (신문법은 내부 SQL 표현식도 가능)', '통화가 다른 금액을 통화 그룹 없이 합산하면 의미 없는 값'],
          ['`WHERE` vs `HAVING`', '집계 전 원본 행 필터 vs 집계 후 그룹 필터', '집계 함수 조건(`COUNT( * ) >= 5`)은 `WHERE`가 아닌 `HAVING`에 작성']
        ]),
        {
          type: 'callout',
          style: 'warning',
          title: '집계 SELECT에서 0건 판별 주의',
          body: '`GROUP BY` 없이 `SELECT COUNT( * ) AS cnt, MAX( seatsocc ) AS max_occ ...`처럼 집계만 조회하면, 조건에 맞는 원본 행이 0건이어도 집계 결과 1행(`cnt = 0`)이 반환되어 `sy-subrc = 0`, `sy-dbcnt = 1`이 됩니다. 따라서 `sy-dbcnt` 대신 `COUNT` 결과 변수(`gs_stat-cnt > 0`)로 데이터 존재 여부를 판별하세요.'
        },
        code('[신문법] SBOOK 예약 집계: GROUP BY와 HAVING', `REPORT zabap_f##_##.

PARAMETERS p_year TYPE c LENGTH 4 DEFAULT '2026'.
DATA(lv_from) = CONV d( p_year && '0101' ).
DATA(lv_to)   = CONV d( p_year && '1231' ).

SELECT carrid,
       loccurkey,
       COUNT( * )          AS book_cnt,
       SUM( loccuram )     AS total_amt,
       MIN( order_date )   AS first_order,
       MAX( order_date )   AS last_order
  FROM sbook
  WHERE order_date BETWEEN @lv_from AND @lv_to
    AND cancelled = @space
  GROUP BY carrid, loccurkey
  HAVING COUNT( * ) >= 5
  ORDER BY carrid, loccurkey
  INTO TABLE @DATA(gt_stats).

IF sy-subrc = 0.
  LOOP AT gt_stats INTO DATA(gs_stat).
    WRITE: / gs_stat-carrid, gs_stat-book_cnt,
             gs_stat-total_amt CURRENCY gs_stat-loccurkey, gs_stat-loccurkey,
             gs_stat-first_order, '~', gs_stat-last_order.
  ENDLOOP.
ELSE.
  WRITE: / '집계 조건을 만족하는 예약이 없습니다.'.
ENDIF.`)
      ),

      /* ===================== 조건 · 집계 (구문법) ===================== */
      sqlSection('filter', 'classic', 'WHERE 조건 · SELECT-OPTIONS · LIKE · NULL',
        text(
          '구문법의 `WHERE` 절에서는 ABAP 변수·`PARAMETERS`·`SELECT-OPTIONS` 앞에 **`@`를 붙이지 않고 변수 이름 그대로** 적습니다(`WHERE id IN so_id AND country = p_cntry`). 비교 연산자와 `AND`·`OR` 우선순위(`NOT` → `AND` → `OR`), 괄호 `( ... )` 사용 원칙은 동일합니다.',
          '구문법 `WHERE` 안에서는 좌변에 SQL 표현식이나 함수(`UPPER( name )` 등)를 넣을 수 없으며, `SELECT-OPTIONS` Range 테이블이 비어 있으면 조건이 생략되어 전체 행이 조회되는 동작도 동일합니다.'
        ),
        table(['구문법 연산자 / 표현', '의미 및 주의사항'], [
          ['`=`, `<>`, `<`, `>`, `<=`, `>=`', '비교 연산자 (`EQ`, `NE`, `LT`, `GT`, `LE`, `GE` 동일 · `@` 미사용)'],
          ['`BETWEEN lv_v1 AND lv_v2`', '`lv_v1`과 `lv_v2` 양 끝 값을 모두 포함하는 범위'],
          ['`IN ( \'LH\', \'AA\' )` / `IN so_carr`', '고정 목록(괄호 안은 쉼표 구분) 또는 `SELECT-OPTIONS` 조건 (`@` 없음)'],
          ['`LIKE \'L%\'` / `LIKE \'_A%\'`', '`%`: 0글자 이상, `_`: 정확히 1글자 (`CP`의 `*`/`+`와 다름)'],
          ['`IS NULL` / `IS NOT NULL`', 'DB NULL 검사 (`= NULL` 불가 · ABAP 초기값과 다름)'],
          ['`AND` · `OR` · `NOT`', '우선순위 `NOT` → `AND` → `OR`. 혼합 시 괄호 `( ... )` 필수']
        ]),
        code('[구문법] SCUSTOM 조건 조회: SELECT-OPTIONS·LIKE·BETWEEN', `REPORT zabap_f##_##.

TYPES: BEGIN OF ts_cust,
         id       TYPE scustom-id,
         name     TYPE scustom-name,
         city     TYPE scustom-city,
         country  TYPE scustom-country,
         discount TYPE scustom-discount,
       END OF ts_cust.

DATA: gv_custid    TYPE scustom-id,
      gt_customers TYPE STANDARD TABLE OF ts_cust,
      gs_cust      TYPE ts_cust.

SELECT-OPTIONS so_id FOR gv_custid.
PARAMETERS p_cntry TYPE scustom-country DEFAULT 'DE'.

SELECT id name city country discount
  FROM scustom
  INTO TABLE gt_customers
  UP TO 20 ROWS
  WHERE id IN so_id
    AND country = p_cntry
    AND ( name LIKE 'A%' OR name LIKE 'S%' )
    AND discount BETWEEN '000' AND '020'
  ORDER BY id.

IF sy-subrc = 0.
  LOOP AT gt_customers INTO gs_cust.
    WRITE: / gs_cust-id, gs_cust-name, gs_cust-city, gs_cust-discount.
  ENDLOOP.
ELSE.
  WRITE: / '조건에 맞는 고객이 없습니다.'.
ENDIF.`)
      ),
      sqlSection('filter', 'classic', '집계 함수 · DISTINCT · GROUP BY · HAVING · 0건 주의',
        text(
          '구문법에서도 `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`와 `GROUP BY`·`HAVING`을 사용할 수 있습니다. 다만 **`SELECT`·`GROUP BY`·`ORDER BY`의 컬럼을 쉼표 없이 공백으로 구분**하고, 결과를 담을 Structure `TYPES`와 Internal Table `DATA`를 미리 선언해야 합니다.',
          '구문법에서는 `SUM( price * seatsocc )`처럼 집계 함수 안에 산술식·`CASE` 같은 SQL 표현식을 넣을 수 없으며, 순수 컬럼명만 전달해야 합니다.'
        ),
        table(['집계 / 절 (구문법)', '역할', '구문법 주의사항'], [
          ['`DISTINCT`', 'SELECT 컬럼 조합 전체의 중복 제거', '공백으로 컬럼 나열 (`SELECT DISTINCT carrid connid`)'],
          ['`COUNT( * )`', '조건에 맞는 전체 행 수', '결과 Structure에 `TYPE i` 컴포넌트 사전 선언 필요'],
          ['`COUNT( DISTINCT col )`', 'NULL 제외한 서로 다른 값의 개수', '괄호 안쪽 공백(`COUNT( DISTINCT col )`) 지키기'],
          ['`SUM( col )` / `AVG( col )`', '합계 / 평균', '함수 안에 산술식·표현식 불가, 통화 컬럼 함께 `GROUP BY`'],
          ['`GROUP BY col1 col2` / `HAVING`', '공백 구분 그룹 묶기 · 집계 후 필터', '집계하지 않는 모든 일반 컬럼을 `GROUP BY`에 명시']
        ]),
        {
          type: 'callout',
          style: 'warning',
          title: '집계 SELECT에서 0건 판별 주의',
          body: '구문법에서도 `GROUP BY` 없이 `SELECT COUNT( * ) MAX( seatsocc ) INTO (lv_cnt, lv_max) FROM ...`처럼 집계만 조회하면, 조건에 맞는 원본 행이 0건이어도 1행(`lv_cnt = 0`)이 반환되어 `sy-subrc = 0`, `sy-dbcnt = 1`이 됩니다. 반드시 `lv_cnt > 0`으로 존재 여부를 확인하세요.'
        },
        code('[구문법] SBOOK 예약 집계: GROUP BY와 HAVING', `REPORT zabap_f##_##.

PARAMETERS p_year TYPE c LENGTH 4 DEFAULT '2026'.

TYPES: BEGIN OF ts_stat,
         carrid      TYPE sbook-carrid,
         loccurkey   TYPE sbook-loccurkey,
         book_cnt    TYPE i,
         total_amt   TYPE sbook-loccuram,
         first_order TYPE sbook-order_date,
         last_order  TYPE sbook-order_date,
       END OF ts_stat.

DATA: lv_from  TYPE d,
      lv_to    TYPE d,
      gt_stats TYPE STANDARD TABLE OF ts_stat,
      gs_stat  TYPE ts_stat.

CONCATENATE p_year '0101' INTO lv_from.
CONCATENATE p_year '1231' INTO lv_to.

SELECT carrid
       loccurkey
       COUNT( * )
       SUM( loccuram )
       MIN( order_date )
       MAX( order_date )
  FROM sbook
  INTO TABLE gt_stats
  WHERE order_date BETWEEN lv_from AND lv_to
    AND cancelled = space
  GROUP BY carrid loccurkey
  HAVING COUNT( * ) >= 5
  ORDER BY carrid loccurkey.

IF sy-subrc = 0.
  LOOP AT gt_stats INTO gs_stat.
    WRITE: / gs_stat-carrid, gs_stat-book_cnt,
             gs_stat-total_amt CURRENCY gs_stat-loccurkey, gs_stat-loccurkey,
             gs_stat-first_order, '~', gs_stat-last_order.
  ENDLOOP.
ELSE.
  WRITE: / '집계 조건을 만족하는 예약이 없습니다.'.
ENDIF.`)
      ),

      /* ===================== JOIN · 서브쿼리 · FAE (신문법) ===================== */
      sqlSection('join', 'new', 'JOIN 종류와 ON vs WHERE 핵심 차이',
        text(
          '여러 테이블이 Foreign Key로 연결되어 있을 때 `JOIN`을 사용하면 DB에서 한 번의 조회로 결합된 결과를 가져올 수 있습니다. 테이블마다 `AS a`, `AS b` 별칭을 붙이고 `a~carrid`, `b~cityfrom`처럼 물결표(`~`)로 소속 테이블을 명시합니다.',
          '가장 자주 틀리는 부분은 **`LEFT OUTER JOIN`에서 오른쪽 테이블 필터 위치**입니다. 오른쪽 테이블 조건(`b~countryfr = \'DE\'`)을 `ON` 절에 쓰면 조건에 맞는 노선이 없는 항공사도 왼쪽 행이 유지되지만, 같은 조건을 `WHERE` 절로 옮기면 오른쪽이 `NULL`인 행이 제거되어 `INNER JOIN`과 같아집니다.'
        ),
        table(['신문법 JOIN 유형', '반환 결과', 'ABAP 7.40+ / 7.5+ 참고'], [
          ['`INNER JOIN`', '양쪽 테이블에서 `ON` 조건이 일치하는 행만', '기본 `JOIN`과 동일 · `ON` 절에 다양한 비교·호스트 변수 허용'],
          ['`LEFT OUTER JOIN`', '왼쪽 행 전체 유지, 오른쪽 미일치 열은 `NULL`', '오른쪽 테이블 필터를 `ON` vs `WHERE` 중 어디에 둘지 신중히 선택'],
          ['`RIGHT OUTER JOIN`', '오른쪽 행 전체 유지, 왼쪽 미일치 열은 `NULL`', 'ABAP 7.52+ 신문법 지원'],
          ['`CROSS JOIN`', '양쪽 모든 행의 곱집합(카테시안 곱)', 'ABAP 7.50+ 신문법 지원 · 행 수가 급격히 커지므로 소규모 조합에만 사용']
        ]),
        code('[신문법] SCARR·SPFLI·SFLIGHT 다중 LEFT OUTER JOIN', `REPORT zabap_f##_##.

SELECT a~carrid,
       a~carrname,
       b~connid,
       b~cityfrom,
       b~cityto,
       c~fldate,
       c~seatsocc
  FROM scarr AS a
  LEFT OUTER JOIN spfli AS b
    ON a~carrid = b~carrid
   AND b~countryfr = 'DE'
  LEFT OUTER JOIN sflight AS c
    ON b~carrid = c~carrid
   AND b~connid = c~connid
  ORDER BY a~carrid, b~connid, c~fldate
  INTO TABLE @DATA(gt_result)
  UP TO 30 ROWS.

LOOP AT gt_result INTO DATA(gs_row).
  WRITE: / gs_row-carrid, gs_row-carrname, gs_row-connid,
           gs_row-cityfrom, '->', gs_row-cityto,
           gs_row-fldate, gs_row-seatsocc.
ENDLOOP.`)
      ),
      sqlSection('join', 'new', '서브쿼리(EXISTS · IN)와 FOR ALL ENTRIES 안전 패턴',
        text(
          '상대 테이블의 컬럼을 출력할 필요 없이 **존재 여부만으로 필터링**할 때는 `JOIN`보다 `WHERE EXISTS ( SELECT * FROM ... )` 또는 `NOT EXISTS`가 중복 행이 생기지 않아 깔끔합니다.',
          '이미 메모리에 있는 Internal Table의 키 목록으로 DB를 조회할 때는 `LOOP` 안에서 `SELECT`를 반복하지 말고 **`FOR ALL ENTRIES IN @gt_keys`**를 사용합니다. 단, 아래 4가지 안전 규칙을 반드시 지켜야 합니다.'
        ),
        table(['`FOR ALL ENTRIES` 필수 안전 규칙 (신문법)', '어기면 생기는 문제'], [
          ['1. `IF gt_keys IS NOT INITIAL.` 선행 검사', '기준 테이블이 비어 있으면 `WHERE` 조건이 통째로 무시되어 대상 테이블 전체를 읽어 옴'],
          ['2. `SELECT` 목록에 대상 테이블의 **Key 컬럼 포함**', 'FAE는 결과의 중복 행을 자동 제거하므로, 키를 빼면 서로 다른 행이 같은 값으로 합쳐져 건수·합계가 누락됨'],
          ['3. 기준 테이블 복사 후 `SORT` + `DELETE ADJACENT DUPLICATES`', '중복 키가 많은 기준 테이블을 그대로 넘기면 DB에 불필요한 조건이 반복 전달됨'],
          ['4. `ORDER BY` · 집계 함수 · `GROUP BY` 제약 확인', 'FAE와 함께 쓸 수 있는 절이 일반 SELECT보다 제한적(정렬은 조회 후 Internal Table `SORT` 권장)']
        ]),
        code('[신문법] SCUSTOM·SBOOK: FOR ALL ENTRIES 안전 패턴과 EXISTS', `REPORT zabap_f##_##.

" 1) EXISTS: 예약 이력이 1건 이상 존재하는 독일 고객만 조회 (중복 없음)
SELECT a~id, a~name, a~city
  FROM scustom AS a
  WHERE a~country = 'DE'
    AND EXISTS ( SELECT * FROM sbook AS b
                   WHERE b~customid = a~id
                     AND b~cancelled = @space )
  ORDER BY a~id
  INTO TABLE @DATA(gt_active_cust)
  UP TO 20 ROWS.

" 2) FOR ALL ENTRIES: 조회된 고객의 예약 상세 일괄 조회
IF gt_active_cust IS NOT INITIAL.
  DATA(lt_keys) = gt_active_cust.
  SORT lt_keys BY id.
  DELETE ADJACENT DUPLICATES FROM lt_keys COMPARING id.

  " SBOOK Primary Key(carrid, connid, fldate, bookid)를 포함해 행 누락 방지
  SELECT carrid, connid, fldate, bookid, customid, order_date
    FROM sbook
    FOR ALL ENTRIES IN @lt_keys
    WHERE customid = @lt_keys-id
      AND cancelled = @space
    INTO TABLE @DATA(gt_books).

  SORT gt_books BY customid order_date DESCENDING.
  WRITE: / '대상 고객 수:', lines( gt_active_cust ),
           '/ 조회 예약 건수:', lines( gt_books ).
ELSE.
  WRITE: / '예약 이력이 있는 고객이 없습니다.'.
ENDIF.`)
      ),

      /* ===================== JOIN · 서브쿼리 · FAE (구문법) ===================== */
      sqlSection('join', 'classic', 'JOIN 종류와 ON vs WHERE 핵심 차이',
        text(
          '구문법(Classic Open SQL)에서는 **`INNER JOIN`과 `LEFT OUTER JOIN`**을 사용합니다. `RIGHT OUTER JOIN`과 `CROSS JOIN`은 구문법에서 지원되지 않으므로, 오른쪽 테이블을 기준으로 유지해야 할 때는 테이블 순서를 바꿔 `LEFT OUTER JOIN`으로 작성합니다.',
          '구문법 `LEFT OUTER JOIN`의 `ON` 절은 제약이 더 엄격해 오른쪽 테이블 필드를 포함하는 `=` / `AND` 조건 위주로 작성해야 하며(`OR`·`BETWEEN`·`LIKE` 등 제한), 오른쪽 테이블 필터를 `WHERE`에 두면 `INNER JOIN`처럼 변하는 주의점은 동일합니다.'
        ),
        table(['구문법 JOIN 유형', '반환 결과', '구문법 제약 · 참고'], [
          ['`INNER JOIN`', '양쪽 테이블에서 `ON` 조건이 일치하는 행만', '기본 `JOIN`과 동일 · 컬럼 목록은 공백 구분'],
          ['`LEFT OUTER JOIN`', '왼쪽 행 전체 유지, 오른쪽 미일치 열은 `NULL`', '`ON` 절은 `=` · `AND` 중심, 오른쪽 조건을 `WHERE`에 쓰면 미일치 행 탈락'],
          ['`RIGHT OUTER JOIN` / `CROSS JOIN`', '구문법 미지원', '테이블 순서를 바꾼 `LEFT OUTER JOIN`으로 대체']
        ]),
        code('[구문법] SCARR·SPFLI·SFLIGHT 다중 LEFT OUTER JOIN', `REPORT zabap_f##_##.

TYPES: BEGIN OF ts_join,
         carrid   TYPE scarr-carrid,
         carrname TYPE scarr-carrname,
         connid   TYPE spfli-connid,
         cityfrom TYPE spfli-cityfrom,
         cityto   TYPE spfli-cityto,
         fldate   TYPE sflight-fldate,
         seatsocc TYPE sflight-seatsocc,
       END OF ts_join.

DATA: gt_result TYPE STANDARD TABLE OF ts_join,
      gs_row    TYPE ts_join.

SELECT a~carrid
       a~carrname
       b~connid
       b~cityfrom
       b~cityto
       c~fldate
       c~seatsocc
  FROM scarr AS a
  LEFT OUTER JOIN spfli AS b
    ON a~carrid = b~carrid
   AND b~countryfr = 'DE'
  LEFT OUTER JOIN sflight AS c
    ON b~carrid = c~carrid
   AND b~connid = c~connid
  INTO TABLE gt_result
  UP TO 30 ROWS
  ORDER BY a~carrid b~connid c~fldate.

LOOP AT gt_result INTO gs_row.
  WRITE: / gs_row-carrid, gs_row-carrname, gs_row-connid,
           gs_row-cityfrom, '->', gs_row-cityto,
           gs_row-fldate, gs_row-seatsocc.
ENDLOOP.`)
      ),
      sqlSection('join', 'classic', '서브쿼리(EXISTS · IN)와 FOR ALL ENTRIES 안전 패턴',
        text(
          '구문법에서도 존재 여부 필터링은 `WHERE EXISTS ( SELECT * FROM ... )`, 이미 가진 Internal Table 기준 일괄 조회는 **`FOR ALL ENTRIES IN lt_keys`**(`@` 없음)를 사용합니다.',
          '구문법에서는 `INTO TABLE gt_books` 뒤에 `FOR ALL ENTRIES IN lt_keys`와 `WHERE customid = lt_keys-id`를 이어 쓰며, 빈 기준 테이블 검사·Primary Key 포함·중복 제거·`ORDER BY` 제약의 4가지 안전 규칙은 신문법과 똑같이 필수입니다.'
        ),
        table(['`FOR ALL ENTRIES` 필수 안전 규칙 (구문법)', '어기면 생기는 문제'], [
          ['1. `IF gt_keys IS NOT INITIAL.` 선행 검사', '기준 테이블이 비어 있으면 `WHERE` 조건이 무시되어 대상 테이블 전체를 읽어 옴'],
          ['2. `SELECT` 목록에 대상 테이블의 **Key 컬럼 포함**', 'FAE가 중복 행을 자동 제거하므로 키 누락 시 건수·합계가 빠짐'],
          ['3. 기준 테이블 복사 후 `SORT` + `DELETE ADJACENT DUPLICATES`', '중복 키가 많은 테이블을 넘기면 불필요한 DB 조건이 반복 전달됨'],
          ['4. `ORDER BY` · 집계 함수 · `GROUP BY` 미사용 (조회 후 `SORT`)', '구문법 FAE는 `ORDER BY PRIMARY KEY` 외 정렬 및 집계를 함께 쓰기 어려움']
        ]),
        code('[구문법] SCUSTOM·SBOOK: FOR ALL ENTRIES 안전 패턴과 EXISTS', `REPORT zabap_f##_##.

TYPES: BEGIN OF ts_cust,
         id   TYPE scustom-id,
         name TYPE scustom-name,
         city TYPE scustom-city,
       END OF ts_cust,
       BEGIN OF ts_book,
         carrid     TYPE sbook-carrid,
         connid     TYPE sbook-connid,
         fldate     TYPE sbook-fldate,
         bookid     TYPE sbook-bookid,
         customid   TYPE sbook-customid,
         order_date TYPE sbook-order_date,
       END OF ts_book.

DATA: gt_active_cust TYPE STANDARD TABLE OF ts_cust,
      lt_keys        TYPE STANDARD TABLE OF ts_cust,
      gt_books       TYPE STANDARD TABLE OF ts_book,
      lv_cust_cnt    TYPE i,
      lv_book_cnt    TYPE i.

" 1) EXISTS: 예약 이력이 1건 이상 존재하는 독일 고객만 조회 (구문법)
SELECT a~id a~name a~city
  FROM scustom AS a
  INTO TABLE gt_active_cust
  UP TO 20 ROWS
  WHERE a~country = 'DE'
    AND EXISTS ( SELECT * FROM sbook AS b
                   WHERE b~customid = a~id
                     AND b~cancelled = space )
  ORDER BY a~id.

" 2) FOR ALL ENTRIES: 조회된 고객의 예약 상세 일괄 조회 (구문법)
IF gt_active_cust IS NOT INITIAL.
  lt_keys = gt_active_cust.
  SORT lt_keys BY id.
  DELETE ADJACENT DUPLICATES FROM lt_keys COMPARING id.

  " SBOOK Primary Key(carrid, connid, fldate, bookid)를 포함해 행 누락 방지
  SELECT carrid connid fldate bookid customid order_date
    FROM sbook
    INTO TABLE gt_books
    FOR ALL ENTRIES IN lt_keys
    WHERE customid = lt_keys-id
      AND cancelled = space.

  SORT gt_books BY customid order_date DESCENDING.
  DESCRIBE TABLE gt_active_cust LINES lv_cust_cnt.
  DESCRIBE TABLE gt_books LINES lv_book_cnt.
  WRITE: / '대상 고객 수:', lv_cust_cnt,
           '/ 조회 예약 건수:', lv_book_cnt.
ELSE.
  WRITE: / '예약 이력이 있는 고객이 없습니다.'.
ENDIF.`)
      ),

      /* ===================== 변경(CUD) · 트랜잭션 ===================== */
      sqlSection('dml', 'new', 'DB 변경 문법 — INSERT · UPDATE · MODIFY · DELETE',
        text(
          'Open SQL의 `INSERT`, `UPDATE`, `MODIFY`, `DELETE`는 **데이터베이스 테이블의 실제 데이터**를 바꿉니다. 신문법(Strict Mode)에서는 조회와 마찬가지로 DML 문장에서도 Work Area·Internal Table·조건 변수 앞에 모두 `@`를 붙입니다.',
          '일부 컬럼만 변경할 때는 Work Area 전체를 덮어쓰는 `MODIFY` 대신 **`UPDATE dbtab SET col = @val WHERE ...`**를 쓰면 의도가 명확하고, 채우지 않은 필드가 초기값으로 덮어쓰이는 사고를 막을 수 있습니다.'
        ),
        {
          type: 'callout',
          style: 'warning',
          title: '실습 시 표준 테이블 직접 변경 금지',
          body: '`SCARR`, `SPFLI`, `SFLIGHT`, `SBOOK`, `SCUSTOM` 같은 교육용 표준 테이블이나 업무 테이블에 직접 `INSERT`/`UPDATE`/`DELETE`를 실행하지 마세요. DB 변경 실습은 반드시 `SE11`에서 본인이 만든 `Z` 연습용 테이블(예: `ZCARRIER_##`)에서만 수행하세요.'
        },
        table(['신문법 문장 (Z 연습 테이블 기준)', '동작', '실무 확인 포인트'], [
          ['`INSERT zcarrier_## FROM @gs_row.`', '새 1행 삽입', '동일 Primary Key가 이미 있으면 `sy-subrc = 4`'],
          ['`INSERT zcarrier_## FROM TABLE @gt_rows ACCEPTING DUPLICATE KEYS.`', '여러 행 일괄 삽입(중복 키만 건너뜀)', '옵션 없이 중복 키가 있으면 런타임 덤프(`CX_SY_OPEN_SQL_DB`) 발생'],
          ['`UPDATE zcarrier_## SET carrname = @lv_name WHERE carrid = @lv_id.`', '조건에 맞는 행의 지정 컬럼만 변경', '실제 변경 행 수는 `sy-dbcnt`로 확인'],
          ['`MODIFY zcarrier_## FROM @gs_row.`', '키가 있으면 전체 덮어쓰기, 없으면 삽입', 'Work Area에 비어 있는 필드도 DB 값을 초기값으로 덮어쓸 수 있음'],
          ['`DELETE FROM zcarrier_## WHERE carrid = @lv_id.`', '조건에 맞는 행 삭제', '`WHERE` 절 누락 주의! 삭제 전 대상·건수 먼저 조회 확인']
        ])
      ),
      sqlSection('dml', 'classic', 'DB 변경 문법 — INSERT · UPDATE · MODIFY · DELETE',
        text(
          '구문법의 DB 변경 문장(`INSERT`, `UPDATE`, `MODIFY`, `DELETE`)은 Work Area·Internal Table·조건 변수 앞에 **`@`를 붙이지 않습니다**. [[unit-05|Internal Table]] 조작 문장과 이름이 비슷하므로 대상이 DB 테이블인지 Internal Table 변수인지 항상 구분하세요.',
          '오래된 레거시 프로그램에서는 `TABLES zcarrier_##.`로 테이블명과 같은 암묵적 Work Area를 선언한 뒤 `FROM` 없이 `INSERT zcarrier_##.`처럼 쓰는 짧은 형태도 볼 수 있지만, 가독성과 안전을 위해 구문법에서도 **명시적인 `FROM gs_row`** 사용을 권장합니다.'
        ),
        {
          type: 'callout',
          style: 'warning',
          title: '실습 시 표준 테이블 직접 변경 금지',
          body: '`SCARR`, `SPFLI`, `SFLIGHT`, `SBOOK`, `SCUSTOM` 같은 교육용 표준 테이블이나 업무 테이블에 직접 `INSERT`/`UPDATE`/`DELETE`를 실행하지 마세요. DB 변경 실습은 반드시 `SE11`에서 본인이 만든 `Z` 연습용 테이블(예: `ZCARRIER_##`)에서만 수행하세요.'
        },
        table(['구문법 문장 (Z 연습 테이블 기준)', '동작', '실무 · 레거시 확인 포인트'], [
          ['`INSERT zcarrier_## FROM gs_row.`', '새 1행 삽입 (`@` 없음)', '동일 Primary Key가 이미 있으면 `sy-subrc = 4`'],
          ['`INSERT zcarrier_## FROM TABLE gt_rows ACCEPTING DUPLICATE KEYS.`', '여러 행 일괄 삽입(중복 키만 건너뜀)', '옵션 없이 중복 키가 있으면 런타임 덤프(`CX_SY_OPEN_SQL_DB`) 발생'],
          ['`UPDATE zcarrier_## SET carrname = lv_name WHERE carrid = lv_id.`', '조건에 맞는 행의 지정 컬럼만 변경', '실제 변경 행 수는 `sy-dbcnt`로 확인'],
          ['`MODIFY zcarrier_## FROM gs_row.`', '키가 있으면 전체 덮어쓰기, 없으면 삽입', '채우지 않은 필드가 초기값으로 덮어쓰일 수 있어 부분 변경은 `UPDATE SET` 권장'],
          ['`DELETE FROM zcarrier_## WHERE carrid = lv_id.`', '조건에 맞는 행 삭제', '`WHERE` 절 누락 주의! 삭제 전 대상·건수 먼저 조회 확인'],
          ['`INSERT zcarrier_##.` / `MODIFY zcarrier_##.` (레거시)', '`TABLES` 선언 암묵적 Work Area 사용', '기존 코드 해석용으로만 알고 신규 작성에서는 `FROM gs_row` 명시']
        ])
      ),
      sqlSection('dml', 'both', '트랜잭션(COMMIT / ROLLBACK) · LUW · Lock Object',
        text(
          'ABAP에서는 데이터베이스 단위의 트랜잭션인 **DB LUW**와, 여러 화면·단계를 하나의 업무 단위로 묶는 **SAP LUW**를 구분합니다. `COMMIT WORK`는 현재 LUW의 변경을 영구 확정하고, `ROLLBACK WORK`는 아직 커밋되지 않은 변경을 되돌립니다.',
          '화면 전환(Dynpro PBO/PAI), `CALL TRANSACTION`, 동기 RFC 호출 등에서는 **암묵적 DB 커밋**이 발생할 수 있으므로, `COMMIT WORK`를 적지 않았다고 변경이 절대 저장되지 않는다고 가정하면 안 됩니다. 또한 `SELECT ... ENDSELECT` 루프 안에서 `COMMIT WORK`를 호출하면 DB 커서가 닫혀 런타임 오류가 납니다.'
        ),
        table(['안전한 DB 변경 5단계 (구문법·신문법 공통)', '핵심 실천'], [
          ['1. 사전 확인', '변경/삭제 대상 행과 건수를 먼저 `SELECT`로 확인 (단, 조회와 변경 사이 타 사용자 수정 가능성 염두)'],
          ['2. 권한 검사', '업무 권한 객체(`AUTHORITY-CHECK`)로 실행 권한 검증 (Open SQL은 업무 권한을 자동 체크하지 않음)'],
          ['3. 잠금(`Lock Object`)', '`SE11`에 정의된 Lock Object의 `ENQUEUE_...` 함수로 동시 수정 방지'],
          ['4. 변경 및 오류 처리', '좁은 Primary Key 조건으로 변경 후 즉시 `sy-subrc`·`sy-dbcnt` 및 `CX_SY_OPEN_SQL_DB` 예외 처리'],
          ['5. 확정 / 복구 및 해제', '업무 단위가 모두 성공하면 `COMMIT WORK`, 하나라도 실패하면 `ROLLBACK WORK` 후 `DEQUEUE_...` 해제']
        ])
      ),

      /* ===================== 규칙 · 표현식 / 후처리 · 성능 ===================== */
      sqlSection('advanced', 'new', '신문법(Strict Mode) 필수 규칙',
        text(
          'ABAP 7.40 SP05 / 7.5+ Open SQL에서는 쉼표(`,`)로 컬럼을 구분하거나 `@` 호스트 변수·`@DATA(...)` 인라인 선언·SQL 표현식 등 최신 요소가 하나라도 들어가면 컴파일러가 **Strict Mode(신문법)**로 검사합니다.',
          'Strict Mode가 켜지면 아래 규칙을 **해당 SQL 문장 전체에 일관되게** 적용해야 합니다. 한 `SELECT` 안에서 쉼표와 `@` 없는 변수, 앞쪽 `INTO` 같은 구문법 요소를 섞어 쓰면 즉시 문법 오류가 발생합니다.'
        ),
        table(['신문법(Strict Mode) 규칙', '올바른 신문법 예시', '자주 나는 문법 오류'], [
          ['컬럼·정렬·그룹 **쉼표 `,` 필수**', '`SELECT carrid, carrname` / `GROUP BY carrid, loccurkey`', '공백으로만 나열하면 Strict Mode 컴파일 오류'],
          ['모든 ABAP 변수 앞 **`@` 필수**', '`WHERE carrid = @p_carr` / `INTO TABLE @gt_tab`', '하나의 변수라도 `@`를 빼먹으면 오류'],
          ['**`INTO` 절은 문장 끝**에 배치', '`FROM scarr WHERE ... ORDER BY ... INTO TABLE @gt_tab.`', '`FROM` 바로 뒤에 `INTO`를 두면 오류'],
          ['**`@DATA(...)` 인라인 선언** 지원', '`INTO @DATA(gs_row)` · `INTO TABLE @DATA(gt_tab)`', '집계·표현식 컬럼에 `AS 별칭`을 빼면 인라인 컴포넌트 생성 오류'],
          ['SQL 표현식 · 최신 JOIN 지원', '`CASE`, `COALESCE`, 산술식, `RIGHT OUTER JOIN`, `WITH`', '시스템 릴리스(7.40 vs 7.50 vs 7.52)별 지원 범위 확인']
        ])
      ),
      sqlSection('advanced', 'new', 'SQL 표현식 · 내장 함수 · UNION · WITH(CTE)',
        text(
          '신문법 Open SQL에서는 데이터를 ABAP 메모리로 옮긴 뒤 `LOOP`로 가공하는 대신, **DB 단계에서 조건 분기·NULL 치환·산술 계산·문자열 조합**까지 처리해 가져올 수 있습니다. 표현식 결과에는 `AS 별칭`을 붙여 대상 컴포넌트 이름을 명확히 지정합니다.',
          '여러 `SELECT` 결과를 세로로 합칠 때는 `UNION`(중복 제거) 또는 `UNION ALL`(중복 유지, 더 빠름)을 사용하고, 복잡한 중간 조회는 `WITH +cte AS ( SELECT ... ) SELECT ... FROM +cte`(ABAP 7.51+)로 단계를 나눌 수 있습니다.'
        ),
        table(['신문법 SQL 표현식 / 기능', '역할 · 예시', '참고'], [
          ['`CASE ... WHEN ... ELSE ... END`', '조건에 따른 값 분류 (`AS seat_status`)', 'Simple CASE와 Searched CASE 모두 지원'],
          ['`COALESCE( a, b )`', '`a`가 `NULL`이면 `b` 반환', '`LEFT OUTER JOIN` 오른쪽 `NULL` 기본값 처리에 유용'],
          ['산술식 (`+`, `-`, `*`)', '`( a~seatsmax - a~seatsocc ) AS seatsfree`', '나눗셈은 `DIVISION` / `DIV` / `MOD`·`FLTP` 타입 규칙 확인'],
          ['문자열 함수 (`CONCAT`, `SUBSTRING`, `UPPER`, `LOWER`, `LENGTH`)', 'DB에서 문자열 가공 (`CONCAT_WITH_SPACE` 포함)', '지원 함수 범위는 ABAP 7.5 / 7.52 릴리스별 F1 문서 확인'],
          ['`UNION` / `UNION ALL`', '컬럼 수·타입이 호환되는 두 결과 집합 결합', '중복 제거가 필요 없으면 `UNION ALL`이 유리'],
          ['`WITH +cte AS ( ... )` / `OFFSET`', '공통 테이블 식(CTE) · 정렬 결과 앞부분 건너뛰기', 'ABAP 7.51+ 지원 · `OFFSET`은 `ORDER BY`와 함께 사용']
        ]),
        code('[신문법] SFLIGHT SQL 표현식: CASE·산술식·COALESCE', `REPORT zabap_f##_##.

PARAMETERS p_carr TYPE sflight-carrid DEFAULT 'LH'.

SELECT a~carrid,
       a~connid,
       a~fldate,
       a~seatsmax,
       a~seatsocc,
       ( a~seatsmax - a~seatsocc ) AS seatsfree,
       CASE
         WHEN a~seatsocc >= a~seatsmax THEN '만석'
         WHEN a~seatsmax - a~seatsocc <= 20 THEN '마감임박'
         ELSE '여유'
       END AS seat_status,
       COALESCE( b~cityto, '미등록' ) AS dest_city
  FROM sflight AS a
  LEFT OUTER JOIN spfli AS b
    ON a~carrid = b~carrid
   AND a~connid = b~connid
  WHERE a~carrid = @p_carr
    AND a~seatsmax > 0
  ORDER BY a~fldate DESCENDING, a~connid ASCENDING
  INTO TABLE @DATA(gt_status)
  UP TO 20 ROWS.

LOOP AT gt_status INTO DATA(gs_st).
  WRITE: / gs_st-carrid, gs_st-connid, gs_st-fldate,
           '잔여:', gs_st-seatsfree, gs_st-seat_status, gs_st-dest_city.
ENDLOOP.`)
      ),
      sqlSection('advanced', 'classic', '구문법(Classic Open SQL) 필수 규칙과 혼용 주의',
        text(
          '구문법(Classic Open SQL)은 기존 SAP ECC·레거시 `Z` 프로그램을 유지보수하거나 BC400 기본 문법을 읽을 때 반드시 알아야 하는 형식입니다. 구문법은 컬럼과 절을 **공백으로 구분**하고 `@`를 쓰지 않으며, 모든 대상 변수를 사전에 선언합니다.',
          '가장 흔한 실수는 기존 구문법 `SELECT`를 수정할 때 새 조건에 `@lv_val`이나 컬럼 쉼표 `,`를 하나만 추가하는 것입니다. **신문법 요소가 단 하나라도 들어가면 컴파일러가 문장 전체를 Strict Mode로 전환**하므로, 한 문장 안에서는 구문법과 신문법을 절대 섞어 쓰지 마세요.'
        ),
        table(['구문법(Classic) 규칙', '올바른 구문법 예시', '혼용 시 주의사항'], [
          ['컬럼·정렬·그룹 **공백 구분**', '`SELECT carrid carrname` / `ORDER BY carrid connid`', '쉼표 `,`를 넣으면 Strict Mode가 켜져 나머지 구문법에서 오류'],
          ['ABAP 변수 앞 **`@` 미사용**', '`WHERE carrid = p_carr` / `INTO TABLE gt_tab`', '일부 변수에만 `@`를 붙이면 문법 오류'],
          ['**`INTO` 절은 `FROM` 뒤·`WHERE` 앞**', '`SELECT ... FROM scarr INTO TABLE gt_tab WHERE ...`', '구문법에서는 `INTO`를 문장 끝에 두는 스타일을 섞지 않기'],
          ['**사전 `TYPES`·`DATA` 선언 필수**', '`DATA gt_tab TYPE STANDARD TABLE OF ts_row.`', '`@DATA(...)` 인라인 선언 불가'],
          ['SQL 표현식 · `UNION` · `WITH` 미지원', '원본 컬럼 조회 후 ABAP `LOOP`에서 계산·가공', '표현식이 필요하면 문장 전체를 신문법으로 전환']
        ])
      ),
      sqlSection('advanced', 'classic', '구문법의 데이터 가공 — SELECT 후 ABAP LOOP 후처리',
        text(
          '구문법 Open SQL에서는 `SELECT` 문 안에서 `CASE`, `COALESCE`, 산술 계산(`seatsmax - seatsocc`), 문자열 함수, `UNION`, `WITH(CTE)`, `OFFSET`을 사용할 수 없습니다.',
          '따라서 구문법에서는 **필요한 원본 컬럼만 `INTO [CORRESPONDING FIELDS OF] TABLE`로 먼저 조회**한 뒤, ABAP `LOOP AT` 내부에서 계산·조건 분기(`IF`/`CASE`)·초기값 치환(`IS INITIAL`)을 처리합니다. 아래 예제는 신문법의 `CASE·산술식·COALESCE` 예제와 동일한 결과를 구문법으로 구현한 패턴입니다.'
        ),
        table(['필요한 가공 작업', '구문법(Classic) 처리 패턴', '참고'], [
          ['조건 분기 (`CASE` 대체)', '`LOOP AT` 안에서 `IF ... ELSEIF ... ELSE ... ENDIF.`', '결과를 Structure 추가 필드에 저장 후 `MODIFY gt_tab FROM gs_row.`'],
          ['`NULL`/미일치 기본값 (`COALESCE` 대체)', '`IF gs_row-dest_city IS INITIAL. gs_row-dest_city = \'미등록\'. ENDIF.`', '`LEFT OUTER JOIN` 미일치 열은 ABAP 초기값으로 들어옴'],
          ['산술 계산 (`seatsmax - seatsocc`)', '`gs_row-seatsfree = gs_row-seatsmax - gs_row-seatsocc.`', '결과 Structure(`TYPES`)에 계산용 필드를 미리 정의'],
          ['두 조회 결과 합치기 (`UNION` 대체)', '첫 조회 `INTO TABLE gt_all` + 두 번째 조회 `APPENDING TABLE gt_all`', '중복 제거가 필요하면 `SORT` 후 `DELETE ADJACENT DUPLICATES`'],
          ['부분 건수 조회 (`OFFSET` 대체)', '`UP TO n ROWS` 조회 후 필요한 범위 처리', '대량 데이터는 키 조건(`WHERE key > lv_last_key`)으로 페이징']
        ]),
        code('[구문법] SFLIGHT 가공: Classic SELECT 후 LOOP 계산·분기', `REPORT zabap_f##_##.

PARAMETERS p_carr TYPE sflight-carrid DEFAULT 'LH'.

TYPES: BEGIN OF ts_status,
         carrid      TYPE sflight-carrid,
         connid      TYPE sflight-connid,
         fldate      TYPE sflight-fldate,
         seatsmax    TYPE sflight-seatsmax,
         seatsocc    TYPE sflight-seatsocc,
         dest_city   TYPE spfli-cityto,
         seatsfree   TYPE i,
         seat_status TYPE c LENGTH 10,
       END OF ts_status.

DATA: gt_status TYPE STANDARD TABLE OF ts_status,
      gs_st     TYPE ts_status.

" 1) 구문법은 SELECT 안 CASE·산술식·COALESCE 불가 -> 원본 컬럼 먼저 조회
SELECT a~carrid
       a~connid
       a~fldate
       a~seatsmax
       a~seatsocc
       b~cityto AS dest_city
  FROM sflight AS a
  LEFT OUTER JOIN spfli AS b
    ON a~carrid = b~carrid
   AND a~connid = b~connid
  INTO CORRESPONDING FIELDS OF TABLE gt_status
  UP TO 20 ROWS
  WHERE a~carrid = p_carr
    AND a~seatsmax > 0
  ORDER BY a~fldate DESCENDING a~connid ASCENDING.

" 2) ABAP LOOP에서 잔여 좌석 계산·상태 분기·미등록 도시 치환
LOOP AT gt_status INTO gs_st.
  gs_st-seatsfree = gs_st-seatsmax - gs_st-seatsocc.

  IF gs_st-seatsocc >= gs_st-seatsmax.
    gs_st-seat_status = '만석'.
  ELSEIF gs_st-seatsfree <= 20.
    gs_st-seat_status = '마감임박'.
  ELSE.
    gs_st-seat_status = '여유'.
  ENDIF.

  IF gs_st-dest_city IS INITIAL.
    gs_st-dest_city = '미등록'.
  ENDIF.

  MODIFY gt_status FROM gs_st.
  WRITE: / gs_st-carrid, gs_st-connid, gs_st-fldate,
           '잔여:', gs_st-seatsfree, gs_st-seat_status, gs_st-dest_city.
ENDLOOP.`)
      ),
      sqlSection('advanced', 'both', 'ABAP SQL 성능 체크리스트 · Table Buffer · ST05',
        text(
          '구문법과 신문법 어느 쪽을 쓰더라도 ABAP 프로그램 성능 저하의 가장 흔한 원인은 **불필요하게 많은 DB 왕복 호출**과 **과도한 컬럼·행 전송**입니다. 감으로 추측하기보다 `ST05`(SQL Trace)로 실제 실행된 SQL 횟수와 소요 시간, 실행 계획을 확인하는 습관이 중요합니다.'
        ),
        table(['점검 항목 (구문법·신문법 공통)', '피해야 할 패턴', '권장 패턴'], [
          ['컬럼 선택', '항상 `SELECT *`로 수십 개 컬럼 전체 읽기', '화면에 실제로 쓰는 컬럼만 명시적으로 나열'],
          ['반복 DB 호출', '`LOOP AT gt_list` 안에서 매 행마다 `SELECT SINGLE` 호출', '`JOIN` 또는 `FOR ALL ENTRIES`로 한 번에 조회 후 `READ TABLE ... BINARY SEARCH` / `HASHED TABLE` 매칭'],
          ['행 수 제한', '전체 테이블을 읽고 ABAP `LOOP`에서 `IF`로 버리기', '`WHERE` 조건으로 DB에서 먼저 필터링, 목록은 `UP TO n ROWS` 고려'],
          ['인덱스 활용', '키/인덱스 앞쪽 컬럼을 빼거나 선택도 낮은 조건만 사용', '`SE11` Primary Key / Secondary Index 선두 컬럼 순서와 선택도 고려'],
          ['`Table Buffer`', '버퍼 테이블에 `JOIN`/`DISTINCT`/`GROUP BY` 등을 무심코 써서 버퍼 우회', '버퍼 우회가 꼭 필요한 실시간 조회에만 명시적으로 `BYPASSING BUFFER` 사용'],
          ['성능 측정', '느낌으로 튜닝 (`JOIN`이 항상 빠르다고 단정)', '`ST05` SQL Trace로 호출 수·읽은 행 수·실행 계획 측정 후 개선']
        ]),
        {
          type: 'callout',
          style: 'tip',
          title: '관련 문서 함께 보기',
          body: '수업 필기 원문과 연결 개념은 [[unit-06|BC400 Unit 6 · 데이터 모델링과 데이터 조회]] · [[bc430-01|BC430 Unit 1 · ABAP Dictionary]] · [[bc430-04|BC430 Unit 4 · 테이블 접근 성능]] · [[unit-05|BC400 Unit 5 · 복합 데이터 객체]] · [[abap-thinking-flow|ABAP 사고 흐름]] · [[basic-session-review|Basic Session Review]] · [[sap-tcode-reference|자주 쓰는 T-Code 모음]]에서 바로 이어서 볼 수 있습니다.'
        }
      )
    ]
  };
  docs['abap-thinking-flow'].sections.push(
    related(['unit-05', 'unit-06', 'unit-07', 'bc430-02', 'abap-sql-guide', 'basic-session-review', 'sap-tcode-reference'])
  );
  docs['sap-gui-programs'].sections.push(
    related(['unit-02', 'unit-04', 'unit-05', 'unit-07', 'unit-09', 'bc430-02', 'bc430-03', 'bc430-09', 'basic-session-review', 'abap-thinking-flow', 'abap-sql-guide', 'sap-tcode-reference'])
  );
  docs['basic-session-review'].sections.push(
    related(['unit-02', 'unit-03', 'unit-04', 'unit-05', 'unit-06', 'unit-07', 'bc430-02', 'abap-sql-guide', 'abap-thinking-flow', 'sap-tcode-reference'])
  );
  const unit06Rel = docs['unit-06']?.sections?.find(s => s.title === '관련 문서');
  if (unit06Rel?.blocks?.[0]?.paragraphs?.[0]) {
    unit06Rel.blocks[0].paragraphs[0] += ' · [[abap-sql-guide|ABAP SQL 가이드]]';
  }
  for (const unitId of ['unit-02', 'unit-03', 'unit-04', 'unit-05', 'unit-06', 'unit-07', 'bc430-02']) {
    const rel = docs[unitId]?.sections?.find(s => s.title === '관련 문서');
    if (rel?.blocks?.[0]?.paragraphs?.[0]) {
      rel.blocks[0].paragraphs[0] += ' · [[basic-session-review|Basic Session Review]]';
    }
  }
  const sortedIds = ['welcome-abap', ...unitOrder];
  const sorted = Object.fromEntries([...sortedIds, ...Object.keys(docs).filter(id => !sortedIds.includes(id))].map(id => [id, docs[id]]));
  window.WIKI_DOCS = sorted;
})();
