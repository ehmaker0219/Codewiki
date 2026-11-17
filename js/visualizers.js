/**
 * ============================================================================
 * [인터랙티브 위젯 레지스트리: js/visualizers.js]
 * ----------------------------------------------------------------------------
 * 일반 블록(flow, compare, table)만으로 표현하기 아쉬운 동적 시뮬레이터가 필요할 때,
 * 여기에 위젯 함수를 등록하고 data.js에서 { type: "widget", widgetId: "이름" }으로
 * 호출만 하면 본문 원하는 위치에 깔끔하게 삽입됩니다.
 * ============================================================================
 */
(function () {
  const svgPaths = {
    typeA: `
      <path d="M12 12 H54 V54 H41 V40 H15 V28.5 H41 V23.5 H12 Z" />
      <path d="M66 12 H108 V25 H79 V41 H108 V54 H66 Z" />
      <path fill-rule="evenodd" clip-rule="evenodd" d="M33 66 A21 21 0 1 0 33 108 A21 21 0 1 0 33 66 Z M33 79 A8 8 0 1 1 33 95 A8 8 0 1 1 33 79 Z" />
      <path d="M66 66 H108 V108 H95 V94 H69 V82.5 H95 V77.5 H66 Z" />
    `,
    typeB: `
      <!-- 좌상단 ㅋ: ㄱ블록 + 독립 가로바 -->
      <path d="M12 12 H54 V54 H41 V25 H12 Z" />
      <rect x="12" y="31" width="23" height="12" />
      <!-- 우상단 ㄷ -->
      <path d="M66 12 H108 V25 H79 V41 H108 V54 H66 Z" />
      <!-- 좌하단 ㅇ -->
      <path fill-rule="evenodd" clip-rule="evenodd" d="M33 66 A21 21 0 1 0 33 108 A21 21 0 1 0 33 66 Z M33 79 A8 8 0 1 1 33 95 A8 8 0 1 1 33 79 Z" />
      <!-- 우하단 ㅋ: ㄱ블록 + 독립 가로바 -->
      <path d="M66 66 H108 V108 H95 V79 H66 Z" />
      <rect x="66" y="85" width="23" height="12" />
    `
  };

  window.WIKI_WIDGETS = {
    // 1. 코드위키 (ㅋㄷㅇㅋ) 심볼 디자인 쇼케이스 위젯
    "logo-showcase": function (container) {
      let selectedType = "typeA";

      function render() {
        const activeMarkup = svgPaths[selectedType];
        // 상단 헤더 심볼도 실시간 반영
        const headerSvg = document.querySelector(".brand-symbol svg");
        if (headerSvg) {
          headerSvg.innerHTML = activeMarkup;
        }

        container.innerHTML = `
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:16px;">
            <div>
              <span style="font-size:13px; font-weight:800; color:var(--toss-blue);">
                ✦ 코드위키 (ㅋㄷ / ㅇㅋ) 기하학 초성 심볼 시안
              </span>
              <div style="font-size:13px; color:var(--text-sub); margin-top:2px;">
                보내주신 레퍼런스(ㅎㅇ/ㅅㄷ)의 굵은 기하학 비율로 설계한 <strong>ㅋ·ㄷ·ㅇ·ㅋ</strong> 2×2 그리드 심볼입니다. 클릭하면 상단 로고에 바로 적용됩니다!
              </div>
            </div>
            <div style="display:flex; gap:8px;">
              <button class="toss-chip-btn ${selectedType === "typeA" ? "active" : ""}" data-logo-type="typeA" style="height:34px; font-size:12.5px;">
                시안 A (일체형 ㅋ)
              </button>
              <button class="toss-chip-btn ${selectedType === "typeB" ? "active" : ""}" data-logo-type="typeB" style="height:34px; font-size:12.5px;">
                시안 B (분리형 기하학 ㅋ)
              </button>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:14px;">
            <!-- 1. 오리지널 미니멀 화이트/블랙 -->
            <div style="background:#ffffff; border-radius:20px; padding:28px 20px; display:flex; flex-direction:column; align-items:center; gap:14px; box-shadow:var(--shadow-card);">
              <svg width="88" height="88" viewBox="0 0 120 120" fill="#191F28">
                ${activeMarkup}
              </svg>
              <div style="font-size:12.5px; font-weight:700; color:#4e5968;">1. 오리지널 모노 심볼</div>
            </div>

            <!-- 2. 토스 스쿼클 앱 아이콘 스타일 -->
            <div style="background:#ffffff; border-radius:20px; padding:28px 20px; display:flex; flex-direction:column; align-items:center; gap:14px; box-shadow:var(--shadow-card);">
              <div style="width:88px; height:88px; border-radius:24px; background:#3182F6; display:flex; align-items:center; justify-content:center; box-shadow:0 8px 20px rgba(49, 130, 246, 0.28);">
                <svg width="56" height="56" viewBox="0 0 120 120" fill="#FFFFFF">
                  ${activeMarkup}
                </svg>
              </div>
              <div style="font-size:12.5px; font-weight:700; color:#4e5968;">2. 토스 블루 앱 아이콘</div>
            </div>

            <!-- 3. 다크 서피스 심볼 -->
            <div style="background:#191F28; border-radius:20px; padding:28px 20px; display:flex; flex-direction:column; align-items:center; gap:14px; box-shadow:var(--shadow-card);">
              <svg width="88" height="88" viewBox="0 0 120 120" fill="#F9FAFB">
                ${activeMarkup}
              </svg>
              <div style="font-size:12.5px; font-weight:700; color:#9ea4aa;">3. 다크 모드 심볼</div>
            </div>
          </div>
        `;

        container.querySelectorAll("[data-logo-type]").forEach(btn => {
          btn.addEventListener("click", () => {
            selectedType = btn.getAttribute("data-logo-type");
            render();
          });
        });
      }

      render();
    },

    // 2. 가이드 문서용 인터랙티브 데모 슬롯
    "interactive-demo": function (container) {
      let activeTab = 0;
      const steps = [
        {
          btn: "STEP 1. 개념 클릭",
          title: "클릭에 반응하는 인터랙티브 다이어그램 슬롯",
          desc: "단순 정적 이미지를 넘어, 사용자가 버튼을 누르면 데이터 흐름이나 상태가 바뀌는 맞춤형 미니 시뮬레이터를 문서 중간 어디든 끼워 넣을 수 있습니다."
        },
        {
          btn: "STEP 2. 상태 변화 확인",
          title: "메모리 적재 · 테이블 조인 · 화면 이벤트 시뮬레이션",
          desc: "나중에 배우실 Internal Table 행 이동, SE11 도메인-엘리먼트 연결, 리포트 이벤트 순서 등을 이런 토스 스타일 인터랙티브 카드로 하나씩 만들어 채워 넣을 수 있습니다."
        },
        {
          btn: "STEP 3. 독립 모듈 구조",
          title: "유지보수 걱정 없는 플러그인 방식",
          desc: "각 위젯은 고유 ID로 독립되어 있어서, 새 위젯을 추가하거나 수정해도 기존 문서나 레이아웃에는 전혀 영향을 주지 않습니다."
        }
      ];

      function render() {
        const cur = steps[activeTab];
        container.innerHTML = `
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-bottom:14px;">
            <span style="font-size:12.5px; font-weight:700; color:var(--toss-blue);">
              ⚡ 인터랙티브 위젯 슬롯 예시 (클릭해 보세요)
            </span>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              ${steps
                .map(
                  (s, idx) => `
                <button class="toss-chip-btn ${idx === activeTab ? "active" : ""}" data-idx="${idx}" style="height:32px; font-size:12px;">
                  ${s.btn}
                </button>
              `
                )
                .join("")}
            </div>
          </div>
          <div style="background:var(--bg-card); border-radius:16px; padding:18px 20px;">
            <div style="font-size:15.5px; font-weight:800; color:var(--text-strong); margin-bottom:6px;">
              ${cur.title}
            </div>
            <div style="font-size:14px; color:var(--text-sub); line-height:1.6;">
              ${cur.desc}
            </div>
          </div>
        `;

        container.querySelectorAll("[data-idx]").forEach(btn => {
          btn.addEventListener("click", () => {
            activeTab = parseInt(btn.getAttribute("data-idx"), 10);
            render();
          });
        });
      }

      render();
    }
  };
})();
