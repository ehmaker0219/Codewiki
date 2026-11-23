/* Account-scoped cache; server rows are authoritative except locally pending edits. */
(() => {
  let state = null;
  const prefix = 'codewiki_progress_v1:';
  const emit = () => window.dispatchEvent(new Event('cw-progress-change'));
  const validId = id => typeof id === 'string' && /^[a-z0-9-]{1,100}$/.test(id);
  function load(key) {
    try {
      const data = JSON.parse(localStorage.getItem(key) || '{}');
      const clean = obj => Object.fromEntries(Object.entries(obj || {}).filter(([id, value]) => validId(id) && typeof value === 'boolean'));
      return {values:clean(data.values), pending:clean(data.pending)};
    } catch { return {values:{}, pending:{}}; }
  }
  function save(s) {
    try { localStorage.setItem(s.key, JSON.stringify({values:s.values, pending:s.pending})); s.storageError = false; }
    catch { s.storageError = true; }
  }
  // Bound each request so a stalled connection cannot leave sync running forever.
  const rpc = (client, name, args) => {
    const timed = window.CodeWikiLearning?.rpcWithTimeout;
    return timed ? timed(() => client.rpc(name, args)) : client.rpc(name, args);
  };
  async function sync() {
    const s = state;
    if (!s || s.running) return;
    const auth = window.CodeWikiAuth;
    const client = auth?.getSupabaseClient();
    if (!client || !s.token) { s.status = 'local'; emit(); return; }
    s.running = true; s.status = 'syncing'; emit();
    try {
      const result = await rpc(client, 'cw_get_progress', {p_token:s.token});
      if (state !== s) return;
      if (result.error) throw result.error;
      const remote = {};
      for (const row of result.data || []) if (validId(row.doc_id) && typeof row.completed === 'boolean') remote[row.doc_id] = row.completed;
      s.values = {...remote, ...s.pending};
      save(s); emit();
      while (state === s && Object.keys(s.pending).length) {
        const [id, value] = Object.entries(s.pending)[0];
        const response = await rpc(client, 'cw_set_progress', {p_token:s.token, p_doc_id:id, p_completed:value});
        if (state !== s) return;
        if (response.error) throw response.error;
        // A click during the request may have replaced this pending edit.
        if (s.pending[id] === value) delete s.pending[id];
        save(s);
      }
      s.status = 'synced';
    } catch { if (state === s) s.status = 'error'; }
    finally { s.running = false; if (state === s) emit(); }
  }
  function setUser(user) {
    const approved = user && (user.status === 'approved' || user.role === 'admin');
    const token = approved ? window.CodeWikiAuth?.getSessionToken() || '' : '';
    if (!approved) { state = null; emit(); return; }
    if (state?.id === user.id && state.token === token) return;
    const key = prefix + user.id;
    state = {id:user.id, token, key, ...load(key), status:'local', running:false};
    emit(); void sync();
  }
  function toggle(id) {
    if (!state || !validId(id)) return;
    const value = !state.values[id];
    state.values[id] = value; state.pending[id] = value;
    save(state); emit(); void sync();
  }
  window.CodeWikiProgress = {
    setUser, toggle, sync,
    getReadDocs:() => state ? Object.keys(state.values).filter(id => state.values[id]) : [],
    getStatus:() => !state ? '로그인 후 기록됩니다.' : state.status === 'synced' ? '계정에 저장됨' : state.storageError ? '기기 저장 실패 · 동기화를 다시 시도하세요.' :
      state.status === 'syncing' ? '동기화 중…' : state.status === 'error' ? '기기에 저장됨 · 동기화 재시도 필요' : '이 기기에 저장됨',
    needsRetry:() => state?.status === 'error'
  };
  window.addEventListener('online', () => void sync());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void sync(); });
  window.addEventListener('storage', event => {
    if (state && event.key === state.key) {
      const saved = load(state.key);
      state.values = {...saved.values, ...state.pending};
      state.pending = {...saved.pending, ...state.pending};
      emit(); void sync();
    }
  });
})();
