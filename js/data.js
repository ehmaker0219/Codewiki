/**
 * ============================================================================
 * [유지보수 전용 데이터 파일: js/data.js]
 * ----------------------------------------------------------------------------
 * ★ 나무위키식 유기적 자동 링크(Auto-Link) 지원!
 * 각 문서에 `aliases: ["키워드1", "키워드2"]`만 등록해 두면, 다른 모든 문서의 설명글에서
 * 해당 단어가 등장할 때마다 자동으로 하이퍼링크 + 마우스오버 요약 프리뷰 + 역링크가 연결됩니다!
 * (예: 문장에 그냥 "Function module은 se37을 통해 만든다"라고만 적어도
 *  'Function module' -> function-module 문서, 'se37' -> tcode-se37 문서로 자동 연결!)
 * ============================================================================
 */

// 1. 좌측 사이드바 폴더 구성 (커리큘럼 챕터 + 개념/T-Code 도감)
window.WIKI_CATEGORIES = [
  { id: "ch00", name: "00. 프롤로그 & 가이드" },
  { id: "ch01", name: "01. SAP ERP 개요 & 시작하기" },
  { id: "ch02", name: "02. ABAP 기초 및 개발 실습" },
  { id: "ch03", name: "03. FI (재무회계) 따라하기" },
  { id: "ch04", name: "04. CO (관리회계) 따라하기" },
  { id: "ch05", name: "05. MM (자재관리) 따라하기" },
  { id: "ch06", name: "06. SD (영업유통) 따라하기" },
  { id: "ch07", name: "07. PP (생산관리) 따라하기" },
  { id: "ch08", name: "08. 모듈 통합 프로세스 (E2E)" },
  { id: "dict-concept", name: "📌 핵심 개념 위키 사전" },
  { id: "dict-tcode", name: "⌨️ T-Code 전용 문서" }
];

// 2. 좌측 T-CODES 빠른 바로가기 (각 T-Code 전용 문서로 직행!)
window.WIKI_TCODES = [
  { code: "SE09", label: "이관 관리 (CTS)", docId: "tcode-se09" },
  { code: "SE11", label: "Data Dictionary", docId: "tcode-se11" },
  { code: "SE37", label: "Function Builder", docId: "tcode-se37" },
  { code: "SE38", label: "ABAP Editor", docId: "tcode-se38" },
  { code: "SE80", label: "Object Navigator", docId: "tcode-se80" }
];

