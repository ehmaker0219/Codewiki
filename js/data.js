/**
 * ============================================================================
 * [유지보수 전용 데이터 파일: js/data.js]
 * ----------------------------------------------------------------------------
 * 앞으로 배우시는 내용을 말씀해주시면, UI 코드(HTML/CSS/앱 엔진)는 건드리지 않고
 * 오직 이 파일의 배열/객체에 블록만 하나씩 추가·수정하여 위키를 확장합니다.
 *
 * [지원하는 인라인 문법 (문장 안에서 자유롭게 사용)]
 *  - [[문서ID|표시이름]] : 다른 개념 문서로 이동하는 하이퍼링크 + 마우스오버 프리뷰 + 자동 역링크
 *  - {{핵심키워드}}       : 상단 '암기 모드 ON' 클릭 시 빈칸으로 가려지는 복습용 키워드
 *  - ~~취소선 메모~~      : 상단 '취소선 메모 ON/OFF'로 켰다 끌 수 있는 나무위키식 비유/사족
 *  - **굵은글씨** / `코드` : 강조 및 인라인 코드 배지
 *
 * [지원하는 시각적 블록(blocks) 타입 6종]
 *  1. { type: "text", paragraphs: ["문단1", "문단2"] }
 *  2. { type: "flow", caption: "흐름도 제목", steps: [{ badge, title, desc }] }
 *  3. { type: "compare", items: [{ tag, title, points: [] }] }
 *  4. { type: "callout", style: "tip" | "point" | "warn", title: "제목", body: "내용" }
 *  5. { type: "table", headers: ["열1", "열2"], rows: [["값1", "값2"]] }
 *  6. { type: "code", label: "ABAP", code: "SELECT * ..." }
 *  7. { type: "widget", widgetId: "memory-sim" | "layer-explorer" }
 * ============================================================================
 */

// 1. 좌측 메뉴 및 둘러보기 틀에 표시될 카테고리 목록 (언제든 추가/순서 변경 가능)
window.WIKI_CATEGORIES = [
  { id: "guide", name: "0. 위키 사용법 & 템플릿" },
  { id: "arch", name: "1. SAP 기초 & 아키텍처" },
  { id: "ddic", name: "2. Data Dictionary (SE11)" },
  { id: "abap-core", name: "3. ABAP 문법 & 메모리" },
  { id: "sql-rap", name: "4. SQL · 화면 · 최신 기술" }
];

// 2. 자주 쓰는 T-Code 사전 (배우실 때마다 여기에 한 줄씩 추가)
window.WIKI_TCODES = [
  { code: "SE11", label: "ABAP Dictionary", docId: "sample-se11" },
  { code: "SE38", label: "ABAP Editor", docId: "welcome-guide" },
  { code: "SE80", label: "Object Navigator", docId: "sample-architecture" }
];

