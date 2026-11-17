/**
 * ============================================================================
 * [데이터 저장소 틀: js/data.js]
 * ============================================================================
 */

window.WIKI_CATEGORIES = [
  { id: "abap-curriculum", track: "abap", name: "커리큘럼" },
  { id: "abap-concept", track: "abap", name: "개념 사전" },
  { id: "abap-tcode", track: "abap", name: "T-Code" },

  { id: "ui5-curriculum", track: "ui5", name: "커리큘럼" },
  { id: "ui5-concept", track: "ui5", name: "개념 사전" },
  { id: "ui5-control", track: "ui5", name: "컨트롤 · API" }
];

window.WIKI_TCODES = [];

window.WIKI_DOCS = {
  "welcome-abap": {
    id: "welcome-abap",
    track: "abap",
    isHome: true,
    stepNum: "",
    title: "ABAP",
    subtitle: "",
    categoryId: "",
    aliases: [],
    tcodes: [],
    summary: "",
    specs: {},
    sections: []
  },

  "welcome-ui5": {
    id: "welcome-ui5",
    track: "ui5",
    isHome: true,
    stepNum: "",
    title: "UI5 / Fiori",
    subtitle: "",
    categoryId: "",
    aliases: [],
    tcodes: [],
    summary: "",
    specs: {},
    sections: []
  }
};