// 3. 전체 위키 문서 저장소 (커리큘럼 문서 + 개별 개념 문서 + T-Code 문서가 그물망처럼 연결됨)
window.WIKI_DOCS = {
  // ==========================================================================
  // [00 ~ 02] 커리큘럼 챕터 문서
  // ==========================================================================
  "welcome-guide": {
    id: "welcome-guide",
    stepNum: "00-1",
    title: "코드위키 프레임워크 홈",
    subtitle: "나무위키식 유기적 키워드 연결 + 위키독스식 커리큘럼 플로우",
    categoryId: "ch00",
    aliases: ["코드위키"],
    tcodes: ["SE80", "SE38", "SE37", "SE11", "SE09"],
    summary: "문장 속에 등장하는 개념어와 T-Code들이 각자의 전용 문서로 촘촘하게 자동 연결됩니다. 아래 예시 문장의 파란 키워드에 마우스를 올리거나 클릭해 꼬리에 꼬리를 무는 위키 탐색을 체험해 보세요!",
    specs: {
      "자동 링크 엔진": "문서별 aliases 키워드 자동 감지",
      "개념 파도타기": "설명 속 단어 클릭 → 해당 개념/T-Code 문서 이동",
      "역링크 집계": "우측 카드에 이 문서를 언급한 모든 문서 표시"
    },
    sections: [
      {
        title: "나무위키식 유기적 연결 예시 (직접 클릭해 보세요!)",
        blocks: [
          {
            type: "callout",
            style: "tip",
            title: "🔗 문장 속 키워드가 어떻게 살아 움직이나요?",
            body: "예를 들어 아래 문장은 특별한 링크 기호 없이 평문으로 적었지만, 등록된 키워드들이 자동으로 각자의 문서로 연결되었습니다:\n\n“재사용 가능한 함수인 Function Module은 SE37을 통해 생성하며, 여러 함수를 묶는 Function Group 및 상위 폴더인 Package 안에 저장된다. 이후 SE09에서 Change Request를 Release하여 운영 서버로 이관한다.”"
          },
          {
            type: "text",
            paragraphs: [
              "위 문장에서 **Function Module**, **SE37**, **Function Group**, **Package**, **SE09**, **Change Request** 중 아무 단어나 클릭해 보세요! 각각의 전용 문서로 즉시 이동하며, 이동한 문서의 설명 속에서도 또 다른 키워드(예: SE80, SE38, SE11, MANDT)가 계속해서 이어집니다."
            ]
          }
        ]
      },
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
        title: "지원하는 시각적 학습 블록 미리보기",
        blocks: [
          {
            type: "practice",
            title: "실습 따라하기 블록 예시: SE11에서 테이블 조회하기",
            steps: [
              {
                step: "1",
                action: "Command Field에 SE11을 입력하고 Enter를 누릅니다.",
                detail: "ABAP Dictionary 초기 화면으로 이동합니다."
              },
              {
                step: "2",
                action: "Database table 항목에 `SFLIGHT`를 입력하고 조회(`F7`)합니다.",
                detail: "첫 번째 Key 필드가 {{MANDT}}인지 확인합니다."
              }
            ]
          },
          {
            type: "flow",
            caption: "모듈 통합 E2E 프로세스 흐름도 예시",
            steps: [
              { badge: "SD", title: "영업 주문", desc: "고객 수주 및 가용성 확인" },
              { badge: "MM / PP", title: "조달 & 생산", desc: "구매발주(PO) 및 생산오더" },
              { badge: "FI / CO", title: "회계 & 원가", desc: "전표 자동 기표 및 원가 정산" }
            ]
          }
        ]
      }
    ]
  },

  "ch01-erp-overview": {
    id: "ch01-erp-overview",
    stepNum: "01-1",
    title: "SAP ERP 시스템 개요 및 화면 구성",
    subtitle: "01. SAP ERP 개요 & 시작하기",
    categoryId: "ch01",
    aliases: ["SAP ERP", "SAP GUI"],
    tcodes: ["SE80"],
    summary: "SAP ERP의 기본 클라이언트(MANDT) 구조와 SAP GUI에서 T-Code(예: SE80, SE38, SE11)로 화면을 이동하는 원리를 정리하는 챕터입니다.",
    specs: {
      "챕터": "01. SAP ERP 개요",
      "핵심 연관 키워드": "MANDT, SE80"
    },
    sections: [
      {
        title: "개요 (내용 업데이트 대기 중)",
        blocks: [
          {
            type: "text",
            paragraphs: [
              "수업에서 배운 내용을 말씀해주시면 이곳에 채워집니다. 로그인할 때 입력하는 3자리 방 번호인 MANDT 개념이나 통합 개발 환경인 SE80 문서와도 유기적으로 연결됩니다."
            ]
          }
        ]
      }
    ]
  },

  "ch02-abap-intro": {
    id: "ch02-abap-intro",
    stepNum: "02-1",
    title: "ABAP 개요 및 개발 환경 이해",
    subtitle: "02. ABAP 기초 및 개발 실습",
    categoryId: "ch02",
    aliases: ["ABAP"],
    tcodes: ["SE38", "SE80", "SE37"],
    summary: "ABAP 리포트는 SE38에서, Function Module은 SE37에서, 전체 Package 및 통합 오브젝트 관리는 SE80에서 수행합니다.",
    specs: {
      "챕터": "02. ABAP 기초 및 개발",
      "주요 개발 T-Code": "SE38, SE80, SE37, SE11"
    },
    sections: [
      {
        title: "주요 개발 도구 연결 구조",
        blocks: [
          {
            type: "text",
            paragraphs: [
              "ABAP 개발자는 작업 대상에 따라 전용 T-Code를 오가며 개발하거나, 모든 도구가 하나로 합쳐진 SE80(Object Navigator) 안에서 트리 형태로 작업합니다.",
              "• 일반 실행 프로그램(Report) 작성 시 → SE38 사용",
              "• 데이터베이스 테이블 및 구조 정의 시 → SE11 사용",
              "• 공통 재사용 함수인 Function Module 작성 시 → SE37 사용",
              "• 만든 결과물을 폴더(Package)에 담고 Change Request로 이관 관리 시 → SE09 사용"
            ]
          }
        ]
      }
    ]
  },

  "ch02-ddic": {
    id: "ch02-ddic",
    stepNum: "02-2",
    title: "Data Dictionary 및 테이블 관리",
    subtitle: "02. ABAP 기초 및 개발 실습",
    categoryId: "ch02",
    aliases: ["Data Dictionary", "ABAP Dictionary", "DDIC"],
    tcodes: ["SE11"],
    summary: "SE11을 통해 전사 표준 데이터 타입(Domain, Data Element)과 물리 테이블을 중앙에서 관리하는 데이터 사전입니다.",
    specs: {
      "챕터": "02. ABAP 기초 및 개발",
      "전용 T-Code": "SE11"
    },
    sections: [
      {
        title: "내용 추가 대기 중",
        blocks: [
          {
            type: "text",
            paragraphs: [
              "테이블의 첫 번째 키 필드로 들어가는 MANDT와 SE11에서 만든 오브젝트들을 Package 및 Change Request에 담아 이관하는 흐름이 서로 연결됩니다."
            ]
          }
        ]
      }
    ]
  },

  "ch02-cts-package": {
    id: "ch02-cts-package",
    stepNum: "02-3",
    title: "Change Request · Package · Program 포함 구조",
    subtitle: "왜 저장할 때 Package와 Change Request 팝업이 차례대로 뜰까?",
    categoryId: "ch02",
    aliases: ["CTS", "이관 구조"],
    tcodes: ["SE09", "SE80", "SE38"],
    summary: "SE38에서 만든 프로그램이나 SE37에서 만든 Function Module은 모두 {{Package}}(폴더) 안에 소속되고, 그 변경 기록은 {{Change Request}}(택배 상자)에 담겨 SE09를 통해 운영 서버로 이관됩니다.",
    specs: {
      "운송 컨테이너": "Change Request (SE09)",
      "보관 폴더": "Package (SE80)",
      "연습용 로컬 폴더": "$TMP"
    },
    sections: [
      {
        title: "한눈에 만져보는 포함 관계 시뮬레이터",
        blocks: [
          {
            type: "text",
            paragraphs: [
              "아래 상자를 클릭해 보며 Change Request 상자 안에 Package 폴더가 담기고, 그 안에 SE38 프로그램이나 SE11 테이블이 들어가는 포함 관계를 확인해 보세요!"
            ]
          },
          {
            type: "widget",
            widgetId: "cts-package-viz"
          }
        ]
      }
    ]
  },

  // ==========================================================================
  // [📌 핵심 개념 위키 사전] — 문장 속 키워드 클릭 시 연결되는 개별 개념 문서들
  // ==========================================================================
  "function-module": {
    id: "function-module",
    stepNum: "개념",
    title: "Function Module (펑션 모듈)",
    subtitle: "여러 프로그램에서 공통으로 호출해 재사용하는 SAP 표준/커스텀 함수 부품",
    categoryId: "dict-concept",
    aliases: ["Function Module", "Function module", "펑션 모듈", "함수 모듈"],
    tcodes: ["SE37", "SE80"],
    summary: "Function Module은 SE37(Function Builder)을 통해 생성·테스트하는 독립된 함수 모듈로, 반드시 상위 묶음인 {{Function Group}} 안에 소속됩니다.",
    specs: {
      "생성/조회 T-Code": "SE37 (또는 SE80)",
      "상위 컨테이너": "Function Group → Package",
      "호출 명령어": "CALL FUNCTION '함수명'"
    },
    sections: [
      {
        title: "개요 및 유기적 구조",
        blocks: [
          {
            type: "text",
            paragraphs: [
              "자주 쓰이는 계산 로직이나 전표 생성 로직을 매번 SE38 리포트마다 복붙하지 않고, 하나의 공용 함수 부품으로 만들어 두는 오브젝트입니다.",
              "Function Module은 단독으로 떠돌아다닐 수 없고 반드시 **Function Group**이라는 바구니 안에 담겨야 하며, 그 Function Group은 다시 **Package** 폴더 안에 소속되어 **Change Request**(SE09)를 통해 운영 서버로 이관됩니다."
            ]
          },
          {
            type: "nested",
            caption: "Function Module의 소속 계층 한눈에 보기",
            root: {
              badge: "Change Request (SE09)",
              title: "DEVK900123 — 이관 택배 상자",
              children: [
                {
                  badge: "Package (폴더)",
                  title: "ZEDU_01 — 개발 패키지 폴더",
                  children: [
                    {
                      badge: "Function Group (함수 바구니)",
                      title: "ZFG_CALC — 관련 함수들과 전역 메모리를 공유하는 그룹",
                      items: [
                        { name: "⚡ Z_CALC_TAX", sub: "세액 계산 Function Module (SE37)" },
                        { name: "⚡ Z_CHECK_AUTH", sub: "권한 검증 Function Module (SE37)" }
                      ]
                    }
                  ]
                }
              ]
            }
          }
        ]
      }
    ]
  },

  "function-group": {
    id: "function-group",
    stepNum: "개념",
    title: "Function Group (펑션 그룹)",
    subtitle: "성격이 비슷한 Function Module들을 하나로 묶어 메모리를 공유하는 컨테이너",
    categoryId: "dict-concept",
    aliases: ["Function Group", "Function group", "펑션 그룹"],
    tcodes: ["SE80", "SE37"],
    summary: "Function Module을 SE37에서 만들기 전에 반드시 먼저 생성해야 하는 '함수 전용 바구니'입니다. SE80에서 생성·관리하는 것이 가장 직관적입니다.",
    specs: {
      "관리 T-Code": "SE80, SE37",
      "포함 대상": "여러 개의 Function Module",
      "상위 소속": "Package"
    },
    sections: [
      {
        title: "왜 Function Group이 따로 있나요?",
        blocks: [
          {
            type: "text",
            paragraphs: [
              "같은 Function Group 안에 들어있는 Function Module들은 전역 변수(`TOP Include`)를 서로 공유합니다. 따라서 하나의 Function Module이 호출되어 메모리에 올라오면 같은 Function Group 식구들도 함께 로드됩니다.",
              "생성된 Function Group은 일반 프로그램과 마찬가지로 Package에 할당되며 수정 시 Change Request에 기록됩니다."
            ]
          }
        ]
      }
    ]
  },

  "package": {
    id: "package",
    stepNum: "개념",
    title: "Package (패키지 / 개발 클래스)",
    subtitle: "관련된 모든 개발 오브젝트(Program, Table, Function Group 등)를 묶어 관리하는 폴더",
    categoryId: "dict-concept",
    aliases: ["Package", "패키지", "$TMP"],
    tcodes: ["SE80", "SE21", "SE09"],
    summary: "SE38 프로그램, SE11 테이블, SE37의 Function Module 등 모든 개발 결과물을 업무/모듈 단위로 묶어 보관하는 폴더입니다.",
    specs: {
      "관리 T-Code": "SE80 / SE21",
      "정식 패키지": "Z* 또는 Y* (Change Request 필수)",
      "로컬 연습 패키지": "$TMP (이관 불가)"
    },
    sections: [
      {
        title: "개요",
        blocks: [
          {
            type: "text",
            paragraphs: [
              "SAP에서 새로운 오브젝트를 저장할 때 가장 먼저 물어보는 소속 폴더입니다. 정식 Package에 저장하면 SE09의 Change Request 번호를 요구하며, 연습용인 `$TMP`(Local Object)로 지정하면 개발 서버에만 남고 이관되지 않습니다.",
              "전체적인 포함 그림은 [[ch02-cts-package|02-3. Change Request · Package · Program 포함 구조]] 시뮬레이터에서 한눈에 볼 수 있습니다."
            ]
          }
        ]
      }
    ]
  },

  "change-request": {
    id: "change-request",
    stepNum: "개념",
    title: "Change Request (변경 요청 / Transport Request)",
    subtitle: "개발 서버(DEV)의 작업 내역을 포장해 품질(QAS)·운영(PRD) 서버로 실어 나르는 운송 상자",
    categoryId: "dict-concept",
    aliases: ["Change Request", "Change request", "Transport Request", "체인지 리퀘스트"],
    tcodes: ["SE09"],
    summary: "Package 안에 있는 프로그램이나 테이블을 생성·수정할 때 발급받는 운송장 번호(예: `DEVK900123`)이며, SE09에서 Release하여 다른 서버로 이관합니다.",
    specs: {
      "관리 T-Code": "SE09 (Transport Organizer)",
      "주요 구분": "Workbench (개발물) / Customizing (설정)",
      "시각화 문서": "02-3 시뮬레이터 참조"
    },
    sections: [
      {
        title: "개요",
        blocks: [
          {
            type: "text",
            paragraphs: [
              "운영 중인 ERP를 안전하게 지키기 위해 모든 개발은 개발 서버(DEV)에서만 수행하고, 그 변경 목록을 Change Request 상자에 차곡차곡 기록합니다. 작업이 완료되면 SE09에서 상자를 봉인(Release)하여 테스트 서버와 운영 서버로 반영합니다."
            ]
          }
        ]
      }
    ]
  },

  "mandt": {
    id: "mandt",
    stepNum: "개념",
    title: "MANDT (Client 번호 필드)",
    subtitle: "하나의 SAP 서버 안에서 회사별 데이터를 철저히 격리하는 3자리 방 번호",
    categoryId: "dict-concept",
    aliases: ["MANDT", "Client"],
    tcodes: ["SE11"],
    summary: "SE11에서 비즈니스 테이블을 만들 때 맨 첫 번째 Primary Key로 들어가는 3자리 클라이언트 코드 필드입니다.",
    specs: {
      "데이터 타입": "CLNT (길이 3)",
      "시스템 변수": "sy-mandt",
      "관련 T-Code": "SE11"
    },
    sections: [
      {
        title: "개요",
        blocks: [
          {
            type: "text",
            paragraphs: [
              "SAP 로그인 화면에서 가장 먼저 입력하는 Client 번호(예: 100, 800)가 테이블 컬럼으로 들어갈 때 `MANDT`라는 이름을 씁니다. SE38에서 Open SQL(`SELECT`)을 실행하면 SAP가 자동으로 현재 접속한 `MANDT` 값만 조회하도록 필터링해 줍니다."
            ]
          }
        ]
      }
    ]
  },

  // ==========================================================================
  // [⌨️ T-Code 전용 문서] — 문장 속 'SE37', 'SE11' 등 클릭 시 바로 열리는 문서들!
  // ==========================================================================
  "tcode-se37": {
    id: "tcode-se37",
    stepNum: "T-Code",
    title: "SE37 (Function Builder)",
    subtitle: "Function Module을 생성 · 수정 · 단독 실행(F8 테스트)하는 전용 트랜잭션",
    categoryId: "dict-tcode",
    aliases: ["SE37", "se37"],
    tcodes: ["SE37", "SE80"],
    summary: "Function Module을 만들고 Import/Export 파라미터를 정의하며, 프로그램 연결 전 `F8` 키로 입력값을 직접 넣어 결과를 즉시 테스트해 볼 수 있는 T-Code입니다.",
    specs: {
      "T-Code": "SE37",
      "정식 명칭": "Function Builder",
      "다루는 대상": "Function Module, Function Group",
      "통합 대체 화면": "SE80 (Object Navigator)"
    },
    sections: [
      {
        title: "SE37의 핵심 탭 구성",
        blocks: [
          {
            type: "table",
            headers: ["탭 이름", "역할 요약"],
            rows: [
              ["Attributes", "소속된 Function Group 확인 및 일반 함수 / 원격 호출(RFC) 여부 설정"],
              ["Import / Export", "함수로 들어오는 입력값(Import)과 계산 후 돌려주는 출력값(Export) 정의"],
              ["Changing / Tables", "입출력을 겸하는 변수 및 다중 행 테이블 파라미터 전달"],
              ["Exceptions", "0으로 나누기나 데이터 없음 등 에러 상황 코드 정의"],
              ["Source code", "실제 ABAP 로직 작성 공간"]
            ]
          },
          {
            type: "practice",
            title: "SE37에서 Function Module 단독 테스트하는 법",
            steps: [
              {
                step: "1",
                action: "Command Field에 `SE37`을 입력하고 조회할 Function Module 이름을 적습니다.",
                detail: "생성하거나 수정할 때는 소속될 Function Group과 Package 및 Change Request가 필요합니다."
              },
              {
                step: "2",
                action: "상단 스패너 모양 아이콘 또는 단축키 `F8`(Test/Execute)을 누릅니다.",
                detail: "별도의 SE38 프로그램을 짜지 않아도 Import 값을 직접 입력해 Export 결과를 바로 검증할 수 있습니다!"
              }
            ]
          }
        ]
      }
    ]
  },

  "tcode-se38": {
    id: "tcode-se38",
    stepNum: "T-Code",
    title: "SE38 (ABAP Editor)",
    subtitle: "ABAP 리포트(Executable Program) 소스코드를 작성하고 실행하는 가장 기본 개발 화면",
    categoryId: "dict-tcode",
    aliases: ["SE38", "se38"],
    tcodes: ["SE38", "SE80"],
    summary: "프로그램(`Z*`)을 생성하고 ABAP 코드를 작성·활성화(`Ctrl+F3`)·실행(`F8`)하는 에디터 화면입니다.",
    specs: {
      "T-Code": "SE38",
      "정식 명칭": "ABAP Editor",
      "연관 도구": "SE80, SE11, SE37, SE09"
    },
    sections: [
      {
        title: "개요",
        blocks: [
          {
            type: "text",
            paragraphs: [
              "ABAP 입문자가 가장 먼저 만나는 코드 에디터입니다. SE38에서 새 프로그램을 만들고 저장하면 소속 폴더인 Package 지정 창이 뜨고, 정식 패키지일 경우 Change Request(SE09) 번호를 선택하게 됩니다.",
              "코드 안에서 **[Pattern]** 버튼을 누르면 SE37에서 만들어 둔 Function Module 호출 구문(`CALL FUNCTION`)을 자동으로 찍어주는 편리한 기능도 제공합니다!"
            ]
          }
        ]
      }
    ]
  },

  "tcode-se11": {
    id: "tcode-se11",
    stepNum: "T-Code",
    title: "SE11 (ABAP Dictionary)",
    subtitle: "DB 테이블, 뷰, 데이터 엘리먼트, 도메인, 서치헬프 등을 정의하는 데이터 사전 트랜잭션",
    categoryId: "dict-tcode",
    aliases: ["SE11", "se11"],
    tcodes: ["SE11"],
    summary: "SAP의 모든 테이블과 표준 데이터 타입을 생성·조회하는 T-Code입니다.",
    specs: {
      "T-Code": "SE11",
      "정식 명칭": "ABAP Dictionary",
      "연관 챕터": "02-2. Data Dictionary"
    },
    sections: [
      {
        title: "개요",
        blocks: [
          {
            type: "text",
            paragraphs: [
              "SE11에서 생성한 테이블과 데이터 타입은 SE38 리포트 프로그램이나 SE37의 Function Module 파라미터 타입 선언에서 공통으로 가져다 씁니다. 생성 시 마찬가지로 Package와 Change Request(SE09)에 귀속됩니다."
            ]
          }
        ]
      }
    ]
  },

  "tcode-se80": {
    id: "tcode-se80",
    stepNum: "T-Code",
    title: "SE80 (Object Navigator)",
    subtitle: "Package, 프로그램, Function Group, 화면(Screen), 클래스를 왼쪽 트리 하나로 통합 관리하는 올인원 개발 환경",
    categoryId: "dict-tcode",
    aliases: ["SE80", "se80"],
    tcodes: ["SE80", "SE38", "SE37", "SE11"],
    summary: "SE38, SE37, SE11 기능을 따로 띄우지 않고 한 화면의 좌측 트리에서 Package 단위로 한눈에 개발할 수 있는 통합 워크벤치입니다.",
    specs: {
      "T-Code": "SE80",
      "정식 명칭": "Object Navigator",
      "최대 장점": "Package 및 Function Group 트리 구조 한눈에 파악"
    },
    sections: [
      {
        title: "개요",
        blocks: [
          {
            type: "text",
            paragraphs: [
              "실무에서는 SE38처럼 단일 프로그램만 볼 때보다, 하나의 Package 안에 어떤 프로그램과 Function Group, Function Module, 화면(Module Pool), T-Code들이 들어있는지 트리 형태로 한꺼번에 보며 개발하기 위해 SE80을 가장 많이 사용합니다."
            ]
          }
        ]
      }
    ]
  },

  "tcode-se09": {
    id: "tcode-se09",
    stepNum: "T-Code",
    title: "SE09 (Transport Organizer)",
    subtitle: "내가 작업한 Change Request와 Task 목록을 확인하고 운영 서버 이관을 위해 Release(밀봉)하는 화면",
    categoryId: "dict-tcode",
    aliases: ["SE09", "se09", "SE10"],
    tcodes: ["SE09"],
    summary: "SE38, SE11, SE37, SE80에서 수정하며 담긴 Change Request 목록을 조회·관리하고 Release(출고)하는 T-Code입니다.",
    specs: {
      "T-Code": "SE09 (또는 SE10)",
      "정식 명칭": "Transport Organizer",
      "다루는 대상": "Change Request, Task"
    },
    sections: [
      {
        title: "개요",
        blocks: [
          {
            type: "text",
            paragraphs: [
              "내 아이디로 생성된 Change Request 안에 어떤 Package의 어떤 오브젝트들이 담겨 있는지 트리로 확인하고, 개발 완료 후 트럭 아이콘(**Release**)을 눌러 품질/운영 서버로 보낼 준비를 마치는 곳입니다."
            ]
          }
        ]
      }
    ]
  }
};
