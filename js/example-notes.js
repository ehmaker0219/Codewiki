/** Expected results are explanatory; none of these examples has been run in SAP here. */
(() => {
  const notes = {
    'TYPE · LIKE · VALUE · CLEAR': {input:'별도 입력 없음', expected:'0, 17, 20이 각각 한 줄씩 출력됩니다.'},
    '선택 화면에서 숫자 입력받기': {input:'p_count = 3', expected:'입력: 3 / 두 배: 6', requirements:'인라인 DATA 선언을 지원하는 Standard ABAP 환경에서 실행하세요.'},
    '문자와 숫자의 초기값': {input:'코드의 초기값 그대로', expected:'정수 초기값은 0 / 0000이 출력됩니다. lv_text는 공백 5자리로 초기화됩니다.'},
    '텍스트 심볼 사용': {input:'텍스트 심볼 001 = 환영합니다, 002 = 안녕하세요', expected:'환영합니다 / 안녕하세요', requirements:'편집기의 텍스트 요소에서 001과 002를 만들고 활성화하세요. 로그온 언어의 번역에 따라 문구가 달라집니다.'},
    '짝수는 건너뛰고 7에서 종료': {input:'별도 입력 없음', expected:'1, 3, 5가 각각 한 줄씩 출력됩니다.'},
    '직접 문구': {input:'별도 입력 없음', expected:'입력값을 확인하세요라는 정보 메시지가 표시됩니다.'},
    '메시지 클래스 예시 — ZCW와 001을 먼저 생성': {input:'로그온 사용자 이름(sy-uname)', expected:'안녕하세요 & 문구의 & 자리에 로그온 사용자 이름이 들어갑니다.', requirements:'SE91에서 메시지 클래스 ZCW와 001번 문구 «안녕하세요 &»를 먼저 생성·활성화하세요.'},
    '입력은 복사하고 결과는 반영': {input:'PERFORM의 입력값 3', expected:'6이 출력됩니다.'},
    '지역 클래스의 인스턴스 메서드': {input:'별도 입력 없음', expected:'Hello ABAP이 출력됩니다.'},
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
        placement:full ? 'SE38에서 실행 가능 프로그램을 만들고 REPORT 이름을 프로그램 이름에 맞춘 뒤 활성화·실행하세요.' : 'REPORT 선언이 있는 실행 가능 프로그램의 실행부에 넣으세요. 아래 추가 조건이 있으면 그 위치를 우선합니다.',
        verification:'SAP 실행 미확인', ...notes[block.label]};
    }
  }
})();
