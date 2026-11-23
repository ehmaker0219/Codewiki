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
    ['databaseTable', 'Database Table · DB 테이블', 'DDIC', 'ZCW_DB_는 이 문제집의 데이터베이스 테이블 접두어입니다.', '데이터베이스에 행을 영속적으로 저장하는 테이블입니다. Program 메모리의 내부 테이블과 구분합니다.', ['ZCW_DB_SCARR','ZCW_DB_SPFLI','ZCW_DB_SFLIGHT','ZCW_DB_SBOOK','ZCW_DB_SCUSTOM','ZCW_DB_SAPLANE']],
    ['functionModule', 'Function Module · 함수 모듈', '프로그램', 'Z_CW_로 시작하는 동작 이름은 이 문제집에서 함수 모듈입니다.', '함수 그룹에 속하는 재사용 가능한 처리 단위이며 CALL FUNCTION으로 호출합니다.', ['Z_CW_GET_FLIGHTS','Z_CW_GET_CARRIER','Z_CW_CHECK_BOOKING','Z_CW_READ_SPFLI','Z_CW_CALC_SEATS','Z_CW_CONVERT_FARE']],
    ['functionGroup', 'Function Group · 함수 그룹', '프로그램', 'ZCW_FG_는 이 문제집의 함수 그룹 접두어입니다.', '관련 함수 모듈을 묶는 저장소 객체입니다. 같은 그룹의 함수 모듈은 그룹의 글로벌 데이터를 공유할 수 있습니다.', ['ZCW_FG_FLIGHT','ZCW_FG_CARRIER','ZCW_FG_SCHEDULE','ZCW_FG_BOOKING','ZCW_FG_AIRPLANE','ZCW_FG_CUSTOMER']],
    ['class', 'Class · 클래스', '프로그램', 'ZCL_은 글로벌 클래스, LCL_은 로컬 클래스에 사용하는 명명 관례입니다.', '속성과 메서드를 묶는 객체 타입입니다. 인스턴스는 이 클래스를 기반으로 생성합니다.', ['ZCL_CW_FLIGHT_SERVICE','ZCL_CW_CARRIER','ZCL_CW_AIRPLANE','LCL_FLIGHT','LCL_SCHEDULE','LCL_BOOKING','ZCL_CW_SCHEDULE','ZCL_CW_BOOKING','ZCL_CW_CUSTOMER']],
    ['interface', 'Interface · 인터페이스', '프로그램', 'ZIF_는 글로벌 인터페이스, LIF_는 로컬 인터페이스에 사용하는 명명 관례입니다.', '구현 클래스가 제공할 메서드 등의 계약을 정의합니다. 인터페이스 자체를 객체로 생성하지 않습니다.', ['ZIF_CW_PRINTABLE','ZIF_CW_FLIGHT_SERVICE','ZIF_CW_BOOKABLE','LIF_FLIGHT_READER','LIF_FARE_CALC','LIF_ROUTE_CHECK']],
    ['report', 'Report · 실행 가능 Program', '프로그램', 'ZCW_R_는 이 문제집의 실행 가능 리포트 접두어입니다.', 'REPORT로 시작하는 실행 가능 Program으로 가정합니다. 선택 화면과 이벤트를 사용해 실행할 수 있습니다.', ['ZCW_R_FLIGHT_LIST','ZCW_R_CARRIER_LIST','ZCW_R_SPFLI_ROUTE','ZCW_R_BOOKING_CHECK','ZCW_R_SEAT_STATUS','ZCW_R_PLANE_SPEC']],
    ['include', 'Include · 인클루드', '프로그램', 'ZCW_I_는 이 문제집의 Include Program 접두어입니다.', 'INCLUDE 문으로 다른 Program에 소스를 포함합니다. Include 자체는 독립 실행 Program이 아닙니다.', ['ZCW_I_FLIGHT_TOP','ZCW_I_FLIGHT_FORMS','ZCW_I_CARRIER_TOP','ZCW_I_BOOKING_FORMS','ZCW_I_SPFLI_EVENTS','ZCW_I_PLANE_CLASSES']],
    ['elementaryType', 'Built-in Type · 기본 타입', '데이터', 'ABAP에서 제공하는 기본 타입 이름입니다.', 'DATA 변수명 TYPE 타입명처럼 선언할 때 쓰는 기본 타입입니다. 사용자 정의 데이터 요소나 변수 이름과 구분합니다.', ['i','int8','c','n','p','d','t','string','xstring']],
    ['structureVariable', 'Structure Variable · 구조 변수', '데이터', 'gs_ / ls_는 이 문제집에서 글로벌 / 로컬 구조 변수 접두어입니다.', '구조 타입으로 선언한 데이터 객체이며 한 건의 필드 값을 보관합니다. 변수-컴포넌트 형식으로 필드에 접근합니다.', ['gs_scarr','gs_spfli','gs_sflight','ls_sbook','ls_scustom','ls_saplane']],
    ['tableVariable', 'Internal Table · 내부 테이블 변수', '데이터', 'gt_ / lt_는 이 문제집에서 글로벌 / 로컬 내부 테이블 변수 접두어입니다.', '여러 행의 실제 데이터를 메모리에 보관합니다. 이를 선언하는 데 사용하는 테이블 타입과 구분합니다.', ['gt_scarr','gt_spfli','gt_sflight','lt_sbook','lt_scustom','lt_saplane']],
    ['referenceVariable', 'Object Reference · 객체 참조 변수', '데이터', 'go_ / lo_는 이 문제집에서 글로벌 / 로컬 객체 참조 변수 접두어입니다.', 'TYPE REF TO로 선언하여 객체에 대한 참조를 보관합니다. 클래스 정의나 객체 자체와는 다릅니다.', ['go_flight_service','go_carrier','go_airplane','lo_flight','lo_schedule','lo_booking']],
    ['constant', 'Constant · 상수', '데이터', 'gc_ / lc_는 이 문제집에서 글로벌 / 로컬 상수 접두어입니다.', 'CONSTANTS로 선언하고 VALUE로 초기값을 정합니다. 실행 중 값을 다시 대입하는 일반 변수와 구분합니다.', ['gc_default_carrid','gc_max_seats','gc_default_currency','lc_min_fltime','lc_cabin_class','lc_limit']],
    ['selectionTable', 'Selection Table · 선택 조건 테이블', '데이터', 'so_는 이 문제집에서 SELECT-OPTIONS로 선언한 선택 조건의 접두어입니다.', 'SELECT-OPTIONS로 선언한 Selection Table입니다. SIGN·OPTION·LOW·HIGH로 여러 값이나 범위, 포함·제외 조건을 보관합니다. 단일 입력값을 받는 PARAMETERS와 구분합니다.', ['so_carr','so_conn','so_date','so_id','so_order','so_plane']]
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
  categories.push(
    {id:'elementaryVariable',label:'Elementary Variable · 단일 값 변수',family:'데이터'},
    {id:'parameter',label:'Parameter · 단일 입력값',family:'데이터'},
    {id:'component',label:'Field / Component · 필드·컴포넌트',family:'데이터'}
  );
  // Standard names may identify both a Data Element and a Domain. These cards
  // include the declaration/definition being asked about, rather than guessing
  // the repository kind from S_ alone. Sources for the standard examples:
  // https://help.sap.com/saphelp_snc70/helpdata/EN/90/8d72feb1af11d194f600a0c929b3c3/content.htm
  // https://help.sap.com/saphelp_snc700_ehp01/helpdata/en/e2/667092730811d2959500a0c929b3c3/content.htm
  // https://help.sap.com/docs/ABAP_PLATFORM_NEW/7989a582039547ae91d8f483e487058d/a778b0a956eb400fbd0ceda5ad20479f.html
  // https://help.sap.com/saphelp_SCM700_ehp01/helpdata/en/ca/d08606a44f11d1950c0000e82de14a/content.htm
  // https://help.sap.com/docs/abap-cloud/abap-keywords-standard-abap/abenlist_overview.html
  // https://help.sap.com/docs/abap-cloud/abap-keywords-standard-abap/ABENNEWS-640-RTTI.html
  const confusers = {
    dataElement:['domain','structure','elementaryType'],
    domain:['dataElement','elementaryType','databaseTable'],
    databaseTable:['structure','tableType','tableVariable'],
    structure:['structureVariable','tableType','dataElement'],
    tableType:['tableVariable','structure','structureVariable'],
    structureVariable:['structure','tableVariable','dataElement'],
    tableVariable:['tableType','structureVariable','selectionTable'],
    elementaryVariable:['dataElement','structureVariable','parameter'],
    parameter:['selectionTable','elementaryVariable','dataElement'],
    selectionTable:['parameter','tableVariable','structureVariable'],
    component:['dataElement','structure','elementaryVariable'],
    referenceVariable:['class','interface','structureVariable'],
    class:['referenceVariable','interface','functionModule'],
    interface:['class','referenceVariable','functionModule'],
    functionModule:['class','functionGroup','report'],
    elementaryType:['dataElement','domain','elementaryVariable'],
    constant:['elementaryVariable','parameter','dataElement']
  };
  function add(answer,name,prompt,hint,explanation) {
    questions.push({id:'contrast-'+answer+'-'+name.toLowerCase().replace(/[^a-z0-9_]+/g,'-'),
      name,answer,family:categories.find(category=>category.id===answer).family,
      prompt,hint,explanation,distractors:confusers[answer]});
  }
  const flightElements = [
    ['S_CARR_ID','carrid'],['S_CONN_ID','connid'],['S_DATE','fldate'],
    ['S_PRICE','price'],['S_CURRCODE','currency'],['S_PLANETYE','planetype'],
    ['S_SEATSMAX','seatsmax'],['S_SEATSOCC','seatsocc'],['S_SUM','paymentsum'],
    ['S_SMAX_B','seatsmax_b'],['S_SOCC_B','seatsocc_b'],
    ['S_SMAX_F','seatsmax_f'],['S_SOCC_F','seatsocc_f']
  ];
  for(const [name,field] of flightElements) {
    const variable=name==='S_CARR_ID'?'s_carrid':'lv_'+field;
    const sharedName=['S_CARR_ID','S_CONN_ID'].includes(name);
    add('dataElement',name,'DATA '+variable+' TYPE '+name.toLowerCase()+'.',
      'TYPE 오른쪽의 이름과 DATA 뒤에 선언되는 변수 이름을 구분하세요.',
      name+'는 이 선언에서 사용하는 항공 모델의 Data Element입니다. S_로 시작한다고 Structure인 것은 아닙니다.'+
      (sharedName?' 같은 이름의 Domain도 있지만, 여기서 TYPE으로 참조하는 대상은 Data Element입니다.':''));
  }
  for(const [name,type,length] of [['S_CARR_ID','CHAR',3],['S_CONN_ID','NUMC',4]]) {
    add('domain',name,'SE11에서 확인한 정의\nDATA TYPE: '+type+' · 길이: '+length+'\n여러 DATA ELEMENT가 이 기술 속성 정의를 참조합니다.',
      '필드의 의미·레이블을 정하는 객체인지, 공통 기술 속성을 제공하는 객체인지 보세요.',
      '이 맥락의 '+name+'는 Domain입니다. 같은 이름의 Data Element와는 별개이며, Data Element가 이 기술 속성을 참조합니다.');
  }
  // ZDO_ is a teaching convention for these custom objects, not an SAP-wide rule.
  for(const [name,type,length] of [
    ['ZDO_CARRID','CHAR',3],['ZDO_CONNID','NUMC',4],['ZDO_FLDATE','DATS',8],
    ['ZDO_CURRENCY','CUKY',5],['ZDO_BOOKID','NUMC',8],['ZDO_SEATCLASS','CHAR',1]
  ]) {
    add('domain',name,'학습용 SE11 정의\nDATA TYPE: '+type+' · 길이: '+length+'\nData Element에서 참조하는 공통 기술 속성 정의',
      'ZDO_는 이 문제에서 사용하는 Domain 명명 관례입니다. 실제 객체 종류는 SE11 정의로 확인하세요.',
      name+'는 항공 실습용으로 가정한 커스텀 Domain입니다. Data Type·길이 등의 기술 속성을 정의하며, 필드의 의미와 레이블을 정하는 Data Element와 구분합니다.');
  }
  for(const name of ['SCARR','SPFLI','SFLIGHT','SBOOK','SCUSTOM','SAPLANE','SAIRPORT']) {
    add('databaseTable',name,'SELECT * FROM '+name.toLowerCase()+' INTO TABLE @DATA(lt_result).',
      'FROM 뒤의 조회 원본과 INTO TABLE 뒤의 결과 변수를 구분하세요.',
      name+'는 SAP 항공 모델의 DB Table입니다. TYPE 뒤에서 행 구조를 참조할 수도 있지만, 이 문제는 SELECT의 조회 원본을 묻습니다.');
  }
  const classExamples = [
    ['CL_DEMO_OUTPUT',"cl_demo_output=>display( 'LH' )."],
    ['CL_SALV_TABLE','DATA lo_alv TYPE REF TO cl_salv_table.'],
    ['CL_ABAP_TYPEDESCR','DATA lo_type TYPE REF TO cl_abap_typedescr.'],
    ['CL_ABAP_STRUCTDESCR','DATA lo_structure TYPE REF TO cl_abap_structdescr.'],
    ['CL_ABAP_TABLEDESCR','DATA lo_table TYPE REF TO cl_abap_tabledescr.']
  ];
  for(const [name,prompt] of classExamples) add('class',name,prompt,
    '클래스 이름과 그 클래스를 가리키는 참조 변수는 다른 대상입니다.',
    name+'는 글로벌 Class입니다. TYPE REF TO 뒤의 클래스 이름이나 정적 메서드 호출의 => 왼쪽에 사용할 수 있습니다.');
  for(const name of ['BAPI_FLIGHT_GETLIST','DDIF_FIELDINFO_GET']) add('functionModule',name,
    "호출 구문 일부\nCALL FUNCTION '"+name+"'\n  ...",
    'CALL FUNCTION 뒤에 놓인 이름을 확인하세요.',
    name+'는 Function Module입니다. 클래스 메서드 호출이나 Function Group 이름과 구분합니다.');
  add('interface','IF_AMDP_MARKER_HDB','CLASS zcl_cw_flights DEFINITION PUBLIC.\n  PUBLIC SECTION.\n    INTERFACES if_amdp_marker_hdb.\nENDCLASS.',
    'INTERFACES 문은 구현 클래스가 따르는 인터페이스를 지정합니다.',
    'IF_AMDP_MARKER_HDB는 SAP HANA용 AMDP 클래스에 사용하는 marker Interface입니다. 클래스 자체나 객체 참조 변수가 아닙니다.');
  add('tableType','BC400_T_FLIGHTS','수업 예시\nDATA gt_flights TYPE bc400_t_flights.',
    '수업에서 BC400_S_FLIGHT와 BC400_T_FLIGHTS를 어떻게 구분했는지 떠올려 보세요.',
    '수업에서 사용한 Table Type입니다. BC400_S_FLIGHT는 Structure, gt_flights는 실제 데이터를 담는 Internal Table 변수입니다.');
  for(const name of ['f','x','decfloat16','decfloat34']) add('elementaryType',name,
    'DATA lv_value TYPE '+name+(name==='x'?' LENGTH 4':'')+'.',
    'SAP가 제공하는 기본 타입과 Dictionary에서 정의한 Data Element를 구분하세요.',
    name+'는 ABAP Built-in Type입니다. f는 이진 부동소수점, x는 고정 길이 바이트, decfloat16·decfloat34는 십진 부동소수점 타입입니다.');
  const rowTypes = [
    ['ts_flight','sflight'],['ts_carrier','scarr'],['ts_connection','spfli'],
    ['ts_booking','sbook'],['ty_flight','sflight'],['ty_carrier','scarr']
  ];
  for(const [name,base] of rowTypes) add('structure',name,'TYPES '+name+' TYPE '+base+'.',
    'TYPES는 타입을 정의합니다. DATA로 생성한 변수와 구분하세요.',
    name+'는 이 Program에서 정의한 Structure 타입입니다. '+base.toUpperCase()+'의 행 구조를 사용하며 아직 실제 값을 담는 변수는 만들지 않았습니다.');
  const tableTypes = [
    ['tt_flights','sflight'],['tt_carriers','scarr'],['tt_connections','spfli'],
    ['tt_bookings','sbook'],['ty_flights','sflight'],['ty_carriers','scarr']
  ];
  for(const [name,base] of tableTypes) add('tableType',name,'TYPES '+name+' TYPE STANDARD TABLE OF '+base+' WITH DEFAULT KEY.',
    'TABLE OF만 보지 말고 문장 시작이 TYPES인지 DATA인지 확인하세요.',
    name+'는 로컬 Table Type입니다. 여러 행을 담을 변수는 DATA lt_rows TYPE '+name+'처럼 따로 선언합니다.');
  for(const [name,base] of [['gs_flight','sflight'],['ls_flight','sflight'],['gs_carrier','scarr'],['ls_carrier','scarr'],['gs_connection','spfli'],['ls_booking','sbook']]) {
    add('structureVariable',name,'DATA '+name+' TYPE '+base+'.',
      'DATA 뒤의 대상이며 TABLE OF 없이 한 행의 구조로 선언되었습니다.',
      name+'는 한 행을 담는 Structure Variable, 즉 Work Area입니다. TYPE 뒤의 '+base.toUpperCase()+'는 그 행 구조의 기준입니다.');
  }
  const workAreas = [
    ['wa_flight','DATA wa_flight TYPE bc400_s_flight.'],
    ['wa_carrier','DATA wa_carrier TYPE scarr.'],
    ['wa_connection','DATA wa_connection TYPE spfli.'],
    ['wa_booking','DATA wa_booking TYPE sbook.'],
    ['wa_customer','DATA wa_customer TYPE scustom.'],
    ['wa_airplane','DATA wa_airplane TYPE saplane.'],
    ['wa_result','DATA gt_flights TYPE STANDARD TABLE OF sflight WITH DEFAULT KEY.\nDATA wa_result LIKE LINE OF gt_flights.'],
    ['wa_output','TYPES tt_flights TYPE STANDARD TABLE OF sflight WITH DEFAULT KEY.\nDATA wa_output TYPE LINE OF tt_flights.']
  ];
  for(const [name,prompt] of workAreas) add('structureVariable',name,prompt,
    'wa_는 Work Area에 자주 쓰는 명명 관례입니다. 선언에서 한 행을 담는지, 여러 행을 담는지 확인하세요.',
    name+'는 한 행의 값을 담는 Work Area, 즉 Structure Variable입니다. TYPE LINE OF는 테이블 타입의 행 타입, LIKE LINE OF는 내부 테이블 변수의 행 구조를 기준으로 선언합니다.');
  for(const [name,base] of [['gt_flights','sflight'],['lt_flights','sflight'],['gt_carriers','scarr'],['lt_carriers','scarr'],['gt_connections','spfli'],['lt_connections','spfli']]) {
    add('tableVariable',name,'DATA '+name+' TYPE STANDARD TABLE OF '+base+' WITH DEFAULT KEY.',
      'DATA로 선언했고 TABLE OF가 있으므로 실제 여러 행을 담습니다.',
      name+'는 Internal Table 변수입니다. TYPES로 정의하는 Table Type이나 한 행만 담는 Work Area와 구분합니다.');
  }
  for(const [name,type] of [['lr_carrid','s_carr_id'],['gr_connid','s_conn_id']]) add('tableVariable',name,
    'DATA '+name+' TYPE RANGE OF '+type+'.',
    '접두어 대신 RANGE OF와 REF TO의 차이를 보세요.',
    name+'는 RANGE OF로 선언한 Internal Table 변수입니다. SIGN·OPTION·LOW·HIGH를 가지며 SELECT-OPTIONS와 달리 입력 화면이나 암시적 Header Line을 만들지 않습니다.');
  for(const [name,type] of [['s_carrid','s_carr_id'],['carrid','s_carr_id'],['lv_carrid','s_carr_id'],['gv_carrid','s_carr_id'],['lv_connid','s_conn_id'],['gv_fldate','s_date'],['lv_seatsmax','s_seatsmax'],['lv_count','i']]) {
    add('elementaryVariable',name,'DATA '+name+' TYPE '+type+'.',
      '이번에 묻는 이름은 TYPE 뒤의 타입 이름이 아니라 DATA 뒤의 선언 대상입니다.',
      name+'는 단일 값을 담는 변수입니다. '+type+'는 이 변수의 타입이며, 이름이 비슷해도 변수와 타입은 다릅니다.');
  }
  for(const [name,type] of [['p_carrid','s_carr_id'],['p_connid','s_conn_id'],['p_fldate','s_date'],['p_price','s_price'],['p_smax','s_seatsmax'],['p_limit','i']]) {
    add('parameter',name,'PARAMETERS '+name+' TYPE '+type+'.',
      '하나의 입력값을 받는 선언과 여러 조건을 보관하는 SELECT-OPTIONS를 구분하세요.',
      name+'는 PARAMETERS로 선언한 단일 입력값입니다. SELECT-OPTIONS의 Selection Table과 달리 SIGN·OPTION·LOW·HIGH 행들을 갖지 않습니다.');
  }
  for(const [name,field] of [['s_carrid','carrid'],['s_connid','connid'],['s_fldate','fldate'],['so_price','price']]) {
    add('selectionTable',name,'DATA gs_flight TYPE sflight.\nSELECT-OPTIONS '+name+' FOR gs_flight-'+field+'.',
      'SELECT-OPTIONS의 선언 대상과 FOR 뒤의 참조 필드는 다릅니다.',
      name+'는 Selection Table입니다. FOR 뒤의 필드 타입을 사용하고 SIGN·OPTION·LOW·HIGH로 여러 조건을 보관합니다.');
  }
  for(const [name,prompt] of [
    ['SCARR-CARRID','DATA lv_carrid TYPE scarr-carrid.'],
    ['SPFLI-CONNID','DATA lv_connid TYPE spfli-connid.'],
    ['SFLIGHT-FLDATE','DATA lv_fldate TYPE sflight-fldate.'],
    ['SBOOK-BOOKID','DATA lv_bookid TYPE sbook-bookid.'],
    ['gs_flight-carrid',"DATA gs_flight TYPE sflight.\ngs_flight-carrid = 'LH'."],
    ['ls_carrier-carrname','DATA ls_carrier TYPE scarr.\nWRITE ls_carrier-carrname.']
  ]) add('component',name,prompt,
    '하이픈(-)으로 연결된 두 이름은 어떤 관계인지 보세요.',
    name+'는 필드·컴포넌트를 지정한 표현입니다. S_CARR_ID 같은 독립적인 Data Element 이름이나 구조 전체를 뜻하지 않습니다.');
  for(const [name,type] of [['lo_output','cl_demo_output'],['lo_salv','cl_salv_table'],['lo_type','cl_abap_typedescr']]) {
    add('referenceVariable',name,'DATA '+name+' TYPE REF TO '+type+'.',
      'TYPE REF TO 뒤의 클래스와 DATA 뒤의 참조 변수를 구분하세요.',
      name+'는 Object Reference 변수입니다. 선언만으로 클래스의 객체가 생성되는 것은 아니며, 객체를 참조하기 전에는 초기 상태입니다.');
  }
  for(const [name,type,value] of [['lc_carrid','s_carr_id','LH'],['gc_carrier_id','s_carr_id','AA'],['lc_connid','s_conn_id','0400']]) {
    add('constant',name,'CONSTANTS '+name+' TYPE '+type+" VALUE '"+value+"'.",
      'DATA가 아니라 CONSTANTS로 선언했습니다.',
      name+'는 Constant입니다. VALUE로 정한 값을 Program 실행 중 다시 대입하는 일반 변수와 구분합니다.');
  }
  window.CodeWikiObjectBank = {categories,questions};
})();
