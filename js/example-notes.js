/** Expected results are explanatory; none of these examples has been run in SAP here. */
(() => {
  const sqlRequirements = 'Standard ABAP 7.52 기준입니다. SCARR·SPFLI·SFLIGHT 교육용 테이블이 있는 시스템에서 실행하세요. 실제 출력은 현재 클라이언트의 데이터에 따라 달라집니다.';
  const sqlExample = (input, expected) => ({input, expected, requirements:sqlRequirements});
  const notes = {
    'Open SQL 기본 조회': sqlExample('p_carr = LH', 'LH가 있으면 항공사 코드·이름·통화가 출력되고, 없으면 조회 결과가 없습니다가 출력됩니다.'),
    '항공사 이름과 가장 빠른 운항일': sqlExample('p_carr = LH', '항공사 이름과 해당 항공사의 가장 이른 운항일 한 건을 출력합니다. 같은 날짜라면 노선 번호가 작은 행을 선택합니다. 데이터가 없는 조회 부분은 출력되지 않습니다.'),
    '이름 기준으로 작업 영역과 테이블에 받기': sqlExample('SCARR의 LH 행', '대상 필드 순서가 달라도 이름으로 매핑됩니다. LH가 있으면 코드·이름과 행 수 1, 없으면 행 수 0이 출력됩니다.'),
    '조회 결과를 이어 담기': sqlExample('SCARR의 LH·AA 행', '두 항공사가 모두 있으면 합친 행 수 2, 다시 채운 행 수 1입니다. 없는 항공사는 추가되지 않습니다.'),
    '선택 범위와 문자열 조건': sqlExample('s_carr에 항공사 범위 입력 또는 비워 두기', '선택한 코드 범위 안에서 이름이 L 또는 A로 시작하는 항공사만 코드순으로 출력됩니다. 범위를 비우면 코드 제한 없이 이름 조건을 적용합니다.'),
    '항공사별 좌석 집계': sqlExample('SFLIGHT에 저장된 데이터', '총 좌석 수가 양수인 운항을 대상으로 항공사별 건수와 점유 좌석 통계를 출력합니다. 조건을 만족하는 운항이 2건 미만인 항공사는 제외됩니다.'),
    '집계 결과와 실제 원본 건수 비교': sqlExample('carrid가 LH이면서 AA인 불가능한 조건', '원본 0건에도 집계 결과 한 행이 생겨 0, 0, 0, 1이 출력됩니다. 순서는 matched, max_occupied, sy-subrc, sy-dbcnt입니다.'),
    '항공사와 독일 출발 노선 연결': sqlExample('SCARR·SPFLI의 현재 데이터', '항공사별 독일 출발 노선을 출력합니다. 해당 노선이 없는 항공사도 표시되며 오른쪽 열은 ABAP 초기값으로 보입니다.'),
    '노선이 있는 항공사만 조회': sqlExample('SCARR·SPFLI의 현재 데이터', 'SPFLI에 노선이 하나 이상 있는 항공사를 한 행씩 코드순으로 출력합니다.'),
    '빈 기준 테이블을 막는 FOR ALL ENTRIES': sqlExample('독일 출발 노선과 운항 데이터', '해당 노선의 운항 건수를 출력합니다. 기준 노선이 없으면 두 번째 조회를 실행하지 않고 조회할 노선이 없습니다를 출력합니다.'),
    '로컬 클래스의 정적 메서드': {input:'iv_number = 5', expected:'10이 출력됩니다.'},
    '구조 타입과 구조 변수': {input:'carrid = LH, carrname = Lufthansa', expected:'LH Lufthansa / Lufthansa가 출력됩니다.', requirements:'SCARR 교육용 테이블이 있는 시스템에서 실행하세요.'},
    '같은 이름의 필드만 복사': {input:'원본 gs_spfli(LH / 0400 / FRANKFURT), 대상 gs_flight-seatsocc = 320', expected:'LH 0400 320이 출력됩니다. seatsocc는 원본에 같은 이름의 필드가 없어 유지되고, cityfrom은 대상에 없어 복사되지 않습니다.', requirements:'SPFLI·SFLIGHT 교육용 테이블이 있는 시스템에서 실행하세요.'},
    '행 타입과 세 가지 테이블 선언': {input:'별도 입력 없음', expected:'SPFLI 필드 기반의 빈 내부 테이블 3개와 초기값의 작업 영역 gs_spfli가 선언됩니다. 출력문은 없습니다.', requirements:'SPFLI 교육용 테이블이 있는 시스템에서 실행하세요.'},
    '내부 테이블 조작 전체 예제': {input:'LH 0400 (FRANKFURT, 545분) / AA 0017 (NEW YORK, 361분)', expected:'LH 0400 FRANKFURT 560만 출력됩니다. LH 0400의 비행시간(fltime)을 수정하고 AA 0017을 삭제한 결과입니다.', requirements:'SPFLI 교육용 테이블이 있는 시스템에서 실행하세요.'},
    '비행시간 내림차순·항공사 오름차순': {input:'gt_spfli에 비행시간(fltime)과 항공사 코드(carrid)가 있는 여러 행', expected:'비행시간 내림차순, 동점이면 항공사 코드 오름차순으로 행 순서가 바뀝니다. 출력문은 없습니다.', requirements:'내부 테이블 조작 전체 예제의 gt_spfli 선언과 데이터 추가 뒤에 넣고 디버거에서 확인하세요.'},
    'Header Line과 테이블 본문 구분': {input:'Header Line에 SCARR 행(LH / Lufthansa)을 담아 한 행 추가', expected:'1, 0이 순서대로 출력됩니다. 첫 CLEAR는 Header Line만, 두 번째 CLEAR는 본문을 비웁니다.', requirements:'SCARR 교육용 테이블이 있고 Header Line을 허용하는 클래식 실행 가능 리포트에서 기존 문법 학습용으로만 사용하세요. 클래스 내부나 ABAP Cloud용 예제가 아닙니다.'},
    'SELECT-OPTIONS와 cl_demo_output 출력': sqlExample('so_carr에 항공사 범위 입력 또는 비워 두기', '선택 조건에 맞는 SPFLI 노선 목록이 cl_demo_output 화면에 표 형태로 출력됩니다. 조건을 비워 두면 전체 노선이 출력됩니다.'),
    'Classic ABAP Report 이벤트 흐름': sqlExample('Selection Screen 초기값 LH 그대로 실행하거나 다른 항공사 범위 입력', '초기 화면에 LH가 미리 채워지며, 조건을 모두 비우고 실행하면 오류 메시지가 표시됩니다. 유효한 조건으로 실행하면 SPFLI 노선 목록이 cl_demo_output으로 출력됩니다.'),
    'TYPE · LIKE · VALUE · CLEAR': {input:'별도 입력 없음', expected:'0, 17, 20이 각각 한 줄씩 출력됩니다.'},
    '선택 화면에서 숫자 입력받기': {input:'p_count = 3', expected:'입력: 3 / 두 배: 6', requirements:'인라인 DATA 선언을 지원하는 Standard ABAP 환경에서 실행하세요.'},
    '문자와 숫자의 초기값': {input:'코드의 초기값 그대로', expected:'정수 초기값은 0 / 0000이 출력됩니다. lv_text는 공백 5자리로 초기화됩니다.'},
    '텍스트 심볼 사용': {input:'텍스트 심볼 001 = 환영합니다, 002 = 안녕하세요', expected:'환영합니다 / 안녕하세요', requirements:'편집기의 텍스트 요소에서 001과 002를 만들고 활성화하세요. 로그온 언어의 번역에 따라 문구가 달라집니다.'},
    '짝수는 건너뛰고 7에서 종료': {input:'별도 입력 없음', expected:'1, 3, 5가 각각 한 줄씩 출력됩니다.'},
    '직접 문구': {input:'별도 입력 없음', expected:'입력값을 확인하세요라는 정보 메시지가 표시됩니다.'},
    '메시지 클래스 예시 — ZCW와 001을 먼저 생성': {input:'로그온 사용자 이름(sy-uname)', expected:'안녕하세요 & 문구의 & 자리에 로그온 사용자 이름이 들어갑니다.', requirements:'SE91에서 메시지 클래스 ZCW와 001번 문구 «안녕하세요 &»를 먼저 생성·활성화하세요.'},
    '입력은 복사하고 결과는 반영': {input:'PERFORM의 입력값 3', expected:'6이 출력됩니다.'},
    '로컬 클래스의 인스턴스 메서드': {input:'별도 입력 없음', expected:'Hello ABAP이 출력됩니다.'},
    '길이 비교': {input:'lv_text = ABAP', expected:'lv_length = 4, lv_first = 1. WRITE가 없으므로 디버거에서 확인하세요.', requirements:'인라인 DATA 선언과 사용한 함수를 지원하는 ABAP 환경이 필요합니다.'},
    '연결과 구분자': {input:'코드에 지정된 문자열', expected:'lv_result가 차례로 Hello ABAP → SAP ABAP → 2026-11-17이 됩니다. 각 대입 직후 디버거에서 확인하세요.'},
    '시스템 날짜에서 연·월·일 추출': {input:'예: 시스템 날짜가 20261117인 날', expected:'lv_year = 2026, lv_month = 11, lv_day = 17. 실제 값은 실행한 시스템 날짜에 따릅니다.'},
    '계산 결과 저장': {input:'-7, 밑 2와 지수 3', expected:'lv_absolute = 7, lv_power = 8. WRITE가 없으므로 디버거에서 확인하세요.', requirements:'인라인 DATA 선언과 ipow 함수를 지원하는 ABAP 환경이 필요합니다.'},
    '초기값과 범위 검사': {input:'lv_count 초기값 0, 이후 5 대입', expected:'초기값 0입니다 / 1부터 10 사이입니다 / 3이 아닙니다가 순서대로 출력됩니다.'},
    '문자 집합과 부분 문자열 구분': {input:'lv_text = cat', expected:'a, b, c 중 하나 이상 포함만 출력됩니다. CS 조건은 거짓입니다.'},
    '3을 건너뛰고 출력': {input:'별도 입력 없음', expected:'1, 2, 4, 5가 각각 한 줄씩 출력됩니다.'},
    '오류 메시지': {input:'선택 화면에서 잘못된 값을 입력한 경우', expected:'입력 내용을 확인해 주세요. 메시지가 표시되며 선택 화면에서 값을 수정하게 됩니다.', requirements:'실행 가능 리포트의 AT SELECTION-SCREEN 이벤트에서 입력값 검증 IF문 안에 넣으세요. E 메시지는 실행 위치에 따라 동작이 달라집니다.'}
  };
  for (const doc of Object.values(window.WIKI_DOCS)) {
    if (doc.track !== 'abap') continue;
    for (const section of doc.sections || []) for (const block of section.blocks || []) {
      if (block.type !== 'code') continue;
      const full = /^\s*REPORT\s/im.test(block.code || '');
      block.example = {kind:full ? 'SE38 리포트 전체 코드' : '리포트에 넣는 일부 코드',
        placement:full ? 'SE38에서 실행 가능 Program을 만들고 REPORT 이름(zabap_f##_##)을 본인 Program 이름에 맞춘 뒤 활성화·실행하세요.' : 'REPORT 선언이 있는 실행 가능 Program의 실행부에 넣으세요. 아래 추가 조건이 있으면 그 위치를 우선합니다.',
        verification:'SAP 실행 미확인', ...notes[block.label]};
    }
  }
})();
