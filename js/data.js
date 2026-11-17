/**
 * ============================================================================
 * [유지보수 전용 데이터 파일: js/data.js]
 * ----------------------------------------------------------------------------
 * 위키독스 《SAP ERP 따라하기 (ABAP · FI · CO · MM · SD · PP)》 스타일의
 * 순차적 커리큘럼 트리 + 나무위키식 상호 하이퍼링크 + 토스 디자인 블록 구조입니다.
 * ============================================================================
 */

// 1. 위키독스 스타일 대단원(Chapter) 구성
window.WIKI_CATEGORIES = [
  { id: "ch00", code: "00", name: "00. 프롤로그 & 코드위키 가이드" },
  { id: "ch01", code: "01", name: "01. SAP ERP 개요 & 시작하기" },
  { id: "ch02", code: "02", name: "02. ABAP 기초 및 개발 실습" },
  { id: "ch03", code: "03", name: "03. FI (재무회계) 따라하기" },
  { id: "ch04", code: "04", name: "04. CO (관리회계) 따라하기" },
  { id: "ch05", code: "05", name: "05. MM (자재관리) 따라하기" },
  { id: "ch06", code: "06", name: "06. SD (영업유통) 따라하기" },
  { id: "ch07", code: "07", name: "07. PP (생산관리) 따라하기" },
  { id: "ch08", code: "08", name: "08. 모듈 통합 프로세스 (E2E)" }
];

// 2. 자주 쓰는 T-Code 빠른 사전 (배우실 때마다 한 줄씩 추가)
window.WIKI_TCODES = [
  { code: "SE09", label: "Transport Organizer", docId: "ch02-cts-package" },
  { code: "SE11", label: "ABAP Dictionary", docId: "ch02-ddic" },
  { code: "SE38", label: "ABAP Editor", docId: "ch02-abap-intro" },
  { code: "SE80", label: "Object Navigator", docId: "ch02-cts-package" }
];

