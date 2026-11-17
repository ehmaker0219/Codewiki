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
  { code: "SE11", label: "ABAP Dictionary", docId: "ch02-ddic" },
  { code: "SE38", label: "ABAP Editor", docId: "ch02-abap-intro" },
  { code: "SE80", label: "Object Navigator", docId: "ch01-erp-overview" }
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
              "배우신 내용을 말씀해주시면 이곳에 정리됩니다. 이전 문서인 [[ch02-abap-intro|02-1. ABAP 개요]]로 돌아가거나 다음 챕터로 이동할 수 있습니다."
            ]
          }
        ]
      }
    ]
  }
};
