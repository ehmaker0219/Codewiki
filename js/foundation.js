/* Owner-only ABAP1 classic syntax foundation template (이은호 student account only). */
(() => {
  const OWNER_ID = '2eafc83d-09cd-4ea6-98a8-9bbb1ebdeb06';
  const TEMPLATE_HEAD = [
    '*&---------------------------------------------------------------------*',
    '*& Report ZABAP_F##_##',
    '*&---------------------------------------------------------------------*',
    '*& ABAP1 (BC400/BC430) 100% 구문법 통합 파운데이션 템플릿',
    '*&---------------------------------------------------------------------*',
    'REPORT zabap_f##_##.',
    '* Custom Message Class 사용 시 위 줄 대신 아래 사용:',
    '* REPORT zabap_f##_## MESSAGE-ID zmsg_f##.',
    '',
    '*======================================================================*',
    '* 1. TYPES 선언 (Structure, Table Type, Range Type)',
    '*======================================================================*',
    'TYPES ty_rate TYPE p LENGTH 5 DECIMALS 2.',
    '',
    'TYPES: BEGIN OF ts_output,',
    '         carrid       TYPE scarr-carrid,',
    '         carrname     TYPE scarr-carrname,',
    '         connid       TYPE sflight-connid,',
    '         cityfrom     TYPE spfli-cityfrom,',
    '         cityto       TYPE spfli-cityto,',
    '         fldate       TYPE sflight-fldate,',
    '         seatsmax     TYPE sflight-seatsmax,',
    '         seatsocc     TYPE sflight-seatsocc,',
    '         seats_remain TYPE i,',
    '         occ_rate     TYPE ty_rate,',
    '         status       TYPE char10,',
    '       END OF ts_output.',
    '',
    '* SE11 Structure 확장 시 참고:',
    '* TYPES: BEGIN OF ts_output.',
    '*          INCLUDE TYPE zbs_flight_f##.',
    '* TYPES:   status TYPE char10,',
    '*        END OF ts_output.',
    '',
    'TYPES: tt_output TYPE TABLE OF ts_output,',
    '       tt_car    TYPE RANGE OF scarr-carrid,',
    '       tt_fdt    TYPE RANGE OF sflight-fldate.',
    '',
    '*======================================================================*',
    '* 2. DATA 선언 (Internal Table, Work Area, 변수, 객체 참조)',
    '*======================================================================*',
    'DATA: gt_output TYPE tt_output,',
    '      gs_output LIKE LINE OF gt_output,',
    '      go_salv   TYPE REF TO cl_salv_table,',
    '      gv_cnt    TYPE i,',
    '      gv_cnt_c  TYPE c LENGTH 10,',
    '      gv_msg    TYPE string.',
    '',
    '* 정렬 / 해시 테이블 선언 참고:',
    '* DATA gt_sorted TYPE SORTED TABLE OF scarr WITH NON-UNIQUE KEY carrid.',
    '* DATA gt_hashed TYPE HASHED TABLE OF scarr WITH UNIQUE KEY carrid.',
    '',
    '*======================================================================*',
    '* 3. Local Class 정의 & 구현 (필요 시 활용)',
    '*======================================================================*',
    'CLASS lcl_flight DEFINITION.',
    '  PUBLIC SECTION.',
    '    CLASS-METHODS calc_rate',
    '      IMPORTING iv_max  TYPE s_seatsmax',
    '                iv_occ  TYPE s_seatsocc',
    '      EXPORTING ev_rate TYPE ty_rate.',
    'ENDCLASS.',
    '',
    'CLASS lcl_flight IMPLEMENTATION.',
    '  METHOD calc_rate.',
    '    " 0으로 나누기 방지 (COMPUTE_INT_ZERODIVIDE 예방)',
    '    IF iv_max > 0.',
    '      ev_rate = ( iv_occ / iv_max ) * 100.',
    '    ELSE.',
    '      ev_rate = 0.',
    '    ENDIF.',
    '  ENDMETHOD.',
    'ENDCLASS.',
    '',
    '*======================================================================*',
    '* 4. Selection Screen (입력 화면)',
    '*======================================================================*',
    'SELECTION-SCREEN BEGIN OF BLOCK b1 WITH FRAME TITLE TEXT-001.',
    '  SELECT-OPTIONS:',
    '    so_car FOR gs_output-carrid,',
    '    so_fdt FOR gs_output-fldate.',
    '',
    '  PARAMETERS:',
    '    pa_year TYPE c LENGTH 4,',
    '    pa_chk  AS CHECKBOX DEFAULT \'X\',',
    '    pa_r1   RADIOBUTTON GROUP rg1 DEFAULT \'X\',',
    '    pa_r2   RADIOBUTTON GROUP rg1.',
    '',
    '  " Search Help 연결 시 참고:',
    '  " PARAMETERS pa_sh TYPE s_carr_id MATCHCODE OBJECT zsh_carr_f##.',
    'SELECTION-SCREEN END OF BLOCK b1.',
    '',
    '*======================================================================*',
    '* 5. INITIALIZATION (화면 표시 전 기본값 세팅)',
    '*======================================================================*',
    'INITIALIZATION.',
    '  " 1) 단일값 기본 세팅 (EQ)',
    '  CLEAR so_car.',
    '  so_car-sign   = \'I\'.',
    '  so_car-option = \'EQ\'.',
    '  so_car-low    = \'AA\'.',
    '  APPEND so_car.',
    '',
    '  " 2) 범위 기본 세팅 (BT: 올해 1월 1일 ~ 12월 31일)',
    '  CLEAR so_fdt.',
    '  so_fdt-sign   = \'I\'.',
    '  so_fdt-option = \'BT\'.',
    '  CONCATENATE sy-datum+0(4) \'0101\' INTO so_fdt-low.',
    '  CONCATENATE sy-datum+0(4) \'1231\' INTO so_fdt-high.',
    '  APPEND so_fdt.',
    '',
    '  " 3) 올해 연도 4자리',
    '  pa_year = sy-datum+0(4).',
    '',
    '*======================================================================*',
    '* 6. AT SELECTION-SCREEN (입력값 검증)',
    '*======================================================================*',
    'AT SELECTION-SCREEN.',
    '  IF so_car[] IS INITIAL AND so_fdt[] IS INITIAL.',
    '    MESSAGE \'항공사 또는 운항일자 조건을 하나 이상 입력하세요.\' TYPE \'E\'.',
    '    " Custom Message Class 사용 시: MESSAGE e000.',
    '  ENDIF.',
    '',
    '*======================================================================*',
    '* 7. START-OF-SELECTION (데이터 조회 및 가공)',
    '*======================================================================*',
    'START-OF-SELECTION.',
    '  PERFORM get_data     USING    so_car[]',
    '                                so_fdt[]',
    '                       CHANGING gt_output.',
    '',
    '  IF gt_output IS INITIAL.',
    '    MESSAGE \'조회된 데이터가 없습니다.\' TYPE \'S\' DISPLAY LIKE \'E\'.',
    '    " Custom Message Class 사용 시: MESSAGE s001 DISPLAY LIKE \'E\'.',
    '    LEAVE LIST-PROCESSING.',
    '  ENDIF.',
    '',
    '  PERFORM process_data CHANGING gt_output.',
    '',
    '*======================================================================*',
    '* 8. END-OF-SELECTION (화면 출력)',
    '*======================================================================*',
    'END-OF-SELECTION.',
    '  DESCRIBE TABLE gt_output LINES gv_cnt.',
    '  gv_cnt_c = gv_cnt.',
    '  CONDENSE gv_cnt_c.',
    '  CONCATENATE \'총\' gv_cnt_c \'건 조회되었습니다.\' INTO gv_msg SEPARATED BY space.',
    '  MESSAGE gv_msg TYPE \'S\'.',
    '  " Custom Message Class 사용 시: MESSAGE s002 WITH gv_cnt.',
    ''
  ];

  const END_OF_SELECTION_CALL = {
    salv: [
      '  PERFORM display_salv CHANGING gt_output.',
      '',
      '  " CL_DEMO_OUTPUT으로 출력 시 위 줄 대신 아래 사용:',
      '  " PERFORM display_demo USING gt_output.',
      '  " 단축 호출: cl_demo_output=>display( gt_output ).',
      ''
    ],
    demo: [
      '  PERFORM display_demo USING gt_output.',
      '',
      '  " 단축 호출 (Subroutine 없이 바로 출력):',
      '  " cl_demo_output=>display( gt_output ).',
      '  " ALV(CL_SALV_TABLE) 출력 시 위 줄 대신 아래 사용:',
      '  " PERFORM display_salv CHANGING gt_output.',
      ''
    ]
  };

  const TEMPLATE_TAIL = [
    '*======================================================================*',
    '* 9. FORM (Subroutine 구현부)',
    '*======================================================================*',
    'FORM get_data USING    pt_car    TYPE tt_car',
    '                       pt_fdt    TYPE tt_fdt',
    '              CHANGING pt_output TYPE tt_output.',
    '',
    '  " 3개 테이블 INNER JOIN 조회 (구문법: 쉼표·@ 없음)',
    '  SELECT a~carrid',
    '         b~carrname',
    '         a~connid',
    '         c~cityfrom',
    '         c~cityto',
    '         a~fldate',
    '         a~seatsmax',
    '         a~seatsocc',
    '    INTO CORRESPONDING FIELDS OF TABLE pt_output',
    '    FROM sflight AS a',
    '    INNER JOIN scarr AS b',
    '      ON a~carrid = b~carrid',
    '    INNER JOIN spfli AS c',
    '      ON a~carrid = c~carrid',
    '     AND a~connid = c~connid',
    '    WHERE a~carrid IN pt_car',
    '      AND a~fldate IN pt_fdt.',
    '',
    '*----------------------------------------------------------------------*',
    '* [참고용 구문법 Open SQL 스니펫 모음]',
    '*',
    '* 1) 단건 조회 (SELECT SINGLE):',
    '*   DATA ls_scarr TYPE scarr.',
    '*   SELECT SINGLE carrid carrname',
    '*     INTO CORRESPONDING FIELDS OF ls_scarr',
    '*     FROM scarr',
    '*     WHERE carrid = \'AA\'.',
    '*',
    '* 2) 연도 LIKE 검색 (\'2026%\'):',
    '*   DATA lv_year TYPE c LENGTH 5.',
    '*   CONCATENATE pa_year \'%\' INTO lv_year.',
    '*   SELECT carrid fldate paymentsum',
    '*     INTO CORRESPONDING FIELDS OF TABLE lt_data',
    '*     FROM sflight',
    '*     WHERE fldate LIKE lv_year.',
    '*',
    '* 3) GROUP BY + SUM 집계:',
    '*   SELECT carrid SUM( paymentsum ) AS total_sum',
    '*     INTO CORRESPONDING FIELDS OF TABLE lt_sum',
    '*     FROM sflight',
    '*     WHERE carrid IN pt_car',
    '*     GROUP BY carrid.',
    '*',
    '* 4) FOR ALL ENTRIES (반드시 IS NOT INITIAL 체크 선행!):',
    '*   IF lt_scarr IS NOT INITIAL.',
    '*     SELECT carrid connid fldate',
    '*       INTO CORRESPONDING FIELDS OF TABLE lt_sflight',
    '*       FROM sflight',
    '*       FOR ALL ENTRIES IN lt_scarr',
    '*       WHERE carrid = lt_scarr-carrid.',
    '*   ENDIF.',
    '*----------------------------------------------------------------------*',
    'ENDFORM.',
    '',
    'FORM process_data CHANGING pt_output TYPE tt_output.',
    '  DATA ls_line LIKE LINE OF pt_output.',
    '',
    '  LOOP AT pt_output INTO ls_line.',
    '    " 1) 잔여 좌석 & 점유율 계산 (Local Class Static Method 호출)',
    '    ls_line-seats_remain = ls_line-seatsmax - ls_line-seatsocc.',
    '',
    '    CALL METHOD lcl_flight=>calc_rate',
    '      EXPORTING',
    '        iv_max  = ls_line-seatsmax',
    '        iv_occ  = ls_line-seatsocc',
    '      IMPORTING',
    '        ev_rate = ls_line-occ_rate.',
    '',
    '    " 2) 조건 분기 (IF / ELSEIF / ELSE)',
    '    IF ls_line-occ_rate >= 80.',
    '      ls_line-status = \'매진임박\'.',
    '    ELSEIF ls_line-occ_rate >= 50.',
    '      ls_line-status = \'보통\'.',
    '    ELSE.',
    '      ls_line-status = \'여유\'.',
    '    ENDIF.',
    '',
    '    " 3) 날짜 오프셋 & CASE 분기 참고:',
    '    " CASE ls_line-fldate+4(2).',
    '    "   WHEN \'01\'. ...',
    '    "   WHEN OTHERS.',
    '    " ENDCASE.',
    '',
    '    " 4) Internal Table 현재 행 반영 (INDEX 생략 권장)',
    '    MODIFY pt_output FROM ls_line.',
    '    CLEAR ls_line.',
    '  ENDLOOP.',
    '',
    '  " 조건 삭제 참고:',
    '  " DELETE pt_output WHERE status = \'여유\'.',
    '',
    '  " 다중 정렬 (항공사 오름차순, 점유율 내림차순)',
    '  SORT pt_output BY carrid   ASCENDING',
    '                    occ_rate DESCENDING.',
    '',
    '*----------------------------------------------------------------------*',
    '* [참고용 구문법 READ TABLE + BINARY SEARCH / Function Module 호출]',
    '*',
    '* 1) SORT 후 BINARY SEARCH:',
    '*   DATA ls_scarr TYPE scarr.',
    '*   SORT lt_scarr BY carrid ASCENDING.',
    '*   READ TABLE lt_scarr INTO ls_scarr',
    '*     WITH KEY carrid = ls_line-carrid',
    '*     BINARY SEARCH.',
    '*   IF sy-subrc = 0.',
    '*     ...',
    '*   ENDIF.',
    '*',
    '* 2) Function Module 호출:',
    '*   CALL FUNCTION \'ZFM_SAMPLE_F##\'',
    '*     EXPORTING',
    '*       iv_carrid = ls_line-carrid',
    '*     IMPORTING',
    '*       ev_name   = lv_name',
    '*     EXCEPTIONS',
    '*       not_found = 1',
    '*       OTHERS    = 2.',
    '*----------------------------------------------------------------------*',
    'ENDFORM.',
    '',
    'FORM display_demo USING pt_output TYPE tt_output.',
    '  " 1) 구문법 정식 호출 (CL_DEMO_OUTPUT=>DISPLAY)',
    '  CALL METHOD cl_demo_output=>display',
    '    EXPORTING',
    '      data = pt_output.',
    '',
    '  " 2) 단축 호출:',
    '  " cl_demo_output=>display( pt_output ).',
    '',
    '  " 3) 제목 지정 / 여러 테이블 순차 출력 참고:',
    '  " CALL METHOD cl_demo_output=>begin_section',
    '  "   EXPORTING',
    '  "     title = \'항공편 좌석 점유율 조회 결과\'.',
    '  " CALL METHOD cl_demo_output=>write_data',
    '  "   EXPORTING',
    '  "     value = pt_output',
    '  "     name  = \'GT_OUTPUT\'.',
    '  " CALL METHOD cl_demo_output=>display.',
    'ENDFORM.',
    '',
    'FORM display_salv CHANGING pt_output TYPE tt_output.',
    '  DATA: lo_cols  TYPE REF TO cl_salv_columns_table,',
    '        lo_col   TYPE REF TO cl_salv_column,',
    '        lo_funcs TYPE REF TO cl_salv_functions_list.',
    '',
    '  TRY.',
    '      CALL METHOD cl_salv_table=>factory',
    '        IMPORTING',
    '          r_salv_table = go_salv',
    '        CHANGING',
    '          t_table      = pt_output.',
    '',
    '      " 1) 컬럼 너비 자동 맞춤 + 컬럼 제목 변경',
    '      CALL METHOD go_salv->get_columns',
    '        RECEIVING',
    '          value = lo_cols.',
    '',
    '      CALL METHOD lo_cols->set_optimize',
    '        EXPORTING',
    '          value = abap_true.',
    '',
    '      TRY.',
    '          CALL METHOD lo_cols->get_column',
    '            EXPORTING',
    '              columnname = \'STATUS\' " 컬럼명은 대문자!',
    '            RECEIVING',
    '              value      = lo_col.',
    '',
    '          CALL METHOD lo_col->set_short_text',
    '            EXPORTING',
    '              value = \'상태\'.',
    '',
    '          CALL METHOD lo_col->set_medium_text',
    '            EXPORTING',
    '              value = \'좌석 상태\'.',
    '',
    '          CALL METHOD lo_col->set_long_text',
    '            EXPORTING',
    '              value = \'항공편 좌석 상태\'.',
    '        CATCH cx_salv_not_found.',
    '      ENDTRY.',
    '',
    '      " 2) 상단 기본 툴바(정렬·필터·엑셀 다운로드) 활성화',
    '      CALL METHOD go_salv->get_functions',
    '        RECEIVING',
    '          value = lo_funcs.',
    '',
    '      CALL METHOD lo_funcs->set_all',
    '        EXPORTING',
    '          value = abap_true.',
    '',
    '      " 3) 화면 출력',
    '      CALL METHOD go_salv->display.',
    '',
    '    CATCH cx_salv_msg.',
    '  ENDTRY.',
    'ENDFORM.'
  ];

  function buildTemplate(mode = 'salv') {
    const callLines = mode === 'demo' ? END_OF_SELECTION_CALL.demo : END_OF_SELECTION_CALL.salv;
    return [...TEMPLATE_HEAD, ...callLines, ...TEMPLATE_TAIL].join('\n');
  }

  const SHORT_LABELS = {
    1: '1. TYPES',
    2: '2. DATA',
    3: '3. Local Class',
    4: '4. Selection Screen',
    5: '5. INITIALIZATION',
    6: '6. AT SELECTION-SCREEN',
    7: '7. START-OF-SELECTION',
    8: '8. END-OF-SELECTION',
    9: '9. FORM'
  };

  const RELATED_DOCS = [
    { id: 'basic-session-review', label: 'Basic Session Review' },
    { id: 'abap-sql-guide', mode: 'classic', label: 'ABAP SQL 가이드 (구문법)' },
    { id: 'unit-04', label: 'BC400 Unit 4 · Modularization' },
    { id: 'unit-05', label: 'BC400 Unit 5 · Structure & Internal Table' },
    { id: 'unit-06', label: 'BC400 Unit 6 · Open SQL & JOIN' },
    { id: 'unit-07', label: 'BC400 Unit 7 · Classic ABAP Reports' },
    { id: 'unit-09', label: 'BC400 Unit 9 · CL_SALV_TABLE (ALV)' },
    { id: 'bc430-09', label: 'BC430 Unit 9 · Search Help' }
  ];

  function parseParts(raw) {
    const lines = raw.split('\n');
    const starts = [];
    for (let i = 0; i < lines.length - 1; i++) {
      if (lines[i].startsWith('*===') && /^\* (\d+)\.\s+(.+)$/.test(lines[i + 1])) {
        const m = lines[i + 1].match(/^\* (\d+)\.\s+(.+)$/);
        starts.push({ num: Number(m[1]), title: m[2].trim(), startIdx: i });
      }
    }
    const parts = [];
    if (starts.length && starts[0].startIdx > 0) {
      parts.push({
        id: 'part-0',
        num: 0,
        shortLabel: '0. REPORT 선언부',
        title: 'Report 선언부 (REPORT / MESSAGE-ID)',
        startLine: 1,
        endLine: starts[0].startIdx,
        code: lines.slice(0, starts[0].startIdx).join('\n')
      });
    }
    starts.forEach((entry, idx) => {
      const endIdx = idx + 1 < starts.length ? starts[idx + 1].startIdx : lines.length;
      parts.push({
        id: `part-${entry.num}`,
        num: entry.num,
        shortLabel: SHORT_LABELS[entry.num] || `${entry.num}. ${entry.title}`,
        title: entry.title,
        startLine: entry.startIdx + 1,
        endLine: endIdx,
        code: lines.slice(entry.startIdx, endIdx).join('\n')
      });
    });
    return parts;
  }

  const TEMPLATES = {
    salv: buildTemplate('salv'),
    demo: buildTemplate('demo')
  };
  const PARTS_BY_MODE = {
    salv: parseParts(TEMPLATES.salv),
    demo: parseParts(TEMPLATES.demo)
  };

  function findFormLine(raw, formName) {
    const lines = raw.split('\n');
    const idx = lines.findIndex(line => line.startsWith(`FORM ${formName} `));
    return idx >= 0 ? idx + 1 : 0;
  }

  const host = document.getElementById('foundationPage');
  const trigger = document.getElementById('openFoundationBtn');
  const shell = document.getElementById('appShell');

  let session = null;
  let activeTab = 'full';
  let outputMode = 'salv'; // 'salv' | 'demo'
  let mounted = false;
  let focusTimer = null;
  const copyTimers = new WeakMap();

  const currentTemplate = () => TEMPLATES[outputMode] || TEMPLATES.salv;
  const currentParts = () => PARTS_BY_MODE[outputMode] || PARTS_BY_MODE.salv;

  function esc(value) {
    if (window.CodeWikiLearning?.escape) return window.CodeWikiLearning.escape(value ?? '');
    return String(value ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function renderCodeHtml(raw, startLine = 1) {
    const renderer = window.CodeWikiApp?.renderEditorCode;
    if (typeof renderer === 'function') {
      const html = renderer(raw, true, true);
      if (startLine === 1) return html;
      let lineNo = startLine;
      return html.replace(/<span class="sap-code-number" aria-hidden="true">\d+<\/span>/g, () =>
        `<span class="sap-code-number" aria-hidden="true">${lineNo++}</span>`
      );
    }
    return String(raw).split('\n').map((line, i) =>
      `<span class="sap-code-line"><span class="sap-code-number" aria-hidden="true">${startLine + i}</span><span class="sap-code-source">${esc(line)}</span></span>`
    ).join('\n');
  }

  function hasFoundationGrant(subject) {
    if (!subject || !subject.id) return false;
    if (subject.tools && typeof subject.tools === 'object' && typeof subject.tools.foundation === 'boolean') {
      return subject.tools.foundation;
    }
    return subject.id === OWNER_ID;
  }

  function resolveAccess(user) {
    if (!user) return null;
    if (window.CodeWikiAuth && typeof window.CodeWikiAuth.getSessionToken === 'function' && !window.CodeWikiAuth.getSessionToken()) {
      return null;
    }
    if (user.role === 'student' && user.status === 'approved' && hasFoundationGrant(user)) {
      return { id: user.id, name: user.full_name || '학생', preview: false };
    }
    if (user.role === 'admin' && Boolean(window.CodeWikiAuth?.isAdminPreviewMode?.())) {
      const previewStu = window.CodeWikiAuth?.getAdminPreviewStudent?.();
      if (hasFoundationGrant(previewStu)) {
        return { id: previewStu.id, name: previewStu.full_name || '학생', preview: true };
      }
    }
    return null;
  }

  function isEligible(user) {
    return Boolean(resolveAccess(user));
  }

  function visible() {
    return Boolean(session) && window.location.hash === '#foundation';
  }

  async function copyText(text) {
    if (navigator?.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
    if (typeof document.createElement === 'function' && document.body && typeof document.execCommand === 'function') {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.append(ta);
      ta.select?.();
      const ok = document.execCommand('copy');
      ta.remove();
      return Boolean(ok);
    }
    return false;
  }

  function announceStatus(message) {
    const el = host?.querySelector('#foundationCopyStatus');
    if (el) el.textContent = message;
  }

  function flashButton(btn, successText) {
    if (!btn) return;
    const prev = btn.dataset.origLabel || btn.textContent;
    btn.dataset.origLabel = prev;
    btn.textContent = successText;
    btn.classList.add('is-copied');
    const prevTimer = copyTimers.get(btn);
    if (prevTimer) clearTimeout(prevTimer);
    copyTimers.set(btn, setTimeout(() => {
      btn.textContent = btn.dataset.origLabel || prev;
      btn.classList.remove('is-copied');
    }, 1800));
  }

  function jumpToLine(lineNumber) {
    const codeRoot = host?.querySelector('#foundationFullCode');
    if (!codeRoot) return;
    const lines = codeRoot.querySelectorAll?.('.sap-code-line');
    if (!lines || !lines.length) return;
    const idx = Math.max(0, Math.min(lines.length - 1, lineNumber - 1));
    codeRoot.querySelectorAll('.sap-code-line.foundation-line-focus').forEach(el => el.classList.remove('foundation-line-focus'));
    for (let offset = 0; offset < 3 && idx + offset < lines.length; offset++) {
      lines[idx + offset].classList.add('foundation-line-focus');
    }
    lines[idx].scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    clearTimeout(focusTimer);
    focusTimer = setTimeout(() => {
      codeRoot.querySelectorAll('.sap-code-line.foundation-line-focus').forEach(el => el.classList.remove('foundation-line-focus'));
    }, 2200);
  }

  function renderFullPanel() {
    const raw = currentTemplate();
    const parts = currentParts();
    const totalLines = raw.split('\n').length;
    const numberedParts = parts.filter(p => p.num > 0);
    const demoLine = findFormLine(raw, 'display_demo');
    const salvLine = findFormLine(raw, 'display_salv');
    const modeLabel = outputMode === 'demo' ? 'CL_DEMO_OUTPUT 출력' : 'CL_SALV_TABLE (ALV) 출력';
    return `
      <div class="foundation-jump-bar" role="navigation" aria-label="템플릿 파트 바로가기">
        <span class="foundation-jump-label">파트 이동</span>
        ${numberedParts.map(p =>
          `<button type="button" class="foundation-jump-chip" data-jump-line="${p.startLine}" title="L${p.startLine}–L${p.endLine} · ${esc(p.title)}">${esc(p.shortLabel)}</button>`
        ).join('')}
        ${demoLine ? `<button type="button" class="foundation-jump-chip foundation-jump-accent" data-jump-line="${demoLine}" title="L${demoLine} · FORM display_demo (CL_DEMO_OUTPUT)">CL_DEMO_OUTPUT</button>` : ''}
        ${salvLine ? `<button type="button" class="foundation-jump-chip foundation-jump-accent" data-jump-line="${salvLine}" title="L${salvLine} · FORM display_salv (CL_SALV_TABLE)">CL_SALV_TABLE</button>` : ''}
      </div>
      <div class="block-code-wrap foundation-code-card">
        <div class="code-top-bar">
          <span>REPORT ZABAP_F##_## · ${modeLabel} (${totalLines} lines)</span>
          <button type="button" class="copy-code-btn" data-copy-target="full">전체 복사</button>
        </div>
        <pre id="foundationFullCode"><code>${renderCodeHtml(raw, 1)}</code></pre>
      </div>
    `;
  }

  function renderPartsPanel() {
    const parts = currentParts();
    return `
      <div class="foundation-part-list">
        ${parts.map(p => {
          const badge = p.num === 0 ? 'HEADER' : `PART ${String(p.num).padStart(2, '0')}`;
          return `
            <article class="foundation-part-card" data-part-id="${esc(p.id)}">
              <div class="foundation-part-head">
                <div class="foundation-part-title-wrap">
                  <span class="foundation-part-badge">${badge}</span>
                  <h2>${esc(p.title)}</h2>
                  <span class="foundation-line-range">L${p.startLine}–L${p.endLine}</span>
                </div>
                <button type="button" class="toss-chip-btn foundation-part-copy-btn" data-copy-target="${esc(p.id)}">이 파트 복사</button>
              </div>
              <div class="block-code-wrap foundation-part-code">
                <pre><code>${renderCodeHtml(p.code.replace(/\n+$/, ''), p.startLine)}</code></pre>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    `;
  }

  function render() {
    if (!host || !session) return;
    mounted = true;
    const isFull = activeTab === 'full';
    const isDemo = outputMode === 'demo';
    const totalLines = currentTemplate().split('\n').length;
    const relatedHtml = RELATED_DOCS.map(item => {
      const attrs = item.mode
        ? `href="#doc/${esc(item.id)}/${esc(item.mode)}" data-doc="${esc(item.id)}" data-doc-mode="${esc(item.mode)}"`
        : `href="#doc/${esc(item.id)}" data-doc="${esc(item.id)}"`;
      return `<a class="foundation-related-chip" ${attrs}>${esc(item.label)}</a>`;
    }).join('');

    host.innerHTML = `
      <header class="foundation-header">
        <div>
          <span class="foundation-eyebrow">ABAP1 · 100% CLASSIC SYNTAX</span>
          <h1>파운데이션</h1>
          <p>BC400 · BC430 100% 구문법 통합 Report 템플릿 (<code>REPORT zabap_f##_##.</code> · <code>CL_SALV_TABLE</code> / <code>CL_DEMO_OUTPUT</code>)</p>
        </div>
        <div class="foundation-header-actions">
          <span class="foundation-meta-pill">${totalLines} lines · 9 Parts</span>
          <button type="button" class="toss-primary-btn foundation-copy-all-btn" data-copy-target="full">전체 코드 복사</button>
        </div>
      </header>

      <div class="foundation-toolbar">
        <div class="foundation-toolbar-group">
          <div class="foundation-tabs" role="tablist" aria-label="파운데이션 보기 방식">
            <button type="button" role="tab" class="foundation-tab-btn${isFull ? ' active' : ''}" data-foundation-tab="full" aria-selected="${isFull}">전체 통합 템플릿</button>
            <button type="button" role="tab" class="foundation-tab-btn${!isFull ? ' active' : ''}" data-foundation-tab="parts" aria-selected="${!isFull}">파트별 복사 (9개)</button>
          </div>
          <div class="foundation-tabs foundation-output-switch" role="group" aria-label="기본 출력 방식 선택">
            <button type="button" class="foundation-tab-btn${!isDemo ? ' active' : ''}" data-output-mode="salv" aria-pressed="${!isDemo}">CL_SALV_TABLE (ALV)</button>
            <button type="button" class="foundation-tab-btn${isDemo ? ' active' : ''}" data-output-mode="demo" aria-pressed="${isDemo}">CL_DEMO_OUTPUT</button>
          </div>
        </div>
        <span id="foundationCopyStatus" class="foundation-copy-status" role="status" aria-live="polite"></span>
      </div>

      <div id="foundationPanel" class="foundation-panel">
        ${isFull ? renderFullPanel() : renderPartsPanel()}
      </div>

      <section class="foundation-related-card" aria-label="관련 문서">
        <div class="foundation-related-head">
          <span>관련 문서</span>
          <small>템플릿에 포함된 핵심 구문법 단원으로 바로 이동합니다.</small>
        </div>
        <div class="foundation-related-links">${relatedHtml}</div>
      </section>
    `;
  }

  function route() {
    if (!host || !trigger) return;
    const open = visible();
    const entering = open && host.hidden;
    host.hidden = !open;
    shell?.classList.toggle('foundation-hidden', open);
    trigger.classList.toggle('active', open);
    if (!open) return;

    window.CodeWikiBoard?.closeIfActive?.();
    window.CodeWikiAdminMembers?.leave?.();
    window.CodeWikiStudy?.leave?.();
    window.CodeWikiMentoring?.leave?.();
    window.CodeWikiObjectGame?.leave?.();
    window.CodeWikiKnowledgeMap?.leave?.();
    document.querySelectorAll('#sbHomeItem.active,#sbScheduleItem.active,#sbThinkingFlowItem.active,#sbProgramCatalogItem.active,#sbBasicSessionItem.active,#sbSqlGuideItem.active,.nav-doc-link.active').forEach(el => el.classList.remove('active'));
    document.getElementById('quizModeBtn')?.classList.add('hidden');
    if (!mounted) render();
    if (entering) window.scrollTo?.({ top: 0, behavior: 'instant' });
  }

  function setUser(user) {
    const next = resolveAccess(user);
    if (next && session?.id === next.id && session.preview === next.preview) {
      if (trigger) trigger.hidden = false;
      route();
      return;
    }
    session = next;
    mounted = false;
    activeTab = 'full';
    outputMode = 'salv';
    clearTimeout(focusTimer);
    if (trigger) {
      trigger.hidden = !session;
      trigger.classList.remove('active');
    }
    if (!session) {
      if (host) {
        host.hidden = true;
        host.replaceChildren();
      }
      shell?.classList.remove('foundation-hidden');
      // Only clear #foundation once a signed-in non-owner is confirmed, preserving deep-link reload for the owner.
      if (user && window.location.hash === '#foundation') {
        try {
          history.replaceState(null, '', '#doc/' + (window.CodeWikiApp?.getCurrentDocId?.() || 'welcome-abap'));
        } catch {}
      }
      return;
    }
    route();
  }

  function leave() {
    if (window.location.hash === '#foundation') {
      try {
        history.replaceState(null, '', '#doc/' + (window.CodeWikiApp?.getCurrentDocId?.() || 'welcome-abap'));
      } catch {}
    }
    route();
  }

  host?.addEventListener('click', e => {
    if (!visible()) return;
    const tabBtn = e.target?.closest?.('[data-foundation-tab]');
    if (tabBtn) {
      const next = tabBtn.dataset.foundationTab === 'parts' ? 'parts' : 'full';
      if (next !== activeTab) {
        activeTab = next;
        render();
      }
      return;
    }
    const modeBtn = e.target?.closest?.('[data-output-mode]');
    if (modeBtn) {
      const next = modeBtn.dataset.outputMode === 'demo' ? 'demo' : 'salv';
      if (next !== outputMode) {
        outputMode = next;
        render();
      }
      return;
    }
    const jumpBtn = e.target?.closest?.('[data-jump-line]');
    if (jumpBtn) {
      const lineNo = Number(jumpBtn.dataset.jumpLine);
      if (Number.isFinite(lineNo) && lineNo > 0) jumpToLine(lineNo);
      return;
    }
    const copyBtn = e.target?.closest?.('[data-copy-target]');
    if (copyBtn) {
      const target = copyBtn.dataset.copyTarget;
      let text = '';
      let label = '전체 코드';
      if (target === 'full') {
        text = currentTemplate();
      } else {
        const part = currentParts().find(p => p.id === target);
        if (!part) return;
        text = part.code.replace(/\n+$/, '');
        label = part.shortLabel;
      }
      void copyText(text).then(ok => {
        if (ok) {
          flashButton(copyBtn, target === 'full' ? '✓ 전체 복사됨' : '✓ 복사됨');
          announceStatus(`${label}가 클립보드에 복사되었습니다.`);
        } else {
          announceStatus('클립보드 복사에 실패했습니다. 코드를 직접 선택해 복사해 주세요.');
        }
      }).catch(() => {
        announceStatus('클립보드 복사에 실패했습니다. 코드를 직접 선택해 복사해 주세요.');
      });
    }
  });

  trigger?.addEventListener('click', () => {
    if (!session) return;
    if (window.location.hash === '#foundation') {
      route();
      return;
    }
    window.location.hash = '#foundation';
  });

  window.addEventListener('hashchange', route);

  window.CodeWikiFoundation = {
    OWNER_ID,
    setUser,
    leave,
    isOwnerUser: isEligible,
    getTemplate: (mode = outputMode) => TEMPLATES[mode] || TEMPLATES.salv,
    getParts: (mode = outputMode) => (PARTS_BY_MODE[mode] || PARTS_BY_MODE.salv).map(p => ({ ...p }))
  };

  setUser(window.CodeWikiAuth?.getCurrentUser?.() || null);
})();
