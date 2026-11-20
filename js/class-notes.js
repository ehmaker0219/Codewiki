/** 2026-11-11 ~ 19 수업 필기를 주제별로 정리한 문서. */
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
      ['Dialog', '사용자의 대화형 요청 처리'], ['Background', '예약된 배치 작업과 비대화형 처리'], ['Update', '업데이트 Task의 데이터 변경 처리'], ['Spool', '인쇄 요청 처리'], ['Enqueue', 'SAP 논리 잠금 관리. 현대 구성에서는 ASCS의 별도 Enqueue Server가 담당하며 과거 Enqueue Work Process와 구분']
    ]), text('SM50에서 현재 애플리케이션 서버의 프로세스를, SM04에서 해당 서버의 사용자·세션을 확인합니다. 잠금은 동시에 같은 업무 데이터를 변경할 때 충돌을 조정하는 장치입니다.')),
    section('통신 구성 요소', table(['구성 요소', '역할'], [
      ['Message Server', '애플리케이션 서버 간 통신 조정과 로그온 부하 분산 지원'], ['Gateway', 'RFC 통신 처리'], ['ICM', 'HTTP(S) 등 인터넷 프로토콜 통신 처리']
    ]), text('SAP NetWeaver는 SAP의 기술 플랫폼입니다. “SAP의 모든 제품을 포함하는 프레임워크”라는 뜻은 아닙니다.'))
  ], '11/11', [['SAP Help · AS ABAP 구조', 'https://help.sap.com/docs/ABAP_PLATFORM_NEW/1ba3197c1aa7489882770103e3a610dc/f9e2350eca7f4a109eb0a7bc63135e27.html']]);

  put('abap-development', '개발 객체와 전송 관리', 'Program을 Package에 담고 Change Request를 통해 다른 시스템으로 전달하는 흐름입니다.', ['패키지', 'Package', 'Change Request', 'Workbench Request', 'Customizing Request', 'Transport'], [
    section('개발·품질·운영 시스템', text('일반적인 시스템 구성은 개발(DEV) → 품질 검증(QAS) → 운영(PRD)입니다. 개발 객체의 변경을 Change Request와 Task로 기록하고 검증 후 대상 시스템으로 전송합니다.', 'Change Request를 누가 만들고 몇 개로 관리하는지는 팀의 정책에 따릅니다. SI는 항상 Change Request 하나, SM은 여러 개라는 고정 규칙은 없습니다.')),
    section('Package와 Change Request', table(['항목', '의미'], [
      ['Package', '관련 개발 객체를 묶고 전송 속성 등을 관리하는 단위'], ['Workbench Request', 'Program·사전 객체 등 저장소 변경을 관리하는 Change Request'], ['Customizing Request', '커스터마이징 설정 변경을 관리하는 Change Request'], ['Task', 'Change Request 아래에서 작업자별 변경을 모으는 단위']
    ]), text('SE80에서 객체와 Package를 탐색하고, SE09에서 Change Request와 Task를 관리합니다. 고객 객체에는 보통 Y/Z 접두어 또는 등록된 네임스페이스를 사용합니다.', 'Transport Layer는 전송 경로와 관련된 설정입니다. 이름의 첫 글자만으로 고객 객체와 SAP 객체를 판정하지 않습니다. 로컬 Package $TMP의 객체는 일반 Change Request에 기록되지 않습니다.')),
    section('작성에서 전송까지', text('Package와 Change Request 확인 → Program 작성 → 문법 검사 → 활성화 → 실행·디버깅 → Task와 Change Request 릴리스 → 대상 시스템으로 임포트하는 흐름입니다.', '저장은 편집 내용을 보관하고, 활성화는 실행 가능한 활성 버전을 만드는 과정입니다. 릴리스만으로 운영 반영이 끝나는 것은 아니며, 임포트와 검증 절차가 따릅니다. 단축키는 [[sap-gui-shortcuts|단축키 모음]]을 참고하세요.')),
    section('트랜잭션 코드 생성', text('SE93에서 실행 대상에 맞는 트랜잭션 유형을 선택합니다. 클래식 실행 가능 리포트는 리포트 트랜잭션, 화면 번호를 시작점으로 사용하는 Program은 대화형 트랜잭션을 검토합니다.', '선택 항목의 순서 번호 대신 유형 이름과 실행 대상을 확인하세요. Program 이름과 T-Code 이름을 같게 하는 것은 팀의 명명 관례이며 필수 조건은 아닙니다.')),
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
    section('입력과 출력', code('선택 화면에서 숫자 입력받기', `REPORT zabap_f##_##.
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
    section('텍스트 심볼과 번역', text('화면 문구는 텍스트 심볼로 분리할 수 있습니다. text-001 또는 문자열 리터럴 뒤의 텍스트 심볼 ID를 사용하는 방식이 있습니다.', '텍스트 요소에서 문구를 관리하고 필요한 언어로 번역합니다. Program과 텍스트 요소의 저장·활성화 상태를 함께 확인하세요.'), code('텍스트 심볼 사용', `WRITE / text-001.
WRITE / '안녕하세요'(002).`))
  ], '11/12');

  put('abap-loops', '반복문과 시스템 필드', '반복 종류에 맞는 시스템 필드를 읽고 CONTINUE와 EXIT를 구분합니다.', ['DO', 'WHILE', 'sy-index', 'sy-tabix', 'sy-subrc', 'sy-dbcnt', 'sy-uname', '시스템 필드'], [
    section('반복문 비교', table(['문장', '용도', '참고'], [
      ['DO n TIMES', '정해진 횟수 반복', '현재 회차는 sy-index'], ['DO ... ENDDO', '종료 조건을 내부에 둔 반복', 'EXIT 등 종료 경로 필요'], ['WHILE ... ENDWHILE', '조건이 참인 동안 반복', '조건을 바꾸는 코드 필요'], ['LOOP AT ... ENDLOOP', '내부 테이블 행 순회', 'sy-tabix는 테이블 종류와 접근 방식에 따라 해석'], ['SELECT ... ENDSELECT', '조회 결과 행별 처리', 'sy-dbcnt는 처리된 DB 행 수; 일반 루프 인덱스가 아님']
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
      ['sy-mandt', '현재 클라이언트 번호'], ['sy-uname', '현재 로그온 사용자 이름; 클라이언트 이름이 아님'], ['sy-langu', '로그온 언어 키'], ['sy-datum / sy-uzeit', '애플리케이션 서버 기준 시스템 날짜 / 시간'], ['sy-tcode', '현재 트랜잭션 코드'], ['sy-repid', '현재 ABAP Program 이름'], ['sy-index', 'DO / WHILE 반복 회차'], ['sy-tabix', '인덱스 테이블 작업의 행 인덱스. 해시 테이블은 일반적으로 0'], ['sy-subrc', '해당 문장이 설정한 반환 코드'], ['sy-dbcnt', '해당 SQL 문장이 처리한 행 수']
    ]), text('sy-subrc의 0은 흔히 성공을 뜻하지만 값과 의미는 문장마다 다릅니다. 0/4/8만 존재하는 것은 아닙니다. 다음 문장에서 덮어쓸 수 있으므로 결과를 설정하는 문장 바로 뒤에서 검사하세요.'))
  ], '11/13', [['SAP Help · 시스템 필드', 'https://help.sap.com/saphelp_snc700_ehp01/helpdata/en/7b/fb96c8882811d295a90000e8353423/content.htm']]);

  put('abap-debug-messages', '디버깅과 메시지', '중단점에서 값을 추적하고 메시지와 예외의 목적을 구분합니다.', ['디버깅', 'Debugger', '중단점', '메시지 클래스', 'MESSAGE'], [
    section('디버깅 순서', text('SE38 또는 SE80에서 중단점을 설정하고 실행합니다. 중단된 위치에서 변수 값, 호출 스택, 조건식의 결과를 확인합니다.', '디버거의 F5는 한 단계 실행(Single Step)입니다. 편집 화면의 F5는 텍스트 요소 등 다른 기능일 수 있으므로 화면 맥락을 확인하세요. 런타임 오류는 ST22에서 덤프를 확인합니다.')),
    section('메시지 유형', table(['유형', '의도와 동작'], [
      ['S', '성공 또는 상태 안내'], ['I', '정보 안내'], ['W', '경고'], ['E', '오류 처리'], ['A', '처리 중단'], ['X', '런타임 오류와 숏덤프 발생']
    ]), text('팝업·상태바 표시와 이후 제어 흐름은 메시지 유형뿐 아니라 선택 화면, 화면 PAI, 배치 등 실행 맥락에 따라 달라집니다. E/W를 “항상 하단 바에만 표시”라고 외우지 않습니다.')),
    section('직접 문구와 메시지 클래스', code('직접 문구', `MESSAGE '입력값을 확인하세요' TYPE 'I'.`), code('메시지 클래스 예시 — ZCW와 001을 먼저 생성', `MESSAGE i001(zcw) WITH sy-uname.`), text('메시지 클래스는 000~999 번호로 문구를 관리하고 번역할 수 있습니다. 문구의 & 자리표시자에 WITH의 값을 전달하며 최대 네 개의 값을 사용할 수 있습니다.')),
    section('예외와 반환 코드', text('클래식 예외는 호출 시 EXCEPTIONS에 번호를 매핑하고 sy-subrc로 처리하는 방식을 볼 수 있습니다. 클래스 기반 예외는 TRY … CATCH … ENDTRY로 처리합니다.', '같은 인터페이스의 예외 선언 방식은 해당 문법의 제약을 따릅니다. Program 전체에서 두 방식이 절대 공존할 수 없다는 뜻은 아닙니다.'))
  ], '11/12 · 11/13 · 11/16 · 11/17');

  put('abap-modularization', '프로그램 모듈화', '서브루틴, 함수 모듈, 메서드를 구분하고 매개변수 전달 방향을 읽습니다.', ['프로그램 모듈화', '서브루틴', 'FORM', 'PERFORM', 'Function Module', '함수 모듈'], [
    section('모듈화 방식', table(['단위', '호출', '주요 용도'], [
      ['서브루틴', 'PERFORM', '클래식 Program 내 절차 분리'], ['함수 모듈', 'CALL FUNCTION', '함수 그룹에 속하는 재사용 단위'], ['메서드', '클래스=>메서드 / 참조->메서드', '클래스의 동작을 캡슐화']
    ])),
    section('서브루틴 매개변수', table(['선언 방식', '전달과 반영'], [
      ['USING VALUE(p)', '값 복사. 내부 변경은 호출자에게 복사되지 않음'], ['CHANGING VALUE(p)', '값을 복사하고 정상 종료 시 결과를 호출자에게 반영'], ['USING p / CHANGING p', '참조 전달. 같은 실제 데이터를 가리키므로 변경이 호출자에 반영']
    ]), text('참조 전달에서 USING은 읽기 전용을 보장하지 않습니다. 입력용은 USING, 변경 의도가 있는 값은 CHANGING으로 드러내는 관례가 중요합니다.', 'FORM의 형식 매개변수에 LENGTH/DECIMALS를 직접 붙이는 대신 미리 정의한 완전 타입을 사용합니다. TYPE ANY 같은 제네릭 타입은 유연하지만 정적 검사와 사용 가능한 연산이 제한됩니다.'), code('입력은 복사하고 결과는 반영', `REPORT zabap_f##_##.
DATA lv_result TYPE i.
PERFORM double_number USING 3 CHANGING lv_result.
WRITE / lv_result.
FORM double_number USING VALUE(iv_number) TYPE i
                   CHANGING cv_result TYPE i.
  cv_result = iv_number * 2.
ENDFORM.`)),
    section('함수 그룹과 함수 모듈', text('SE37에서 함수 모듈의 인터페이스와 테스트 기능을 확인합니다. 함수 그룹은 관련 함수 모듈과 공유 글로벌 데이터를 담습니다.', '함수 그룹 ZDEMO의 생성된 메인 Program은 SAPLZDEMO입니다. 그룹 이름 자체에 SAPL을 붙이는 뜻은 아닙니다. LZDEMOTOP은 글로벌 선언을, LZDEMOUXX는 함수 모듈 구현 Include들을 포함하는 역할을 합니다.', '한 그룹에 넣는 함수 모듈 수는 고정 규칙이 아닙니다. 함께 쓰는 목적과 상태를 기준으로 묶고 활성화 상태를 확인합니다.')),
    section('호출자와 함수의 방향', table(['함수 인터페이스', '호출 문장', '방향'], [
      ['IMPORTING', 'EXPORTING', '호출자가 함수에 입력 전달'], ['EXPORTING', 'IMPORTING', '함수 결과를 호출자가 수신'], ['CHANGING', 'CHANGING', '값을 전달하고 변경 결과 수신']
    ]), text('호출 예제를 입력할 때는 해당 함수의 실제 매개변수 이름과 타입을 SE37에서 확인하세요.'))
  ], '11/16 · 11/17', [['SAP Help · 서브루틴 매개변수', 'https://help.sap.com/saphelp_ewm900/helpdata/en/9f/db984635c111d1829f0000e829fbfe/content.htm']]);

  put('abap-bapi', 'BAPI와 RFC', '원격 호출 기술인 RFC와 업무 API인 BAPI를 구분합니다.', ['BAPI', 'RFC', 'RETURN'], [
    section('BAPI와 RFC의 관계', text('RFC는 시스템 간 함수 호출 기술입니다. BAPI는 표준화된 업무 객체 인터페이스이며 전통적인 BAPI 구현에는 원격 호출 가능 함수 모듈이 사용됩니다. 모든 RFC 함수가 BAPI인 것은 아닙니다.', 'GetList, GetDetail, Create, Change 등은 업무 동작의 예입니다. 실제 제공 메서드와 이름은 업무 객체별로 확인합니다.')),
    section('입출력과 오류 처리', text('BAPI는 화면 팝업 대신 RETURN 구조 또는 테이블로 성공·오류 메시지를 전달하도록 설계합니다. 호출자는 RETURN의 TYPE과 메시지 내용을 확인해야 합니다.', '원격 함수의 인터페이스는 RFC 지원 타입과 값 전달 제약을 따릅니다. 일반 로컬 함수의 모든 설정에 그대로 적용할 규칙으로 이해하지 마세요.', '변경 BAPI의 커밋·롤백 책임은 개별 BAPI 문서를 확인해야 합니다. 호출 성공 여부만 보고 저장 완료라고 판단하지 않습니다.'))
  ], '11/17', [['SAP Help · BAPI 반환 메시지', 'https://help.sap.com/saphelp_snc70/helpdata/en/a5/3ec9f74ac011d1894e0000e829fbbd/content.htm']]);

  put('abap-objects', '클래스와 메서드', '클래스 자체의 정적 메서드와 객체의 인스턴스 메서드를 구분합니다.', ['Global class', 'Local class', '정적 메서드', '인스턴스 메서드', '참조 변수'], [
    section('글로벌 클래스와 로컬 클래스', text('글로벌 클래스는 저장소 객체로 관리하며 SE24에서 확인할 수 있습니다. 로컬 클래스는 Program 안에 정의합니다. 클래스는 속성과 메서드를 함께 묶는 단위입니다.')),
    section('정적 호출과 인스턴스 호출', table(['종류', '표기', '특징'], [
      ['정적 메서드', '클래스명=>메서드명( )', '객체 생성 없이 클래스에 호출'], ['인스턴스 메서드', '참조변수->메서드명( )', '생성된 객체를 참조하여 호출']
    ]), text('TYPE REF TO는 객체 참조를 보관할 변수를 선언합니다. 선언만으로 객체가 생기지는 않으며 CREATE OBJECT 또는 NEW로 생성합니다.'), code('로컬 클래스의 인스턴스 메서드', `REPORT zabap_f##_##.
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

  put('abap-program-types', 'Program 종류와 Include', '실행 가능한 리포트와 다른 Program에 포함되는 소스 단위를 구분합니다.', ['Include Program', 'Include 프로그램', '리포트 프로그램', 'Module Pool'], [
    section('Program과 저장소 객체', table(['종류', '역할'], [
      ['실행 가능 Program / Report', '선택 화면과 이벤트를 사용해 실행·출력'], ['Module Pool', '클래식 Dynpro 화면과 대화형 흐름 처리'], ['Function Pool', '함수 그룹의 런타임 Program'], ['Class Pool', '글로벌 클래스의 런타임 Program'], ['Interface Pool', '글로벌 인터페이스의 런타임 Program'], ['Include', '다른 Program에 포함되는 소스. 독립 실행 대상이 아님']
    ]), text('“Screen”은 화면 객체를, “OOP”는 객체지향 프로그래밍 방식을 가리킵니다. 이를 그대로 공식 Program 유형 이름과 일대일 대응시키지 않습니다.')),
    section('Include와 모듈화', text('Include는 소스를 나누는 수단입니다. Include 자체가 별도 매개변수나 호출 경계를 만드는 함수는 아닙니다. 동작 단위의 재사용은 서브루틴·함수 모듈·메서드와 구분해서 설계합니다.'))
  ], '11/17');

  // 11/18: retain earlier sections so their curated daily pages stay unchanged.
  docs['abap-objects'].sections.splice(-1, 1,
    section('로컬 클래스의 정의와 구현', text('12번 Program 필기: DEFINITION에서 속성과 메서드의 인터페이스를 선언하고 IMPLEMENTATION에서 메서드의 동작을 작성합니다. 속성만 선언하고 구현할 메서드가 없다면 구현부를 생략할 수 있습니다.', '접근 영역은 PUBLIC → PROTECTED → PRIVATE 순서입니다. 수업에서는 PUBLIC과 PRIVATE를 사용했지만 영역이 두 종류뿐인 것은 아닙니다. CLASS-METHODS는 정적 메서드, METHODS는 인스턴스 메서드 선언입니다.'),
      code('로컬 클래스의 정적 메서드', `REPORT zabap_f##_##.
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
  WRITE / lv_result.`), text('클래스 외부에서는 공개된 double 메서드를 호출하고, PRIVATE 영역의 c_factor는 클래스 내부에서 사용합니다. 호출 방식은 [[abap-modularization|프로그램 모듈화]]와 비교해 보세요.')),
    source('11/17 · 11/18', [['SAP Help · CLASS DEFINITION', 'https://help.sap.com/docs/abap-cloud/abap-keywords-standard-abap/ABAPCLASS_DEFINITION.html']]));

  docs['abap-types'].aliases.push('구조체', 'Structure', 'MOVE-CORRESPONDING');
  const typeSource = docs['abap-types'].sections.pop();
  docs['abap-types'].sections.push(
    section('구조체 선언과 컴포넌트', text('구조체는 서로 다른 타입의 컴포넌트를 하나로 묶습니다. ABAP Dictionary의 글로벌 구조를 참조하거나 Program 안에서 TYPES로 로컬 구조 타입을 정의할 수 있습니다.', 'ts_는 구조 타입, gs_는 구조 변수에 붙인 학습용 명명 관례입니다. 필드에 접근할 때는 구조변수-컴포넌트 형식을 사용합니다. 구조 하나는 한 건의 데이터를, [[abap-data-report|내부 테이블]]은 여러 행을 담습니다.'),
      code('구조 타입과 구조 변수', `TYPES: BEGIN OF ts_carrier,
         carrid   TYPE scarr-carrid,
         carrname TYPE scarr-carrname,
       END OF ts_carrier.
DATA gs_carrier TYPE ts_carrier.
DATA lv_carrname TYPE ts_carrier-carrname.

gs_carrier-carrid = 'LH'.
gs_carrier-carrname = 'Lufthansa'.
lv_carrname = gs_carrier-carrname.
WRITE: / gs_carrier-carrid, gs_carrier-carrname, / lv_carrname.`), text('TYPE ts_carrier-carrname은 구조 타입의 컴포넌트 타입을 참조합니다. ABAP Dictionary의 구조·테이블 필드도 TYPE scarr-carrid, TYPE spfli-connid처럼 글로벌타입-필드명으로 참조할 수 있습니다. 기존 변수의 컴포넌트를 기준으로 선언할 때는 LIKE gs_carrier-carrname을 사용합니다.')),
    section('구조체 간 MOVE-CORRESPONDING', text('이름이 같은 컴포넌트끼리 값을 전달합니다. 이름이 다른 대상 컴포넌트는 그대로 남으며, 같은 이름이어도 타입이 다르면 변환 가능 여부를 확인해야 합니다.'),
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
  docs['abap-types'].sections.push(typeSource);

  put('abap-data-report', '데이터 처리와 리포트', '구조체를 행 타입으로 사용하는 Internal Table과 Classic ABAP Report의 Selection Screen·처리 순서를 정리합니다.', ['내부 테이블', 'Internal Table', 'STANDARD TABLE', 'SORTED TABLE', 'HASHED TABLE', 'Header Line', 'OCCURS', 'Classic ABAP Report', 'Selection Screen', 'SELECT-OPTIONS', 'INITIALIZATION', 'AT SELECTION-SCREEN', 'START-OF-SELECTION', 'cl_demo_output'], [
    section('내부 테이블의 종류와 접근', text('14번 Program 필기: 내부 테이블은 Program 실행 중 여러 행을 메모리에 보관합니다. 데이터베이스 테이블에 저장하는 것과는 다릅니다. 아래는 기본 키와 기본 인덱스를 기준으로 한 비교입니다.'), table(['구분', 'STANDARD TABLE', 'SORTED TABLE', 'HASHED TABLE'], [
      ['분류', 'Index Table', 'Index Table', 'Hashed Table'],
      ['인덱스 접근', '가능', '가능', '기본 인덱스 없음'],
      ['키 접근', '가능', '가능', '가능'],
      ['기본 키 중복', 'NON-UNIQUE', 'UNIQUE / NON-UNIQUE', 'UNIQUE'],
      ['행 관리', '추가된 순서, SORT로 정렬 가능', '키 순서로 자동 정렬', '키의 해시로 관리']
    ]), text("INDEX 2는 두 번째 행에 접근한다는 뜻입니다. 열 번호가 아닙니다. 키 접근은 carrid = 'LH'처럼 필드 값으로 행을 찾습니다. 보조 키는 이후 학습 범위로 남겨 둡니다.")),
    section('내부 테이블 타입과 변수 선언', text('먼저 [[abap-types|구조체]]로 행 타입을 만들고 TYPES로 재사용할 테이블 타입을 정의합니다. DATA에서 테이블 종류와 행 타입을 바로 지정할 수도 있습니다.'),
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
      ['READ TABLE ... INTO', '조건에 맞는 행을 작업 영역에 복사'],
      ['MODIFY TABLE ... FROM', '기본 키로 찾은 행 수정'],
      ['DELETE TABLE ... WITH TABLE KEY', '기본 키로 찾은 행 삭제']
    ]), text('INSERT INTO TABLE을 항상 특정 위치에 넣는 명령이라고 생각하지 마세요. Index Table에서 위치를 지정하는 형식은 INSERT ... INTO ... INDEX n입니다. Sorted Table은 정렬 순서를 지켜야 합니다. READ TABLE 후에는 [[abap-loops|sy-subrc]]를 확인합니다.'),
      code('내부 테이블 조작 전체 예제', `REPORT zabap_f##_##.
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
    section('내부 테이블 정렬', text('Standard Table에서 SORT로 행 순서를 바꿉니다. BY 뒤에는 정렬할 필드가 필요하며, SORT gt_spfli BY.처럼 비워 두면 안 됩니다. Sorted Table은 선언된 키 순서를 자동으로 유지합니다.'),
      code('비행시간 내림차순·항공사 오름차순', `SORT gt_spfli BY fltime DESCENDING
                 carrid ASCENDING.`), text('비행시간(fltime)이 긴 행이 먼저 오고, 비행시간이 같으면 항공사 코드(carrid) 오름차순으로 정렬됩니다. SORT gt_spfli.는 기본 키 기준 정렬이므로 여기서는 carrid와 connid를 기준으로 정렬합니다.')),
    section('CLEAR·REFRESH·FREE', table(['문장', '의미'], [
      ['CLEAR gs_spfli-fltime.', '구조체의 한 필드를 초기값으로 변경'],
      ['CLEAR gs_spfli.', '구조체 전체 필드를 초기값으로 변경'],
      ['CLEAR gt_spfli.', 'Header Line이 없는 내부 테이블의 행을 모두 비움'],
      ['REFRESH gt_spfli.', '테이블 본문을 비우는 기존 문법'],
      ['FREE gt_spfli.', '행을 비우고 테이블 본문에 할당된 메모리도 해제']
    ]), text('CLEAR는 변수 선언 자체를 삭제하지 않습니다. 초기화한 구조체와 테이블은 다시 사용할 수 있습니다. 새 코드에서 Header Line 없는 테이블을 비울 때는 CLEAR를 사용할 수 있습니다.')),
    section('Header Line과 OCCURS — 기존 코드 읽기', text('15번 Program 필기: WITH HEADER LINE을 사용한 옛 문법에서는 테이블과 같은 이름의 작업 영역이 함께 생깁니다. 문장에 따라 같은 이름이 작업 영역 또는 본문을 가리켜 혼동하기 쉽습니다. 새 코드에서는 gs_ 작업 영역과 gt_ 테이블을 분리하세요.'),
      code('Header Line과 테이블 본문 구분', `REPORT zabap_f##_##.
DATA gt_scarr TYPE STANDARD TABLE OF scarr WITH HEADER LINE.
gt_scarr-carrid   = 'LH'.       " Header Line에 값 대입
gt_scarr-carrname = 'Lufthansa'.
APPEND gt_scarr.                " Header Line을 본문에 추가
CLEAR gt_scarr.                 " Header Line만 초기화, 본문 1행 유지
WRITE / lines( gt_scarr[] ).
CLEAR gt_scarr[].               " 테이블 본문 초기화
WRITE / lines( gt_scarr[] ).`),
      text('OCCURS n은 과거 내부 테이블 선언에서 초기 메모리 할당 규모를 지정하던 문법입니다. 최대 n건까지만 저장한다는 의미가 아니며 필요하면 테이블은 늘어납니다. 단순 구조 타입 선언에 저장 건수 제한으로 붙이지 않습니다. Header Line과 OCCURS는 기존 Standard ABAP 코드를 읽기 위한 내용입니다.')),
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
      text('FOR 뒤에는 타입 이름이 아니라 이미 선언된 데이터 객체(변수 또는 TABLES 선언 필드)를 지정합니다. 화면 입력을 비워 두면 WHERE ... IN @so_carr 조건은 제한 없이 전체 데이터를 통과시킵니다.'),
      code('SELECT-OPTIONS와 cl_demo_output 출력', `REPORT zabap_f##_##.

DATA gv_carrid TYPE spfli-carrid.
SELECT-OPTIONS so_carr FOR gv_carrid.

SELECT carrid, connid, cityfrom, cityto
  FROM spfli
  WHERE carrid IN @so_carr
  INTO TABLE @DATA(gt_connections).

cl_demo_output=>display( gt_connections ).`),
      text('cl_demo_output=>display( gt_connections ).은 학습·테스트용으로 Internal Table을 빠르게 화면에 출력하는 정적 메서드입니다. 실무 조회 화면용 ALV와는 구분해서 사용하세요.')),
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

DATA gv_carrid TYPE spfli-carrid.
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
  SELECT carrid, connid, cityfrom, cityto
    FROM spfli
    WHERE carrid IN @so_carr
    INTO TABLE @DATA(gt_connections).
  cl_demo_output=>display( gt_connections ).`),
      text('so_carr는 Header Line과 Internal Table 본문을 함께 가지므로 INITIALIZATION에서는 Header Line(so_carr-sign 등)에 값을 채운 뒤 APPEND so_carr.로 본문에 넣고, AT SELECTION-SCREEN에서는 본문이 비었는지 so_carr[] IS INITIAL로 검사합니다.')),
    section('이후 학습', text('DB에서 데이터를 읽고 변경하는 문법은 [[abap-open-sql|Open SQL]]에서 이어집니다. 이 문서는 11월 18일 Internal Table과 11월 20일 Classic ABAP Report 필기를 정리한 범위이며, ALV 화면 구성은 준비 중입니다.'))
  ], '11/18 · 11/20', [
    ['SAP Help · 내부 테이블과 키', 'https://help.sap.com/saphelp_gbt10/helpdata/en/fc/eb35de358411d1829f0000e829fbfe/content.htm'],
    ['SAP Help · 기본 키 컴포넌트', 'https://help.sap.com/docs/ABAP_PLATFORM_NEW/8132142fd1a144a59303663a03a7c2d4/3606e11612b046e1b801fde0e26682b3.html'],
    ['SAP Help · OCCURS와 기존 선언', 'https://help.sap.com/saphelp_em900/helpdata/en/fc/eb3646358411d1829f0000e829fbfe/content.htm'],
    ['SAP Help · 내부 테이블 정렬', 'https://help.sap.com/docs/abap-cloud/abap-concepts/sorting-table-content'],
    ['SAP ABAP 7.52 · SELECT-OPTIONS', 'https://help.sap.com/doc/abapdocu_752_index_htm/7.52/en-US/abapselect-options.htm'],
    ['SAP ABAP 7.52 · 리포트 이벤트 순서', 'https://help.sap.com/doc/abapdocu_752_index_htm/7.52/en-US/abenprogram_events.htm']
  ]);

  put('abap-open-sql', 'Open SQL', 'DB 테이블 조회부터 조건·집계·JOIN과 데이터 변경까지 정리합니다.',
    ['ABAP SQL', 'SELECT SINGLE', 'CORRESPONDING FIELDS', 'APPENDING TABLE', 'GROUP BY', 'HAVING', 'FOR ALL ENTRIES', 'OUTER JOIN'], [
    section('Open SQL과 Transparent Table', text(
      '11월 19일 필기의 SELECT·집계·조건·MODIFY 내용을 중심으로, JOIN·서브쿼리·트랜잭션 등 연결되는 내용을 보완했습니다. Open SQL은 현재 문서에서 ABAP SQL이라고도 부릅니다. ABAP Program의 DB 인터페이스를 통해 데이터베이스를 조회하고 변경합니다.',
      '예제 기준은 Standard ABAP 7.52입니다. @ 호스트 변수, 쉼표로 구분한 필드 목록, 인라인 DATA 선언을 사용합니다. 구버전이나 ABAP Cloud에서는 사용 가능한 문법·테이블·API가 다르므로 시스템의 F1 도움말을 확인하세요. SCARR·SPFLI·SFLIGHT는 교육용 항공 데이터가 설치된 환경을 전제로 하며, 현재 클라이언트에 데이터가 없으면 조회 결과가 비어 있을 수 있습니다.'),
      table(['구분', '의미', '예'], [
        ['Transparent Table', 'DDIC에서 정의하며 DB에 실제 행을 저장하는 테이블', 'SCARR'],
        ['행의 구조 타입', 'DB 테이블 이름을 TYPE 뒤에 쓰면 한 행의 구조로 사용', 'DATA gs_carrier TYPE scarr.'],
        ['Internal Table', 'Program 메모리에 여러 행을 보관하는 변수', 'DATA gt_carriers TYPE STANDARD TABLE OF scarr WITH EMPTY KEY.']
      ]), text('Transparent Table 자체가 단순 구조체라는 뜻은 아닙니다. DB 테이블의 행 구조를 ABAP 변수의 타입으로 활용하는 것입니다. SELECT의 FROM은 DB 데이터 소스, INTO는 결과를 받을 ABAP 변수를 지정합니다.')),
    section('SELECT 기본 구조와 호스트 변수', text(
      'SELECT는 열, FROM은 데이터 소스, WHERE는 행 조건, INTO는 결과 저장 위치입니다. SQL 안에서 ABAP 변수는 @로 구분합니다. WHERE carrid = @p_carr의 carrid는 DB 열이고 p_carr는 Program 변수입니다. 여기서 =는 대입이 아닌 비교입니다.',
      '예제는 INTO를 뒤에 쓰는 문법으로 통일합니다. 과거 코드의 INTO ... WHERE ... 순서와 섞지 마세요. 한 열은 단일 변수로, 여러 열은 구조체로, 여러 행은 내부 테이블로 받을 수 있습니다.'),
      code('Open SQL 기본 조회', `REPORT zabap_f##_##.
PARAMETERS p_carr TYPE scarr-carrid DEFAULT 'LH'.

SELECT carrid, carrname, currcode
  FROM scarr
  WHERE carrid = @p_carr
  INTO TABLE @DATA(gt_carriers).

IF sy-subrc = 0.
  LOOP AT gt_carriers INTO DATA(gs_carrier).
    WRITE: / gs_carrier-carrid,
             gs_carrier-carrname, gs_carrier-currcode.
  ENDLOOP.
ELSE.
  WRITE / '조회 결과가 없습니다.'.
ENDIF.`), text('sy-subrc는 후속 문장으로 바뀔 수 있으므로 조회 직후 확인합니다. 클라이언트 종속 테이블은 일반 Open SQL에서 현재 클라이언트로 자동 제한됩니다. 이것이 업무 권한 검사까지 대신하는 것은 아닙니다.')),
    section('한 행 조회와 정렬된 첫 행', table(['목적', '문법', '주의'], [
      ['키로 한 행 조회', 'SELECT SINGLE ...', '키를 모두 지정하지 않으면 여러 후보 중 어느 행인지 보장되지 않음'],
      ['정렬 기준에 따른 첫 행', 'ORDER BY ... INTO TABLE ... UP TO 1 ROWS', '동점까지 구분하도록 정렬 열 지정'],
      ['여러 행 제한', 'ORDER BY ... INTO TABLE ... UP TO n ROWS', 'ORDER BY가 없으면 반환 순서 보장 안 됨']
    ]), code('항공사 이름과 가장 빠른 운항일', `REPORT zabap_f##_##.
PARAMETERS p_carr TYPE scarr-carrid DEFAULT 'LH'.
DATA gv_name TYPE scarr-carrname.

CLEAR gv_name.
SELECT SINGLE carrname FROM scarr
  WHERE carrid = @p_carr
  INTO @gv_name.
IF sy-subrc = 0.
  WRITE / gv_name.
ENDIF.

SELECT carrid, connid, fldate FROM sflight
  WHERE carrid = @p_carr
  ORDER BY fldate ASCENDING, connid ASCENDING
  INTO TABLE @DATA(gt_first)
  UP TO 1 ROWS.
LOOP AT gt_first INTO DATA(gs_first).
  WRITE: / gs_first-carrid, gs_first-connid, gs_first-fldate.
ENDLOOP.`), text('SINGLE은 최대 한 행이며 결과가 없으면 0행입니다. 기존 변수에 INTO 했을 때 조회 실패로 이전 값이 남을 수 있으므로 반환 코드를 확인하세요. 단일 값을 변수에 받는 것은 가능하지만 SELECT를 VALUE 생성자의 내부 표현식처럼 넣는 것은 아닙니다.')),
    section('작업 영역·내부 테이블·CORRESPONDING', text(
      '일반 다중 행 SELECT를 작업 영역으로 받으면 SELECT ... ENDSELECT에서 한 행씩 처리합니다. INTO TABLE은 결과를 내부 테이블에 모으므로 일반적으로 ENDSELECT가 없습니다. PACKAGE SIZE를 쓰는 패키지 처리에는 별도 반복 규칙이 적용됩니다.',
      '명시한 열들을 CORRESPONDING 없이 구조체로 받으면 열 순서와 대상 컴포넌트의 타입이 맞아야 합니다. CORRESPONDING FIELDS OF는 결과 열의 이름(AS 별칭 포함)과 대상 컴포넌트 이름을 연결합니다. OF 뒤는 필드명이 아니라 대상 작업 영역 또는 내부 테이블입니다.'),
      code('이름 기준으로 작업 영역과 테이블에 받기', `REPORT zabap_f##_##.
TYPES: BEGIN OF ts_carrier,
         carrname TYPE scarr-carrname,
         carrid   TYPE scarr-carrid,
       END OF ts_carrier.
DATA gs_carrier TYPE ts_carrier.
DATA gt_carriers TYPE STANDARD TABLE OF ts_carrier WITH EMPTY KEY.

SELECT carrid, carrname FROM scarr
  WHERE carrid = 'LH'
  INTO CORRESPONDING FIELDS OF @gs_carrier.
  WRITE: / gs_carrier-carrid, gs_carrier-carrname.
ENDSELECT.

SELECT carrid, carrname FROM scarr
  WHERE carrid = 'LH'
  INTO CORRESPONDING FIELDS OF TABLE @gt_carriers.
WRITE: / '테이블 행 수:', lines( gt_carriers ).`), text('작업 영역에서 매칭되지 않은 필드는 이전 값이 남을 수 있습니다. 재사용할 때 필요한 초기화를 하세요. 여러 행을 보관하려는 목적이라면 SELECT 루프에서 APPEND를 반복하기보다 INTO TABLE이 간결합니다. 대량 조회는 메모리 크기도 고려합니다.')),
    section('INTO TABLE과 APPENDING TABLE', text(
      '일반 SELECT ... INTO TABLE은 대상 내부 테이블의 기존 행을 비운 뒤 조회 결과로 채웁니다. APPENDING TABLE은 기존 행을 유지하고 조회한 행을 추가합니다. 변수를 두 번 정의해서 덮어쓰는 현상과는 다릅니다.',
      'APPENDING이 중복을 자동 제거하지는 않습니다. 아래 Standard Table에는 같은 행이 두 번 들어갈 수 있고, UNIQUE 키를 가진 대상은 키 충돌도 고려해야 합니다.'),
      code('조회 결과를 이어 담기', `REPORT zabap_f##_##.
DATA gt_carriers TYPE STANDARD TABLE OF scarr WITH EMPTY KEY.

SELECT * FROM scarr WHERE carrid = 'LH'
  INTO TABLE @gt_carriers.
SELECT * FROM scarr WHERE carrid = 'AA'
  APPENDING TABLE @gt_carriers.
WRITE: / '합친 행 수:', lines( gt_carriers ).

SELECT * FROM scarr WHERE carrid = 'LH'
  INTO TABLE @gt_carriers.
WRITE: / '다시 채운 행 수:', lines( gt_carriers ).`), text('이 예제의 *는 행 전체와 SCARR 타입을 비교하기 위한 것입니다. 실제 Program에서는 필요한 열을 명시하는 것을 우선하세요.')),
    section('WHERE 조건과 NULL', table(['조건', '의미 / 예'], [
      ['= / EQ · <> / NE', '같음 / 다름'],
      ['< / LT · > / GT · <= / LE · >= / GE', '크기 비교'],
      ['AND · OR · NOT', '논리 결합. NOT → AND → OR 순으로 결합하므로 괄호로 의도 표현'],
      ['BETWEEN ... AND ...', '양 끝을 포함한 범위'],
      ['IN (...) · IN @range', '값 목록 또는 선택 범위 테이블'],
      ['LIKE', '%는 길이 0 이상 문자열, _는 한 문자. ABAP의 CP 패턴과 구분'],
      ['IS NULL · IS NOT NULL', 'DB의 NULL 여부. 공백이나 숫자 0 여부와 다름']
    ]), code('선택 범위와 문자열 조건', `REPORT zabap_f##_##.
DATA gv_carrid TYPE scarr-carrid.
SELECT-OPTIONS s_carr FOR gv_carrid.

SELECT carrid, carrname FROM scarr
  WHERE carrid IN @s_carr
    AND ( carrname LIKE 'L%' OR carrname LIKE 'A%' )
  ORDER BY carrid
  INTO TABLE @DATA(gt_carriers).
LOOP AT gt_carriers INTO DATA(gs_carrier).
  WRITE: / gs_carrier-carrid, gs_carrier-carrname.
ENDLOOP.`), text('선택 범위는 SIGN·OPTION·LOW·HIGH로 포함/제외와 비교 방법을 표현합니다. 빈 선택 범위의 IN 조건은 제한을 걸지 않으므로 빈 입력이 곧 0건이라는 뜻은 아닙니다.',
      'NULL은 값이 없거나 미정임을 나타냅니다. = NULL로 비교하지 않습니다. OUTER JOIN에서 상대 행이 없을 때도 생깁니다. 보통 ABAP 변수로 전달되면 타입의 초기값으로 보이므로 SQL에서 IS NULL이나 COALESCE로 처리할지 먼저 결정하세요.')),
    section('DISTINCT·집계·GROUP BY·HAVING', text(
      'DISTINCT는 SELECT에 나열한 열 조합 전체가 같은 행을 제거합니다. 한 열의 중복 제거와 여러 열 조합의 중복 제거는 결과가 다릅니다. 필기의 disting는 DISTINCT로 정정합니다.'),
      table(['함수 / 절', '역할'], [
        ['MIN · MAX', '최솟값 / 최댓값'], ['SUM · AVG', '합계 / 평균. 결과 타입과 자리수 확인'],
        ['COUNT( * )', '행 수'], ['COUNT( DISTINCT 열 )', 'NULL을 제외한 서로 다른 값의 개수'],
        ['GROUP BY', '지정한 열 조합별로 묶기. 단순 열 조회에서 집계하지 않는 열은 그룹에도 지정'],
        ['WHERE / HAVING', '집계 전 원본 행 필터 / 집계 후 그룹 필터']
      ]), code('항공사별 좌석 집계', `REPORT zabap_f##_##.
SELECT carrid, COUNT( * ) AS flight_count,
       MIN( seatsocc ) AS min_occupied,
       MAX( seatsocc ) AS max_occupied,
       SUM( seatsocc ) AS total_occupied,
       AVG( seatsocc ) AS avg_occupied
  FROM sflight
  WHERE seatsmax > 0
  GROUP BY carrid
  HAVING COUNT( * ) >= 2
  ORDER BY carrid
  INTO TABLE @DATA(gt_totals).
LOOP AT gt_totals INTO DATA(gs_total).
  WRITE: / gs_total-carrid, gs_total-flight_count,
           gs_total-min_occupied, gs_total-max_occupied,
           gs_total-total_occupied, gs_total-avg_occupied.
ENDLOOP.`), text('예제는 좌석 수를 집계합니다. 금액을 합치거나 평균을 낼 때는 통화가 다른 값을 그대로 섞지 말고 통화별 그룹이나 환산 기준을 정해야 합니다.')),
    section('조회 결과가 없을 때와 시스템 필드', table(['조회 형태', '데이터가 없을 때'], [
      ['일반 SELECT', 'sy-subrc = 4, sy-dbcnt = 0'],
      ['GROUP BY 없는 집계만의 SELECT', '일반적으로 집계 결과 한 행. COUNT는 0, 나머지는 대상 타입 초기값. sy-subrc = 0, sy-dbcnt = 1'],
      ['GROUP BY가 있는 집계', '그룹 자체가 없으면 결과 0행'],
      ['별칭 없는 COUNT( * )만 단독 조회, GROUP BY 없음', '예외: sy-dbcnt가 집계한 원본 행 수. 0건이면 sy-subrc = 4, sy-dbcnt = 0']
    ]), text('따라서 집계 후 sy-dbcnt가 1이라고 해서 원본 데이터가 한 건 있었다고 판단하면 안 됩니다. COUNT 단독 예외는 INTO를 생략할 수 있는 기존 형식과 연결됩니다. 새 코드에서는 개수를 명시적인 변수에 받아 판단하는 편이 읽기 쉽습니다.'),
      code('집계 결과와 실제 원본 건수 비교', `REPORT zabap_f##_##.
SELECT COUNT( * ) AS matched,
       MAX( seatsocc ) AS max_occupied
  FROM sflight
  WHERE carrid = 'LH' AND carrid = 'AA'
  INTO @DATA(gs_summary).
DATA(gv_subrc) = sy-subrc.
DATA(gv_dbcnt) = sy-dbcnt.
WRITE: / gs_summary-matched, gs_summary-max_occupied,
         gv_subrc, gv_dbcnt.`), text('같은 carrid가 LH와 AA일 수 없으므로 원본은 0건입니다. 별칭 있는 COUNT와 MAX를 함께 쓴 결과는 0, 0, 0, 1입니다. COUNT 결과 0으로 데이터 부재를 판별합니다.')),
    section('JOIN과 ON·WHERE의 차이', table(['종류', '결과'], [
      ['INNER JOIN', 'ON 조건에 서로 맞는 행만'],
      ['LEFT OUTER JOIN', '왼쪽 행을 유지하고 오른쪽이 없으면 해당 열은 NULL'],
      ['RIGHT OUTER JOIN', '오른쪽 행을 유지. ABAP 7.52 공식 문서에서 지원'],
      ['CROSS JOIN', '양쪽의 모든 조합. 결과가 급격히 커질 수 있음']
    ]), text('필기의 “Right Outer Join 사용 불가”는 모든 ABAP 버전에 적용되지 않습니다. 수업 시스템의 릴리스와 문법 검사로 확인하세요. 같은 의미를 테이블 순서를 바꾼 LEFT OUTER JOIN으로 표현할 수도 있습니다.',
      'AS는 별칭, 별칭~열은 소속 테이블을 명시합니다. ON은 행을 연결하는 조건이고 WHERE는 연결된 결과를 걸러냅니다. LEFT JOIN 오른쪽 열에 대한 WHERE 조건은 NULL 행을 제외해 왼쪽 보존 효과를 잃게 할 수 있습니다.'),
      code('항공사와 독일 출발 노선 연결', `REPORT zabap_f##_##.
SELECT a~carrid, a~carrname, b~connid, b~cityfrom, b~cityto
  FROM scarr AS a
  LEFT OUTER JOIN spfli AS b
    ON a~carrid = b~carrid AND b~countryfr = 'DE'
  ORDER BY a~carrid, b~connid
  INTO TABLE @DATA(gt_routes).
LOOP AT gt_routes INTO DATA(gs_route).
  WRITE: / gs_route-carrid, gs_route-carrname,
           gs_route-connid, gs_route-cityfrom, gs_route-cityto.
ENDLOOP.`), text('독일 출발 노선이 없는 항공사도 남습니다. countryfr 조건을 WHERE b~countryfr = ...로 옮기면 그 행들이 제외됩니다. 한 항공사에 여러 노선이 있으면 항공사 정보가 여러 행에 반복되는 것은 정상입니다.')),
    section('보완: 서브쿼리와 FOR ALL ENTRIES', text(
      'EXISTS는 하위 조회에 맞는 행이 하나라도 있는지 검사합니다. IN ( SELECT ... )는 하위 조회의 값 집합과 비교합니다. JOIN처럼 상대쪽 열을 함께 표시할 필요 없이 존재 여부로 걸러낼 때 유용합니다.'),
      code('노선이 있는 항공사만 조회', `REPORT zabap_f##_##.
SELECT a~carrid, a~carrname FROM scarr AS a
  WHERE EXISTS ( SELECT * FROM spfli AS b
                   WHERE b~carrid = a~carrid )
  ORDER BY a~carrid
  INTO TABLE @DATA(gt_carriers).
LOOP AT gt_carriers INTO DATA(gs_carrier).
  WRITE: / gs_carrier-carrid, gs_carrier-carrname.
ENDLOOP.`), text('FOR ALL ENTRIES는 이미 가진 내부 테이블의 각 행을 조건으로 조회하고 결과의 중복 행을 제거합니다. 기준 테이블이 비어 있으면 WHERE 전체가 무시될 수 있으므로 반드시 비어 있지 않은지 먼저 검사합니다.'),
      code('빈 기준 테이블을 막는 FOR ALL ENTRIES', `REPORT zabap_f##_##.
SELECT carrid, connid FROM spfli
  WHERE countryfr = 'DE'
  INTO TABLE @DATA(gt_keys).

IF gt_keys IS NOT INITIAL.
  SELECT carrid, connid, fldate FROM sflight
    FOR ALL ENTRIES IN @gt_keys
    WHERE carrid = @gt_keys-carrid
      AND connid = @gt_keys-connid
    INTO TABLE @DATA(gt_flights).
  WRITE: / '조회 건수:', lines( gt_flights ).
ELSE.
  WRITE / '조회할 노선이 없습니다.'.
ENDIF.`), text('SELECT 열에 키를 빼면 원래 서로 다른 행이 같은 결과 행으로 합쳐질 수 있습니다. 필요 키를 포함하고 JOIN과 비교하세요. FOR ALL ENTRIES는 집계·정렬 등과 결합할 때 제한이 있으므로 일반 SELECT와 똑같이 조합하면 안 됩니다.')),
    section('INSERT·UPDATE·MODIFY·DELETE', table(['DB 변경 문장', '의미', '확인할 점'], [
      ['INSERT dbtab FROM @wa', '새 행 삽입', '기본 키·고유 인덱스 중복'],
      ['UPDATE dbtab SET ... WHERE ...', '기존 행의 지정 열 변경', '조건과 실제 변경 행 수'],
      ['MODIFY dbtab FROM @wa', '기본 키가 있으면 덮어쓰고 없으면 삽입', '전달한 행의 초기값도 덮어쓸 수 있음'],
      ['DELETE FROM dbtab WHERE ...', '조건에 맞는 행 삭제', 'WHERE 누락·과도한 범위 주의']
    ]), text('이 문장들은 DB 테이블을 대상으로 합니다. [[abap-data-report|내부 테이블]]의 INSERT·MODIFY·DELETE와 문장이 비슷해도 저장 위치와 트랜잭션이 다릅니다. 일부 필드만 바꾸려면 완성되지 않은 작업 영역으로 MODIFY하기보다 UPDATE ... SET으로 의도를 드러내세요.',
      '변경 예제는 별도 Z 연습용 테이블을 정의한 뒤 실습해야 합니다. SCARR·SFLIGHT나 업무 표준 테이블을 실습용으로 직접 변경하지 마세요. 결과 코드는 문장·단일/일괄 처리별로 다르며 DB 오류는 예외로 발생할 수도 있습니다. sy-subrc와 sy-dbcnt를 바로 확인하고 예외 처리도 설계합니다.'),
      table(['문법 형태 — 그대로 실행하는 코드가 아님', '전제'], [
        ['INSERT zcw_scarr_demo FROM @gs_scarr.', 'ZCW_SCARR_DEMO의 키(carrid 등)와 모든 필수 값이 준비된 작업 영역'],
        ['UPDATE zcw_scarr_demo SET carrname = @gv_carrname WHERE carrid = @gv_carrid.', '정확한 키 조건과 입력 검증'],
        ['MODIFY zcw_scarr_demo FROM @gs_scarr.', '초기값까지 포함한 행 전체를 저장하려는 경우'],
        ['DELETE FROM zcw_scarr_demo WHERE carrid = @gv_carrid.', '삭제 권한·대상 확인·복구 계획']
      ])),
    section('보완: 트랜잭션과 안전한 변경', text(
      'COMMIT WORK는 현재 작업 단위의 변경을 확정하고, ROLLBACK WORK는 현재 DB LUW의 미확정 변경을 되돌립니다. 이미 커밋한 변경까지 되돌리는 기능은 아닙니다. 화면 전환·RFC 등에서 암묵적인 커밋이 생길 수 있어 “COMMIT을 안 썼으니 영구 저장되지 않는다”라고 가정하면 안 됩니다.',
      '삭제 전 백업은 복구 수단 중 하나입니다. 먼저 대상·건수를 읽어 확인하고, 권한 검사와 필요한 SAP 잠금, 좁은 키 조건, 오류 처리, 트랜잭션 경계를 함께 설계하세요. 확인 조회와 변경 사이에 다른 사용자가 수정할 수도 있습니다.',
      '한 업무가 끝나는 위치에서 커밋하도록 설계합니다. SELECT ... ENDSELECT 안에서 COMMIT·ROLLBACK을 실행하면 커서가 닫혀 오류가 날 수 있습니다. BAPI·RAP 등은 해당 API/프레임워크의 트랜잭션 규칙을 따릅니다.')),
    section('보완: 성능과 다음 문법', table(['점검', '실천'], [
      ['가져올 데이터', '필요한 열과 WHERE 조건을 지정. 화면용 목록은 건수 제한·페이지 처리 고려'],
      ['반복 DB 호출', 'LOOP 안의 반복 SELECT를 JOIN·집합 조회로 줄일 수 있는지 확인'],
      ['키와 인덱스', '키 조건은 유리할 수 있지만 자동으로 빠르지는 않음. 조건의 선택도·인덱스·실행 계획에 따라 판단'],
      ['정렬', '결과 순서가 필요하면 ORDER BY. 내부 테이블 순서는 SORT와 구분'],
      ['측정', 'ST05 SQL Trace 등으로 호출 횟수·실행 시간 확인. JOIN이 항상 최선이라고 단정하지 않음'],
      ['입력과 권한', '값은 @변수로 전달. 동적 테이블/열/WHERE 문자열은 별도 검증. Open SQL 자체가 업무 권한을 자동 보장하지 않음']
    ]), text('추가 문법은 필요할 때 확장하세요. CASE·COALESCE는 SQL 안의 조건/NULL 처리, UNION·UNION ALL은 조회 결과 결합, WITH는 공통 테이블 식, OFFSET은 정렬된 결과의 앞부분 건너뛰기에 사용됩니다. UNION은 중복 제거, UNION ALL은 중복 유지입니다. 필드 수와 타입 호환성도 맞춰야 합니다.',
      '이들 문법과 최신 SQL 함수·내부 테이블을 FROM에 사용하는 기능은 릴리스별 지원 범위가 다릅니다. 이 페이지의 기본 예제와 구분해 대상 시스템의 키워드 문서를 확인하세요.')),
    section('최신 문법(Strict Mode)과 쉼표·@ 규칙', text(
      'Open SQL에서 INTO 절을 SELECT 문의 마지막에 작성하거나, SELECT 절에 일반 컬럼과 집계 함수를 함께 쓰는 등 최신 문법 요소가 들어가면 컴파일러가 최신 문법(Strict Mode)으로 간주합니다.',
      '최신 문법으로 판정되면 SELECT 컬럼 목록에 쉼표(,)를 붙여 구분하고 ABAP 호스트 변수 앞에도 모두 @를 붙여야 합니다. 한 SELECT 문 안에서 구문법과 최신 문법을 섞어 쓰면 문법 오류가 발생합니다.'),
      table(['최신 문법으로 간주되는 예', '함께 지켜야 하는 규칙'], [
        ['INTO ~ 절을 SELECT 문 마지막에 작성', 'SELECT 컬럼 목록을 쉼표(,)로 구분'],
        ['SELECT 절에 일반 컬럼 + 집계 함수 함께 작성', 'ABAP 호스트 변수 앞에 모두 @ 붙이기 (@p_carr, @so_carr, @DATA(...))']
      ]))
  ], '11/19 · 11/20', [
    ['SAP ABAP 7.52 · SELECT', 'https://help.sap.com/doc/abapdocu_752_index_htm/7.52/en-US/abapselect.htm'],
    ['SAP ABAP 7.52 · INTO와 APPENDING', 'https://help.sap.com/doc/abapdocu_752_index_htm/7.52/en-US/abapinto_clause.htm'],
    ['SAP ABAP 7.52 · 정렬된 첫 행과 건수 제한', 'https://help.sap.com/doc/abapdocu_752_index_htm/7.52/en-US/abapselect_up_to_offset.htm'],
    ['SAP ABAP · 집계 결과와 COUNT 예외', 'https://help.sap.com/docs/abap-cloud/abap-keywords/select-col-spec'],
    ['SAP ABAP 7.52 · JOIN', 'https://help.sap.com/doc/abapdocu_752_index_htm/7.52/en-US/abapselect_join.htm'],
    ['SAP ABAP 7.52 · FOR ALL ENTRIES', 'https://help.sap.com/doc/abapdocu_752_index_htm/7.52/en-US/abenwhere_logexp_itab.htm'],
    ['SAP ABAP 7.52 · MODIFY', 'https://help.sap.com/doc/abapdocu_752_index_htm/7.52/en-US/abapmodify_dbtab.htm'],
    ['SAP Help · 트랜잭션과 LUW', 'https://help.sap.com/docs/abap-cloud/abap-concepts/luws-in-abap']
  ]);

  // Remove the setup stub and repair every existing reference, including home and roadmap.
  delete docs['erp-setup'];
  for (const [id, doc] of Object.entries(docs)) {
    docs[id] = JSON.parse(JSON.stringify(doc).replaceAll('[[erp-setup|실습 준비]]', '[[sap-architecture|SAP 시스템 구조]]').replaceAll('[[erp-setup|', '[[sap-architecture|'));
  }
  const order = ['sap-architecture', 'abap-development', 'abap-basics', 'abap-types', 'abap-loops', 'abap-debug-messages', 'abap-program-types', 'abap-modularization', 'abap-bapi', 'abap-objects', 'abap-data-report', 'abap-open-sql', 'abap-dictionary', 'erp-fi', 'erp-co', 'erp-mm', 'erp-sd', 'erp-pp', 'erp-resources'];
  order.forEach((id, i) => { docs[id].stepNum = String(i + 1).padStart(2, '0'); });
  const connections = {
    'sap-architecture': ['sap-tcode-reference', 'abap-development'],
    'abap-development': ['abap-program-types', 'sap-gui-shortcuts', 'sap-tcode-reference'],
    'abap-basics': ['abap-types', 'abap-loops', 'abap-useful-syntax'],
    'abap-types': ['abap-basics', 'abap-data-report', 'abap-dictionary', 'abap-useful-syntax'],
    'abap-loops': ['abap-debug-messages', 'abap-data-report'],
    'abap-debug-messages': ['abap-loops', 'abap-bapi', 'sap-tcode-reference'],
    'abap-modularization': ['abap-objects', 'abap-bapi', 'abap-types'],
    'abap-bapi': ['abap-modularization', 'abap-debug-messages'],
    'abap-objects': ['abap-modularization', 'abap-program-types'],
    'abap-program-types': ['abap-development', 'abap-modularization'],
    'abap-data-report': ['abap-types', 'abap-loops', 'abap-dictionary', 'abap-open-sql'],
    'abap-open-sql': ['abap-data-report', 'abap-dictionary', 'abap-loops']
  };
  for (const [id, targets] of Object.entries(connections)) docs[id].sections.push(related(targets));
  // Move broad aliases to their dedicated topic pages.
  const owners = { 'SAP GUI': 'sap-architecture', '자료형': 'abap-types', 'Include 프로그램': 'abap-program-types', '리포트 프로그램': 'abap-program-types', 'Open SQL': 'abap-open-sql' };
  for (const doc of Object.values(docs)) doc.aliases = (doc.aliases || []).filter(alias => !owners[alias] || owners[alias] === doc.id);
  docs['learning-roadmap'].subtitle = '수업 필기 기반 ABAP 학습 순서';
  docs['learning-roadmap'].summary = '11월 11~20일 필기를 주제별로 정리했습니다. 본문이 채워진 문서부터 읽고, 이후 과정은 준비된 목차로 확인하세요.';
  docs['learning-roadmap'].sections[0].blocks[0].rows = order.map(id => [docs[id].stepNum, `[[${id}|${docs[id].title}]]`, connections[id] ? '필기 정리 · 예제' : '목차 준비 · 본문 예정']);
  docs['welcome-abap'].topWidgetId = 'knowledge-map-entry';
  docs['welcome-abap'].sections[0].blocks = [text('[[learning-roadmap|전체 학습 목차]]에서 주제별 내용을 확인하세요. 수업 필기에서 다루지 않은 ERP 모듈은 목차로 남겨 두었습니다.'), table(['분야', '문서'], [
    ['시스템과 개발', '[[sap-architecture|SAP 시스템 구조]] · [[abap-development|개발 객체와 전송 관리]] · [[abap-program-types|Program 종류]]'],
    ['ABAP 기본기', '[[abap-basics|ABAP 기초]] · [[abap-types|자료형과 초기값]] · [[abap-loops|반복문과 시스템 필드]] · [[abap-debug-messages|디버깅과 메시지]]'],
    ['모듈화', '[[abap-modularization|프로그램 모듈화]] · [[abap-bapi|BAPI와 RFC]] · [[abap-objects|클래스와 메서드]]'],
    ['데이터 처리', '[[abap-types|구조체와 자료형]] · [[abap-data-report|내부 테이블 · Report]] · [[abap-open-sql|Open SQL]]'],
    ['이후 학습', '[[abap-dictionary|데이터 사전]] · [[learning-roadmap|ERP 모듈 목차]]']
  ])];
  const sortedIds = ['welcome-abap', 'learning-roadmap', ...order];
  const sorted = Object.fromEntries([...sortedIds, ...Object.keys(docs).filter(id => !sortedIds.includes(id))].map(id => [id, docs[id]]));
  window.WIKI_DOCS = sorted;
})();
