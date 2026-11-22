/**
 * ============================================================================
 * [인터랙티브 위젯 레지스트리 틀: js/visualizers.js]
 * ----------------------------------------------------------------------------
 * 추후 시각화가 필요한 주제를 정해주시면 이곳에 고유 ID로 위젯을 등록하고,
 * js/data.js 문서 블록에서 `{ type: "widget", widgetId: "위젯ID" }`로 호출합니다.
 * ============================================================================
 */
(function () {
  window.WIKI_WIDGETS = {
    'knowledge-map-entry'(slot) {
      slot.innerHTML = `
        <div class="kmap-home-entry">
          <div class="kmap-home-entry-copy">
            <span class="kmap-home-entry-eyebrow">VISUAL MAP</span>
            <strong class="kmap-home-entry-title">ABAP 개념 지도</strong>
            <span class="kmap-home-entry-desc">전체 학습 흐름을 줌인·줌아웃하며 한눈에 탐색하세요.</span>
          </div>
          <a href="#map" class="kmap-home-entry-btn">개념 지도 열기 →</a>
        </div>
      `;
    },
    'abap-oven-diagram'(slot) {
      const states = {
        loop: {
          mode: 'pulled',
          trayTag: '오븐 2단에서 꺼냄 · LOOP AT',
          rackNote: '2단 · 트레이 꺼내서 작업 중',
          caption: '오븐(TABLE) 2단에서 한 줄을 오븐 트레이(WORK AREA · gs_output)로 꺼내 올려둔 상태입니다.',
          rack2: ['00000002', 'Air Berlin', '0', '-'],
          molds: [
            { el: 'id', type: 'scustom-id', val: "'00000002'", active: false, empty: false },
            { el: 'name', type: 'scustom-name', val: "'Air Berlin'", active: false, empty: false },
            { el: 'bookcnt', type: 'i', val: '0', active: false, empty: false },
            { el: 'grade', type: 'c (1)', val: "'-'", active: false, empty: false }
          ]
        },
        clear: {
          mode: 'cleared',
          trayTag: '계산용 트레이 비우기 · CLEAR gs_data',
          rackNote: '2단 · 출력용 트레이의 고객 정보 유지',
          caption: 'CLEAR gs_data. — 계산용 트레이의 customid와 bookcnt만 초기값으로 비웁니다. 출력용 트레이(gs_output)의 고객 정보는 유지됩니다.',
          rack2: ['00000002', 'Air Berlin', '0', '-'],
          molds: [
            { el: 'customid', type: 'sbook-customid', val: "'00000000'", active: false, empty: true },
            { el: 'bookcnt', type: 'i', val: '0', active: false, empty: true }
          ]
        },
        fill: {
          mode: 'filled',
          trayTag: '칸 채우기 · READ TABLE · IF',
          rackNote: '2단 · 트레이 위 값 수정 중 (오븐 반영 전)',
          caption: 'READ TABLE로 계산용 트레이(gs_data)의 예약 건수 15를 옮기고, IF > 10 조건으로 등급 P를 채웁니다.',
          rack2: ['00000002', 'Air Berlin', '0', '-'],
          molds: [
            { el: 'id', type: 'scustom-id', val: "'00000002'", active: false, empty: false },
            { el: 'name', type: 'scustom-name', val: "'Air Berlin'", active: false, empty: false },
            { el: 'bookcnt', type: 'i', val: '15', active: true, empty: false },
            { el: 'grade', type: 'c (1)', val: "'P'", active: true, empty: false }
          ]
        },
        modify: {
          mode: 'inserted',
          trayTag: '오븐에 다시 넣기 · MODIFY',
          rackNote: '2단 · 오븐(gt_output)에 반영 완료!',
          caption: 'MODIFY gt_output FROM gs_output. — 작업 끝난 트레이를 오븐 2단 자리에 그대로 밀어 넣어 반영합니다.',
          rack2: ['00000002', 'Air Berlin', '15', 'P'],
          molds: [
            { el: 'id', type: 'scustom-id', val: "'00000002'", active: false, empty: false },
            { el: 'name', type: 'scustom-name', val: "'Air Berlin'", active: false, empty: false },
            { el: 'bookcnt', type: 'i', val: '15', active: true, empty: false },
            { el: 'grade', type: 'c (1)', val: "'P'", active: true, empty: false }
          ]
        }
      };
      const buttons = [
        ['loop', '1. 꺼내기 (LOOP)'],
        ['clear', '2. 계산용 비우기 (CLEAR)'],
        ['fill', '3. 채우기 (READ · IF)'],
        ['modify', '4. 넣기 (MODIFY)']
      ];
      let current = 'loop';
      const esc = window.CodeWikiLearning?.escape || (v => String(v ?? ''));
      function render() {
        const s = states[current];
        slot.innerHTML = `
          <div class="oven-wrap" data-oven-mode="${s.mode}">
            <div class="oven-controls" role="group" aria-label="오븐 트레이 동작 시뮬레이션">
              ${buttons.map(([key, label]) => `
                <button type="button" class="oven-step-btn${current === key ? ' active' : ''}" data-oven-step="${key}" aria-pressed="${current === key}">${label}</button>
              `).join('')}
            </div>
            <div class="oven-stage">
              <div class="oven-shell">
                <div class="oven-panel">
                  <div class="oven-panel-left">
                    <span class="oven-badge badge-table">TABLE</span>
                    <strong class="oven-panel-title">오븐 (다단 오븐)</strong>
                    <span class="oven-code-chip">DB / gt_output</span>
                  </div>
                  <div class="oven-panel-right" aria-hidden="true">
                    <span class="oven-vents"><i></i><i></i><i></i><i></i></span>
                    <span class="oven-led"><i class="oven-led-dot"></i>180°C · ${current.toUpperCase()}</span>
                    <span class="oven-knob"></span>
                    <span class="oven-knob knob-temp"></span>
                  </div>
                </div>

                <div class="oven-window-frame">
                  <div class="oven-cavity">
                    <div class="oven-heater" aria-hidden="true"><span></span><span></span></div>
                    <div class="oven-glass-glare" aria-hidden="true"></div>

                    <div class="oven-rack oven-rack-dim">
                      <span class="oven-rack-num">1단</span>
                      <div class="oven-rack-line">
                        <span>00000001</span><span>Lufthansa</span><span>12</span><span>P</span>
                      </div>
                    </div>

                    <div class="oven-rack oven-rack-active">
                      <div class="oven-rack-slot-head">
                        <span class="oven-rack-num active">2단</span>
                        <span class="oven-rack-status">${esc(s.rackNote)}</span>
                        <div class="oven-rack-live" aria-label="오븐 2단 현재 저장값">
                          ${s.rack2.map((cell, idx) => `<span${current === 'modify' && idx >= 2 ? ' class="is-saved"' : ''}>${esc(cell)}</span>`).join('')}
                        </div>
                      </div>

                      <div class="oven-tray-deck">
                        <div class="oven-tray">
                          <span class="oven-tray-grip grip-left" aria-hidden="true"></span>
                          <span class="oven-tray-grip grip-right" aria-hidden="true"></span>
                          <div class="oven-tray-head">
                            <div class="oven-tray-title-group">
                              <span class="oven-badge badge-struct">STRUCTURE · WORK AREA</span>
                              <strong class="oven-tray-title">${current === 'clear' ? '계산용 트레이' : '오븐 트레이'}</strong>
                              <span class="oven-code-chip dark">${current === 'clear' ? 'ts_data / gs_data' : 'ts_output / gs_output'}</span>
                            </div>
                            <span class="oven-tray-state">${esc(s.trayTag)}</span>
                          </div>

                          <div class="oven-molds">
                            ${s.molds.map(m => `
                              <div class="oven-mold${m.active ? ' is-updated' : ''}${m.empty ? ' is-empty' : ''}">
                                <div class="oven-mold-el">
                                  <span class="oven-mini-tag tag-el">DATA ELEMENT</span>
                                  <strong>${esc(m.el)}</strong>
                                </div>
                                <div class="oven-mold-type">
                                  <span class="oven-mini-tag tag-type">DATA TYPE</span>
                                  <span class="oven-type-name">${esc(m.type)}</span>
                                  <div class="oven-mold-data">
                                    <span class="oven-mini-tag tag-data">DATA</span>
                                    <span class="oven-data-val">${esc(m.val)}</span>
                                  </div>
                                </div>
                              </div>
                            `).join('')}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="oven-rack oven-rack-dim">
                      <span class="oven-rack-num">3단</span>
                      <div class="oven-rack-line">
                        <span>00000003</span><span>United Air</span><span>4</span><span>S</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="oven-door-bar" aria-hidden="true">
                  <span class="oven-handle-mount"></span>
                  <span class="oven-handle"></span>
                  <span class="oven-handle-mount"></span>
                </div>
              </div>
              <div class="oven-feet" aria-hidden="true"><span></span><span></span></div>
            </div>

            <p class="oven-caption" role="status">${esc(s.caption)}</p>

            <div class="oven-legend" aria-label="5단계 포함 관계 범례">
              <span><b class="oven-badge badge-table">TABLE</b> 오븐</span>
              <span class="oven-legend-sep">⊃</span>
              <span><b class="oven-badge badge-struct">STRUCTURE · WORK AREA</b> 오븐 트레이</span>
              <span class="oven-legend-sep">⊃</span>
              <span><b class="oven-mini-tag tag-el">DATA ELEMENT</b> 각 칸</span>
              <span class="oven-legend-sep">⊃</span>
              <span><b class="oven-mini-tag tag-type">DATA TYPE</b> 틀 모양</span>
              <span class="oven-legend-sep">⊃</span>
              <span><b class="oven-mini-tag tag-data">DATA</b> 재료(값)</span>
            </div>
          </div>
        `;
      }
      slot.onclick = e => {
        const btn = e.target.closest?.('[data-oven-step]');
        if (!btn) return;
        const next = btn.getAttribute('data-oven-step');
        if (Object.hasOwn(states, next) && next !== current) {
          const restoreFocus = slot.ownerDocument.activeElement === btn;
          current = next;
          render();
          if (restoreFocus) slot.querySelector(`[data-oven-step="${current}"]`)?.focus({preventScroll: true});
        }
      };
      render();
    }
  };
})();
