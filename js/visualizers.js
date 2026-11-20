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
    }
  };
})();
