/**
 * Interactive ABAP Open SQL 30-problem practice bank.
 * Uses SAP Flight Model (SCARR, SPFLI, SFLIGHT, SCUSTOM, SBOOK) and ERP MM tables (MARA, MAKT, EKPO).
 */
(() => {
  const tables = {
    SCARR: {
      name: 'SCARR',
      koName: '항공사 마스터',
      columns: [
        { name: 'CARRID', label: '항공사 코드', pk: true, type: 'c' },
        { name: 'CARRNAME', label: '항공사 이름', pk: false, type: 'c' },
        { name: 'CURRCODE', label: '통화', pk: false, type: 'c' }
      ],
      rows: [
        { CARRID: 'AA', CARRNAME: 'American Airlines', CURRCODE: 'USD' },
        { CARRID: 'AZ', CARRNAME: 'Alitalia', CURRCODE: 'EUR' },
        { CARRID: 'JL', CARRNAME: 'Japan Airlines', CURRCODE: 'JPY' },
        { CARRID: 'LH', CARRNAME: 'Lufthansa', CURRCODE: 'EUR' },
        { CARRID: 'SQ', CARRNAME: 'Singapore Airlines', CURRCODE: 'SGD' },
        { CARRID: 'UA', CARRNAME: 'United Airlines', CURRCODE: 'USD' }
      ]
    },
    SPFLI: {
      name: 'SPFLI',
      koName: '운항 노선',
      columns: [
        { name: 'CARRID', label: '항공사', pk: true, type: 'c' },
        { name: 'CONNID', label: '노선 번호', pk: true, type: 'n' },
        { name: 'COUNTRYFR', label: '출발 국가', pk: false, type: 'c' },
        { name: 'CITYFROM', label: '출발 도시', pk: false, type: 'c' },
        { name: 'COUNTRYTO', label: '도착 국가', pk: false, type: 'c' },
        { name: 'CITYTO', label: '도착 도시', pk: false, type: 'c' },
        { name: 'FLTIME', label: '비행시간(분)', pk: false, type: 'i' }
      ],
      rows: [
        { CARRID: 'AA', CONNID: '0017', COUNTRYFR: 'US', CITYFROM: 'NEW YORK', COUNTRYTO: 'US', CITYTO: 'SAN FRANCISCO', FLTIME: 361 },
        { CARRID: 'AA', CONNID: '0064', COUNTRYFR: 'US', CITYFROM: 'SAN FRANCISCO', COUNTRYTO: 'US', CITYTO: 'NEW YORK', FLTIME: 322 },
        { CARRID: 'JL', CONNID: '0408', COUNTRYFR: 'DE', CITYFROM: 'FRANKFURT', COUNTRYTO: 'JP', CITYTO: 'TOKYO', FLTIME: 675 },
        { CARRID: 'LH', CONNID: '0400', COUNTRYFR: 'DE', CITYFROM: 'FRANKFURT', COUNTRYTO: 'US', CITYTO: 'NEW YORK', FLTIME: 545 },
        { CARRID: 'LH', CONNID: '0402', COUNTRYFR: 'DE', CITYFROM: 'FRANKFURT', COUNTRYTO: 'US', CITYTO: 'NEW YORK', FLTIME: 555 },
        { CARRID: 'LH', CONNID: '2402', COUNTRYFR: 'DE', CITYFROM: 'FRANKFURT', COUNTRYTO: 'DE', CITYTO: 'BERLIN', FLTIME: 65 },
        { CARRID: 'SQ', CONNID: '0002', COUNTRYFR: 'SG', CITYFROM: 'SINGAPORE', COUNTRYTO: 'US', CITYTO: 'SAN FRANCISCO', FLTIME: 840 },
        { CARRID: 'UA', CONNID: '0941', COUNTRYFR: 'DE', CITYFROM: 'FRANKFURT', COUNTRYTO: 'US', CITYTO: 'SAN FRANCISCO', FLTIME: 675 }
      ]
    },
    SFLIGHT: {
      name: 'SFLIGHT',
      koName: '운항 일정',
      columns: [
        { name: 'CARRID', label: '항공사', pk: true, type: 'c' },
        { name: 'CONNID', label: '노선 번호', pk: true, type: 'n' },
        { name: 'FLDATE', label: '운항일', pk: true, type: 'd' },
        { name: 'PRICE', label: '운임', pk: false, type: 'i' },
        { name: 'CURRENCY', label: '통화', pk: false, type: 'c' },
        { name: 'SEATSMAX', label: '총 좌석', pk: false, type: 'i' },
        { name: 'SEATSOCC', label: '점유 좌석', pk: false, type: 'i' }
      ],
      rows: [
        { CARRID: 'AA', CONNID: '0017', FLDATE: '20261110', PRICE: 422, CURRENCY: 'USD', SEATSMAX: 385, SEATSOCC: 310 },
        { CARRID: 'AA', CONNID: '0017', FLDATE: '20261115', PRICE: 450, CURRENCY: 'USD', SEATSMAX: 385, SEATSOCC: 385 },
        { CARRID: 'JL', CONNID: '0408', FLDATE: '20261112', PRICE: 980, CURRENCY: 'JPY', SEATSMAX: 330, SEATSOCC: 290 },
        { CARRID: 'LH', CONNID: '0400', FLDATE: '20261110', PRICE: 666, CURRENCY: 'EUR', SEATSMAX: 330, SEATSOCC: 330 },
        { CARRID: 'LH', CONNID: '0400', FLDATE: '20261118', PRICE: 590, CURRENCY: 'EUR', SEATSMAX: 330, SEATSOCC: 265 },
        { CARRID: 'LH', CONNID: '0402', FLDATE: '20261120', PRICE: 720, CURRENCY: 'EUR', SEATSMAX: 280, SEATSOCC: 210 },
        { CARRID: 'LH', CONNID: '2402', FLDATE: '20261122', PRICE: 180, CURRENCY: 'EUR', SEATSMAX: 180, SEATSOCC: 150 },
        { CARRID: 'SQ', CONNID: '0002', FLDATE: '20261114', PRICE: 1120, CURRENCY: 'SGD', SEATSMAX: 410, SEATSOCC: 395 },
        { CARRID: 'UA', CONNID: '0941', FLDATE: '20261116', PRICE: 840, CURRENCY: 'USD', SEATSMAX: 350, SEATSOCC: 350 }
      ]
    },
    SCUSTOM: {
      name: 'SCUSTOM',
      koName: '고객 마스터',
      columns: [
        { name: 'ID', label: '고객 번호', pk: true, type: 'n' },
        { name: 'NAME', label: '고객명', pk: false, type: 'c' },
        { name: 'CITY', label: '도시', pk: false, type: 'c' },
        { name: 'COUNTRY', label: '국가', pk: false, type: 'c' },
        { name: 'DISCOUNT', label: '할인율', pk: false, type: 'n' }
      ],
      rows: [
        { ID: '00000001', NAME: 'Hans Mueller', CITY: 'BERLIN', COUNTRY: 'DE', DISCOUNT: '010' },
        { ID: '00000002', NAME: 'Anna Schmidt', CITY: 'MUNICH', COUNTRY: 'DE', DISCOUNT: '005' },
        { ID: '00000003', NAME: 'John Smith', CITY: 'NEW YORK', COUNTRY: 'US', DISCOUNT: '000' },
        { ID: '00000004', NAME: 'Kenji Sato', CITY: 'TOKYO', COUNTRY: 'JP', DISCOUNT: '015' },
        { ID: '00000005', NAME: 'Minji Kim', CITY: 'SEOUL', COUNTRY: 'KR', DISCOUNT: '020' }
      ]
    },
    SBOOK: {
      name: 'SBOOK',
      koName: '항공 예약',
      columns: [
        { name: 'CARRID', label: '항공사', pk: true, type: 'c' },
        { name: 'CONNID', label: '노선', pk: true, type: 'n' },
        { name: 'FLDATE', label: '운항일', pk: true, type: 'd' },
        { name: 'BOOKID', label: '예약 번호', pk: true, type: 'n' },
        { name: 'CUSTOMID', label: '고객 번호', pk: false, type: 'n' },
        { name: 'LOCCURAM', label: '결제 금액', pk: false, type: 'i' },
        { name: 'LOCCURKEY', label: '통화', pk: false, type: 'c' },
        { name: 'CANCELLED', label: '취소 여부', pk: false, type: 'c' }
      ],
      rows: [
        { CARRID: 'LH', CONNID: '0400', FLDATE: '20261110', BOOKID: '00000101', CUSTOMID: '00000001', LOCCURAM: 666, LOCCURKEY: 'EUR', CANCELLED: '' },
        { CARRID: 'LH', CONNID: '0400', FLDATE: '20261118', BOOKID: '00000102', CUSTOMID: '00000001', LOCCURAM: 590, LOCCURKEY: 'EUR', CANCELLED: '' },
        { CARRID: 'LH', CONNID: '2402', FLDATE: '20261122', BOOKID: '00000103', CUSTOMID: '00000002', LOCCURAM: 180, LOCCURKEY: 'EUR', CANCELLED: '' },
        { CARRID: 'LH', CONNID: '0402', FLDATE: '20261120', BOOKID: '00000104', CUSTOMID: '00000002', LOCCURAM: 720, LOCCURKEY: 'EUR', CANCELLED: 'X' },
        { CARRID: 'AA', CONNID: '0017', FLDATE: '20261110', BOOKID: '00000201', CUSTOMID: '00000003', LOCCURAM: 422, LOCCURKEY: 'USD', CANCELLED: '' },
        { CARRID: 'AA', CONNID: '0017', FLDATE: '20261115', BOOKID: '00000202', CUSTOMID: '00000003', LOCCURAM: 450, LOCCURKEY: 'USD', CANCELLED: '' },
        { CARRID: 'SQ', CONNID: '0002', FLDATE: '20261114', BOOKID: '00000301', CUSTOMID: '00000001', LOCCURAM: 1120, LOCCURKEY: 'SGD', CANCELLED: '' },
        { CARRID: 'JL', CONNID: '0408', FLDATE: '20261112', BOOKID: '00000401', CUSTOMID: '00000004', LOCCURAM: 980, LOCCURKEY: 'JPY', CANCELLED: 'X' }
      ]
    },
    MARA: {
      name: 'MARA',
      koName: '자재 마스터 (MM)',
      columns: [
        { name: 'MATNR', label: '자재 번호', pk: true, type: 'c' },
        { name: 'MTART', label: '자재 유형', pk: false, type: 'c' },
        { name: 'MATKL', label: '자재 그룹', pk: false, type: 'c' },
        { name: 'MEINS', label: '기본 단위', pk: false, type: 'c' }
      ],
      rows: [
        { MATNR: 'MAT-100', MTART: 'ROH', MATKL: 'RAW01', MEINS: 'KG' },
        { MATNR: 'MAT-200', MTART: 'HALB', MATKL: 'SEMI01', MEINS: 'EA' },
        { MATNR: 'MAT-300', MTART: 'FERT', MATKL: 'FIN01', MEINS: 'EA' },
        { MATNR: 'MAT-400', MTART: 'ROH', MATKL: 'RAW02', MEINS: 'L' },
        { MATNR: 'MAT-500', MTART: 'FERT', MATKL: 'FIN02', MEINS: 'EA' },
        { MATNR: 'MAT-600', MTART: 'HALB', MATKL: 'SEMI02', MEINS: 'EA' }
      ]
    },
    MAKT: {
      name: 'MAKT',
      koName: '자재 내역 (MM)',
      columns: [
        { name: 'MATNR', label: '자재 번호', pk: true, type: 'c' },
        { name: 'SPRAS', label: '언어 키', pk: true, type: 'c' },
        { name: 'MAKTX', label: '자재 설명', pk: false, type: 'c' }
      ],
      rows: [
        { MATNR: 'MAT-100', SPRAS: 'KO', MAKTX: '알루미늄 원자재' },
        { MATNR: 'MAT-100', SPRAS: 'EN', MAKTX: 'Aluminum Raw' },
        { MATNR: 'MAT-200', SPRAS: 'KO', MAKTX: '모터 반제품' },
        { MATNR: 'MAT-300', SPRAS: 'KO', MAKTX: '완성 펌프' },
        { MATNR: 'MAT-400', SPRAS: 'KO', MAKTX: '윤활유' },
        { MATNR: 'MAT-500', SPRAS: 'EN', MAKTX: 'Export Pump' },
        { MATNR: 'MAT-600', SPRAS: 'KO', MAKTX: '제어 모듈' }
      ]
    },
    EKPO: {
      name: 'EKPO',
      koName: '구매오더 품목 (MM)',
      columns: [
        { name: 'EBELN', label: '구매오더', pk: true, type: 'c' },
        { name: 'EBELP', label: '품목 번호', pk: true, type: 'n' },
        { name: 'MATNR', label: '자재 번호', pk: false, type: 'c' },
        { name: 'MENGE', label: '발주 수량', pk: false, type: 'i' },
        { name: 'NETWR', label: '순 금액', pk: false, type: 'i' },
        { name: 'WAERS', label: '통화', pk: false, type: 'c' }
      ],
      rows: [
        { EBELN: '4500000001', EBELP: '00010', MATNR: 'MAT-100', MENGE: 100, NETWR: 3000, WAERS: 'KRW' },
        { EBELN: '4500000001', EBELP: '00020', MATNR: 'MAT-200', MENGE: 50, NETWR: 4500, WAERS: 'KRW' },
        { EBELN: '4500000002', EBELP: '00010', MATNR: 'MAT-100', MENGE: 80, NETWR: 2400, WAERS: 'KRW' },
        { EBELN: '4500000002', EBELP: '00020', MATNR: 'MAT-300', MENGE: 10, NETWR: 6200, WAERS: 'KRW' },
        { EBELN: '4500000003', EBELP: '00010', MATNR: 'MAT-400', MENGE: 40, NETWR: 1600, WAERS: 'KRW' },
        { EBELN: '4500000003', EBELP: '00020', MATNR: 'MAT-200', MENGE: 20, NETWR: 1800, WAERS: 'KRW' }
      ]
    }
  };

  const categories = [
    { id: 'all', label: '전체' },
    { id: 'flight-basic', label: '항공사 기초' },
    { id: 'flight-adv', label: '운항 · 예약' },
    { id: 'erp', label: 'ERP 모듈' },
    { id: 'new-abap', label: '신문법 (7.40+)' }
  ];

  const problems = [
    /* ===================== 01–10: 항공사 기초 ===================== */
    {
      id: 'sql-01', num: '01', category: 'flight-basic', categoryLabel: '항공사 기초', level: '기본', syntax: 'either',
      prompt: 'SCARR(항공사) 테이블의 **모든 데이터**를 `gt_scarr`에 담으세요.',
      note: '구문법·신문법 모두 채점됩니다. 단, 한 문장 안에서 쉼표/@ 등 구문법과 신문법을 섞어 쓰면 오류가 납니다.',
      tables: ['SCARR'],
      declarations: 'DATA gt_scarr TYPE TABLE OF scarr.',
      target: { name: 'gt_scarr', kind: 'table', label: 'Internal Table gt_scarr', fields: [
        { name: 'CARRID', label: '항공사 코드' }, { name: 'CARRNAME', label: '항공사 이름' }, { name: 'CURRCODE', label: '통화' }
      ] },
      hints: [
        '모든 컬럼을 가져올 때는 `SELECT *`를 사용합니다.',
        '구문법은 `SELECT * FROM scarr INTO TABLE gt_scarr.`, 신문법은 `INTO TABLE @gt_scarr.`처럼 `@`를 붙입니다.'
      ],
      answers: {
        classic: 'SELECT *\n  FROM scarr\n  INTO TABLE gt_scarr.',
        new: 'SELECT *\n  FROM scarr\n  INTO TABLE @gt_scarr.'
      }
    },
    {
      id: 'sql-02', num: '02', category: 'flight-basic', categoryLabel: '항공사 기초', level: '기본', syntax: 'either',
      prompt: 'SCARR 테이블에서 **항공사 코드(`carrid`)와 항공사 이름(`carrname`)만** `gt_carr`에 담으세요.',
      tables: ['SCARR'],
      declarations: 'TYPES: BEGIN OF ts_carr,\n         carrid   TYPE scarr-carrid,\n         carrname TYPE scarr-carrname,\n       END OF ts_carr.\nDATA gt_carr TYPE TABLE OF ts_carr.',
      target: { name: 'gt_carr', kind: 'table', label: 'Internal Table gt_carr', fields: [
        { name: 'CARRID', label: '항공사 코드' }, { name: 'CARRNAME', label: '항공사 이름' }
      ] },
      hints: [
        '`SELECT *` 대신 필요한 컬럼 `carrid`, `carrname`을 순서대로 적으세요.',
        '구문법은 컬럼을 공백으로 구분하고, 신문법은 쉼표(`,`)로 구분하고 `@gt_carr`를 사용합니다.'
      ],
      answers: {
        classic: 'SELECT carrid carrname\n  FROM scarr\n  INTO TABLE gt_carr.',
        new: 'SELECT carrid, carrname\n  FROM scarr\n  INTO TABLE @gt_carr.'
      }
    },
    {
      id: 'sql-03', num: '03', category: 'flight-basic', categoryLabel: '항공사 기초', level: '기본', syntax: 'either',
      prompt: 'SCARR 테이블에서 **통화(`currcode`)가 `\'EUR\'`인 항공사**의 모든 컬럼을 `gt_eur`에 담으세요.',
      tables: ['SCARR'],
      declarations: 'DATA gt_eur TYPE TABLE OF scarr.',
      target: { name: 'gt_eur', kind: 'table', label: 'Internal Table gt_eur', fields: [
        { name: 'CARRID', label: '항공사 코드' }, { name: 'CARRNAME', label: '항공사 이름' }, { name: 'CURRCODE', label: '통화' }
      ] },
      hints: [
        '문자열 조건은 작은따옴표(`\'EUR\'`)로 감쌉니다.',
        '`WHERE currcode = \'EUR\'` 조건을 추가하고, 신문법에서는 `INTO TABLE @gt_eur`를 `WHERE` 뒤에 배치합니다.'
      ],
      answers: {
        classic: "SELECT *\n  FROM scarr\n  INTO TABLE gt_eur\n  WHERE currcode = 'EUR'.",
        new: "SELECT *\n  FROM scarr\n  WHERE currcode = 'EUR'\n  INTO TABLE @gt_eur."
      }
    },
    {
      id: 'sql-04', num: '04', category: 'flight-basic', categoryLabel: '항공사 기초', level: '기본', syntax: 'either',
      prompt: 'SPFLI 테이블에서 **출발 국가(`countryfr`)가 `\'DE\'`이고 비행시간(`fltime`)이 `500` 이상**인 노선의 `carrid`, `connid`, `cityto`, `fltime`을 `gt_routes`에 담으세요.',
      tables: ['SPFLI'],
      declarations: 'TYPES: BEGIN OF ts_route,\n         carrid TYPE spfli-carrid,\n         connid TYPE spfli-connid,\n         cityto TYPE spfli-cityto,\n         fltime TYPE spfli-fltime,\n       END OF ts_route.\nDATA gt_routes TYPE TABLE OF ts_route.',
      target: { name: 'gt_routes', kind: 'table', label: 'Internal Table gt_routes', fields: [
        { name: 'CARRID', label: '항공사' }, { name: 'CONNID', label: '노선 번호' }, { name: 'CITYTO', label: '도착 도시' }, { name: 'FLTIME', label: '비행시간(분)' }
      ] },
      hints: [
        '두 조건을 모두 만족해야 하므로 `AND`로 연결합니다.',
        '`WHERE countryfr = \'DE\' AND fltime >= 500`처럼 작성하세요.'
      ],
      answers: {
        classic: "SELECT carrid connid cityto fltime\n  FROM spfli\n  INTO TABLE gt_routes\n  WHERE countryfr = 'DE'\n    AND fltime >= 500.",
        new: "SELECT carrid, connid, cityto, fltime\n  FROM spfli\n  WHERE countryfr = 'DE'\n    AND fltime >= 500\n  INTO TABLE @gt_routes."
      }
    },
    {
      id: 'sql-05', num: '05', category: 'flight-basic', categoryLabel: '항공사 기초', level: '기본', syntax: 'either',
      prompt: 'SFLIGHT 테이블에서 **운임(`price`)이 `400` 이상 `800` 이하**인 운항의 `carrid`, `connid`, `fldate`, `price`를 `gt_mid`에 담으세요.',
      tables: ['SFLIGHT'],
      declarations: 'TYPES: BEGIN OF ts_mid,\n         carrid TYPE sflight-carrid,\n         connid TYPE sflight-connid,\n         fldate TYPE sflight-fldate,\n         price  TYPE sflight-price,\n       END OF ts_mid.\nDATA gt_mid TYPE TABLE OF ts_mid.',
      target: { name: 'gt_mid', kind: 'table', label: 'Internal Table gt_mid', fields: [
        { name: 'CARRID', label: '항공사' }, { name: 'CONNID', label: '노선 번호' }, { name: 'FLDATE', label: '운항일' }, { name: 'PRICE', label: '운임' }
      ] },
      hints: [
        '범위 조건은 `BETWEEN 400 AND 800` 또는 `price >= 400 AND price <= 800`으로 표현할 수 있습니다.',
        '`BETWEEN`은 양 끝 값(400, 800)을 모두 포함합니다.'
      ],
      answers: {
        classic: 'SELECT carrid connid fldate price\n  FROM sflight\n  INTO TABLE gt_mid\n  WHERE price BETWEEN 400 AND 800.',
        new: 'SELECT carrid, connid, fldate, price\n  FROM sflight\n  WHERE price BETWEEN 400 AND 800\n  INTO TABLE @gt_mid.'
      }
    },
    {
      id: 'sql-06', num: '06', category: 'flight-basic', categoryLabel: '항공사 기초', level: '기본', syntax: 'either',
      prompt: 'SCARR 테이블에서 **항공사 코드(`carrid`)가 `\'LH\'`, `\'AA\'`, `\'SQ\'` 중 하나**인 항공사의 `carrid`, `carrname`을 `gt_pick`에 담으세요.',
      tables: ['SCARR'],
      declarations: 'TYPES: BEGIN OF ts_pick,\n         carrid   TYPE scarr-carrid,\n         carrname TYPE scarr-carrname,\n       END OF ts_pick.\nDATA gt_pick TYPE TABLE OF ts_pick.',
      target: { name: 'gt_pick', kind: 'table', label: 'Internal Table gt_pick', fields: [
        { name: 'CARRID', label: '항공사 코드' }, { name: 'CARRNAME', label: '항공사 이름' }
      ] },
      hints: [
        '여러 고정 값 중 하나와 일치할 때는 `WHERE carrid IN ( \'LH\', \'AA\', \'SQ\' )`를 사용하면 간결합니다.',
        '괄호 안쪽 목록은 구문법에서도 쉼표(`,`)로 구분하며, 괄호와 값 사이에 공백을 두는 것이 ABAP 관례입니다.'
      ],
      answers: {
        classic: "SELECT carrid carrname\n  FROM scarr\n  INTO TABLE gt_pick\n  WHERE carrid IN ( 'LH', 'AA', 'SQ' ).",
        new: "SELECT carrid, carrname\n  FROM scarr\n  WHERE carrid IN ( 'LH', 'AA', 'SQ' )\n  INTO TABLE @gt_pick."
      }
    },
    {
      id: 'sql-07', num: '07', category: 'flight-basic', categoryLabel: '항공사 기초', level: '기본', syntax: 'either',
      prompt: 'SCARR 테이블에서 **항공사 이름(`carrname`)이 `\'Airlines\'`로 끝나는 항공사**의 `carrid`, `carrname`을 `gt_airlines`에 담으세요.',
      tables: ['SCARR'],
      declarations: 'TYPES: BEGIN OF ts_airline,\n         carrid   TYPE scarr-carrid,\n         carrname TYPE scarr-carrname,\n       END OF ts_airline.\nDATA gt_airlines TYPE TABLE OF ts_airline.',
      target: { name: 'gt_airlines', kind: 'table', label: 'Internal Table gt_airlines', fields: [
        { name: 'CARRID', label: '항공사 코드' }, { name: 'CARRNAME', label: '항공사 이름' }
      ] },
      hints: [
        'SQL 문자열 패턴 검색은 `LIKE` 연산자를 사용합니다.',
        '0글자 이상 와일드카드는 `*`가 아니라 `%`입니다 (`LIKE \'%Airlines\'`).'
      ],
      answers: {
        classic: "SELECT carrid carrname\n  FROM scarr\n  INTO TABLE gt_airlines\n  WHERE carrname LIKE '%Airlines'.",
        new: "SELECT carrid, carrname\n  FROM scarr\n  WHERE carrname LIKE '%Airlines'\n  INTO TABLE @gt_airlines."
      }
    },
    {
      id: 'sql-08', num: '08', category: 'flight-basic', categoryLabel: '항공사 기초', level: '기본', syntax: 'either',
      prompt: 'SPFLI 테이블에서 **중복 없이 출발 국가(`countryfr`) 목록**을 `gt_countries`에 담으세요.',
      tables: ['SPFLI'],
      declarations: 'TYPES: BEGIN OF ts_country,\n         countryfr TYPE spfli-countryfr,\n       END OF ts_country.\nDATA gt_countries TYPE TABLE OF ts_country.',
      target: { name: 'gt_countries', kind: 'table', label: 'Internal Table gt_countries', fields: [
        { name: 'COUNTRYFR', label: '출발 국가' }
      ] },
      hints: [
        '조회 결과의 중복 행을 제거할 때는 `SELECT DISTINCT`를 사용합니다.',
        '`SELECT DISTINCT countryfr FROM spfli ...` 형태로 작성하세요.'
      ],
      answers: {
        classic: 'SELECT DISTINCT countryfr\n  FROM spfli\n  INTO TABLE gt_countries.',
        new: 'SELECT DISTINCT countryfr\n  FROM spfli\n  INTO TABLE @gt_countries.'
      }
    },
    {
      id: 'sql-09', num: '09', category: 'flight-basic', categoryLabel: '항공사 기초', level: '기본', syntax: 'either',
      requireOrder: true,
      prompt: 'SPFLI 테이블에서 모든 노선의 `carrid`, `connid`, `fltime`을 **비행시간(`fltime`) 내림차순**, 비행시간이 같으면 **항공사 코드(`carrid`) 오름차순**으로 정렬해 `gt_sorted`에 담으세요.',
      note: 'JL 0408과 UA 0941은 비행시간이 675분으로 같으므로 2차 정렬 기준이 필요합니다.',
      tables: ['SPFLI'],
      declarations: 'TYPES: BEGIN OF ts_sorted,\n         carrid TYPE spfli-carrid,\n         connid TYPE spfli-connid,\n         fltime TYPE spfli-fltime,\n       END OF ts_sorted.\nDATA gt_sorted TYPE TABLE OF ts_sorted.',
      target: { name: 'gt_sorted', kind: 'table', label: 'Internal Table gt_sorted', fields: [
        { name: 'CARRID', label: '항공사' }, { name: 'CONNID', label: '노선 번호' }, { name: 'FLTIME', label: '비행시간(분)' }
      ] },
      hints: [
        'DB 정렬은 `ORDER BY` 절을 사용하며, 내림차순은 `DESCENDING`, 오름차순은 `ASCENDING`(생략 가능)입니다.',
        '구문법은 `ORDER BY fltime DESCENDING carrid ASCENDING.`, 신문법은 `ORDER BY fltime DESCENDING, carrid ASCENDING`처럼 쉼표로 구분합니다.'
      ],
      answers: {
        classic: 'SELECT carrid connid fltime\n  FROM spfli\n  INTO TABLE gt_sorted\n  ORDER BY fltime DESCENDING carrid ASCENDING.',
        new: 'SELECT carrid, connid, fltime\n  FROM spfli\n  ORDER BY fltime DESCENDING, carrid ASCENDING\n  INTO TABLE @gt_sorted.'
      }
    },
    {
      id: 'sql-10', num: '10', category: 'flight-basic', categoryLabel: '항공사 기초', level: '기본', syntax: 'either',
      requireSingle: true,
      prompt: 'SCARR 테이블에서 **Primary Key `carrid = \'LH\'`인 1건**을 `SELECT SINGLE`로 조회해 구조 변수 `gs_scarr`에 담으세요.',
      tables: ['SCARR'],
      declarations: 'DATA gs_scarr TYPE scarr.',
      target: { name: 'gs_scarr', kind: 'struct', label: 'Work Area gs_scarr', fields: [
        { name: 'CARRID', label: '항공사 코드' }, { name: 'CARRNAME', label: '항공사 이름' }, { name: 'CURRCODE', label: '통화' }
      ] },
      hints: [
        '단건 조회는 `SELECT SINGLE *`와 `INTO gs_scarr`(또는 `INTO @gs_scarr`)를 사용합니다.',
        '단건 구조 변수에 받을 때는 `INTO TABLE`이 아니라 `INTO`를 사용하세요.'
      ],
      answers: {
        classic: "SELECT SINGLE *\n  FROM scarr\n  INTO gs_scarr\n  WHERE carrid = 'LH'.",
        new: "SELECT SINGLE *\n  FROM scarr\n  WHERE carrid = 'LH'\n  INTO @gs_scarr."
      }
    },

    /* ===================== 11–18: 운항 · 예약 응용 ===================== */
    {
      id: 'sql-11', num: '11', category: 'flight-adv', categoryLabel: '운항 · 예약', level: '응용', syntax: 'either',
      requireOrder: true,
      prompt: 'SFLIGHT 테이블에서 **`carrid = \'LH\'`인 운항 중 운임(`price`)이 가장 저렴한 상위 2건**의 `carrid`, `connid`, `fldate`, `price`를 `gt_top2`에 담으세요.',
      note: '정렬 기준 상위 N건은 `ORDER BY`와 `UP TO 2 ROWS`를 함께 사용합니다.',
      tables: ['SFLIGHT'],
      declarations: 'TYPES: BEGIN OF ts_top,\n         carrid TYPE sflight-carrid,\n         connid TYPE sflight-connid,\n         fldate TYPE sflight-fldate,\n         price  TYPE sflight-price,\n       END OF ts_top.\nDATA gt_top2 TYPE TABLE OF ts_top.',
      target: { name: 'gt_top2', kind: 'table', label: 'Internal Table gt_top2', fields: [
        { name: 'CARRID', label: '항공사' }, { name: 'CONNID', label: '노선 번호' }, { name: 'FLDATE', label: '운항일' }, { name: 'PRICE', label: '운임' }
      ] },
      hints: [
        '`WHERE carrid = \'LH\'`와 `ORDER BY price ASCENDING`으로 저렴한 순서를 먼저 맞춥니다.',
        '구문법은 `INTO TABLE gt_top2 UP TO 2 ROWS`, 신문법은 `INTO TABLE @gt_top2 UP TO 2 ROWS.`로 최대 2건만 추출합니다.'
      ],
      answers: {
        classic: "SELECT carrid connid fldate price\n  FROM sflight\n  INTO TABLE gt_top2\n  UP TO 2 ROWS\n  WHERE carrid = 'LH'\n  ORDER BY price ASCENDING.",
        new: "SELECT carrid, connid, fldate, price\n  FROM sflight\n  WHERE carrid = 'LH'\n  ORDER BY price ASCENDING\n  INTO TABLE @gt_top2\n  UP TO 2 ROWS."
      }
    },
    {
      id: 'sql-12', num: '12', category: 'flight-adv', categoryLabel: '운항 · 예약', level: '응용', syntax: 'either',
      prompt: 'SBOOK 테이블에서 **취소되지 않은(`cancelled = \'\'`) 예약의 전체 건수**를 단일 정수 변수 `lv_cnt`에 담으세요.',
      note: '`cancelled = space` 또는 `cancelled = \'\'` 모두 사용할 수 있습니다.',
      tables: ['SBOOK'],
      declarations: 'DATA lv_cnt TYPE i.',
      params: { space: '' },
      target: { name: 'lv_cnt', kind: 'scalar', label: 'Variable lv_cnt', fields: [
        { name: 'CNT', label: '예약 건수' }
      ] },
      hints: [
        '행 개수를 셀 때는 집계 함수 `COUNT( * )`를 사용합니다.',
        '`SELECT COUNT( * ) FROM sbook INTO lv_cnt WHERE cancelled = \'\'.` (신문법은 `INTO @lv_cnt`를 `WHERE` 뒤에 배치)'
      ],
      answers: {
        classic: "SELECT COUNT( * )\n  FROM sbook\n  INTO lv_cnt\n  WHERE cancelled = ''.",
        new: "SELECT COUNT( * )\n  FROM sbook\n  WHERE cancelled = ''\n  INTO @lv_cnt."
      }
    },
    {
      id: 'sql-13', num: '13', category: 'flight-adv', categoryLabel: '운항 · 예약', level: '응용', syntax: 'either',
      requireOrder: true,
      prompt: 'SFLIGHT 테이블에서 **항공사(`carrid`)별 운항 편수(`COUNT( * )`)와 최대 점유 좌석(`MAX( seatsocc )`)**을 구해 `carrid` 오름차순으로 `gt_flight_stat`에 담으세요.',
      tables: ['SFLIGHT'],
      declarations: 'TYPES: BEGIN OF ts_fstat,\n         carrid  TYPE sflight-carrid,\n         cnt     TYPE i,\n         max_occ TYPE sflight-seatsocc,\n       END OF ts_fstat.\nDATA gt_flight_stat TYPE TABLE OF ts_fstat.',
      target: { name: 'gt_flight_stat', kind: 'table', label: 'Internal Table gt_flight_stat', fields: [
        { name: 'CARRID', label: '항공사' }, { name: 'CNT', label: '운항 편수' }, { name: 'MAX_OCC', label: '최대 점유 좌석' }
      ] },
      hints: [
        '항공사별로 묶으려면 `GROUP BY carrid`가 필요합니다.',
        'SELECT 목록의 집계 함수는 `COUNT( * ) AS cnt`, `MAX( seatsocc ) AS max_occ`처럼 작성하고 `ORDER BY carrid`로 정렬하세요.'
      ],
      answers: {
        classic: 'SELECT carrid COUNT( * ) MAX( seatsocc )\n  FROM sflight\n  INTO TABLE gt_flight_stat\n  GROUP BY carrid\n  ORDER BY carrid.',
        new: 'SELECT carrid, COUNT( * ) AS cnt, MAX( seatsocc ) AS max_occ\n  FROM sflight\n  GROUP BY carrid\n  ORDER BY carrid\n  INTO TABLE @gt_flight_stat.'
      }
    },
    {
      id: 'sql-14', num: '14', category: 'flight-adv', categoryLabel: '운항 · 예약', level: '응용', syntax: 'either',
      requireOrder: true,
      prompt: 'SBOOK 테이블에서 **취소되지 않은(`cancelled = \'\'`) 예약**을 항공사(`carrid`)·통화(`loccurkey`)별로 묶어 총 결제 금액(`SUM( loccuram )`)을 구하되, **예약 건수가 2건 이상인 그룹만** `carrid` 오름차순으로 `gt_sales`에 담으세요.',
      tables: ['SBOOK'],
      declarations: 'TYPES: BEGIN OF ts_sales,\n         carrid    TYPE sbook-carrid,\n         loccurkey TYPE sbook-loccurkey,\n         total_amt TYPE sbook-loccuram,\n       END OF ts_sales.\nDATA gt_sales TYPE TABLE OF ts_sales.',
      params: { space: '' },
      target: { name: 'gt_sales', kind: 'table', label: 'Internal Table gt_sales', fields: [
        { name: 'CARRID', label: '항공사' }, { name: 'LOCCURKEY', label: '통화' }, { name: 'TOTAL_AMT', label: '총 결제 금액' }
      ] },
      hints: [
        '집계 전 원본 행 필터는 `WHERE cancelled = \'\'`, 집계 후 그룹 건수 필터는 `HAVING COUNT( * ) >= 2`에 작성합니다.',
        '`GROUP BY`에는 집계하지 않는 일반 컬럼 `carrid`와 `loccurkey`를 모두 명시해야 합니다.'
      ],
      answers: {
        classic: "SELECT carrid loccurkey SUM( loccuram )\n  FROM sbook\n  INTO TABLE gt_sales\n  WHERE cancelled = ''\n  GROUP BY carrid loccurkey\n  HAVING COUNT( * ) >= 2\n  ORDER BY carrid.",
        new: "SELECT carrid, loccurkey, SUM( loccuram ) AS total_amt\n  FROM sbook\n  WHERE cancelled = ''\n  GROUP BY carrid, loccurkey\n  HAVING COUNT( * ) >= 2\n  ORDER BY carrid\n  INTO TABLE @gt_sales."
      }
    },
    {
      id: 'sql-15', num: '15', category: 'flight-adv', categoryLabel: '운항 · 예약', level: '응용', syntax: 'either',
      requireOrder: true,
      prompt: 'SCARR(`a`)와 SPFLI(`b`)를 **`INNER JOIN`**해 각 노선의 `a~carrid`, `a~carrname`, `b~connid`, `b~cityfrom`, `b~cityto`를 `a~carrid`, `b~connid` 오름차순으로 `gt_route_info`에 담으세요.',
      tables: ['SCARR', 'SPFLI'],
      declarations: 'TYPES: BEGIN OF ts_route_info,\n         carrid   TYPE scarr-carrid,\n         carrname TYPE scarr-carrname,\n         connid   TYPE spfli-connid,\n         cityfrom TYPE spfli-cityfrom,\n         cityto   TYPE spfli-cityto,\n       END OF ts_route_info.\nDATA gt_route_info TYPE TABLE OF ts_route_info.',
      target: { name: 'gt_route_info', kind: 'table', label: 'Internal Table gt_route_info', fields: [
        { name: 'CARRID', label: '항공사' }, { name: 'CARRNAME', label: '항공사 이름' }, { name: 'CONNID', label: '노선 번호' }, { name: 'CITYFROM', label: '출발 도시' }, { name: 'CITYTO', label: '도착 도시' }
      ] },
      hints: [
        'ABAP SQL에서는 테이블 별칭 뒤에 물결표(`~`)를 써서 `a~carrid`, `b~cityfrom`처럼 컬럼을 지정합니다.',
        '`FROM scarr AS a INNER JOIN spfli AS b ON a~carrid = b~carrid`로 두 테이블을 연결하세요.'
      ],
      answers: {
        classic: 'SELECT a~carrid a~carrname b~connid b~cityfrom b~cityto\n  FROM scarr AS a\n  INNER JOIN spfli AS b\n    ON a~carrid = b~carrid\n  INTO TABLE gt_route_info\n  ORDER BY a~carrid b~connid.',
        new: 'SELECT a~carrid, a~carrname, b~connid, b~cityfrom, b~cityto\n  FROM scarr AS a\n  INNER JOIN spfli AS b\n    ON a~carrid = b~carrid\n  ORDER BY a~carrid, b~connid\n  INTO TABLE @gt_route_info.'
      }
    },
    {
      id: 'sql-16', num: '16', category: 'flight-adv', categoryLabel: '운항 · 예약', level: '응용', syntax: 'either',
      requireOrder: true,
      prompt: 'SCARR(`a`)를 기준으로 SPFLI(`b`)와 **`LEFT OUTER JOIN`**해 **노선이 없는 항공사(`AZ`)까지 모두 포함**하여 `a~carrid`, `a~carrname`, `b~connid`를 `a~carrid`, `b~connid` 오름차순으로 `gt_all_carr`에 담으세요.',
      note: '일치하는 노선이 없는 항공사의 `connid`는 ABAP 초기값(빈 값)으로 표시됩니다.',
      tables: ['SCARR', 'SPFLI'],
      declarations: 'TYPES: BEGIN OF ts_all_carr,\n         carrid   TYPE scarr-carrid,\n         carrname TYPE scarr-carrname,\n         connid   TYPE spfli-connid,\n       END OF ts_all_carr.\nDATA gt_all_carr TYPE TABLE OF ts_all_carr.',
      target: { name: 'gt_all_carr', kind: 'table', label: 'Internal Table gt_all_carr', fields: [
        { name: 'CARRID', label: '항공사' }, { name: 'CARRNAME', label: '항공사 이름' }, { name: 'CONNID', label: '노선 번호' }
      ] },
      hints: [
        '왼쪽 테이블(`SCARR`)의 모든 행을 유지하려면 `INNER JOIN` 대신 `LEFT OUTER JOIN`을 사용합니다.',
        '`FROM scarr AS a LEFT OUTER JOIN spfli AS b ON a~carrid = b~carrid`'
      ],
      answers: {
        classic: 'SELECT a~carrid a~carrname b~connid\n  FROM scarr AS a\n  LEFT OUTER JOIN spfli AS b\n    ON a~carrid = b~carrid\n  INTO TABLE gt_all_carr\n  ORDER BY a~carrid b~connid.',
        new: 'SELECT a~carrid, a~carrname, b~connid\n  FROM scarr AS a\n  LEFT OUTER JOIN spfli AS b\n    ON a~carrid = b~carrid\n  ORDER BY a~carrid, b~connid\n  INTO TABLE @gt_all_carr.'
      }
    },
    {
      id: 'sql-17', num: '17', category: 'flight-adv', categoryLabel: '운항 · 예약', level: '응용', syntax: 'either',
      requireOrder: true,
      prompt: 'SCUSTOM(`a`) 기준으로 SBOOK(`b`)을 `LEFT OUTER JOIN`해 **모든 고객의 유효 예약 건수(`cancelled = \'\'`)**를 집계하여 `a~id`, `a~name`, `book_cnt`를 `a~id` 오름차순으로 `gt_cust_cnt`에 담으세요.',
      note: '예약이 없거나 취소된 예약만 있는 고객(`00000004`, `00000005`)도 건수 `0`으로 유지되어야 합니다! `COUNT( b~bookid )`와 `ON` 절 필터 위치에 주의하세요.',
      tables: ['SCUSTOM', 'SBOOK'],
      declarations: 'TYPES: BEGIN OF ts_cust_cnt,\n         id       TYPE scustom-id,\n         name     TYPE scustom-name,\n         book_cnt TYPE i,\n       END OF ts_cust_cnt.\nDATA gt_cust_cnt TYPE TABLE OF ts_cust_cnt.',
      params: { space: '' },
      target: { name: 'gt_cust_cnt', kind: 'table', label: 'Internal Table gt_cust_cnt', fields: [
        { name: 'ID', label: '고객 번호' }, { name: 'NAME', label: '고객명' }, { name: 'BOOK_CNT', label: '유효 예약 건수' }
      ] },
      hints: [
        '`b~cancelled = \'\'` 조건을 `WHERE`에 넣으면 예약이 없는 고객 행이 사라집니다. 반드시 `LEFT OUTER JOIN`의 `ON` 절에 함께 쓰세요.',
        '`COUNT( * )`는 오른쪽이 NULL인 행도 1로 셉니다. 실제 예약 건수를 0으로 세려면 `COUNT( b~bookid )`를 사용하세요.'
      ],
      answers: {
        classic: "SELECT a~id a~name COUNT( b~bookid )\n  FROM scustom AS a\n  LEFT OUTER JOIN sbook AS b\n    ON a~id = b~customid\n   AND b~cancelled = ''\n  INTO TABLE gt_cust_cnt\n  GROUP BY a~id a~name\n  ORDER BY a~id.",
        new: "SELECT a~id, a~name, COUNT( b~bookid ) AS book_cnt\n  FROM scustom AS a\n  LEFT OUTER JOIN sbook AS b\n    ON a~id = b~customid\n   AND b~cancelled = ''\n  GROUP BY a~id, a~name\n  ORDER BY a~id\n  INTO TABLE @gt_cust_cnt."
      }
    },
    {
      id: 'sql-18', num: '18', category: 'flight-adv', categoryLabel: '운항 · 예약', level: '응용', syntax: 'either',
      requireOrder: true,
      prompt: 'SCARR(`a`), SPFLI(`b`), SFLIGHT(`c`)를 **3중 `INNER JOIN`**해 **독일(`b~countryfr = \'DE\'`) 출발 노선**의 `a~carrname`, `b~cityto`, `c~fldate`, `c~price`를 `c~fldate` 오름차순으로 `gt_de_flights`에 담으세요.',
      tables: ['SCARR', 'SPFLI', 'SFLIGHT'],
      declarations: 'TYPES: BEGIN OF ts_de_flight,\n         carrname TYPE scarr-carrname,\n         cityto   TYPE spfli-cityto,\n         fldate   TYPE sflight-fldate,\n         price    TYPE sflight-price,\n       END OF ts_de_flight.\nDATA gt_de_flights TYPE TABLE OF ts_de_flight.',
      target: { name: 'gt_de_flights', kind: 'table', label: 'Internal Table gt_de_flights', fields: [
        { name: 'CARRNAME', label: '항공사 이름' }, { name: 'CITYTO', label: '도착 도시' }, { name: 'FLDATE', label: '운항일' }, { name: 'PRICE', label: '운임' }
      ] },
      hints: [
        '`SCARR`와 `SPFLI`는 `carrid`로, `SPFLI`와 `SFLIGHT`는 `carrid`와 `connid` 2개 키로 조인합니다.',
        '`INNER JOIN sflight AS c ON b~carrid = c~carrid AND b~connid = c~connid`'
      ],
      answers: {
        classic: "SELECT a~carrname b~cityto c~fldate c~price\n  FROM scarr AS a\n  INNER JOIN spfli AS b\n    ON a~carrid = b~carrid\n  INNER JOIN sflight AS c\n    ON b~carrid = c~carrid\n   AND b~connid = c~connid\n  INTO TABLE gt_de_flights\n  WHERE b~countryfr = 'DE'\n  ORDER BY c~fldate.",
        new: "SELECT a~carrname, b~cityto, c~fldate, c~price\n  FROM scarr AS a\n  INNER JOIN spfli AS b\n    ON a~carrid = b~carrid\n  INNER JOIN sflight AS c\n    ON b~carrid = c~carrid\n   AND b~connid = c~connid\n  WHERE b~countryfr = 'DE'\n  ORDER BY c~fldate\n  INTO TABLE @gt_de_flights."
      }
    },

    /* ===================== 19–24: ERP 모듈 (MM) ===================== */
    {
      id: 'sql-19', num: '19', category: 'erp', categoryLabel: 'ERP 모듈', level: '기본', syntax: 'either',
      requireOrder: true,
      prompt: 'MARA(자재 마스터)에서 **자재 유형(`mtart`)이 `\'ROH\'`(원자재) 또는 `\'HALB\'`(반제품)**인 자재의 `matnr`, `mtart`, `meins`를 `matnr` 오름차순으로 `gt_mat`에 담으세요.',
      tables: ['MARA'],
      declarations: 'TYPES: BEGIN OF ts_mat,\n         matnr TYPE mara-matnr,\n         mtart TYPE mara-mtart,\n         meins TYPE mara-meins,\n       END OF ts_mat.\nDATA gt_mat TYPE TABLE OF ts_mat.',
      target: { name: 'gt_mat', kind: 'table', label: 'Internal Table gt_mat', fields: [
        { name: 'MATNR', label: '자재 번호' }, { name: 'MTART', label: '자재 유형' }, { name: 'MEINS', label: '기본 단위' }
      ] },
      hints: [
        '`WHERE mtart IN ( \'ROH\', \'HALB\' )` 또는 `WHERE mtart = \'ROH\' OR mtart = \'HALB\'`를 사용하세요.',
        '`ORDER BY matnr`로 자재 번호 오름차순을 맞춥니다.'
      ],
      answers: {
        classic: "SELECT matnr mtart meins\n  FROM mara\n  INTO TABLE gt_mat\n  WHERE mtart IN ( 'ROH', 'HALB' )\n  ORDER BY matnr.",
        new: "SELECT matnr, mtart, meins\n  FROM mara\n  WHERE mtart IN ( 'ROH', 'HALB' )\n  ORDER BY matnr\n  INTO TABLE @gt_mat."
      }
    },
    {
      id: 'sql-20', num: '20', category: 'erp', categoryLabel: 'ERP 모듈', level: '응용', syntax: 'either',
      requireOrder: true,
      prompt: 'MARA(`a`)와 MAKT(`b`)를 `INNER JOIN`해 **한국어(`b~spras = \'KO\'`) 설명이 있는 자재**의 `a~matnr`, `a~mtart`, `b~maktx`를 `a~matnr` 오름차순으로 `gt_mat_ko`에 담으세요.',
      tables: ['MARA', 'MAKT'],
      declarations: 'TYPES: BEGIN OF ts_mat_ko,\n         matnr TYPE mara-matnr,\n         mtart TYPE mara-mtart,\n         maktx TYPE makt-maktx,\n       END OF ts_mat_ko.\nDATA gt_mat_ko TYPE TABLE OF ts_mat_ko.',
      target: { name: 'gt_mat_ko', kind: 'table', label: 'Internal Table gt_mat_ko', fields: [
        { name: 'MATNR', label: '자재 번호' }, { name: 'MTART', label: '자재 유형' }, { name: 'MAKTX', label: '자재 설명' }
      ] },
      hints: [
        'Text Table(`MAKT`)은 언어 키(`spras`)가 Primary Key 일부이므로 `b~spras = \'KO\'` 조건이 없으면 언어 수만큼 행이 중복됩니다.',
        '`INNER JOIN`이므로 `b~spras = \'KO\'`를 `ON` 또는 `WHERE`에 넣어 한국어 내역이 있는 자재만 조회합니다.'
      ],
      answers: {
        classic: "SELECT a~matnr a~mtart b~maktx\n  FROM mara AS a\n  INNER JOIN makt AS b\n    ON a~matnr = b~matnr\n  INTO TABLE gt_mat_ko\n  WHERE b~spras = 'KO'\n  ORDER BY a~matnr.",
        new: "SELECT a~matnr, a~mtart, b~maktx\n  FROM mara AS a\n  INNER JOIN makt AS b\n    ON a~matnr = b~matnr\n  WHERE b~spras = 'KO'\n  ORDER BY a~matnr\n  INTO TABLE @gt_mat_ko."
      }
    },
    {
      id: 'sql-21', num: '21', category: 'erp', categoryLabel: 'ERP 모듈', level: '응용', syntax: 'either',
      requireOrder: true,
      prompt: 'MARA(`a`)를 기준으로 MAKT(`b`)를 **`LEFT OUTER JOIN`**해 **한국어(`b~spras = \'KO\'`) 설명이 없는 자재(`MAT-500`)까지 모두 포함**하여 `a~matnr`, `a~mtart`, `b~maktx`를 `a~matnr` 오름차순으로 `gt_mat_all`에 담으세요.',
      note: '`b~spras = \'KO\'`를 `WHERE`에 두면 `MAT-500`이 탈락합니다. 반드시 `ON` 절에 넣으세요.',
      tables: ['MARA', 'MAKT'],
      declarations: 'TYPES: BEGIN OF ts_mat_all,\n         matnr TYPE mara-matnr,\n         mtart TYPE mara-mtart,\n         maktx TYPE makt-maktx,\n       END OF ts_mat_all.\nDATA gt_mat_all TYPE TABLE OF ts_mat_all.',
      target: { name: 'gt_mat_all', kind: 'table', label: 'Internal Table gt_mat_all', fields: [
        { name: 'MATNR', label: '자재 번호' }, { name: 'MTART', label: '자재 유형' }, { name: 'MAKTX', label: '자재 설명' }
      ] },
      hints: [
        '`LEFT OUTER JOIN makt AS b ON a~matnr = b~matnr AND b~spras = \'KO\'`처럼 오른쪽 테이블 언어 조건을 `ON`에 적어야 왼쪽 모든 자재가 유지됩니다.'
      ],
      answers: {
        classic: "SELECT a~matnr a~mtart b~maktx\n  FROM mara AS a\n  LEFT OUTER JOIN makt AS b\n    ON a~matnr = b~matnr\n   AND b~spras = 'KO'\n  INTO TABLE gt_mat_all\n  ORDER BY a~matnr.",
        new: "SELECT a~matnr, a~mtart, b~maktx\n  FROM mara AS a\n  LEFT OUTER JOIN makt AS b\n    ON a~matnr = b~matnr\n   AND b~spras = 'KO'\n  ORDER BY a~matnr\n  INTO TABLE @gt_mat_all."
      }
    },
    {
      id: 'sql-22', num: '22', category: 'erp', categoryLabel: 'ERP 모듈', level: '응용', syntax: 'either',
      requireOrder: true,
      prompt: 'EKPO(구매오더 품목)에서 **자재 번호(`matnr`)별 총 발주 수량(`SUM( menge )`)과 총 순 금액(`SUM( netwr )`)**을 구해 `matnr` 오름차순으로 `gt_po_sum`에 담으세요.',
      tables: ['EKPO'],
      declarations: 'TYPES: BEGIN OF ts_po_sum,\n         matnr     TYPE ekpo-matnr,\n         tot_menge TYPE ekpo-menge,\n         tot_netwr TYPE ekpo-netwr,\n       END OF ts_po_sum.\nDATA gt_po_sum TYPE TABLE OF ts_po_sum.',
      target: { name: 'gt_po_sum', kind: 'table', label: 'Internal Table gt_po_sum', fields: [
        { name: 'MATNR', label: '자재 번호' }, { name: 'TOT_MENGE', label: '총 발주 수량' }, { name: 'TOT_NETWR', label: '총 순 금액' }
      ] },
      hints: [
        '`GROUP BY matnr`로 자재별 합계를 집계합니다.',
        '`SUM( menge )`, `SUM( netwr )`를 선택하고 `ORDER BY matnr`로 정렬하세요.'
      ],
      answers: {
        classic: 'SELECT matnr SUM( menge ) SUM( netwr )\n  FROM ekpo\n  INTO TABLE gt_po_sum\n  GROUP BY matnr\n  ORDER BY matnr.',
        new: 'SELECT matnr, SUM( menge ) AS tot_menge, SUM( netwr ) AS tot_netwr\n  FROM ekpo\n  GROUP BY matnr\n  ORDER BY matnr\n  INTO TABLE @gt_po_sum.'
      }
    },
    {
      id: 'sql-23', num: '23', category: 'erp', categoryLabel: 'ERP 모듈', level: '응용', syntax: 'either',
      requireOrder: true,
      prompt: 'EKPO(`a`)와 MAKT(`b`, `b~spras = \'KO\'`)를 `INNER JOIN`해 **자재별 총 순 금액(`SUM( a~netwr )`)이 `5000` 이상인 자재**의 `a~matnr`, `b~maktx`, `tot_netwr`를 `a~matnr` 오름차순으로 `gt_big_po`에 담으세요.',
      tables: ['EKPO', 'MAKT'],
      declarations: 'TYPES: BEGIN OF ts_big_po,\n         matnr     TYPE ekpo-matnr,\n         maktx     TYPE makt-maktx,\n         tot_netwr TYPE ekpo-netwr,\n       END OF ts_big_po.\nDATA gt_big_po TYPE TABLE OF ts_big_po.',
      target: { name: 'gt_big_po', kind: 'table', label: 'Internal Table gt_big_po', fields: [
        { name: 'MATNR', label: '자재 번호' }, { name: 'MAKTX', label: '자재 설명' }, { name: 'TOT_NETWR', label: '총 순 금액' }
      ] },
      hints: [
        '`JOIN` 뒤 `GROUP BY a~matnr, b~maktx`(구문법은 공백 구분)로 묶고, 집계 합계 조건은 `HAVING SUM( a~netwr ) >= 5000`에 작성합니다.'
      ],
      answers: {
        classic: "SELECT a~matnr b~maktx SUM( a~netwr )\n  FROM ekpo AS a\n  INNER JOIN makt AS b\n    ON a~matnr = b~matnr\n  INTO TABLE gt_big_po\n  WHERE b~spras = 'KO'\n  GROUP BY a~matnr b~maktx\n  HAVING SUM( a~netwr ) >= 5000\n  ORDER BY a~matnr.",
        new: "SELECT a~matnr, b~maktx, SUM( a~netwr ) AS tot_netwr\n  FROM ekpo AS a\n  INNER JOIN makt AS b\n    ON a~matnr = b~matnr\n  WHERE b~spras = 'KO'\n  GROUP BY a~matnr, b~maktx\n  HAVING SUM( a~netwr ) >= 5000\n  ORDER BY a~matnr\n  INTO TABLE @gt_big_po."
      }
    },
    {
      id: 'sql-24', num: '24', category: 'erp', categoryLabel: 'ERP 모듈', level: '응용', syntax: 'either',
      requireOrder: true,
      prompt: 'MARA(`a`)에서 **EKPO(`b`)에 발주 이력이 1건 이상 존재하는 자재만 중복 없이** `a~matnr`, `a~mtart`를 `a~matnr` 오름차순으로 `gt_ordered`에 담으세요.',
      note: '`WHERE EXISTS ( SELECT * FROM ekpo AS b WHERE b~matnr = a~matnr )` 서브쿼리 패턴을 연습해 보세요.',
      tables: ['MARA', 'EKPO'],
      declarations: 'TYPES: BEGIN OF ts_ordered,\n         matnr TYPE mara-matnr,\n         mtart TYPE mara-mtart,\n       END OF ts_ordered.\nDATA gt_ordered TYPE TABLE OF ts_ordered.',
      target: { name: 'gt_ordered', kind: 'table', label: 'Internal Table gt_ordered', fields: [
        { name: 'MATNR', label: '자재 번호' }, { name: 'MTART', label: '자재 유형' }
      ] },
      hints: [
        '상대 테이블 컬럼을 가져올 필요가 없고 존재 여부만 확인할 때는 `JOIN` 대신 `WHERE EXISTS ( SELECT * FROM ekpo AS b WHERE b~matnr = a~matnr )`가 깔끔합니다.'
      ],
      answers: {
        classic: 'SELECT a~matnr a~mtart\n  FROM mara AS a\n  INTO TABLE gt_ordered\n  WHERE EXISTS ( SELECT * FROM ekpo AS b WHERE b~matnr = a~matnr )\n  ORDER BY a~matnr.',
        new: 'SELECT a~matnr, a~mtart\n  FROM mara AS a\n  WHERE EXISTS ( SELECT * FROM ekpo AS b WHERE b~matnr = a~matnr )\n  ORDER BY a~matnr\n  INTO TABLE @gt_ordered.'
      }
    },

    /* ===================== 25–30: 신문법 (7.40+ Strict Mode) ===================== */
    {
      id: 'sql-25', num: '25', category: 'new-abap', categoryLabel: '신문법', level: '신문법', syntax: 'new',
      requireOrder: true,
      prompt: '**[신문법]** `PARAMETERS p_carr`(현재 값 `\'LH\'`)를 호스트 변수(`@p_carr`)로 사용해 SPFLI에서 해당 항공사의 `carrid`, `connid`, `cityto`를 `connid` 오름차순으로 `gt_lh`에 담으세요.',
      note: '신문법(Strict Mode) 필수 규칙: 쉼표(`,`) 구분 · 모든 ABAP 변수 앞 `@` · `INTO TABLE @gt_lh` 문장 끝 배치',
      tables: ['SPFLI'],
      declarations: "PARAMETERS p_carr TYPE spfli-carrid DEFAULT 'LH'.\nTYPES: BEGIN OF ts_lh,\n         carrid TYPE spfli-carrid,\n         connid TYPE spfli-connid,\n         cityto TYPE spfli-cityto,\n       END OF ts_lh.\nDATA gt_lh TYPE TABLE OF ts_lh.",
      params: { p_carr: 'LH' },
      target: { name: 'gt_lh', kind: 'table', label: 'Internal Table gt_lh', fields: [
        { name: 'CARRID', label: '항공사' }, { name: 'CONNID', label: '노선 번호' }, { name: 'CITYTO', label: '도착 도시' }
      ] },
      hints: [
        '컬럼은 `carrid, connid, cityto`처럼 쉼표로 구분하고 `WHERE carrid = @p_carr`에 `@`를 붙입니다.',
        '`INTO TABLE @gt_lh.`는 반드시 `ORDER BY connid` 뒤(문장 끝)에 배치하세요.'
      ],
      answers: {
        new: 'SELECT carrid, connid, cityto\n  FROM spfli\n  WHERE carrid = @p_carr\n  ORDER BY connid\n  INTO TABLE @gt_lh.'
      }
    },
    {
      id: 'sql-26', num: '26', category: 'new-abap', categoryLabel: '신문법', level: '신문법', syntax: 'new',
      requireOrder: true,
      requireInline: true,
      prompt: '**[신문법]** 별도 `DATA` 선언 없이 **`INTO TABLE @DATA(gt_flights)` 인라인 선언**으로 SFLIGHT에서 `carrid = @p_carr`(`\'LH\'`)인 운항의 `carrid`, `connid`, `fldate`, `price`를 `fldate` 오름차순으로 조회하세요.',
      tables: ['SFLIGHT'],
      declarations: "PARAMETERS p_carr TYPE sflight-carrid DEFAULT 'LH'.\n\" gt_flights는 SELECT 안에서 @DATA(gt_flights)로 인라인 선언하세요.",
      params: { p_carr: 'LH' },
      target: { name: 'gt_flights', kind: 'table', inline: true, label: 'Inline Table @DATA(gt_flights)', fields: [
        { name: 'CARRID', label: '항공사' }, { name: 'CONNID', label: '노선 번호' }, { name: 'FLDATE', label: '운항일' }, { name: 'PRICE', label: '운임' }
      ] },
      hints: [
        '문장 끝에 `INTO TABLE @DATA(gt_flights).`를 작성하면 SELECT 컬럼 목록 구조대로 Internal Table이 자동 선언됩니다.'
      ],
      answers: {
        new: 'SELECT carrid, connid, fldate, price\n  FROM sflight\n  WHERE carrid = @p_carr\n  ORDER BY fldate\n  INTO TABLE @DATA(gt_flights).'
      }
    },
    {
      id: 'sql-27', num: '27', category: 'new-abap', categoryLabel: '신문법', level: '신문법', syntax: 'new',
      requireSingle: true,
      requireInline: true,
      prompt: '**[신문법]** `SELECT SINGLE`과 **`INTO @DATA(gs_carr)` 인라인 선언**으로 SCARR에서 `carrid = @p_carr`(`\'SQ\'`)인 항공사의 `carrid`, `carrname`, `currcode` 1건을 조회하세요.',
      tables: ['SCARR'],
      declarations: "PARAMETERS p_carr TYPE scarr-carrid DEFAULT 'SQ'.\n\" gs_carr는 SELECT 안에서 @DATA(gs_carr)로 인라인 선언하세요.",
      params: { p_carr: 'SQ' },
      target: { name: 'gs_carr', kind: 'struct', inline: true, label: 'Inline Work Area @DATA(gs_carr)', fields: [
        { name: 'CARRID', label: '항공사 코드' }, { name: 'CARRNAME', label: '항공사 이름' }, { name: 'CURRCODE', label: '통화' }
      ] },
      hints: [
        '단건 인라인 선언은 `INTO TABLE @DATA(...)`가 아니라 `INTO @DATA(gs_carr).`를 사용합니다.'
      ],
      answers: {
        new: 'SELECT SINGLE carrid, carrname, currcode\n  FROM scarr\n  WHERE carrid = @p_carr\n  INTO @DATA(gs_carr).'
      }
    },
    {
      id: 'sql-28', num: '28', category: 'new-abap', categoryLabel: '신문법', level: '신문법', syntax: 'new',
      requireOrder: true,
      requireInline: true,
      prompt: '**[신문법]** SFLIGHT에서 `carrid = \'LH\'`인 운항의 `connid`, `fldate`와 **잔여 좌석 `( seatsmax - seatsocc ) AS seatsfree`**를 계산해 `fldate` 오름차순으로 `@DATA(gt_free)`에 담으세요.',
      note: '인라인 선언(`@DATA(...)`)에서 산술 표현식에는 반드시 `AS 별칭`(`AS seatsfree`)이 필요합니다.',
      tables: ['SFLIGHT'],
      declarations: '" 별도 TYPES/DATA 선언 없이 @DATA(gt_free)로 인라인 선언하세요.',
      target: { name: 'gt_free', kind: 'table', inline: true, label: 'Inline Table @DATA(gt_free)', fields: [
        { name: 'CONNID', label: '노선 번호' }, { name: 'FLDATE', label: '운항일' }, { name: 'SEATSFREE', label: '잔여 좌석' }
      ] },
      hints: [
        'SELECT 목록에 `( seatsmax - seatsocc ) AS seatsfree` 산술식을 작성합니다.',
        '`WHERE carrid = \'LH\' ORDER BY fldate INTO TABLE @DATA(gt_free).`'
      ],
      answers: {
        new: "SELECT connid, fldate, ( seatsmax - seatsocc ) AS seatsfree\n  FROM sflight\n  WHERE carrid = 'LH'\n  ORDER BY fldate\n  INTO TABLE @DATA(gt_free)."
      }
    },
    {
      id: 'sql-29', num: '29', category: 'new-abap', categoryLabel: '신문법', level: '신문법', syntax: 'new',
      requireOrder: true,
      requireInline: true,
      prompt: '**[신문법]** SFLIGHT에서 `carrid = \'LH\'`인 운항의 `connid`, `fldate`와 **`CASE` 표현식**으로 `seatsocc >= seatsmax`이면 `\'만석\'`, 아니면 `\'여유\'`를 **`AS seat_status`**로 붙여 `fldate` 오름차순으로 `@DATA(gt_status)`에 담으세요.',
      tables: ['SFLIGHT'],
      declarations: '" CASE WHEN ... THEN ... ELSE ... END AS seat_status 표현식과 @DATA(gt_status)를 사용하세요.',
      target: { name: 'gt_status', kind: 'table', inline: true, label: 'Inline Table @DATA(gt_status)', fields: [
        { name: 'CONNID', label: '노선 번호' }, { name: 'FLDATE', label: '운항일' }, { name: 'SEAT_STATUS', label: '좌석 상태' }
      ] },
      hints: [
        '`CASE WHEN seatsocc >= seatsmax THEN \'만석\' ELSE \'여유\' END AS seat_status`처럼 작성합니다.',
        '표현식 끝의 `END` 뒤에 `AS seat_status` 별칭을 꼭 붙여 주세요.'
      ],
      answers: {
        new: "SELECT connid,\n       fldate,\n       CASE\n         WHEN seatsocc >= seatsmax THEN '만석'\n         ELSE '여유'\n       END AS seat_status\n  FROM sflight\n  WHERE carrid = 'LH'\n  ORDER BY fldate\n  INTO TABLE @DATA(gt_status)."
      }
    },
    {
      id: 'sql-30', num: '30', category: 'new-abap', categoryLabel: '신문법', level: '신문법', syntax: 'new',
      requireOrder: true,
      requireInline: true,
      prompt: '**[신문법 종합]** MARA(`a`)를 기준으로 MAKT(`b`, `b~spras = \'KO\'`)와 EKPO(`c`)를 모두 `LEFT OUTER JOIN`해, 자재별 `a~matnr`, **`COALESCE( b~maktx, \'미등록\' ) AS maktx`**, **`COALESCE( SUM( c~netwr ), 0 ) AS total_amt`**를 `a~matnr` 오름차순으로 `@DATA(gt_summary)`에 담으세요.',
      note: '한국어 내역이 없는 자재는 `\'미등록\'`, 발주 이력이 없는 자재는 합계 `0`으로 표시되는 실무형 리포트 쿼리입니다.',
      tables: ['MARA', 'MAKT', 'EKPO'],
      declarations: '" 다중 LEFT OUTER JOIN + COALESCE + SUM + @DATA(gt_summary)를 한 문장으로 작성하세요.',
      target: { name: 'gt_summary', kind: 'table', inline: true, label: 'Inline Table @DATA(gt_summary)', fields: [
        { name: 'MATNR', label: '자재 번호' }, { name: 'MAKTX', label: '자재 설명' }, { name: 'TOTAL_AMT', label: '발주 총액' }
      ] },
      hints: [
        '`FROM mara AS a LEFT OUTER JOIN makt AS b ON a~matnr = b~matnr AND b~spras = \'KO\' LEFT OUTER JOIN ekpo AS c ON a~matnr = c~matnr`',
        'NULL 치환은 `COALESCE( b~maktx, \'미등록\' ) AS maktx`와 `COALESCE( SUM( c~netwr ), 0 ) AS total_amt`를 사용하고 `GROUP BY a~matnr, b~maktx`로 묶으세요.'
      ],
      answers: {
        new: "SELECT a~matnr,\n       COALESCE( b~maktx, '미등록' ) AS maktx,\n       COALESCE( SUM( c~netwr ), 0 ) AS total_amt\n  FROM mara AS a\n  LEFT OUTER JOIN makt AS b\n    ON a~matnr = b~matnr\n   AND b~spras = 'KO'\n  LEFT OUTER JOIN ekpo AS c\n    ON a~matnr = c~matnr\n  GROUP BY a~matnr, b~maktx\n  ORDER BY a~matnr\n  INTO TABLE @DATA(gt_summary)."
      }
    }
  ];

  window.CodeWikiSqlPracticeBank = { tables, categories, problems };
})();
