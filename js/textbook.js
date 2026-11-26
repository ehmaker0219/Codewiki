/* Textbook contents transcribed from the supplied BC400 (3 pages) and BC430 (2 pages) contents pages. */
(() => {
  const docs = window.WIKI_DOCS;

  const bc400Units = [
    [1, 1, 'unit-01', 'ABAP 프로그램의 흐름', 'Flow of an ABAP Program', [
      [3, 'Lesson: Describing the Processing of ABAP Programs', ['unit-01'], '완료']
    ]],
    [2, 19, 'unit-02', 'ABAP Workbench', 'ABAP Workbench', [
      [21, 'Lesson: Introducing the ABAP Workbench', ['unit-02', 'sap-tcode-reference'], '완료'],
      [30, 'Lesson: Organizing ABAP Development Projects', ['unit-02'], '완료'],
      [37, 'Exercise 1: Create a Package', ['unit-02'], '실습 정리'],
      [40, 'Lesson: Developing ABAP Programs', ['unit-02'], '완료'],
      [51, 'Exercise 2: Develop a Simple ABAP Program', ['unit-02'], '실습 정리'],
      [55, 'Lesson: Finalizing ABAP Development Projects', ['unit-02'], '완료'],
      [59, 'Exercise 3: Create a Transaction', ['unit-02'], '실습 정리']
    ]],
    [3, 73, 'unit-03', 'ABAP 기본 언어 요소', 'Basic ABAP Language Elements', [
      [75, 'Lesson: Defining Elementary Data Objects', ['unit-03'], '완료'],
      [87, 'Lesson: Using Basic ABAP Statements', ['unit-03', 'abap-useful-syntax'], '완료'],
      [97, 'Exercise 4: Use Basic ABAP Statements', ['unit-03'], '실습 정리'],
      [104, 'Lesson: Analyzing Programs with the ABAP Debugger', ['unit-03'], '완료'],
      [113, 'Exercise 5: Debug Statements on Elementary Data Objects', ['unit-03'], '실습 정리']
    ]],
    [4, 125, 'unit-04', 'ABAP 모듈화 기법', 'Modularization Techniques in ABAP', [
      [127, 'Lesson: Explaining Modularization', ['unit-04'], '완료'],
      [134, 'Lesson: Defining and Calling Subroutines', ['unit-04'], '완료'],
      [149, 'Exercise 6: Implement Subroutines', ['unit-04'], '실습 정리'],
      [155, 'Lesson: Calling Function Modules', ['unit-04'], '완료'],
      [165, 'Exercise 7: Call a Function Module', ['unit-04'], '실습 정리'],
      [172, 'Lesson: Creating Function Modules', ['unit-04'], '완료'],
      [175, 'Exercise 8: Create a Function Group', ['unit-04'], '실습 정리'],
      [179, 'Exercise 9: Create a Function Module', ['unit-04'], '실습 정리'],
      [187, 'Lesson: Describing Business Application Programming Interfaces (BAPIs)', ['unit-04'], '완료'],
      [193, 'Lesson: Calling Methods of Global Classes', ['unit-04'], '완료'],
      [205, 'Exercise 10: Use a Global Static Method', ['unit-04'], '실습 정리'],
      [212, 'Lesson: Creating Global Classes and Static Methods', ['unit-04'], '완료'],
      [217, 'Exercise 11: Create a Simple Global Class', ['unit-04'], '실습 정리'],
      [219, 'Exercise 12: Create a Simple Static Method', ['unit-04'], '실습 정리'],
      [225, 'Lesson: Using Local Classes', ['unit-04'], '완료']
    ]],
    [5, 239, 'unit-05', '복합 데이터 객체', 'Complex Data Objects', [
      [240, 'Lesson: Using Structured Data Objects', ['unit-05'], '완료'],
      [247, 'Exercise 13: Use Structured Data Objects', ['unit-05'], '실습 정리'],
      [253, 'Lesson: Using Internal Tables', ['unit-05'], '완료'],
      [273, 'Exercise 14: Use Internal Tables', ['unit-05'], '실습 정리']
    ]],
    [6, 283, 'unit-06', '데이터 모델링과 데이터 조회', 'Data Modeling and Data Retrieval', [
      [285, 'Lesson: Explaining Data Models', ['unit-06', 'bc430-01'], '완료'],
      [295, 'Exercise 15: Analyze Transparent Tables in the Data Dictionary', ['unit-06', 'bc430-03'], '실습 정리'],
      [301, 'Lesson: Retrieving Single Database Records', ['unit-06', 'abap-sql-guide'], '완료'],
      [309, 'Exercise 16: Implement Single Record Access', ['unit-06'], '실습 정리'],
      [315, 'Lesson: Retrieving Multiple Database Records', ['unit-06', 'abap-sql-guide'], '완료'],
      [317, 'Exercise 17: Implement a SELECT Loop', ['unit-06'], '실습 정리'],
      [325, 'Exercise 18: Implement an Array Fetch (Optional Exercise)', ['unit-06'], '실습 정리'],
      [331, 'Lesson: Describing Other Aspects of Database Access', ['unit-06', 'abap-sql-guide'], '완료'],
      [342, 'Lesson: Implementing Authorization Checks', ['unit-06'], '준비 중'],
      [349, 'Exercise 19: Implement an Authorization Check', ['unit-06'], '준비 중']
    ]],
    [7, 363, 'unit-07', 'Classic ABAP Reports', 'Classic ABAP Reports', [
      [365, 'Lesson: Implementing ABAP Lists', ['unit-07'], '완료'],
      [370, 'Lesson: Implementing Selection Screens', ['unit-07'], '완료'],
      [379, 'Exercise 20: Create a Selection Screen and a Classic ABAP List', ['unit-07'], '실습 정리'],
      [386, 'Lesson: Implementing Events of ABAP Reports', ['unit-07', 'abap-thinking-flow'], '완료'],
      [395, 'Exercise 21: Implement Events of ABAP Reports', ['unit-07', 'abap-thinking-flow'], '실습 정리']
    ]],
    [8, 405, 'unit-08', 'Screens (Dynpro)', 'Screens', [
      [406, 'Lesson: Creating Screens', ['unit-08'], '준비 중'],
      [425, 'Exercise 22: Create Screens', ['unit-08'], '준비 중'],
      [432, 'Lesson: Creating Input and Output Fields', ['unit-08'], '준비 중'],
      [435, 'Exercise 23: Create Input and Output Fields on a Screen', ['unit-08'], '준비 중'],
      [441, 'Lesson: Implementing Data Transport', ['unit-08'], '준비 중'],
      [449, 'Exercise 24: Implement Data Transport', ['unit-08'], '준비 중']
    ]],
    [9, 459, 'unit-09', 'SAP List Viewer (ALV)', 'SAP List Viewer', [
      [460, 'Lesson: Using the SAP List Viewer', ['unit-09'], '준비 중'],
      [473, 'Exercise 25: Use SAP List Viewer in an ABAP Report', ['unit-09'], '준비 중'],
      [481, 'Exercise 26: Display an Internal Table with the SAP List Viewer', ['unit-09'], '준비 중']
    ]],
    [10, 493, 'unit-10', 'Web Dynpro ABAP', 'Web Dynpro ABAP', [
      [495, 'Lesson: Describing Web Dynpro ABAP', ['unit-10'], '준비 중'],
      [503, 'Lesson: Implementing Navigation in Web Dynpro', ['unit-10'], '준비 중'],
      [515, 'Exercise 27: Implement Navigation in Web Dynpro', ['unit-10'], '준비 중'],
      [522, 'Lesson: Implementing Data Transport in Web Dynpro', ['unit-10'], '준비 중'],
      [531, 'Exercise 28: Implement Data Transport in Web Dynpro', ['unit-10'], '준비 중']
    ]],
    [11, 543, 'unit-11', 'Program Analysis Tools', 'Program Analysis Tools', [
      [545, 'Lesson: Improving the Quality of ABAP Code with the Code Inspector', ['unit-11'], '준비 중']
    ]],
    [12, 555, 'unit-12', 'ADT (Eclipse)', 'ABAP Development Tools for SAP NetWeaver', [
      [557, 'Lesson: Describing ABAP Development Tools for SAP NetWeaver', ['unit-12'], '준비 중'],
      [561, 'Lesson: Creating an ABAP Project in Eclipse', ['unit-12'], '준비 중']
    ]],
    [13, 569, 'unit-13', 'SAP 표준 소프트웨어 조정', 'SAP Standard Software Adjustments', [
      [571, 'Lesson: Adjusting the SAP Standard Software', ['unit-13', 'bc430-07'], '완료']
    ]]
  ];

  const bc430Units = [
    [1, 1, 'bc430-01', 'ABAP Dictionary 개요', 'Introduction to the ABAP Dictionary', [
      [3, 'Lesson: Describing the ABAP Dictionary', ['bc430-01'], '완료']
    ]],
    [2, 11, 'bc430-02', 'ABAP Dictionary 데이터 타입', 'Data Types in the ABAP Dictionary', [
      [12, 'Lesson: Creating Domains and Data Elements', ['bc430-02'], '완료'],
      [19, 'Exercise 1: Create Elementary Data Types', ['bc430-02'], '실습 정리'],
      [25, 'Lesson: Creating Flat Structures', ['bc430-02'], '완료'],
      [29, 'Exercise 2: Create Simple and Nested Structures', ['bc430-02'], '실습 정리'],
      [34, 'Lesson: Creating Table Types and Deep Structures', ['bc430-02'], '완료'],
      [37, 'Exercise 3: Create Table Types', ['bc430-02'], '실습 정리'],
      [41, 'Exercise 4: Create Deep Structures', ['bc430-02'], '실습 정리'],
      [47, 'Lesson: Creating Type Groups', ['bc430-02'], '준비 중']
    ]],
    [3, 55, 'bc430-03', '데이터베이스 테이블', 'Database Tables', [
      [56, 'Lesson: Creating Transparent Tables', ['bc430-03'], '완료'],
      [69, 'Exercise 5: Create Tables in the ABAP Dictionary', ['bc430-03'], '실습 정리'],
      [79, 'Lesson: Defining Cluster Tables and Pooled Tables', ['bc430-03'], '준비 중']
    ]],
    [4, 91, 'bc430-04', '테이블 접근 성능', 'Performance During Table Access', [
      [92, 'Lesson: Creating Database Table Indexes', ['bc430-04'], '완료'],
      [97, 'Exercise 6: Create Table Indexes', ['bc430-04'], '실습 정리'],
      [101, 'Lesson: Setting Up Table Buffering', ['bc430-04'], '완료'],
      [115, 'Exercise 7: Set Up Table Buffering', ['bc430-04'], '실습 정리']
    ]],
    [5, 125, 'bc430-05', '입력 검사 (Input Checks)', 'Input Checks', [
      [126, 'Lesson: Creating Fixed Values', ['bc430-05'], '완료'],
      [129, 'Exercise 8: Create Fixed Values', ['bc430-05'], '실습 정리'],
      [132, 'Lesson: Defining Foreign Keys to Perform Input Checks', ['bc430-05'], '완료'],
      [141, 'Exercise 9: Perform Input Checks to Ensure Data Consistency', ['bc430-05'], '실습 정리'],
      [152, 'Lesson: Creating Text Tables', ['bc430-05'], '완료'],
      [155, 'Exercise 10: Create a Text Table', ['bc430-05'], '실습 정리']
    ]],
    [6, 167, 'bc430-06', 'Dictionary 객체 종속성', 'Dictionary Object Dependencies', [
      [168, 'Lesson: Differentiating Between Active and Inactive Dictionary Objects', ['bc430-06'], '준비 중'],
      [173, 'Exercise 11: Differentiate Between Active and Inactive Dictionary Objects', ['bc430-06'], '준비 중'],
      [177, 'Lesson: Identifying Dependencies with ABAP Dictionary Objects', ['bc430-06'], '완료'],
      [181, 'Exercise 12: Identify Dependencies with ABAP Dictionary Objects', ['bc430-06'], '실습 정리']
    ]],
    [7, 189, 'bc430-07', '테이블 변경과 확장', 'Table Changes', [
      [190, 'Lesson: Performing a Table Conversion', ['bc430-07', 'sap-tcode-reference'], '완료'],
      [199, 'Exercise 13: Perform a Table Conversion', ['bc430-07'], '실습 정리'],
      [204, 'Lesson: Enhancing Tables Using Append Structures', ['bc430-07'], '완료'],
      [211, 'Exercise 14: Add Enhancements to a Table Using an Append Structure', ['bc430-07'], '실습 정리']
    ]],
    [8, 219, 'bc430-08', 'View와 Maintenance View', 'Views and Maintenance Views', [
      [220, 'Lesson: Creating Database Views', ['bc430-08'], '완료'],
      [233, 'Exercise 15: Create a Database View', ['bc430-08'], '실습 정리'],
      [237, 'Lesson: Creating Maintenance Views', ['bc430-08', 'sap-tcode-reference'], '완료'],
      [245, 'Exercise 16: Create a Maintenance View', ['bc430-08'], '실습 정리'],
      [250, 'Lesson: Creating View Clusters', ['bc430-08'], '준비 중'],
      [253, 'Exercise 17: Create a View Cluster', ['bc430-08'], '준비 중']
    ]],
    [9, 265, 'bc430-09', 'Search Help', 'Search Helps', [
      [266, 'Lesson: Creating Search Helps', ['bc430-09'], '완료'],
      [281, 'Exercise 18: Create Search Helps', ['bc430-09'], '실습 정리'],
      [285, 'Lesson: Applying Advanced Search Help Techniques', ['bc430-09'], '진행 중'],
      [289, 'Exercise 19: Create Collective Search Helps', ['bc430-09'], '준비 중'],
      [293, 'Exercise 20: Create Append Search Helps', ['bc430-09'], '준비 중']
    ]]
  ];

  // Attach textbook references onto each target document.
  const attachParts = (course, list) => {
    for (const [number, , , , enTitle, entries] of list) {
      const targets = new Set(entries.flatMap(([, , ids = []]) => ids));
      for (const id of targets) {
        if (!docs[id]) continue;
        (docs[id].textbookParts ||= []).push({
          course, unit: number, title: `${course} · ${enTitle}`,
          entries: entries.filter(([, , ids = []]) => ids.includes(id))
            .map(([page, entryTitle, , status]) => ({ page, title: entryTitle, status }))
        });
      }
    }
  };
  attachParts('BC400', bc400Units);
  attachParts('BC430', bc430Units);

  // Refresh reference documents' related links now that BC400 & BC430 Units exist.
  for (const refId of ['abap-useful-syntax', 'sap-gui-shortcuts', 'sap-tcode-reference']) {
    const rel = docs[refId]?.sections?.find(s => s.title === '관련 문서');
    if (!rel) continue;
    rel.blocks[0].paragraphs = rel.blocks[0].paragraphs.map(p =>
      p.replace(/\[\[((?:unit|bc430)-\d+)\|([^\]]+)\]\]/g, (_, id, label) => `[[${id}|${docs[id]?.title || label}]]`)
    );
  }

  const unitStatus = entries => {
    const ready = entries.filter(([, , , status]) => status !== '준비 중').length;
    if (ready === 0) return '준비 중';
    if (ready === entries.length) return '필기 정리 · 예제';
    return `진행 중 (${ready}/${entries.length})`;
  };

  const buildSummaryRows = list => list.map(([number, page, unitId, koTitle, enTitle, entries]) => {
    const lessonCount = entries.filter(([, t]) => t.startsWith('Lesson:')).length;
    const exNums = entries.map(([, t]) => t.match(/^Exercise (\d+):/)?.[1]).filter(Boolean);
    const exText = exNums.length ? ` · Ex ${exNums[0]}${exNums.length > 1 ? `–${exNums[exNums.length - 1]}` : ''}` : '';
    return [
      `Unit ${number}`,
      `p. ${page}`,
      `[[${unitId}|${koTitle}]]<br><small><span data-no-autolink>${enTitle}</span></small>`,
      `Lesson ${lessonCount}개${exText}`,
      unitStatus(entries)
    ];
  });

  const buildUnitSections = (tabId, course, list) => [
    {
      tab: tabId,
      badge: course,
      title: `${course} 한눈에 보기 (${course === 'BC400' ? 'Unit 1–13 · Ex 1–28' : 'Unit 1–9 · Ex 1–20'})`,
      blocks: [
        { type: 'table', headers: ['Unit', '교재 p.', '단원명 (한글 · 영문 원제)', 'Lesson · Exercise', '상태'], rows: buildSummaryRows(list) }
      ]
    },
    ...list.map(([number, page, unitId, koTitle, enTitle, entries]) => ({
      tab: tabId,
      badge: `${course} U${number}`,
      page: `p. ${page}`,
      title: `${course} Unit ${number} · ${koTitle} (${enTitle})`,
      blocks: [
        { type: 'text', paragraphs: [`**${course} 교재 p. ${page}** · [[${unitId}|${course} Unit ${number} 문서 바로 열기]]`] },
        {
          type: 'table',
          headers: ['페이지', 'Lesson · Exercise', '상태', '연결 문서'],
          rows: entries.map(([entryPage, entryTitle, targets = [], status = '준비 중']) => [
            String(entryPage),
            `<span data-no-autolink>${entryTitle}</span>`,
            status,
            targets.filter(id => docs[id]).map(id => `[[${id}|${docs[id].unitMeta ? docs[id].unitMeta.koTitle : docs[id].title}]]`).join(' · ') || '—'
          ])
        }
      ]
    }))
  ];

  docs['abap-textbook'] = {
    id: 'abap-textbook', track: 'abap', categoryId: '', stepNum: '',
    title: '교재 목차', subtitle: 'BC400 · ABAP 기초 (Unit 1–13 · Ex 1–28) / BC430 · ABAP Dictionary (Unit 1–9 · Ex 1–20)',
    aliases: ['교재 목차', 'BC400 교재 목차', 'BC430 교재 목차', '학습 로드맵', '전체 학습 목차'], tcodes: [],
    specs: { 'BC400': 'Course Overview p. ix · Unit 1–13', 'BC430': 'Course Overview p. vii · Unit 1–9', '반영 범위': '2026-11-11 ~ 26' },
    defaultTab: 'bc400',
    hideAllTab: true,
    tabsAboveToc: true,
    filterTocByTab: true,
    hideSectionNumbers: true,
    sectionTabs: [
      { id: 'bc400', kind: 'lesson', badge: 'BC400', hideCount: true, label: 'ABAP 기초 (Unit 1–13)', desc: 'BC400 ABAP Workbench Foundations (Course Overview p. ix · Unit 1–13 · Exercise 1–28) 전체 목차입니다.' },
      { id: 'bc430', kind: 'exercise', badge: 'BC430', hideCount: true, label: 'ABAP Dictionary (Unit 1–9)', desc: 'BC430 ABAP Dictionary (Course Overview p. vii · Unit 1–9 · Exercise 1–20) 전체 목차입니다.' }
    ],
    summary: '아래 탭에서 **BC400 (ABAP 기초 · Unit 1–13)**과 **BC430 (ABAP Dictionary · Unit 1–9)** 교재를 전환해 단원별 Lesson · Exercise와 페이지 번호를 확인할 수 있습니다.',
    sections: [
      ...buildUnitSections('bc400', 'BC400', bc400Units),
      ...buildUnitSections('bc430', 'BC430', bc430Units)
    ]
  };

  // Populate the home page (welcome-abap) with both BC400 and BC430 overview tables.
  if (docs['welcome-abap']?.sections?.[0]) {
    docs['welcome-abap'].sections[0].blocks = [
      { type: 'text', paragraphs: [
        '[[abap-textbook|교재 목차 (BC400 · BC430)]]에서 BC400·BC430 탭을 전환해 전체 Lesson · Exercise와 페이지 번호를 한눈에 볼 수 있습니다. 각 Unit 페이지 안에서 Lesson과 Exercise를 탭으로 전환해 학습하세요.'
      ] },
      { type: 'text', paragraphs: ['**BC400 · ABAP 기초 (Unit 1–13 · Exercise 1–28)**'] },
      {
        type: 'table',
        headers: ['단계', 'BC400 Unit', '핵심 학습 내용', '상태'],
        rows: [
          ['기초 · 환경', '[[unit-01|Unit 1]] · [[unit-02|Unit 2]] · [[unit-03|Unit 3]]', 'SAP 요청 흐름 · Workbench/Package · 기본 문법 · 자료형 · 반복문 · 디버깅 (Ex 1–5)', '필기 정리 · 예제'],
          ['모듈화 · 객체', '[[unit-04|Unit 4]] · [[unit-05|Unit 5]]', 'FORM · Function Module · BAPI · Class · Structure · Internal Table (Ex 6–14)', '필기 정리 · 예제'],
          ['SQL · Report', '[[unit-06|Unit 6]] · [[unit-07|Unit 7]]', '데이터 모델 · Open SQL · Selection Screen · Classic Report (Ex 15–21)', '진행 중 (권한 체크 예정)'],
          ['화면 · 도구', '[[unit-08|Unit 8]] · [[unit-09|Unit 9]] · [[unit-10|Unit 10]] · [[unit-11|Unit 11]] · [[unit-12|Unit 12]]', 'Screens(Dynpro) · ALV · Web Dynpro · Code Inspector · ADT (Ex 22–28)', '준비 중'],
          ['표준 조정', '[[unit-13|Unit 13]]', 'SAP Standard 소프트웨어 조정 (BC430 Unit 7 Append Structure 연계)', '필기 정리 · 연계']
        ]
      },
      { type: 'text', paragraphs: ['**BC430 · ABAP Dictionary (Unit 1–9 · Exercise 1–20)**'] },
      {
        type: 'table',
        headers: ['단계', 'BC430 Unit', '핵심 학습 내용', '상태'],
        rows: [
          ['개요 · 타입', '[[bc430-01|Unit 1]] · [[bc430-02|Unit 2]]', 'DDIC 3가지 기능 · Domain · Data Element · Flat/Deep Structure · Table Type (Ex 1–4)', '진행 중 (Type Groups 예정)'],
          ['테이블 · 성능', '[[bc430-03|Unit 3]] · [[bc430-04|Unit 4]]', 'Transparent Table · Technical Settings · Primary/Secondary Index · Table Buffer (Ex 5–7)', '진행 중 (Cluster/Pooled 예정)'],
          ['검사 · 종속성', '[[bc430-05|Unit 5]] · [[bc430-06|Unit 6]]', 'Fixed Values · Foreign Keys · Text Table(SPRAS) · Where-Used List (Ex 8–12)', '진행 중 (Active/Inactive 예정)'],
          ['변경 · View', '[[bc430-07|Unit 7]] · [[bc430-08|Unit 8]]', 'Table Conversion(SE14) · Append Structure(ZZ/YY) · Views · SM30 · Dynamic Attachment (Ex 13–17)', '진행 중 (View Cluster 예정)'],
          ['Search Help', '[[bc430-09|Unit 9]]', 'Elementary · Collective · Append Search Help · HANA Full-Text/Fuzzy · MATCHCODE/LISTBOX (Ex 18–20)', '진행 중 (Collective · Append 예정)']
        ]
      }
    ];
  }
})();
