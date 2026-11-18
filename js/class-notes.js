/** 2026-11-11 ~ 17 수업 필기를 주제별로 정리한 문서. */
(function () {
  const docs = window.WIKI_DOCS;
  const text = (...paragraphs) => ({ type: 'text', paragraphs });
  const table = (headers, rows) => ({ type: 'table', headers, rows });
  const code = (label, code) => ({ type: 'code', label, code });
  const section = (title, ...blocks) => ({ title, blocks });
  const related = ids => section('관련 문서', text(ids.map(id => `[[${id}|${docs[id].title}]]`).join(' · ')));
  const source = (dates, links = []) => section('필기와 참고 자료', text(
    `수업 필기: ${dates}. 중복 메모는 합치고 설명과 예제를 보완했습니다. SAP GUI 기반 Standard ABAP 학습을 기준으로 하며, ABAP Cloud에서는 사용 가능한 문법과 도구가 다를 수 있습니다.`,
    ...links.map(([label, url]) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`)
  ));
  function put(id, title, summary, aliases, sections, dates, links) {
    docs[id] = { id, title, summary, aliases, lessonDates: dates.split(' · ').map(date => '2026-' + date.replace('/', '-')), sections: [...sections, source(dates, links)], track: 'abap', categoryId: 'abap-curriculum', subtitle: '수업 필기 정리 · 개념과 예제', stepNum: '', tcodes: [], specs: {} };
  }
  put('sap-architecture', 'SAP 시스템 구조', '사용자 요청이 처리되는 흐름과 서버 구성 요소의 역할을 구분합니다.', ['Dispatcher', 'Work Process', '워크 프로세스', 'Message Server', 'Gateway', 'ICM', 'SAP GUI'], [
    section('요청 처리 흐름', text('SAP GUI → Dispatcher → 사용 가능한 Work Process → 필요한 경우 데이터베이스 접근 → 결과 반환 순서로 이해할 수 있습니다. 모든 요청이 데이터베이스 작업을 수행하는 것은 아닙니다.', 'Dispatcher는 요청을 받아 작업을 배분합니다. 큐를 단순한 처리 순서 예제로 이해하되, 실제 스케줄링 전체를 항상 FIFO라고 단정하지 않습니다.')),
    section('워크 프로세스와 잠금', table(['구분', '역할'], [
      ['Dialog', '사용자의 대화형 요청 처리'], ['Background', '예약된 배치 작업과 비대화형 처리'], ['Update', '업데이트 태스크의 데이터 변경 처리'], ['Spool', '인쇄 요청 처리'], ['Enqueue', 'SAP 논리 잠금 관리. 현대 구성에서는 ASCS의 별도 Enqueue Server가 담당하며 과거 Enqueue Work Process와 구분']
    ]), text('SM50에서 현재 애플리케이션 서버의 프로세스를, SM04에서 해당 서버의 사용자·세션을 확인합니다. 잠금은 동시에 같은 업무 데이터를 변경할 때 충돌을 조정하는 장치입니다.')),
    section('통신 구성 요소', table(['구성 요소', '역할'], [
      ['Message Server', '애플리케이션 서버 간 통신 조정과 로그온 부하 분산 지원'], ['Gateway', 'RFC 통신 처리'], ['ICM', 'HTTP(S) 등 인터넷 프로토콜 통신 처리']
    ]), text('SAP NetWeaver는 SAP의 기술 플랫폼입니다. “SAP의 모든 제품을 포함하는 프레임워크”라는 뜻은 아닙니다.'))
  ], '11/11', [['SAP Help · AS ABAP 구조', 'https://help.sap.com/docs/ABAP_PLATFORM_NEW/1ba3197c1aa7489882770103e3a610dc/f9e2350eca7f4a109eb0a7bc63135e27.html']]);

  put('abap-development', '개발 객체와 전송 관리', '프로그램을 패키지에 담고 변경 요청을 통해 다른 시스템으로 전달하는 흐름입니다.', ['패키지', 'Package', 'Change Request', 'Workbench Request', 'Customizing Request', 'Transport'], [
    section('개발·품질·운영 시스템', text('일반적인 시스템 구성은 개발(DEV) → 품질 검증(QAS) → 운영(PRD)입니다. 개발 객체의 변경을 요청과 태스크로 기록하고 검증 후 대상 시스템으로 전송합니다.', '요청을 누가 만들고 몇 개로 관리하는지는 팀의 정책에 따릅니다. SI는 항상 요청 하나, SM은 여러 개라는 고정 규칙은 없습니다.')),
    section('패키지와 요청', table(['항목', '의미'], [
      ['패키지', '관련 개발 객체를 묶고 전송 속성 등을 관리하는 단위'], ['Workbench Request', '프로그램·사전 객체 등 저장소 변경을 관리하는 요청'], ['Customizing Request', '커스터마이징 설정 변경을 관리하는 요청'], ['태스크', '요청 아래에서 작업자별 변경을 모으는 단위']
    ]), text('SE80에서 객체와 패키지를 탐색하고, SE09에서 요청과 태스크를 관리합니다. 고객 객체에는 보통 Y/Z 접두어 또는 등록된 네임스페이스를 사용합니다.', 'Transport Layer는 전송 경로와 관련된 설정입니다. 이름의 첫 글자만으로 고객 객체와 SAP 객체를 판정하지 않습니다. 로컬 패키지 $TMP의 객체는 일반 전송 요청에 기록되지 않습니다.')),
    section('작성에서 전송까지', text('패키지와 요청 확인 → 프로그램 작성 → 문법 검사 → 활성화 → 실행·디버깅 → 태스크와 요청 릴리스 → 대상 시스템으로 임포트하는 흐름입니다.', '저장은 편집 내용을 보관하고, 활성화는 실행 가능한 활성 버전을 만드는 과정입니다. 릴리스만으로 운영 반영이 끝나는 것은 아니며, 임포트와 검증 절차가 따릅니다. 단축키는 [[sap-gui-shortcuts|단축키 모음]]을 참고하세요.')),
    section('트랜잭션 코드 생성', text('SE93에서 실행 대상에 맞는 트랜잭션 유형을 선택합니다. 클래식 실행 가능 리포트는 리포트 트랜잭션, 화면 번호를 시작점으로 사용하는 프로그램은 대화형 트랜잭션을 검토합니다.', '선택 항목의 순서 번호 대신 유형 이름과 실행 대상을 확인하세요. 프로그램 이름과 T-Code 이름을 같게 하는 것은 팀의 명명 관례이며 필수 조건은 아닙니다.'))
  ], '11/11 · 11/12');

  put('abap-basics', 'ABAP 기초', '문장 구조, 변수 선언, 입력과 출력의 기본 흐름을 익힙니다.', ['ABAP 기초', 'DATA', 'PARAMETERS', 'CLEAR', 'TYPE', 'LIKE'], [
    section('문장과 주석', text('ABAP 문장은 마침표(.)로 끝납니다. 키워드와 식별자는 대소문자를 구분하지 않지만, 문자열 리터럴의 내용은 구분됩니다.', '큰따옴표(") 뒤는 해당 줄의 주석이며, 첫 번째 열의 별표(*)는 줄 전체를 주석으로 만듭니다. F1 문서에 obsolete로 표시된 구문은 유지보수 시 의미를 익히되 새 코드에서는 대안을 검토합니다.')),
    section('변수 선언과 대입', code('TYPE · LIKE · VALUE · CLEAR', `REPORT zcw_basics.
DATA lv_count TYPE i VALUE 17.
DATA lv_copy LIKE lv_count.
CONSTANTS lc_limit TYPE i VALUE 20.
lv_copy = lv_count.
CLEAR lv_count.
WRITE: / lv_count, / lv_copy, / lc_limit.`), text('TYPE은 타입을, LIKE는 기존 데이터 객체의 타입을 참조합니다. VALUE는 선언 시 값을 지정합니다. 대입은 = 로 표현할 수 있으며 MOVE 원본 TO 대상도 기존 코드에서 볼 수 있습니다.', 'CLEAR는 빈 문자열을 일괄 대입하는 명령이 아니라 타입별 초기값으로 되돌리는 명령입니다. 자세한 값은 [[abap-types|자료형과 초기값]]을 참고하세요.')),
    section('입력과 출력', code('선택 화면에서 숫자 입력받기', `REPORT zcw_input.
PARAMETERS p_count TYPE i DEFAULT 3.
START-OF-SELECTION.
  DATA(lv_double) = p_count * 2.
  WRITE: / '입력:', p_count,
         / '두 배:', lv_double.`), text('PARAMETERS는 리포트의 선택 화면 입력 필드를 정의합니다. WRITE는 클래식 리스트 출력을 만듭니다. 문자열 함수와 조건 표현은 [[abap-useful-syntax|유용한 함수 · 문법 모음]]으로 연결됩니다.'))
  ], '11/11 · 11/12');

  put('abap-types', '자료형과 초기값', '문자형·숫자형·바이트형을 구분하고 길이와 소수 자릿수를 명시합니다.', ['자료형', '초기값', 'DECFLOAT16', 'DECFLOAT34', 'XSTRING'], [
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
    section('텍스트 심볼과 번역', text('화면 문구는 텍스트 심볼로 분리할 수 있습니다. text-001 또는 문자열 리터럴 뒤의 텍스트 심볼 ID를 사용하는 방식이 있습니다.', '텍스트 요소에서 문구를 관리하고 필요한 언어로 번역합니다. 프로그램과 텍스트 요소의 저장·활성화 상태를 함께 확인하세요.'), code('텍스트 심볼 사용', `WRITE / text-001.
WRITE / '안녕하세요'(002).`))
  ], '11/12');

  put('abap-loops', '반복문과 시스템 필드', '반복 종류에 맞는 시스템 필드를 읽고 CONTINUE와 EXIT를 구분합니다.', ['DO', 'WHILE', 'sy-index', 'sy-tabix', 'sy-subrc', 'sy-dbcnt', 'sy-uname', '시스템 필드'], [
    section('반복문 비교', table(['문장', '용도', '참고'], [
      ['DO n TIMES', '정해진 횟수 반복', '현재 회차는 sy-index'], ['DO ... ENDDO', '종료 조건을 내부에 둔 반복', 'EXIT 등 종료 경로 필요'], ['WHILE ... ENDWHILE', '조건이 참인 동안 반복', '조건을 바꾸는 코드 필요'], ['LOOP AT ... ENDLOOP', '내부 테이블 행 순회', 'sy-tabix는 테이블 종류와 접근 방식에 따라 해석'], ['SELECT ... ENDSELECT', '조회 결과 행별 처리', 'sy-dbcnt는 처리된 DB 행 수; 일반 루프 인덱스가 아님']
    ])),
    section('CONTINUE와 EXIT', code('짝수는 건너뛰고 7에서 종료', `REPORT zcw_loop.
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
      ['sy-mandt', '현재 클라이언트 번호'], ['sy-uname', '현재 로그온 사용자 이름; 클라이언트 이름이 아님'], ['sy-langu', '로그온 언어 키'], ['sy-datum / sy-uzeit', '애플리케이션 서버 기준 시스템 날짜 / 시간'], ['sy-tcode', '현재 트랜잭션 코드'], ['sy-repid', '현재 ABAP 프로그램 이름'], ['sy-index', 'DO / WHILE 반복 회차'], ['sy-tabix', '인덱스 테이블 작업의 행 인덱스. 해시 테이블은 일반적으로 0'], ['sy-subrc', '해당 문장이 설정한 반환 코드'], ['sy-dbcnt', '해당 SQL 문장이 처리한 행 수']
    ]), text('sy-subrc의 0은 흔히 성공을 뜻하지만 값과 의미는 문장마다 다릅니다. 0/4/8만 존재하는 것은 아닙니다. 다음 문장에서 덮어쓸 수 있으므로 결과를 설정하는 문장 바로 뒤에서 검사하세요.'))
  ], '11/13', [['SAP Help · 시스템 필드', 'https://help.sap.com/saphelp_snc700_ehp01/helpdata/en/7b/fb96c8882811d295a90000e8353423/content.htm']]);

  put('abap-debug-messages', '디버깅과 메시지', '중단점에서 값을 추적하고 메시지와 예외의 목적을 구분합니다.', ['디버깅', 'Debugger', '중단점', '메시지 클래스', 'MESSAGE'], [
    section('디버깅 순서', text('SE38 또는 SE80에서 중단점을 설정하고 실행합니다. 중단된 위치에서 변수 값, 호출 스택, 조건식의 결과를 확인합니다.', '디버거의 F5는 한 단계 실행(Single Step)입니다. 편집 화면의 F5는 텍스트 요소 등 다른 기능일 수 있으므로 화면 맥락을 확인하세요. 런타임 오류는 ST22에서 덤프를 확인합니다.')),
    section('메시지 유형', table(['유형', '의도와 동작'], [
      ['S', '성공 또는 상태 안내'], ['I', '정보 안내'], ['W', '경고'], ['E', '오류 처리'], ['A', '처리 중단'], ['X', '런타임 오류와 숏덤프 발생']
    ]), text('팝업·상태바 표시와 이후 제어 흐름은 메시지 유형뿐 아니라 선택 화면, 화면 PAI, 배치 등 실행 맥락에 따라 달라집니다. E/W를 “항상 하단 바에만 표시”라고 외우지 않습니다.')),
    section('직접 문구와 메시지 클래스', code('직접 문구', `MESSAGE '입력값을 확인하세요' TYPE 'I'.`), code('메시지 클래스 예시 — ZCW와 001을 먼저 생성', `MESSAGE i001(zcw) WITH sy-uname.`), text('메시지 클래스는 000~999 번호로 문구를 관리하고 번역할 수 있습니다. 문구의 & 자리표시자에 WITH의 값을 전달하며 최대 네 개의 값을 사용할 수 있습니다.')),
    section('예외와 반환 코드', text('클래식 예외는 호출 시 EXCEPTIONS에 번호를 매핑하고 sy-subrc로 처리하는 방식을 볼 수 있습니다. 클래스 기반 예외는 TRY … CATCH … ENDTRY로 처리합니다.', '같은 인터페이스의 예외 선언 방식은 해당 문법의 제약을 따릅니다. 프로그램 전체에서 두 방식이 절대 공존할 수 없다는 뜻은 아닙니다.'))
  ], '11/12 · 11/13 · 11/16 · 11/17');

  put('abap-modularization', '프로그램 모듈화', '서브루틴, 함수 모듈, 메서드를 구분하고 매개변수 전달 방향을 읽습니다.', ['프로그램 모듈화', '서브루틴', 'FORM', 'PERFORM', 'Function Module', '함수 모듈'], [
    section('모듈화 방식', table(['단위', '호출', '주요 용도'], [
      ['서브루틴', 'PERFORM', '클래식 프로그램 내 절차 분리'], ['함수 모듈', 'CALL FUNCTION', '함수 그룹에 속하는 재사용 단위'], ['메서드', '클래스=>메서드 / 참조->메서드', '클래스의 동작을 캡슐화']
    ])),
    section('서브루틴 매개변수', table(['선언 방식', '전달과 반영'], [
      ['USING VALUE(p)', '값 복사. 내부 변경은 호출자에게 복사되지 않음'], ['CHANGING VALUE(p)', '값을 복사하고 정상 종료 시 결과를 호출자에게 반영'], ['USING p / CHANGING p', '참조 전달. 같은 실제 데이터를 가리키므로 변경이 호출자에 반영']
    ]), text('참조 전달에서 USING은 읽기 전용을 보장하지 않습니다. 입력용은 USING, 변경 의도가 있는 값은 CHANGING으로 드러내는 관례가 중요합니다.', 'FORM의 형식 매개변수에 LENGTH/DECIMALS를 직접 붙이는 대신 미리 정의한 완전 타입을 사용합니다. TYPE ANY 같은 제네릭 타입은 유연하지만 정적 검사와 사용 가능한 연산이 제한됩니다.'), code('입력은 복사하고 결과는 반영', `REPORT zcw_form.
DATA lv_result TYPE i.
PERFORM double_number USING 3 CHANGING lv_result.
WRITE / lv_result.
FORM double_number USING VALUE(iv_number) TYPE i
                   CHANGING cv_result TYPE i.
  cv_result = iv_number * 2.
ENDFORM.`)),
    section('함수 그룹과 함수 모듈', text('SE37에서 함수 모듈의 인터페이스와 테스트 기능을 확인합니다. 함수 그룹은 관련 함수 모듈과 공유 전역 데이터를 담습니다.', '함수 그룹 ZDEMO의 생성된 메인 프로그램은 SAPLZDEMO입니다. 그룹 이름 자체에 SAPL을 붙이는 뜻은 아닙니다. LZDEMOTOP은 전역 선언을, LZDEMOUXX는 함수 모듈 구현 Include들을 포함하는 역할을 합니다.', '한 그룹에 넣는 함수 모듈 수는 고정 규칙이 아닙니다. 함께 쓰는 목적과 상태를 기준으로 묶고 활성화 상태를 확인합니다.')),
    section('호출자와 함수의 방향', table(['함수 인터페이스', '호출 문장', '방향'], [
      ['IMPORTING', 'EXPORTING', '호출자가 함수에 입력 전달'], ['EXPORTING', 'IMPORTING', '함수 결과를 호출자가 수신'], ['CHANGING', 'CHANGING', '값을 전달하고 변경 결과 수신']
    ]), text('호출 예제를 입력할 때는 해당 함수의 실제 매개변수 이름과 타입을 SE37에서 확인하세요.'))
  ], '11/16 · 11/17', [['SAP Help · 서브루틴 매개변수', 'https://help.sap.com/saphelp_ewm900/helpdata/en/9f/db984635c111d1829f0000e829fbfe/content.htm']]);

  put('abap-bapi', 'BAPI와 RFC', '원격 호출 기술인 RFC와 업무 API인 BAPI를 구분합니다.', ['BAPI', 'RFC', 'RETURN'], [
    section('BAPI와 RFC의 관계', text('RFC는 시스템 간 함수 호출 기술입니다. BAPI는 표준화된 업무 객체 인터페이스이며 전통적인 BAPI 구현에는 원격 호출 가능 함수 모듈이 사용됩니다. 모든 RFC 함수가 BAPI인 것은 아닙니다.', 'GetList, GetDetail, Create, Change 등은 업무 동작의 예입니다. 실제 제공 메서드와 이름은 업무 객체별로 확인합니다.')),
    section('입출력과 오류 처리', text('BAPI는 화면 팝업 대신 RETURN 구조 또는 테이블로 성공·오류 메시지를 전달하도록 설계합니다. 호출자는 RETURN의 TYPE과 메시지 내용을 확인해야 합니다.', '원격 함수의 인터페이스는 RFC 지원 타입과 값 전달 제약을 따릅니다. 일반 로컬 함수의 모든 설정에 그대로 적용할 규칙으로 이해하지 마세요.', '변경 BAPI의 커밋·롤백 책임은 개별 BAPI 문서를 확인해야 합니다. 호출 성공 여부만 보고 저장 완료라고 판단하지 않습니다.'))
  ], '11/17', [['SAP Help · BAPI 반환 메시지', 'https://help.sap.com/saphelp_snc70/helpdata/en/a5/3ec9f74ac011d1894e0000e829fbbd/content.htm']]);

  put('abap-objects', '클래스와 메서드', '클래스 자체의 정적 메서드와 객체의 인스턴스 메서드를 구분합니다.', ['Global class', 'Local class', '정적 메서드', '인스턴스 메서드', '참조 변수'], [
    section('전역 클래스와 지역 클래스', text('전역 클래스는 저장소 객체로 관리하며 SE24에서 확인할 수 있습니다. 지역 클래스는 프로그램 안에 정의합니다. 클래스는 속성과 메서드를 함께 묶는 단위입니다.')),
    section('정적 호출과 인스턴스 호출', table(['종류', '표기', '특징'], [
      ['정적 메서드', '클래스명=>메서드명( )', '객체 생성 없이 클래스에 호출'], ['인스턴스 메서드', '참조변수->메서드명( )', '생성된 객체를 참조하여 호출']
    ]), text('TYPE REF TO는 객체 참조를 보관할 변수를 선언합니다. 선언만으로 객체가 생기지는 않으며 CREATE OBJECT 또는 NEW로 생성합니다.'), code('지역 클래스의 인스턴스 메서드', `REPORT zcw_object.
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

  put('abap-program-types', '프로그램 종류와 Include', '실행 가능한 리포트와 다른 프로그램에 포함되는 소스 단위를 구분합니다.', ['Include 프로그램', '리포트 프로그램', 'Module Pool'], [
    section('프로그램과 저장소 객체', table(['종류', '역할'], [
      ['실행 가능 프로그램 / Report', '선택 화면과 이벤트를 사용해 실행·출력'], ['Module Pool', '클래식 Dynpro 화면과 대화형 흐름 처리'], ['Function Pool', '함수 그룹의 런타임 프로그램'], ['Class Pool', '전역 클래스의 런타임 프로그램'], ['Interface Pool', '전역 인터페이스의 런타임 프로그램'], ['Include', '다른 프로그램에 포함되는 소스. 독립 실행 대상이 아님']
    ]), text('“Screen”은 화면 객체를, “OOP”는 객체지향 프로그래밍 방식을 가리킵니다. 이를 그대로 공식 프로그램 유형 이름과 일대일 대응시키지 않습니다.')),
    section('Include와 모듈화', text('Include는 소스를 나누는 수단입니다. Include 자체가 별도 매개변수나 호출 경계를 만드는 함수는 아닙니다. 동작 단위의 재사용은 서브루틴·함수 모듈·메서드와 구분해서 설계합니다.'))
  ], '11/17');

  // Remove the setup stub and repair every existing reference, including home and roadmap.
  delete docs['erp-setup'];
  for (const [id, doc] of Object.entries(docs)) {
    docs[id] = JSON.parse(JSON.stringify(doc).replaceAll('[[erp-setup|실습 준비]]', '[[sap-architecture|SAP 시스템 구조]]').replaceAll('[[erp-setup|', '[[sap-architecture|'));
  }
  const order = ['sap-architecture', 'abap-development', 'abap-basics', 'abap-types', 'abap-loops', 'abap-debug-messages', 'abap-program-types', 'abap-modularization', 'abap-bapi', 'abap-objects', 'abap-dictionary', 'abap-data-report', 'erp-fi', 'erp-co', 'erp-mm', 'erp-sd', 'erp-pp', 'erp-resources'];
  order.forEach((id, i) => { docs[id].stepNum = String(i + 1).padStart(2, '0'); });
  const connections = {
    'sap-architecture': ['sap-tcode-reference', 'abap-development'],
    'abap-development': ['abap-program-types', 'sap-gui-shortcuts', 'sap-tcode-reference'],
    'abap-basics': ['abap-types', 'abap-loops', 'abap-useful-syntax'],
    'abap-types': ['abap-basics', 'abap-dictionary', 'abap-useful-syntax'],
    'abap-loops': ['abap-debug-messages', 'abap-data-report'],
    'abap-debug-messages': ['abap-loops', 'abap-bapi', 'sap-tcode-reference'],
    'abap-modularization': ['abap-objects', 'abap-bapi', 'abap-types'],
    'abap-bapi': ['abap-modularization', 'abap-debug-messages'],
    'abap-objects': ['abap-modularization', 'abap-program-types'],
    'abap-program-types': ['abap-development', 'abap-modularization']
  };
  for (const [id, targets] of Object.entries(connections)) docs[id].sections.push(related(targets));
  // Move broad aliases to their dedicated topic pages.
  const owners = { 'SAP GUI': 'sap-architecture', '자료형': 'abap-types', 'Include 프로그램': 'abap-program-types', '리포트 프로그램': 'abap-program-types' };
  for (const doc of Object.values(docs)) doc.aliases = (doc.aliases || []).filter(alias => !owners[alias] || owners[alias] === doc.id);
  docs['learning-roadmap'].subtitle = '수업 필기 기반 ABAP 학습 순서';
  docs['learning-roadmap'].summary = '11월 11~17일 필기를 주제별로 정리했습니다. 본문이 채워진 문서부터 읽고, 이후 과정은 준비된 목차로 확인하세요.';
  docs['learning-roadmap'].sections[0].blocks[0].rows = order.map(id => [docs[id].stepNum, `[[${id}|${docs[id].title}]]`, connections[id] ? '필기 정리 · 예제' : '목차 준비 · 본문 예정']);
  docs['welcome-abap'].sections[0].blocks = [text('[[learning-roadmap|전체 학습 목차]]에서 주제별 내용을 확인하세요. 수업 필기에서 다루지 않은 ERP 모듈은 목차로 남겨 두었습니다.'), table(['분야', '문서'], [
    ['시스템과 개발', '[[sap-architecture|SAP 시스템 구조]] · [[abap-development|개발 객체와 전송 관리]] · [[abap-program-types|프로그램 종류]]'],
    ['ABAP 기본기', '[[abap-basics|ABAP 기초]] · [[abap-types|자료형과 초기값]] · [[abap-loops|반복문과 시스템 필드]] · [[abap-debug-messages|디버깅과 메시지]]'],
    ['모듈화', '[[abap-modularization|프로그램 모듈화]] · [[abap-bapi|BAPI와 RFC]] · [[abap-objects|클래스와 메서드]]'],
    ['이후 학습', '[[abap-dictionary|데이터 사전]] · [[abap-data-report|데이터 처리와 리포트]] · [[learning-roadmap|ERP 모듈 목차]]']
  ])];
  const sortedIds = ['welcome-abap', 'learning-roadmap', ...order];
  const sorted = Object.fromEntries([...sortedIds, ...Object.keys(docs).filter(id => !sortedIds.includes(id))].map(id => [id, docs[id]]));
  window.WIKI_DOCS = sorted;
})();