// 3. 위키 문서 저장소 (위키독스처럼 순서대로 이전/다음 페이지가 자동 연결됩니다)
window.WIKI_DOCS = {
  "welcome-guide": {
    id: "welcome-guide",
    stepNum: "00-1",
    title: "코드위키 (CODE WIKI) 프레임워크 가이드",
    subtitle: "위키독스식 순차 학습 플로우 + 나무위키식 개념 연결 + 토스 스타일 UI",
    categoryId: "ch00",
    tcodes: ["SE38", "SE11"],
    summary: "위키독스처럼 좌측 목차와 하단 [이전/다음] 버튼으로 순서대로 따라가며 공부하고, 모르는 용어는 나무위키처럼 링크에 마우스를 올려 즉시 확인하는 우리 반 전용 위키입니다.",
    specs: {
      "사이트명": "코드위키 (ㅋㄷㅇㅋ)",
      "학습 플로우": "위키독스형 순차 커리큘럼 + 따라하기 스텝",
      "개념 연결": "나무위키형 양방향 링크 & 역링크",
      "접근 권한": "우리 반 승인제 (Admin Approval)"
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
        title: "위키독스 스타일 '실습 따라하기 (practice)' 블록 예시",
        blocks: [
          {
            type: "text",
            paragraphs: [
              "수업에서 강사님과 함께 따라 해본 실습 순서(T-Code 입력 → 조건 세팅 → 실행)를 말씀해주시면 아래처럼 **Step-by-Step 따라하기 블록**으로 깔끔하게 정리해 드립니다."
            ]
          },
          {
            type: "practice",
            title: "실습 따라하기 예시: SE11에서 테이블 구조 조회하기",
            steps: [
              {
                step: "1",
                action: "Command Field에 `SE11`을 입력하고 Enter를 누릅니다.",
                detail: "ABAP Dictionary 초기 화면으로 이동합니다."
              },
              {
                step: "2",
                action: "**Database table** 라디오버튼을 선택하고 입력창에 `SFLIGHT`를 입력합니다.",
                detail: "항공편 운항 일정 표준 테이블입니다. [[ch02-ddic|2-2. Data Dictionary (SE11)]] 문서에서 자세히 다룹니다."
              },
              {
                step: "3",
                action: "하단 **[Display (조회)]** 버튼(`F7`)을 클릭하여 필드와 Key 구조를 확인합니다.",
                detail: "첫 번째 필드가 {{MANDT}} (Client 키)인지 확인해 보세요!"
              }
            ]
          }
        ]
      },
      {
        title: "시각적 개념 블록 (흐름도 · 비교 카드 · 콜아웃 · 표)",
        blocks: [
          {
            type: "flow",
            caption: "모듈 통합 E2E 프로세스 흐름도 블록 예시",
            steps: [
              { badge: "SD (영업)", title: "판매 오더 수주", desc: "고객 주문 접수 및 가용성 점검" },
              { badge: "MM / PP", title: "자재 조달 & 생산", desc: "MRP 실행 후 구매발주(PO) 및 생산오더" },
              { badge: "SD / MM", title: "출하 및 출고", desc: "고객에게 제품 배송 및 재고 차감" },
              { badge: "FI / CO", title: "회계 전표 & 원가", desc: "매출채권(AR) 및 매출원가 자동 기표" }
            ]
          },
          {
            type: "compare",
            items: [
              {
                tag: "비교 카드 A",
                title: "FI (Financial Accounting, 재무회계)",
                points: [
                  "**외부 이해관계자**(주주, 세무서, 은행) 보고 목적",
                  "법적 기준(K-IFRS)을 준수하는 재무상태표·손익계산서 작성",
                  "핵심 서브모듈: {{G/L}}(총계정원장), {{AP}}(매입채무), {{AR}}(매출채권), {{AA}}(자산회계)"
                ]
              },
              {
                tag: "비교 카드 B",
                title: "CO (Controlling, 관리회계)",
                points: [
                  "**내부 경영진**의 의사결정 및 원가 절감·수익성 관리 목적",
                  "부서별 비용 통제 및 제품별 실제 제조원가 정밀 산출",
                  "핵심 서브모듈: {{CCA}}(코스트센터), {{PC}}(제품원가), {{PA}}(수익성분석)"
                ]
              }
            ]
          },
          {
            type: "callout",
            style: "tip",
            title: "💡 앞으로 업데이트하는 방법",
            body: "오늘 수업에서 배운 진도나 노트를 채팅으로 편하게 던져주시면, 해당 챕터(01~08) 아래에 새 문서를 추가하고 기존 문서들과 하이퍼링크로 촘촘하게 연결해 드립니다!"
          }
        ]
      }
    ]
  },

  "ch01-erp-overview": {
    id: "ch01-erp-overview",
    stepNum: "01-1",
    title: "SAP ERP 시스템 개요 및 화면 구성",
    subtitle: "01. SAP ERP 개요 & 시작하기 — 첫 번째 노트 슬롯",
    categoryId: "ch01",
    tcodes: ["SE80"],
    summary: "SAP ERP의 전반적인 개념과 SAP Logon / GUI 화면 구성을 정리할 문서 슬롯입니다. (내용을 말씀해주시면 채워집니다!)",
    specs: {
      "챕터": "01. SAP ERP 개요",
      "상태": "학습 내용 입력 대기 중"
    },
    sections: [
      {
        title: "내용 추가 대기 중",
        blocks: [
          {
            type: "text",
            paragraphs: [
              "이 문서는 **01. SAP ERP 개요 & 시작하기** 챕터의 첫 번째 페이지입니다. 수업에서 배우신 내용을 말씀해주시면 [[welcome-guide|코드위키 가이드]]의 시각적 블록들로 정리됩니다."
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
    subtitle: "02. ABAP 기초 및 개발 실습 — 첫 번째 노트 슬롯",
    categoryId: "ch02",
    tcodes: ["SE38", "SE80"],
    summary: "ABAP 언어의 특징과 개발 환경(SE38, SE80, ADT)을 정리할 문서 슬롯입니다.",
    specs: {
      "챕터": "02. ABAP 기초 및 개발",
      "관련 T-Code": "SE38, SE80"
    },
    sections: [
      {
        title: "내용 추가 대기 중",
        blocks: [
          {
            type: "text",
            paragraphs: [
              "다음 페이지인 [[ch02-ddic|02-2. Data Dictionary (SE11)]]와 하단 **[다음 챕터]** 버튼으로 자연스럽게 연결됩니다."
            ]
          }
        ]
      }
    ]
  },

  "ch02-ddic": {
    id: "ch02-ddic",
    stepNum: "02-2",
    title: "Data Dictionary (SE11) 및 테이블 관리",
    subtitle: "02. ABAP 기초 및 개발 실습 — 두 번째 노트 슬롯",
    categoryId: "ch02",
    tcodes: ["SE11"],
    summary: "SE11 데이터 사전(Domain, Data Element, Table) 실습 내용을 채워 넣을 문서 슬롯입니다.",
    specs: {
      "챕터": "02. ABAP 기초 및 개발",
      "관련 T-Code": "SE11"
    },
    sections: [
      {
        title: "내용 추가 대기 중",
        blocks: [
          {
            type: "text",
            paragraphs: [
              "배우신 내용을 말씀해주시면 이곳에 정리됩니다. 다음 페이지인 [[ch02-cts-package|02-3. Change Request · Package · Program 관계]]로 이동해 보세요!"
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
    subtitle: "왜 프로그램을 저장할 때 Package와 Request 번호를 차례대로 물어볼까?",
    categoryId: "ch02",
    tcodes: ["SE09", "SE80", "SE21", "SE38"],
    summary: "프로그램(파일)은 {{Package}}(폴더) 안에 정리되고, 그 변경분은 {{Change Request}}(택배 상자)에 담겨 개발 서버(DEV)에서 운영 서버(PRD)로 이사 갑니다!",
    specs: {
      "바깥 상자 (운송)": "Change Request (SE09)",
      "중간 폴더 (보관)": "Package (SE80 / SE21)",
      "안쪽 알맹이": "Program, Table, T-Code 등",
      "연습용 로컬 폴더": "$TMP (이관 상자 안 뜸)"
    },
    sections: [
      {
        title: "한눈에 만져보는 포함 관계 시뮬레이터",
        blocks: [
          {
            type: "text",
            paragraphs: [
              "처음 `SE38`이나 `SE11`에서 무언가를 만들고 저장(`Ctrl + S`)하면 팝업창이 연달아 2번 떠서 당황하기 쉽습니다. 아래 **중첩 상자**를 바깥부터 안쪽으로 클릭해 보며 **택배 상자(`Change Request`) → 폴더(`Package`) → 프로그램(`Program`)**의 관계를 직접 확인해 보세요!"
            ]
          },
          {
            type: "widget",
            widgetId: "cts-package-viz"
          }
        ]
      },
      {
        title: "핵심 비유: 이사 갈 때 짐 싸는 순서와 똑같다!",
        blocks: [
          {
            type: "flow",
            caption: "프로그램 생성부터 운영 서버(PRD) 반영까지의 흐름",
            steps: [
              {
                badge: "1. 파일 생성",
                title: "Program 작성 (SE38)",
                desc: "개발 서버(DEV)에서 리포트나 테이블 등 알맹이를 만듦"
              },
              {
                badge: "2. 폴더 지정",
                title: "Package 선택",
                desc: "어느 업무 폴더(예: ZSD, ZFI)에 보관할지 지정 ($TMP는 내 책상)"
              },
              {
                badge: "3. 택배 포장",
                title: "Change Request 담기",
                desc: "운영 서버로 보낼 택배 상자 번호(CTS)에 변경 내역 기록"
              },
              {
                badge: "4. 트럭 출발",
                title: "SE09 Release & 이관",
                desc: "상자를 밀봉(Release)하면 QAS → PRD 서버로 배달 완료!"
              }
            ]
          },
          {
            type: "compare",
            items: [
              {
                tag: "실무 개발 시",
                title: "정식 Package (예: ZEDU_01)",
                points: [
                  "`Z` 또는 `Y`로 시작하는 정식 패키지 폴더에 저장",
                  "저장 시 반드시 **{{Change Request}} 번호 팝업**이 뜸",
                  "`SE09`에서 Release 하면 품질(QAS)·운영(PRD) 서버로 이관 가능"
                ]
              },
              {
                tag: "혼자 연습할 때",
                title: "로컬 오브젝트 ({{$TMP}})",
                points: [
                  "팝업에서 **[Local Object]** 버튼을 누르면 자동 지정되는 연습장 패키지",
                  "다른 서버로 안 보낼 거라 **Change Request 팝업이 아예 안 뜸!**",
                  "~~실무에서 운영에 반영할 걸 실수로 $TMP에 만들면 나중에 패키지 바꿔주느라 땀난다~~"
                ]
              }
            ]
          }
        ]
      },
      {
        title: "재사용 가능한 중첩 박스(nested) 블록 요약",
        blocks: [
          {
            type: "text",
            paragraphs: [
              "앞으로 다른 개념(예: `Change Request` 안의 `Task` 구조나 `조직 구조`)을 정리할 때도 아래처럼 깔끔한 **중첩 포함 블록**으로 언제든 표현할 수 있습니다."
            ]
          },
          {
            type: "nested",
            caption: "SE09에서 보게 되는 실제 트리 계층 구조",
            root: {
              badge: "Change Request (큰 택배 상자)",
              title: "DEVK900123 — [프로젝트] 영업 월마감 리포트 개발",
              code: "Workbench Request",
              desc: "프로젝트 리더 또는 본인이 생성한 대표 운송장 번호",
              children: [
                {
                  badge: "Task (팀원별 소포 상자)",
                  title: "DEVK900124 — 개발자 A의 작업 목록 → Package [ZSD_PACK] 소속 오브젝트들",
                  desc: "실제 수정한 패키지 내의 개발 오브젝트들이 이 안에 차곡차곡 기록됩니다.",
                  items: [
                    { name: "📄 ZSDR0010", sub: "ABAP 리포트 프로그램" },
                    { name: "🗃️ ZSDT0010", sub: "마감 집계 테이블" },
                    { name: "🔑 ZSD10", sub: "실행용 T-Code" }
                  ]
                }
              ]
            }
          }
        ]
      }
    ]
  }
};
