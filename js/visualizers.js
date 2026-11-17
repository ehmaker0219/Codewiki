/**
 * ============================================================================
 * [인터랙티브 위젯 레지스트리: js/visualizers.js]
 * ----------------------------------------------------------------------------
 * 일반 블록(flow, compare, table, nested)만으로 표현하기 아쉬운 동적 시뮬레이터를
 * 고유 ID로 등록하고 data.js에서 { type: "widget", widgetId: "이름" }으로 호출합니다.
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
      <path d="M12 12 H54 V54 H41 V25 H12 Z" />
      <rect x="12" y="31" width="23" height="12" />
      <path d="M66 12 H108 V25 H79 V41 H108 V54 H66 Z" />
      <path fill-rule="evenodd" clip-rule="evenodd" d="M33 66 A21 21 0 1 0 33 108 A21 21 0 1 0 33 66 Z M33 79 A8 8 0 1 1 33 95 A8 8 0 1 1 33 79 Z" />
      <path d="M66 66 H108 V108 H95 V79 H66 Z" />
      <rect x="66" y="85" width="23" height="12" />
    `
  };

  window.WIKI_WIDGETS = {
    // 1. Change Request > Package > Program 시각적 포함 관계 & 이관 시뮬레이터
    "cts-package-viz": function (container) {
      let mode = "transport"; // 'transport' (정식 패키지 ZEDU_01) | 'local' ($TMP 연습장)
      let selectedPart = "cr"; // 'cr' | 'pkg' | 'prog'
      let serverStep = 0; // 0: DEV 작업중, 1: QAS 이관됨, 2: PRD 운영 반영됨

      const partDetails = {
        cr: {
          badge: "가장 바깥 운송 컨테이너 · SE09 / SE10",
          title: "🚚 Change Request (CTS 번호 · 예: DEVK900123)",
          analogy: "비유하자면 **'이사 택배 박스(트럭)'**입니다!",
          desc: "개발 서버(DEV)에서 만들고 수정한 결과물들을 담아서 품질 서버(QAS)와 운영 서버(PRD)로 안전하게 옮겨주는 운송장 번호입니다. 같은 프로젝트 팀원들과 하나의 Change Request 아래에 각자 Task(작은 상자)를 나눠 담기도 합니다."
        },
        pkg: {
          badge: "중간 보관 폴더 · SE80 / SE21",
          title: "📁 Package (패키지 · 예: ZEDU_01 vs $TMP)",
          analogy: "비유하자면 프로그램들을 주제별로 모아두는 **'서랍장(폴더)'**입니다!",
          desc: "프로그램을 저장할 때 제일 먼저 '어느 폴더(Package)에 넣을래?' 하고 물어봅니다. 이때 정식 패키지(Z로 시작)에 넣으면 자동으로 '그럼 어느 택배 박스(Change Request)에 실을래?' 팝업이 이어서 뜨고, $TMP(Local Object)를 고르면 내 연습장에만 저장되어 택배 박스를 묻지 않습니다."
        },
        prog: {
          badge: "가장 안쪽 실제 결과물 · SE38 / SE11 / SE93",
          title: "📄 Program · Table · T-Code (개발 오브젝트)",
          analogy: "비유하자면 폴더 안에 실제로 들어가는 **'문서 파일과 부품들'**입니다!",
          desc: "우리가 매일 만드는 ABAP 리포트 프로그램(SE38), DB 테이블(SE11), 화면, 클래스, 트랜잭션 코드(SE93) 등 모든 개발 결과물은 반드시 하나의 Package 안에 소속되며, 수정할 때마다 Change Request에 변경 기록이 차곡차곡 담깁니다."
        }
      };

      function render() {
        const isLocal = mode === "local";
        const detail = partDetails[selectedPart];

        const servers = [
          { code: "DEV", name: "개발 서버", sub: "코드 작성 및 단위 테스트" },
          { code: "QAS", name: "품질 검증 서버", sub: "현업 테스트 및 통합 검증" },
          { code: "PRD", name: "운영 서버", sub: "실제 회사 업무 가동!" }
        ];

        container.innerHTML = `
          <!-- 상단 모드 전환 바 -->
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:16px;">
            <div>
              <span style="font-size:13px; font-weight:800; color:var(--toss-blue);">
                📦 포함 구조 & 이관(CTS) 인터랙티브 시각화
              </span>
              <div style="font-size:12.5px; color:var(--text-muted); margin-top:2px;">
                각 상자(Change Request · Package · Program)를 직접 클릭해 보세요!
              </div>
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <button type="button" class="toss-chip-btn ${!isLocal ? "active" : ""}" data-mode="transport" style="height:34px; font-size:12.5px;">
                🚚 실무 패키지 (ZEDU_01)
              </button>
              <button type="button" class="toss-chip-btn ${isLocal ? "active" : ""}" data-mode="local" style="height:34px; font-size:12.5px;">
                🏠 로컬 연습장 ($TMP)
              </button>
            </div>
          </div>

          <!-- 메인 마트료시카(중첩 박스) 다이어그램 -->
          <div
            data-select-part="cr"
            style="
              border-radius:22px;
              padding:20px;
              cursor:pointer;
              transition:all 0.2s;
              background:${isLocal ? "var(--bg-card)" : "var(--toss-blue-soft)"};
              border:2px ${isLocal ? "dashed var(--border-subtle)" : selectedPart === "cr" ? "solid var(--toss-blue)" : "dashed rgba(49,130,246,0.45)"};
            "
          >
            <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:11.5px; font-weight:800; padding:3px 10px; border-radius:999px; background:${
                  isLocal ? "var(--bg-chip)" : "var(--toss-blue)"
                }; color:${isLocal ? "var(--text-muted)" : "#fff"};">
                  ${isLocal ? "이관 상자 없음" : "바깥 상자 · Change Request"}
                </span>
                <strong style="font-size:14px; color:${isLocal ? "var(--text-muted)" : "var(--text-strong)"};">
                  ${
                    isLocal
                      ? "🔒 Change Request 생성 안 됨 (이관 불가)"
                      : "🚚 Change Request : DEVK900123 (운송 택배 상자)"
                  }
                </strong>
              </div>
              <span class="tcode-pill-badge">${isLocal ? "팝업 안 뜸" : "T-Code · SE09"}</span>
            </div>
            <div style="font-size:12.5px; color:var(--text-sub); margin-top:4px;">
              ${
                isLocal
                  ? "패키지를 $TMP로 지정하면 다른 서버(QAS/PRD)로 보낼 일이 없으므로 Change Request 상자로 포장하지 않습니다."
                  : "패키지 안의 프로그램들을 묶어 품질(QAS)·운영(PRD) 서버로 배달하기 위해 감싸는 가장 큰 택배 상자입니다."
              }
            </div>

            <!-- 2단계: Package 상자 -->
            <div
              data-select-part="pkg"
              style="
                margin-top:16px;
                background:var(--bg-card);
                border-radius:18px;
                padding:18px 20px;
                box-shadow:var(--shadow-card);
                border:2px solid ${selectedPart === "pkg" ? "var(--toss-green)" : "transparent"};
                transition:all 0.2s;
              "
            >
              <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-size:11.5px; font-weight:800; padding:3px 10px; border-radius:999px; background:var(--toss-green-soft); color:var(--toss-green);">
                    중간 폴더 · Package
                  </span>
                  <strong style="font-size:13.5px; color:var(--text-strong);">
                    📁 Package : ${isLocal ? "$TMP (Local Object · 내 연습장 폴더)" : "ZEDU_01 (우리 반 실습 정식 폴더)"}
                  </strong>
                </div>
                <span class="tcode-pill-badge">T-Code · SE80 / SE21</span>
              </div>
              <div style="font-size:12.5px; color:var(--text-sub); margin-top:4px;">
                관련된 프로그램과 테이블들을 주제별로 한곳에 모아두는 폴더입니다.
              </div>

              <!-- 3단계: Program / Table / T-Code 알맹이들 -->
              <div
                data-select-part="prog"
                style="
                  margin-top:14px;
                  background:var(--bg-subtle);
                  border-radius:14px;
                  padding:14px 16px;
                  border:2px solid ${selectedPart === "prog" ? "var(--toss-amber)" : "transparent"};
                  transition:all 0.2s;
                "
              >
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
                  <span style="font-size:12px; font-weight:800; color:var(--text-sub);">
                    📄 Package 폴더 안에 들어있는 개발 오브젝트들 (클릭)
                  </span>
                  <span style="font-size:11.5px; color:var(--text-muted);">Repository Objects</span>
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:10px;">
                  <div style="background:var(--bg-card); padding:11px 13px; border-radius:11px;">
                    <div style="font-size:13.5px; font-weight:800; color:var(--text-strong);">📄 Z_REPORT_01</div>
                    <div style="font-size:11.5px; color:var(--text-muted);">ABAP Program (SE38)</div>
                  </div>
                  <div style="background:var(--bg-card); padding:11px 13px; border-radius:11px;">
                    <div style="font-size:13.5px; font-weight:800; color:var(--text-strong);">🗃️ ZT_STUDENT</div>
                    <div style="font-size:11.5px; color:var(--text-muted);">DB Table (SE11)</div>
                  </div>
                  <div style="background:var(--bg-card); padding:11px 13px; border-radius:11px;">
                    <div style="font-size:13.5px; font-weight:800; color:var(--text-strong);">🔑 ZEDU01</div>
                    <div style="font-size:11.5px; color:var(--text-muted);">T-Code (SE93)</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 서버 이관(DEV -> QAS -> PRD) 시뮬레이터 바 -->
          <div style="margin-top:16px; background:var(--bg-card); border-radius:16px; padding:16px 18px;">
            <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
              <span style="font-size:13px; font-weight:800; color:var(--text-strong);">
                🛣️ 서버 이관 경로 시뮬레이션 (3-System Landscape)
              </span>
              ${
                isLocal
                  ? `<span style="font-size:12px; font-weight:700; color:var(--toss-red);">🚫 $TMP 폴더는 DEV 서버 밖으로 나갈 수 없어요!</span>`
                  : `<button type="button" id="moveNextServerBtn" class="toss-chip-btn active" style="height:32px; font-size:12px;">
                      ${serverStep < 2 ? "🚀 Change Request 상자 다음 서버로 이관하기 →" : "🔄 처음(DEV)으로 리셋"}
                     </button>`
              }
            </div>
            <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px;">
              ${servers
                .map((srv, idx) => {
                  const isHere = isLocal ? idx === 0 : idx === serverStep;
                  const isPassed = !isLocal && idx < serverStep;
                  return `
                  <div style="
                    padding:12px 14px;
                    border-radius:12px;
                    background:${isHere ? "var(--toss-blue-soft)" : "var(--bg-subtle)"};
                    opacity:${isLocal && idx > 0 ? "0.4" : "1"};
                    transition:all 0.2s;
                  ">
                    <div style="display:flex; align-items:center; justify-content:space-between;">
                      <strong style="font-size:14px; color:${isHere ? "var(--toss-blue)" : "var(--text-strong)"};">
                        ${srv.code} (${srv.name})
                      </strong>
                      <span style="font-size:12px;">
                        ${isHere ? (isLocal ? "🏠 보관중" : "🚚 현재 위치") : isPassed ? "✓ 통과" : ""}
                      </span>
                    </div>
                    <div style="font-size:11.5px; color:var(--text-muted); margin-top:3px;">${srv.sub}</div>
                  </div>
                `;
                })
                .join("")}
            </div>
          </div>

          <!-- 클릭한 요소 상세 멘토링 설명 카드 -->
          <div style="margin-top:14px; background:var(--bg-card); border-radius:16px; padding:16px 18px;">
            <span style="font-size:11px; font-weight:800; color:var(--toss-blue);">${detail.badge}</span>
            <div style="font-size:14.5px; font-weight:800; color:var(--text-strong); margin-top:4px;">${detail.title}</div>
            <div style="font-size:13px; font-weight:700; color:var(--toss-green); margin-top:5px;">${detail.analogy.replace(/\*\*(.+?)\*\*/g, "$1")}</div>
            <p style="font-size:13px; color:var(--text-body); margin-top:5px; line-height:1.65;">${detail.desc}</p>
          </div>
        `;

        // 모드 전환 이벤트
        container.querySelectorAll("[data-mode]").forEach(btn => {
          btn.addEventListener("click", e => {
            e.stopPropagation();
            mode = btn.getAttribute("data-mode");
            serverStep = 0;
            render();
          });
        });

        // 중첩 박스 클릭 이벤트 (버블링 방지하여 가장 안쪽 클릭 시 안쪽이 선택되도록 처리)
        container.querySelectorAll("[data-select-part]").forEach(box => {
          box.addEventListener("click", e => {
            e.stopPropagation();
            selectedPart = box.getAttribute("data-select-part");
            render();
          });
        });

        // 서버 이관 시뮬레이션 버튼
        const moveBtn = container.querySelector("#moveNextServerBtn");
        if (moveBtn) {
          moveBtn.addEventListener("click", e => {
            e.stopPropagation();
            serverStep = (serverStep + 1) % 3;
            render();
          });
        }
      }

      render();
    },

    // 2. 코드위키 (ㅋㄷㅇㅋ) 심볼 디자인 쇼케이스 위젯
    "logo-showcase": function (container) {
      let selectedType = "typeA";

      function render() {
        const activeMarkup = svgPaths[selectedType];
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
                클릭하면 상단 로고에 실시간 적용됩니다.
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
            <div style="background:#ffffff; border-radius:20px; padding:28px 20px; display:flex; flex-direction:column; align-items:center; gap:14px; box-shadow:var(--shadow-card);">
              <svg width="88" height="88" viewBox="0 0 120 120" fill="#191F28">
                ${activeMarkup}
              </svg>
              <div style="font-size:12.5px; font-weight:700; color:#4e5968;">1. 오리지널 모노 심볼</div>
            </div>

            <div style="background:#ffffff; border-radius:20px; padding:28px 20px; display:flex; flex-direction:column; align-items:center; gap:14px; box-shadow:var(--shadow-card);">
              <div style="width:88px; height:88px; border-radius:24px; background:#3182F6; display:flex; align-items:center; justify-content:center; box-shadow:0 8px 20px rgba(49, 130, 246, 0.28);">
                <svg width="56" height="56" viewBox="0 0 120 120" fill="#FFFFFF">
                  ${activeMarkup}
                </svg>
              </div>
              <div style="font-size:12.5px; font-weight:700; color:#4e5968;">2. 토스 블루 앱 아이콘</div>
            </div>

            <div style="background:#191F28; border-radius:20px; padding:28px 20px; display:flex; align-items:center; flex-direction:column; gap:14px; box-shadow:var(--shadow-card);">
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
    }
  };
})();
