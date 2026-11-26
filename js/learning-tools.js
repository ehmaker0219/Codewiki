/* Pure helpers shared by rendering and regression tests. */
(() => {
  const HTML_TAG_RE = /<\/?[a-z][a-z0-9-]*(?:\s[^<>]*)?\/?>/gi;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const plain = value => String(value ?? '').replace(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g, (_, id, label) => label || id)
    .replace(/~~(.+?)~~/g, '$1').replace(/\{\{(.+?)\}\}/g, '$1')
    .replace(/<br\s*\/?>/gi, ' ').replace(HTML_TAG_RE, '').replace(/[`*]/g, '').replace(/\s+/g, ' ').trim();
  function blockText(block) {
    if (typeof block === 'string') return [plain(block)];
    if (Array.isArray(block)) return block.flatMap(blockText);
    if (!block || typeof block !== 'object') return [];
    return Object.entries(block).filter(([key]) => !['type','style','id','widgetId','sourceDocId','example'].includes(key))
      .flatMap(([key, value]) => key === 'code' ? [String(value)] : blockText(value));
  }
  function indexDocuments(documents) {
    return documents.filter(d => d.track !== 'ui5').map(doc => {
      const entries = [];
      const pushEntry = (raw, meta = {}) => {
        const text = String(raw ?? '').replace(/\s+/g, ' ').trim();
        if (!text) return;
        entries.push({ text, lower: text.toLowerCase(), sectionId: null, sectionTitle: null, sectionTab: null, sectionMode: null, isSectionTitle: false, isAuxSection: false, ...meta });
      };
      pushEntry(doc.summary);
      pushEntry(doc.subtitle);
      (doc.sections || []).forEach((s, sIdx) => {
        const sectionId = `sec-${sIdx + 1}`;
        const isAuxSection = s.title === '관련 문서' || s.title === '필기와 참고 자료';
        const base = { sectionId, sectionTitle: s.title || null, sectionTab: s.tab || null, sectionMode: s.mode || null, isAuxSection };
        pushEntry(s.title, { ...base, isSectionTitle: true });
        for (const chunk of blockText(s.blocks)) pushEntry(chunk, base);
      });
      return {
        doc, title: doc.title.toLowerCase(),
        heading: [doc.title, ...(doc.aliases || []), ...(doc.tcodes || [])].join(' ').toLowerCase(),
        entries
      };
    });
  }

  function search(index, input) {
    const q = input.trim().toLowerCase();
    if (!q) return [];
    return index.map(entry => {
      const hit =
        entry.entries.find(e => e.isSectionTitle && !e.isAuxSection && e.lower.includes(q)) ||
        entry.entries.find(e => e.sectionId && !e.isAuxSection && e.lower.includes(q)) ||
        entry.entries.find(e => e.sectionId && e.lower.includes(q)) ||
        entry.entries.find(e => e.lower.includes(q));
      const score = entry.title === q ? 4 : entry.heading.includes(q) ? 3 : hit ? 1 : 0;
      if (!score) return null;
      const value = hit?.text || entry.doc.subtitle || entry.doc.title;
      const at = Math.max(0, value.toLowerCase().indexOf(q));
      const start = Math.max(0, at - 32);
      const end = Math.max(start + 130, at + q.length + 25);
      return {
        doc: entry.doc,
        score,
        snippet: (start ? '…' : '') + value.slice(start, end) + (end < value.length ? '…' : ''),
        sectionId: hit?.sectionId || null,
        sectionTitle: hit?.sectionTitle || null,
        sectionTab: hit?.sectionTab || null,
        sectionMode: hit?.sectionMode && hit.sectionMode !== 'both' ? hit.sectionMode : null
      };
    }).filter(Boolean).sort((a,b) => b.score-a.score || Number(a.doc.isDailyLesson || false)-Number(b.doc.isDailyLesson || false));
  }
  function highlight(text, query) {
    const q = query.toLowerCase();
    if (!q) return escape(text);
    let result = '', offset = 0, at;
    const lower = text.toLowerCase();
    while ((at = lower.indexOf(q, offset)) !== -1) {
      result += escape(text.slice(offset, at)) + '<mark>' + escape(text.slice(at, at+q.length)) + '</mark>';
      offset = at + q.length;
    }
    return result + escape(text.slice(offset));
  }
  function relatedGroups(doc, backlinks, documents) {
    const topics = new Set([...(doc.sourceTopics || [])]);
    const references = JSON.stringify(doc.sections || []).matchAll(/\[\[([a-z0-9-]+)(?:\|[^\]]+)?\]\]/g);
    for (const ref of references) topics.add(ref[1]);
    const backlinkIds = new Set(backlinks.map(d => d.id));
    const isOverview = d => Boolean(d.isHome || d.id === 'learning-roadmap' || d.id === 'abap-textbook' || d.id === 'bc400-textbook' || d.id === 'bc430-textbook' || d.id === 'sap-gui-programs' || d.id === 'abap-sql-guide');
    const concepts = documents.filter(d => d.id !== doc.id && d.track !== 'ui5' && !d.isDailyLesson &&
      (topics.has(d.id) || backlinkIds.has(d.id)))
      .sort((a, b) => Number(isOverview(a)) - Number(isOverview(b)));
    const dates = documents.filter(d => d.isDailyLesson && (doc.lessonDates || []).includes(d.id.replace('lesson-','')));
    return {concepts, dates};
  }
  async function rpcWithTimeout(requestFactory, timeoutMs = 15000) {
    if (typeof AbortController !== 'function' || typeof setTimeout !== 'function') {
      return await requestFactory(undefined);
    }
    const controller = new AbortController();
    let timer;
    try {
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(Object.assign(new Error('request-timeout'), {code:'TIMEOUT'}));
          controller.abort();
        }, timeoutMs);
      });
      const request = requestFactory(controller.signal);
      return await Promise.race([
        typeof request?.abortSignal === 'function' ? request.abortSignal(controller.signal) : request,
        timeout
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  window.CodeWikiLearning = {escape, plain, indexDocuments, search, highlight, relatedGroups, rpcWithTimeout};
})();
