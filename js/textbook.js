/* Textbook contents transcribed from the three supplied contents pages. */
(() => {
  const docs = window.WIKI_DOCS;
  // Each entry keeps the printed page and title; links point to existing study notes.
  const units = [
    [1, 1, 'Flow of an ABAP Program', [
      [3, 'Lesson: Describing the Processing of ABAP Programs', ['sap-architecture', 'abap-program-types']]
    ]],
    [2, 19, 'ABAP Workbench', [
      [21, 'Lesson: Introducing the ABAP Workbench', ['abap-development', 'sap-tcode-reference']],
      [30, 'Lesson: Organizing ABAP Development Projects', ['abap-development']],
      [37, 'Exercise 1: Create a Package', ['abap-development']],
      [40, 'Lesson: Developing ABAP Programs', ['abap-development', 'abap-basics']],
      [51, 'Exercise 2: Develop a Simple ABAP Program', ['abap-basics']],
      [55, 'Lesson: Finalizing ABAP Development Projects', ['abap-development']],
      [59, 'Exercise 3: Create a Transaction', ['abap-development']]
    ]],
    [3, 73, 'Basic ABAP Language Elements', [
      [75, 'Lesson: Defining Elementary Data Objects', ['abap-types']],
      [87, 'Lesson: Using Basic ABAP Statements', ['abap-basics', 'abap-loops']],
      [97, 'Exercise 4: Use Basic ABAP Statements', ['abap-basics', 'abap-loops']],
      [104, 'Lesson: Analyzing Programs with the ABAP Debugger', ['abap-debug-messages']],
      [113, 'Exercise 5: Debug Statements on Elementary Data Objects', ['abap-debug-messages']]
    ]],
    [4, 125, 'Modularization Techniques in ABAP', [
      [127, 'Lesson: Explaining Modularization', ['abap-modularization']],
      [134, 'Lesson: Defining and Calling Subroutines', ['abap-modularization']],
      [149, 'Exercise 6: Implement Subroutines', ['abap-modularization']],
      [155, 'Lesson: Calling Function Modules', ['abap-modularization']],
      [165, 'Exercise 7: Call a Function Module', ['abap-modularization']],
      [172, 'Lesson: Creating Function Modules', ['abap-modularization']],
      [175, 'Exercise 8: Create a Function Group', ['abap-modularization']],
      [179, 'Exercise 9: Create a Function Module', ['abap-modularization']],
      [187, 'Lesson: Describing Business Application Programming Interfaces (BAPIs)', ['abap-bapi']],
      [193, 'Lesson: Calling Methods of Global Classes', ['abap-objects']],
      [205, 'Exercise 10: Use a Global Static Method', ['abap-objects']],
      [212, 'Lesson: Creating Global Classes and Static Methods', ['abap-objects']],
      [217, 'Exercise 11: Create a Simple Global Class', ['abap-objects']],
      [219, 'Exercise 12: Create a Simple Static Method', ['abap-objects']],
      [225, 'Lesson: Using Local Classes', ['abap-objects']]
    ]],
    [5, 239, 'Complex Data Objects', [
      [240, 'Lesson: Using Structured Data Objects', ['abap-types']],
      [247, 'Exercise 13: Use Structured Data Objects', ['abap-types']],
      [253, 'Lesson: Using Internal Tables', ['abap-data-report']],
      [273, 'Exercise 14: Use Internal Tables', ['abap-data-report']]
    ]],
    [6, 283, 'Data Modeling and Data Retrieval', [
      [285, 'Lesson: Explaining Data Models'],
      [295, 'Exercise 15: Analyze Transparent Tables in the Data Dictionary'],
      [301, 'Lesson: Retrieving Single Database Records', ['abap-open-sql']],
      [309, 'Exercise 16: Implement Single Record Access', ['abap-open-sql']],
      [315, 'Lesson: Retrieving Multiple Database Records', ['abap-open-sql']],
      [317, 'Exercise 17: Implement a SELECT Loop', ['abap-open-sql']],
      [325, 'Exercise 18: Implement an Array Fetch (Optional Exercise)', ['abap-open-sql']],
      [331, 'Lesson: Describing Other Aspects of Database Access', ['abap-open-sql']],
      [342, 'Lesson: Implementing Authorization Checks'],
      [349, 'Exercise 19: Implement an Authorization Check']
    ]],
    [7, 363, 'Classic ABAP Reports', [
      [365, 'Lesson: Implementing ABAP Lists', ['abap-data-report']],
      [370, 'Lesson: Implementing Selection Screens', ['abap-data-report']],
      [379, 'Exercise 20: Create a Selection Screen and a Classic ABAP List', ['abap-data-report']],
      [386, 'Lesson: Implementing Events of ABAP Reports', ['abap-data-report', 'abap-thinking-flow']],
      [395, 'Exercise 21: Implement Events of ABAP Reports', ['abap-data-report', 'abap-thinking-flow']]
    ]],
    [8, 405, 'Screens', [
      [406, 'Lesson: Creating Screens'],
      [425, 'Exercise 22: Create Screens'],
      [432, 'Lesson: Creating Input and Output Fields'],
      [435, 'Exercise 23: Create Input and Output Fields on a Screen'],
      [441, 'Lesson: Implementing Data Transport'],
      [449, 'Exercise 24: Implement Data Transport']
    ]],
    [9, 459, 'SAP List Viewer', [
      [460, 'Lesson: Using the SAP List Viewer'],
      [473, 'Exercise 25: Use SAP List Viewer in an ABAP Report'],
      [481, 'Exercise 26: Display an Internal Table with the SAP List Viewer']
    ]],
    [10, 493, 'Web Dynpro ABAP', [
      [495, 'Lesson: Describing Web Dynpro ABAP'],
      [503, 'Lesson: Implementing Navigation in Web Dynpro'],
      [515, 'Exercise 27: Implement Navigation in Web Dynpro'],
      [522, 'Lesson: Implementing Data Transport in Web Dynpro'],
      [531, 'Exercise 28: Implement Data Transport in Web Dynpro']
    ]],
    [11, 543, 'Program Analysis Tools', [
      [545, 'Lesson: Improving the Quality of ABAP Code with the Code Inspector']
    ]],
    [12, 555, 'ABAP Development Tools for SAP NetWeaver', [
      [557, 'Lesson: Describing ABAP Development Tools for SAP NetWeaver'],
      [561, 'Lesson: Creating an ABAP Project in Eclipse']
    ]],
    [13, 569, 'SAP Standard Software Adjustments', [
      [571, 'Lesson: Adjusting the SAP Standard Software']
    ]]
  ];
  // Derive each topic's book references from the same links used in the book index.
  for (const [number, , title, entries] of units) {
    const targets = new Set(entries.flatMap(([, , ids = []]) => ids));
    for (const id of targets) {
      (docs[id].textbookParts ||= []).push({
        unit: number, title,
        entries: entries.filter(([, , ids = []]) => ids.includes(id))
          .map(([page, entryTitle]) => ({ page, title: entryTitle }))
      });
    }
  }
  const roadmap = docs['learning-roadmap'].sections[0].blocks.find(block => block.type === 'table');
  roadmap.headers.splice(2, 0, '교재 위치');
  for (const row of roadmap.rows) {
    const id = row[1].match(/\[\[([^|\]]+)/)?.[1];
    row.splice(2, 0, docs[id]?.textbookParts?.map(part => `Unit ${part.unit}`).join('<br>') || '—');
  }
  docs['abap-textbook'] = {
    id: 'abap-textbook', track: 'abap', categoryId: '', stepNum: '',
    title: 'ABAP 교재 목차', subtitle: 'Unit 1–13 · Lesson · Exercise 1–28',
    aliases: ['교재 목차'], tcodes: [], specs: { 'Course Overview': 'p. ix' },
    hideSectionNumbers: true,
    summary: '교재 순서와 페이지 번호로 찾아보세요. 관련 학습 문서는 같은 주제의 수업 필기로 연결되며, 교재 Exercise의 정답을 뜻하지 않습니다. 연결된 문서가 없는 항목은 —로 표시했습니다.',
    sections: units.map(([number, page, title, entries]) => ({
      title: `Unit ${number}: ${title}`,
      blocks: [
        { type: 'text', paragraphs: [`**교재 p. ${page}**`] },
        { type: 'table', headers: ['페이지', 'Lesson · Exercise', '관련 학습 문서'], rows: entries.map(([entryPage, entryTitle, targets = []]) => [
          String(entryPage),
          `<span data-no-autolink>${entryTitle}</span>`,
          targets.map(id => `[[${id}|${docs[id].title}]]`).join('<br>') || '—'
        ]) }
      ]
    }))
  };
  // Keep the book index accessible from both existing overview pages.
  for (const id of ['welcome-abap', 'learning-roadmap']) {
    docs[id].sections[0].blocks.unshift({ type: 'text', paragraphs: [
      '[[abap-textbook|교재 목차]]에서 Unit·Lesson·Exercise와 교재 페이지 번호를 확인할 수 있습니다.'
    ] });
  }
})();
