/** Expected results are explanatory; none of these examples has been run in SAP here. */
(() => {
  const sqlRequirements = 'Standard ABAP 7.52 기준입니다. SCARR·SPFLI·SFLIGHT·SBOOK·SCUSTOM 교육용 테이블이 있는 시스템에서 실행하세요. 실제 출력은 현재 클라이언트의 데이터에 따라 달라집니다.';
  const classicSqlRequirements = 'Classic Open SQL 기준입니다. SCARR·SPFLI·SFLIGHT·SBOOK·SCUSTOM 교육용 테이블이 있는 Standard ABAP 시스템에서 실행하세요. 실제 출력은 현재 클라이언트의 데이터에 따라 달라집니다.';
  const sqlExample = (input, expected) => ({input, expected, requirements:sqlRequirements});
  const classicSqlExample = (input, expected) => ({input, expected, requirements:classicSqlRequirements});
  const notes = {
    'Open SQL 기본 조회': classicSqlExample('p_carr = LH', 'LH가 있으면 항공사 코드·이름·통화가 출력되고, 없으면 조회 결과가 없습니다가 출력됩니다.'),
    '항공사 이름과 가장 빠른 운항일': classicSqlExample('p_carr = LH', '항공사 이름과 해당 항공사의 가장 이른 운항일 한 건을 출력합니다. 같은 날짜라면 노선 번호가 작은 행을 선택합니다. 데이터가 없는 조회 부분은 출력되지 않습니다.'),
    '이름 기준으로 Work Area와 테이블에 받기': classicSqlExample('SCARR의 LH 행', '대상 필드 순서가 달라도 이름으로 매핑됩니다. LH가 있으면 코드·이름과 행 수 1, 없으면 행 수 0이 출력됩니다.'),
    '조회 결과를 이어 담기': classicSqlExample('SCARR의 LH·AA 행', '두 항공사가 모두 있으면 합친 행 수 2, 다시 채운 행 수 1입니다. 없는 항공사는 추가되지 않습니다.'),
    '선택 범위와 문자열 조건': classicSqlExample('s_carr에 항공사 범위 입력 또는 비워 두기', '선택한 코드 범위 안에서 이름이 L 또는 A로 시작하는 항공사만 코드순으로 출력됩니다. 범위를 비우면 코드 제한 없이 이름 조건을 적용합니다.'),
    '항공사별 좌석 집계': classicSqlExample('SFLIGHT에 저장된 데이터', '총 좌석 수가 양수인 운항을 대상으로 항공사별 건수와 점유 좌석 통계를 출력합니다. 조건을 만족하는 운항이 2건 미만인 항공사는 제외됩니다.'),
    '집계 결과와 실제 원본 건수 비교': classicSqlExample('carrid가 LH이면서 AA인 불가능한 조건', '원본 0건에도 집계 결과 한 행이 생겨 0, 0, 0, 1이 출력됩니다. 순서는 matched, max_occupied, sy-subrc, sy-dbcnt입니다.'),
    '항공사와 독일 출발 노선 연결': classicSqlExample('SCARR·SPFLI의 현재 데이터', '항공사별 독일 출발 노선을 출력합니다. 해당 노선이 없는 항공사도 표시되며 오른쪽 열은 ABAP 초기값으로 보입니다.'),
    '노선이 있는 항공사만 조회': classicSqlExample('SCARR·SPFLI의 현재 데이터', 'SPFLI에 노선이 하나 이상 있는 항공사를 한 행씩 코드순으로 출력합니다.'),
    '빈 기준 테이블을 막는 FOR ALL ENTRIES': classicSqlExample('독일 출발 노선과 운항 데이터', '해당 노선의 운항 건수를 출력합니다. 기준 노선이 없으면 두 번째 조회를 실행하지 않고 조회할 노선이 없습니다를 출력합니다.'),
    '[신문법] 단건 조회: SELECT SINGLE과 UP TO 1 ROWS 비교': sqlExample('p_carr = LH', 'SCARR에서 LH 항공사 기본 정보를 1건 출력하고, SFLIGHT에서 최저 운임·가장 이른 운항일 1건을 출력합니다.'),
    '[신문법] 다건 조회: INTO TABLE과 CORRESPONDING FIELDS OF TABLE': sqlExample('SPFLI의 DE·US·LH 노선 데이터', '독일 출발 노선 수, 미국 출발 노선을 이어 담은 합산 노선 수, LH 노선의 비행시간 내림차순 목록이 순서대로 출력됩니다.'),
    '[신문법] SCUSTOM 조건 조회: SELECT-OPTIONS·LIKE·BETWEEN': sqlExample('so_id 비움 또는 고객 ID 범위, p_cntry = DE', '독일 고객 중 이름이 A 또는 S로 시작하고 할인율이 000~020 사이인 고객을 최대 20건 출력합니다.'),
    '[신문법] SBOOK 예약 집계: GROUP BY와 HAVING': sqlExample('p_year = 2026 (취소되지 않은 SBOOK 예약)', '해당 연도에 5건 이상 예약이 있는 항공사·통화 조합별 예약 건수, 총액, 최초/최종 예약일을 출력합니다.'),
    '[신문법] SCARR·SPFLI·SFLIGHT 다중 LEFT OUTER JOIN': sqlExample('SCARR·SPFLI·SFLIGHT의 현재 데이터', '모든 항공사를 유지하면서 독일 출발 노선과 운항일·점유 좌석을 최대 30건 출력합니다. 독일 노선이 없는 항공사는 오른쪽 열이 초기값으로 보입니다.'),
    '[신문법] SCUSTOM·SBOOK: FOR ALL ENTRIES 안전 패턴과 EXISTS': sqlExample('SCUSTOM·SBOOK의 독일 고객과 취소되지 않은 예약', '예약 이력이 있는 독일 고객 최대 20명을 먼저 조회한 뒤, 중복 키를 제거한 기준 테이블로 해당 고객들의 예약 상세 총 건수를 출력합니다.'),
    '[신문법] SFLIGHT SQL 표현식: CASE·산술식·COALESCE': sqlExample('p_carr = LH', 'LH 운항편의 잔여 좌석(seatsmax - seatsocc), 좌석 상태(만석/마감임박/여유), 도착 도시(미등록 시 기본값)를 최신 운항일순으로 최대 20건 출력합니다.'),
    '[구문법] 단건 조회: SELECT SINGLE과 UP TO 1 ROWS 비교': classicSqlExample('p_carr = LH', '구문법(공백 구분·@ 미사용)으로 SCARR에서 LH 항공사 1건과 SFLIGHT 최저 운임·가장 이른 운항일 1건을 출력합니다.'),
    '[구문법] 다건 조회: INTO TABLE과 CORRESPONDING FIELDS OF TABLE': classicSqlExample('SPFLI의 DE·US·LH 노선 데이터', '구문법 사전 선언 테이블과 DESCRIBE TABLE로 독일 출발 노선 수, 합산 노선 수, LH 비행시간 내림차순 목록을 출력합니다.'),
    '[구문법] SCUSTOM 조건 조회: SELECT-OPTIONS·LIKE·BETWEEN': classicSqlExample('so_id 비움 또는 고객 ID 범위, p_cntry = DE', '구문법 WHERE(id IN so_id, @ 미사용)로 독일 고객 중 이름이 A 또는 S로 시작하고 할인율이 000~020 사이인 고객을 최대 20건 출력합니다.'),
    '[구문법] SBOOK 예약 집계: GROUP BY와 HAVING': classicSqlExample('p_year = 2026 (취소되지 않은 SBOOK 예약)', '구문법 공백 구분 GROUP BY와 사전 선언 Structure로 5건 이상 예약이 있는 항공사·통화 조합별 통계를 출력합니다.'),
    '[구문법] SCARR·SPFLI·SFLIGHT 다중 LEFT OUTER JOIN': classicSqlExample('SCARR·SPFLI·SFLIGHT의 현재 데이터', '구문법 공백 구분 다중 LEFT OUTER JOIN으로 모든 항공사와 독일 출발 노선·운항일·점유 좌석을 최대 30건 출력합니다.'),
    '[구문법] SCUSTOM·SBOOK: FOR ALL ENTRIES 안전 패턴과 EXISTS': classicSqlExample('SCUSTOM·SBOOK의 독일 고객과 취소되지 않은 예약', '구문법 EXISTS와 @ 없는 FOR ALL ENTRIES IN lt_keys로 예약 이력이 있는 독일 고객 수와 예약 상세 총 건수를 출력합니다.'),
    '[구문법] SFLIGHT 가공: Classic SELECT 후 LOOP 계산·분기': classicSqlExample('p_carr = LH', '구문법 SELECT로 원본 컬럼을 먼저 읽은 뒤 ABAP LOOP에서 잔여 좌석·좌석 상태(만석/마감임박/여유)·도착 도시 기본값(미등록)을 계산해 최대 20건 출력합니다.'),
    'Local Class의 Static Method': {input:'iv_number = 5', expected:'10이 출력됩니다.'},
    'Structure Type과 Structure Variable': {input:'carrid = LH, carrname = Lufthansa', expected:'LH Lufthansa / Lufthansa가 출력됩니다.', requirements:'SCARR 교육용 테이블이 있는 시스템에서 실행하세요.'},
    '같은 이름의 필드만 복사': {input:'원본 gs_spfli(LH / 0400 / FRANKFURT), 대상 gs_flight-seatsocc = 320', expected:'LH 0400 320이 출력됩니다. seatsocc는 원본에 같은 이름의 필드가 없어 유지되고, cityfrom은 대상에 없어 복사되지 않습니다.', requirements:'SPFLI·SFLIGHT 교육용 테이블이 있는 시스템에서 실행하세요.'},
    '비교 예제의 Local Type 선언': {input:'별도 입력 없음', expected:'로컬 structure ts_flight와 로컬 table type tt_flights가 정의됩니다. 타입만 정의하므로 데이터 변수나 테이블 행은 생성되지 않으며 출력문도 없습니다.', placement:'REPORT 선언 아래, 이어지는 표의 DATA 선언보다 먼저 넣으세요.', requirements:'BC400_S_FLIGHT와 S_CARR_ID·S_CONN_ID·S_DATE·S_SEATSMAX·S_SEATSOCC Data Element가 있는 수업 실습 시스템 기준입니다.'},
    '행 타입과 세 가지 테이블 선언': {input:'별도 입력 없음', expected:'SPFLI 필드 기반의 빈 Internal Table 3개와 초기값의 Work Area gs_spfli가 선언됩니다. 출력문은 없습니다.', requirements:'SPFLI 교육용 테이블이 있는 시스템에서 실행하세요.'},
    'Internal Table 조작 전체 예제': {input:'LH 0400 (FRANKFURT, 545분) / AA 0017 (NEW YORK, 361분)', expected:'LH 0400 FRANKFURT 560만 출력됩니다. LH 0400의 비행시간(fltime)을 수정하고 AA 0017을 삭제한 결과입니다.', requirements:'SPFLI 교육용 테이블이 있는 시스템에서 실행하세요.'},
    '비행시간 내림차순·항공사 오름차순': {input:'gt_spfli에 비행시간(fltime)과 항공사 코드(carrid)가 있는 여러 행', expected:'비행시간 내림차순, 동점이면 항공사 코드 오름차순으로 행 순서가 바뀝니다. 출력문은 없습니다.', requirements:'Internal Table 조작 전체 예제의 gt_spfli 선언과 데이터 추가 뒤에 넣고 디버거에서 확인하세요.'},
    'Header Line과 테이블 본문 구분': {input:'Header Line에 SCARR 행(LH / Lufthansa)을 담아 한 행 추가', expected:'1, 0이 순서대로 출력됩니다. 첫 CLEAR는 Header Line만, 두 번째 CLEAR는 본문을 비웁니다.', requirements:'SCARR 교육용 테이블이 있고 Header Line을 허용하는 클래식 실행 가능 Report에서 기존 문법 학습용으로만 사용하세요. Class 내부나 ABAP Cloud용 예제가 아닙니다.'},
    'SELECT-OPTIONS와 cl_demo_output 출력': classicSqlExample('so_carr에 항공사 범위 입력 또는 비워 두기', '선택 조건에 맞는 SPFLI 노선 목록이 cl_demo_output 화면에 표 형태로 출력됩니다. 조건을 비워 두면 전체 노선이 출력됩니다.'),
    'Classic ABAP Report 이벤트 흐름': classicSqlExample('Selection Screen 초기값 LH 그대로 실행하거나 다른 항공사 범위 입력', '초기 화면에 LH가 미리 채워지며, 조건을 모두 비우고 실행하면 오류 메시지가 표시됩니다. 유효한 조건으로 실행하면 SPFLI 노선 목록이 cl_demo_output으로 출력됩니다.'),
    '고객별 예약 건수 조회 Report 사고 흐름 전체 예제': {input:'so_id에 고객 ID 범위 입력(또는 비워 두기), so_date에 예약일 범위 입력(초기값: 올해 1월 1일~오늘)', expected:'so_date를 비우고 실행하면 AT SELECTION-SCREEN에서 오류 메시지가 표시됩니다. 유효한 기간으로 실행하면 SCUSTOM 고객 목록에 기간 내 SBOOK 예약 건수(bookcnt)와 등급(10건 초과 P, 5~10건 G, 4건 이하 S)이 합쳐져 cl_demo_output 표로 출력됩니다.', requirements:'Classic Open SQL 기준입니다. SCUSTOM·SBOOK 교육용 테이블이 있는 Standard ABAP 시스템에서 실행하세요. 실제 출력은 현재 클라이언트의 데이터와 예약일 범위에 따라 달라집니다.'},
    'Data Element를 참조한 PARAMETERS와 변수 선언': {input:'p_carr = LH, p_conn = 0400 (또는 F4 Search Help로 선택)', expected:'Selection Screen에서 S_CARR_ID·S_CONN_ID의 Field Label과 F4 도움말을 확인할 수 있으며, 실행 시 일치하는 노선의 출발 도시 -> 도착 도시(예: LH 0400 FRANKFURT -> NEW YORK)가 출력됩니다.', requirements:'Classic Open SQL 기준입니다. SPFLI 테이블과 S_CARR_ID·S_CONN_ID Data Element가 있는 시스템에서 실행하세요.'},
    'Nested Structure와 INCLUDE TYPE 접근 비교': {input:'carrid = LH, connid = 0400, cityfrom = FRANKFURT, cityto = NEW YORK', expected:'Nested : LH FRANKFURT NEW YORK / Include : LH FRANKFURT NEW YORK 두 줄이 출력됩니다. Nested structure는 route를 한 번 더 거쳐 접근하고, INCLUDE TYPE은 바로 하위 필드명으로 접근합니다.', requirements:'SPFLI·SFLIGHT 교육용 테이블이 있는 시스템에서 실행하세요.'},
    'Deep Structure와 전역 Table Type 활용': {input:'SCARR·SPFLI의 LH 항공사 데이터', expected:'LH 항공사의 코드·이름과 SPFLI에서 조회되어 gs_carrier-routes Internal Table 컴포넌트에 담긴 보유 노선 수가 출력됩니다.', requirements:'Classic Open SQL 기준입니다. SCARR·SPFLI 교육용 테이블이 있는 시스템에서 실행하세요. 실제 출력은 현재 클라이언트의 데이터에 따라 달라집니다.'},
    'Table Buffer 조회와 BYPASSING BUFFER': {input:'SCARR 테이블의 LH 항공사 행', expected:'버퍼/표준 조회와 DB 직접 조회(BYPASSING BUFFER) 모두 LH와 항공사 이름(Lufthansa)을 출력합니다. Table Buffer가 활성화된 환경에서는 첫 조회가 Application Server 버퍼를 활용하고, 두 번째 조회는 버퍼를 우회해 DB에서 직접 읽습니다.', requirements:'Classic Open SQL 기준입니다. SCARR 교육용 테이블이 있는 시스템에서 실행하세요.'},
    'Text Table(T005T)과 sy-langu로 언어별 국가명 조회': {input:'p_carr = LH (현재 로그온 언어 sy-langu 기준)', expected:'LH 항공사의 각 노선과 출발 국가 코드(countryfr)에 대응하는 표준 Text Table(T005T)의 현재 로그온 언어별 국가명(landx), 출발/도착 도시가 출력됩니다.', requirements:'Classic Open SQL 기준입니다. SPFLI 교육용 테이블과 표준 국가 Text Table(T005T)이 있는 시스템에서 실행하세요.'},
    'MATCHCODE OBJECT와 AS LISTBOX로 Search Help 적용': {input:'p_carr에서 F4 Search Help(h_scarr)로 LH 선택, 또는 p_carrlb 드롭다운 리스트박스에서 항공사 선택', expected:'Selection Screen에서 p_carr은 h_scarr F4 도움말로, p_carrlb는 길이 20의 드롭다운 리스트박스로 표시됩니다. 실행 시 선택한 항공사의 코드·이름·통화(예: LH Lufthansa EUR)가 출력됩니다.', requirements:'Classic Open SQL 기준입니다. SCARR 교육용 테이블, S_CARR_ID Data Element, 표준 Search Help H_SCARR가 있는 시스템에서 실행하세요. 직접 만든 Z/Y Search Help가 있다면 h_scarr 대신 해당 이름을 넣으세요.'},
    '사내 강사님 공식 답안 (ZPROG_CL5_T14_005)': {input:'초기값(pa_car = LH, pa_con = 0400, so_date = 2026.05.31 ~ 2027.06.19) 그대로 실행 또는 빈 값·연도 초과·미존재 항공사(ZZ) 테스트', expected:'입력 누락 시 gv_subrc=1(e000), 연도 ±1년 초과 시 gv_subrc=2(e001), 데이터 없음 시 gv_subrc=3(e001) 오류 메시지가 Selection Screen에 표시됩니다. 유효 조건 실행 시 SFLIGHT·SCARR INNER JOIN 결과에 SEATS_REMAIN과 STATUS(매진임박/보통/여유)가 계산되어 cl_demo_output 표로 출력됩니다.', requirements:'SE11에서 Global Structure(zbs_flight_t_14 → 본인 ZBS_FLIGHT_?_##, PRICE Currency Reference = CURRENCY 포함)와 SE91에서 Message Class(zmc_t14 → 본인 ZBASIC_MSG_?_##, 000번 및 & 자리표시자 001번)를 먼저 생성·저장한 뒤 실행하세요.'},
    'TYPE · LIKE · VALUE · CLEAR': {input:'별도 입력 없음', expected:'0, 17, 20이 각각 한 줄씩 출력됩니다.'},
    'Selection Screen에서 숫자 입력받기': {input:'p_count = 3', expected:'입력: 3 / 두 배: 6'},
    '문자와 숫자의 초기값': {input:'코드의 초기값 그대로', expected:'정수 초기값은 0 / 0000이 출력됩니다. lv_text는 공백 5자리로 초기화됩니다.'},
    'Text Symbol 사용': {input:'Text Symbol 001 = 환영합니다, 002 = 안녕하세요', expected:'환영합니다 / 안녕하세요', requirements:'편집기의 Text Element에서 001과 002를 만들고 활성화하세요. 로그온 언어의 번역에 따라 문구가 달라집니다.'},
    '짝수는 건너뛰고 7에서 종료': {input:'별도 입력 없음', expected:'1, 3, 5가 각각 한 줄씩 출력됩니다.'},
    '직접 문구': {input:'별도 입력 없음', expected:'입력값을 확인하세요라는 정보 메시지가 표시됩니다.'},
    'Message Class 예시 — ZCW와 001을 먼저 생성': {input:'로그온 사용자 이름(sy-uname)', expected:'안녕하세요 & 문구의 & 자리에 로그온 사용자 이름이 들어갑니다.', requirements:'SE91에서 Message Class ZCW와 001번 문구 «안녕하세요 &»를 먼저 생성·저장하세요.'},
    'REPORT 선언부 MESSAGE-ID로 Message Class 연결': {input:'p_carr 비우고 실행(오류 확인) 또는 LH 입력 후 실행', expected:'p_carr을 비우고 실행하면 AT SELECTION-SCREEN에서 zcw 000번 오류 메시지가 표시되어 Selection Screen에 머뭅니다. 값을 입력하고 실행하면 zcw 001번 문구의 & 자리에 sy-uname이 들어가 표시됩니다.', requirements:'SE91에서 Message Class ZCW를 생성하고 000번(예: 입력값을 입력해주세요.)과 001번(예: 안녕하세요 &) 문구를 저장한 뒤 실행하세요.'},
    '입력은 복사하고 결과는 반영': {input:'PERFORM의 입력값 3', expected:'6이 출력됩니다.'},
    'Local Class의 Instance Method': {input:'별도 입력 없음', expected:'Hello ABAP이 출력됩니다.'},
    '길이 비교': {input:'lv_text = ABAP', expected:'lv_length = 4, lv_first = 1. WRITE가 없으므로 디버거에서 확인하세요.'},
    '연결과 구분자': {input:'코드에 지정된 문자열', expected:'lv_result가 차례로 Hello ABAP → SAP ABAP → 2026-11-17이 됩니다. 각 대입 직후 디버거에서 확인하세요.'},
    '시스템 날짜에서 연·월·일 추출': {input:'예: 시스템 날짜가 20261117인 날', expected:'lv_year = 2026, lv_month = 11, lv_day = 17. 실제 값은 실행한 시스템 날짜에 따릅니다.'},
    '계산 결과 저장': {input:'-7, 밑 2와 지수 3', expected:'lv_absolute = 7, lv_power = 8. WRITE가 없으므로 디버거에서 확인하세요.', requirements:'ipow 함수를 지원하는 Standard ABAP 환경에서 실행하세요.'},
    '초기값과 범위 검사': {input:'lv_count 초기값 0, 이후 5 대입', expected:'초기값 0입니다 / 1부터 10 사이입니다 / 3이 아닙니다가 순서대로 출력됩니다.'},
    '문자 집합과 부분 문자열 구분': {input:'lv_text = cat', expected:'a, b, c 중 하나 이상 포함만 출력됩니다. CS 조건은 거짓입니다.'},
    '3을 건너뛰고 출력': {input:'별도 입력 없음', expected:'1, 2, 4, 5가 각각 한 줄씩 출력됩니다.'},
    '오류 메시지': {input:'Selection Screen에서 잘못된 값을 입력한 경우', expected:'입력 내용을 확인해 주세요. 메시지가 표시되며 Selection Screen에서 값을 수정하게 됩니다.', requirements:'실행 가능 Report의 AT SELECTION-SCREEN 이벤트에서 입력값 검증 IF문 안에 넣으세요. E 메시지는 실행 위치에 따라 동작이 달라집니다.'}
  };
  for (const doc of Object.values(window.WIKI_DOCS)) {
    if (doc.track !== 'abap') continue;
    for (const section of doc.sections || []) for (const block of section.blocks || []) {
      if (block.type !== 'code') continue;
      const full = /^\s*REPORT\s/im.test(block.code || '');
      block.example = {kind:full ? 'SE38 Report 전체 코드' : 'Report에 넣는 일부 코드',
        placement:full ? 'SE38에서 실행 가능 Program을 만들고 REPORT 이름(zabap_f##_##)을 본인 Program 이름에 맞춘 뒤 활성화·실행하세요.' : 'REPORT 선언이 있는 실행 가능 Program의 실행부에 넣으세요. 아래 추가 조건이 있으면 그 위치를 우선합니다.',
        verification:'SAP 실행 미확인', ...notes[block.label]};
    }
  }
})();