// 3. 위키 문서 저장소 (배우신 내용을 저에게 말씀해주시면 여기에 차곡차곡 쌓입니다)
window.WIKI_DOCS = {
  "welcome-guide": {
    id: "welcome-guide",
    title: "코드위키 (CODE WIKI) 프레임워크 가이드",
    subtitle: "배우는 내용을 말만 하면 아래 블록들로 자동 조립되는 모듈형 SAP 학습 위키",
    categoryId: "guide",
    tcodes: ["SE38", "SE11"],
    summary: "오늘 배운 개념을 편하게 말씀만 해주세요! 줄글, 흐름도, 비교 카드, 빈칸 암기 키워드로 깔끔하게 정리해 넣을 수 있는 코드위키 기본 뼈대입니다.",
    specs: {
      "사이트명": "코드위키 (ㅋㄷㅇㅋ)",
      "디자인 테마": "Toss Seed Design (라이트/다크)",
      "유지보수 방식": "100% 데이터 분리형 (js/data.js)",
      "특수 기능": "링크 프리뷰 · 역링크 · 빈칸 암기 모드"
    },
    sections: [
      {
        title: "코드위키 (ㅋㄷ / ㅇㅋ) 브랜드 심볼 시안",
        blocks: [
          {
            type: "widget",
            widgetId: "logo-showcase"
          }
        ]
      },
      {
        title: "인라인 문법 3가지 (링크 · 빈칸 암기 · 취소선 사족)",
        blocks: [
          {
            type: "text",
            paragraphs: [
              "1) **개념 간 하이퍼링크**: 문장 중간에 [[sample-architecture|SAP 기본 구조 (예시 문서)]]나 [[sample-se11|SE11 데이터 사전 (예시 문서)]]처럼 연결해 두면, 마우스를 올렸을 때 **토스 스타일 미니 요약 카드**가 뜨고 클릭 시 바로 이동합니다. 또한 연결 당한 문서 우측 하단에는 자동으로 **역링크**가 생성됩니다.",
              "2) **빈칸 암기 토큰**: 중요한 시험 키워드나 개념어를 {{Internal Table}} 또는 {{MANDT}}처럼 감싸두면, 우측 상단의 **[암기 모드 OFF]** 버튼을 눌렀을 때 가림막 처리되어 클릭하며 스스로 테스트할 수 있습니다.",
              "3) **나무위키식 취소선 메모**: 공부하다가 느낀 나만의 비유나 드립은 ~~이렇게 취소선으로 적어두고 상단 버튼으로 언제든 숨길 수 있습니다.~~"
            ]
          }
        ]
      },
      {
        title: "시각화 블록 ①: 단계별 흐름도 (Flow Block)",
        blocks: [
          {
            type: "text",
            paragraphs: [
              "프로세스 순서나 계층 간 이동을 배우셨을 때는 복잡한 그림을 그릴 필요 없이 텍스트만 주시면 아래처럼 **단계별 카드 흐름도**로 자동 변환됩니다."
            ]
          },
          {
            type: "flow",
            caption: "예시: 앞으로 우리가 문서를 업데이트하는 흐름",
            steps: [
              {
                badge: "STEP 1",
                title: "수업에서 개념 학습",
                desc: "새로 배운 개념이나 헷갈리는 부분을 채팅으로 편하게 전달"
              },
              {
                badge: "STEP 2",
                title: "맞춤 블록 조립",
                desc: "흐름도·비교표·인터랙티브 위젯 중 가장 잘 어울리는 블록으로 구성"
              },
              {
                badge: "STEP 3",
                title: "하이퍼링크 & 복습",
                desc: "기존 문서와 양방향 링크로 연결하고 암기 모드로 복습"
              }
            ]
          }
        ]
      },
      {
        title: "시각화 블록 ②: 2단 비교 카드 & 콜아웃 박스",
        blocks: [
          {
            type: "compare",
            items: [
              {
                tag: "비교 카드 A",
                title: "헷갈리는 개념 A (예: Internal Table)",
                points: [
                  "두 개념의 차이점을 나란히 비교할 때 쓰는 블록입니다.",
                  "핵심 특징을 글머리 기호로 한눈에 대조할 수 있습니다.",
                  "{{다중 행(Multi-row)}} 데이터를 메모리에 담는 그릇"
                ]
              },
              {
                tag: "비교 카드 B",
                title: "헷갈리는 개념 B (예: Work Area)",
                points: [
                  "복잡한 줄글 대신 카드로 쪼개어 시각적 피로도를 낮춥니다.",
                  "모바일이나 좁은 화면에서는 자동으로 위아래로 정렬됩니다.",
                  "{{단 한 줄(Single-row)}} 데이터만 담는 작업용 접시"
                ]
              }
            ]
          },
          {
            type: "callout",
            style: "tip",
            title: "💡 꿀팁 / 핵심 포인트 콜아웃 블록 (tip · point · warn 3가지 색상 지원)",
            body: "강사님이 강조하신 시험 포인트나 실무 주의사항은 이렇게 눈에 띄는 파스텔 콜아웃 박스로 분리해 드립니다."
          }
        ]
      },
      {
        title: "시각화 블록 ③: 표(Table) · 코드(Code) · 인터랙티브 위젯",
        blocks: [
          {
            type: "table",
            headers: ["블록 이름", "언제 쓰나요?", "유지보수 난이도"],
            rows: [
              ["flow (흐름도)", "실행 순서, 계층 구조, 데이터 이동 경로 설명 시", "매우 쉬움 (배열 추가)"],
              ["compare (비교)", "A vs B 개념 대조, 구문법 vs 신문법 비교 시", "매우 쉬움"],
              ["widget (위젯)", "직접 클릭하며 값이 바뀌는 시뮬레이터가 필요할 때", "맞춤 제작 지원"]
            ]
          },
          {
            type: "code",
            label: "ABAP 코드 블록 예시 (우측 상단 복사 버튼 자동 포함)",
            code: `SELECT * FROM sflight
  INTO TABLE @DATA(lt_flight)
  UP TO 5 ROWS.`
          },
          {
            type: "widget",
            widgetId: "interactive-demo"
          }
        ]
      }
    ]
  },

  "sample-architecture": {
    id: "sample-architecture",
    title: "[빈 슬롯 예시] SAP 기본 아키텍처",
    subtitle: "배운 내용을 말씀해주시면 이곳에 채워집니다",
    categoryId: "arch",
    tcodes: ["SE80"],
    summary: "이 문서는 카테고리 연결과 [[welcome-guide|가이드 문서]] 간의 하이퍼링크·역링크 동작을 확인하기 위한 샘플 슬롯입니다.",
    specs: {
      "상태": "내용 입력 대기 중",
      "카테고리": "1. SAP 기초 & 아키텍처"
    },
    sections: [
      {
        title: "내용 추가 대기 중",
        blocks: [
          {
            type: "text",
            paragraphs: [
              "수업에서 아키텍처나 시스템 구조를 배우신 뒤 말씀해주시면, 이 자리에 깔끔한 시각적 블록들이 채워집니다. [[sample-se11|SE11 데이터 사전]] 문서와도 자유롭게 연결할 수 있습니다."
            ]
          }
        ]
      }
    ]
  },

  "sample-se11": {
    id: "sample-se11",
    title: "[빈 슬롯 예시] Data Dictionary (SE11)",
    subtitle: "배운 내용을 말씀해주시면 이곳에 채워집니다",
    categoryId: "ddic",
    tcodes: ["SE11"],
    summary: "SE11 관련 개념(Domain, Data Element, Table 등)을 배우시는 대로 하나씩 채워 넣을 공간입니다.",
    specs: {
      "상태": "내용 입력 대기 중",
      "대표 T-Code": "SE11"
    },
    sections: [
      {
        title: "내용 추가 대기 중",
        blocks: [
          {
            type: "text",
            paragraphs: [
              "[[welcome-guide|위키 가이드]]에서 보신 비교 카드나 계층 조립 위젯을 활용해 세련되게 정리해 드릴 예정입니다."
            ]
          }
        ]
      }
    ]
  }
};
