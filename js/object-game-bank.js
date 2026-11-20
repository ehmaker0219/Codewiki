/** Static teaching bank: custom names use the explicitly stated lesson convention,
 * not a claim that prefixes alone prove a real SAP repository object's type.
 * References: https://help.sap.com/docs/abap-cloud/abap-concepts/naming-conventions
 * https://help.sap.com/saphelp_snc700_ehp04/helpdata/en/92/c2b084bc1d11d2958700a0c94260a5/content.htm
 */
(() => {
  const groups = [
    ['structure', 'Structure · 구조 타입', 'DDIC', 'ZCW_S_는 이 문제집의 구조 타입 접두어입니다.', '여러 컴포넌트를 묶는 타입입니다. 구조 변수 자체나 여러 행을 담는 테이블 타입과 구분합니다.', ['ZCW_S_FLIGHT','ZCW_S_CARRIER','ZCW_S_SPFLI','ZCW_S_BOOKING','ZCW_S_CUSTOMER','ZCW_S_AIRPLANE']],
    ['tableType', 'Table Type · 테이블 타입', 'DDIC', 'ZCW_TT_는 이 문제집의 테이블 타입 접두어입니다.', '행 타입, 테이블 종류, 키를 정의합니다. 실제 데이터를 담는 내부 테이블 변수와는 다릅니다.', ['ZCW_TT_FLIGHTS','ZCW_TT_CARRIERS','ZCW_TT_SPFLI','ZCW_TT_BOOKINGS','ZCW_TT_CUSTOMERS','ZCW_TT_AIRPLANES']],
    ['dataElement', 'Data Element · 데이터 요소', 'DDIC', 'ZCW_DE_는 이 문제집의 데이터 요소 접두어입니다.', '필드의 의미, 필드 레이블과 문서를 정의합니다. 기술 속성은 도메인을 참조하거나 직접 지정할 수 있습니다.', ['ZCW_DE_CARRIER_ID','ZCW_DE_CONN_ID','ZCW_DE_BOOKING_ID','ZCW_DE_PLANE_TYPE','ZCW_DE_FLIGHT_DATE','ZCW_DE_CITY_FROM']],
    ['domain', 'Domain · 도메인', 'DDIC', 'ZCW_DM_은 이 문제집의 도메인 접두어입니다.', '데이터 타입·길이·소수 자릿수 같은 기술 속성과 값 범위를 정의합니다. 업무 의미를 설명하는 데이터 요소와 구분합니다.', ['ZCW_DM_CARRIER_ID','ZCW_DM_CONN_ID','ZCW_DM_AIRPORT','ZCW_DM_CURRENCY','ZCW_DM_FLTIME','ZCW_DM_SEAT_CLASS']],
    ['databaseTable', 'Database Table · DB 테이블', 'DDIC', 'ZCW_DB_는 이 문제집의 데이터베이스 테이블 접두어입니다.', '데이터베이스에 행을 영속적으로 저장하는 테이블입니다. 프로그램 메모리의 내부 테이블과 구분합니다.', ['ZCW_DB_SCARR','ZCW_DB_SPFLI','ZCW_DB_SFLIGHT','ZCW_DB_SBOOK','ZCW_DB_SCUSTOM','ZCW_DB_SAPLANE']],
    ['functionModule', 'Function Module · 함수 모듈', '프로그램', 'Z_CW_로 시작하는 동작 이름은 이 문제집에서 함수 모듈입니다.', '함수 그룹에 속하는 재사용 가능한 처리 단위이며 CALL FUNCTION으로 호출합니다.', ['Z_CW_GET_FLIGHTS','Z_CW_GET_CARRIER','Z_CW_CHECK_BOOKING','Z_CW_READ_SPFLI','Z_CW_CALC_SEATS','Z_CW_CONVERT_FARE']],
    ['functionGroup', 'Function Group · 함수 그룹', '프로그램', 'ZCW_FG_는 이 문제집의 함수 그룹 접두어입니다.', '관련 함수 모듈을 묶는 저장소 객체입니다. 같은 그룹의 함수 모듈은 그룹의 글로벌 데이터를 공유할 수 있습니다.', ['ZCW_FG_FLIGHT','ZCW_FG_CARRIER','ZCW_FG_SCHEDULE','ZCW_FG_BOOKING','ZCW_FG_AIRPLANE','ZCW_FG_CUSTOMER']],
    ['class', 'Class · 클래스', '프로그램', 'ZCL_은 글로벌 클래스, LCL_은 로컬 클래스에 사용하는 명명 관례입니다.', '속성과 메서드를 묶는 객체 타입입니다. 인스턴스는 이 클래스를 기반으로 생성합니다.', ['ZCL_CW_FLIGHT_SERVICE','ZCL_CW_CARRIER','ZCL_CW_AIRPLANE','LCL_FLIGHT','LCL_SCHEDULE','LCL_BOOKING']],
    ['interface', 'Interface · 인터페이스', '프로그램', 'ZIF_는 글로벌 인터페이스, LIF_는 로컬 인터페이스에 사용하는 명명 관례입니다.', '구현 클래스가 제공할 메서드 등의 계약을 정의합니다. 인터페이스 자체를 객체로 생성하지 않습니다.', ['ZIF_CW_PRINTABLE','ZIF_CW_FLIGHT_SERVICE','ZIF_CW_BOOKABLE','LIF_FLIGHT_READER','LIF_FARE_CALC','LIF_ROUTE_CHECK']],
    ['report', 'Report · 실행 가능 프로그램', '프로그램', 'ZCW_R_는 이 문제집의 실행 가능 리포트 접두어입니다.', 'REPORT로 시작하는 실행 가능 프로그램으로 가정합니다. 선택 화면과 이벤트를 사용해 실행할 수 있습니다.', ['ZCW_R_FLIGHT_LIST','ZCW_R_CARRIER_LIST','ZCW_R_SPFLI_ROUTE','ZCW_R_BOOKING_CHECK','ZCW_R_SEAT_STATUS','ZCW_R_PLANE_SPEC']],
    ['include', 'Include · 인클루드', '프로그램', 'ZCW_I_는 이 문제집의 Include 프로그램 접두어입니다.', 'INCLUDE 문으로 다른 프로그램에 소스를 포함합니다. Include 자체는 독립 실행 프로그램이 아닙니다.', ['ZCW_I_FLIGHT_TOP','ZCW_I_FLIGHT_FORMS','ZCW_I_CARRIER_TOP','ZCW_I_BOOKING_FORMS','ZCW_I_SPFLI_EVENTS','ZCW_I_PLANE_CLASSES']],
    ['elementaryType', 'Built-in Type · 기본 타입', '데이터', 'ABAP에서 제공하는 기본 타입 이름입니다.', 'DATA 변수명 TYPE 타입명처럼 선언할 때 쓰는 기본 타입입니다. 사용자 정의 데이터 요소나 변수 이름과 구분합니다.', ['i','int8','c','n','p','d','t','string','xstring']],
    ['structureVariable', 'Structure Variable · 구조 변수', '데이터', 'gs_ / ls_는 이 문제집에서 글로벌 / 로컬 구조 변수 접두어입니다.', '구조 타입으로 선언한 데이터 객체이며 한 건의 필드 값을 보관합니다. 변수-컴포넌트 형식으로 필드에 접근합니다.', ['gs_scarr','gs_spfli','gs_sflight','ls_sbook','ls_scustom','ls_saplane']],
    ['tableVariable', 'Internal Table · 내부 테이블 변수', '데이터', 'gt_ / lt_는 이 문제집에서 글로벌 / 로컬 내부 테이블 변수 접두어입니다.', '여러 행의 실제 데이터를 메모리에 보관합니다. 이를 선언하는 데 사용하는 테이블 타입과 구분합니다.', ['gt_scarr','gt_spfli','gt_sflight','lt_sbook','lt_scustom','lt_saplane']],
    ['referenceVariable', 'Object Reference · 객체 참조 변수', '데이터', 'go_ / lo_는 이 문제집에서 글로벌 / 로컬 객체 참조 변수 접두어입니다.', 'TYPE REF TO로 선언하여 객체에 대한 참조를 보관합니다. 클래스 정의나 객체 자체와는 다릅니다.', ['go_flight_service','go_carrier','go_airplane','lo_flight','lo_schedule','lo_booking']],
    ['constant', 'Constant · 상수', '데이터', 'gc_ / lc_는 이 문제집에서 글로벌 / 로컬 상수 접두어입니다.', 'CONSTANTS로 선언하고 VALUE로 초기값을 정합니다. 실행 중 값을 다시 대입하는 일반 변수와 구분합니다.', ['gc_default_carrid','gc_max_seats','gc_default_currency','lc_min_fltime','lc_cabin_class','lc_limit']]
  ];
  const categories = groups.map(([id,label,family]) => ({id,label,family}));
  const questions = groups.flatMap(([answer,,family,hint,explanation,names]) => names.map((name,i) => ({
    id:`${answer}-${i+1}`,name,answer,family,hint,explanation,
    context:answer==='elementaryType'?'ABAP 기본 타입':'학습용 이름 · 이 문제집의 명명 규칙 기준'
  })));
  questions.unshift({id:'structure-bc400',name:'BC400_S_FLIGHT',answer:'structure',family:'DDIC',
    context:'수업 예시 · 구조 타입으로 정의한 이름',
    hint:'수업 예시의 _S_는 Structure를 나타냅니다.',
    explanation:'수업에서 사용한 비행 정보 구조 타입 예시입니다. TYPE BC400_S_FLIGHT로 구조 변수를 선언하는 맥락입니다. 실제 시스템의 객체 정의는 SE11에서 확인하세요.'});
  // Keep the name-only challenge intact; the answer context appears after answering.
  questions[0].context='수업에서 다룬 이름';
  window.CodeWikiObjectBank = {categories,questions};
})();
