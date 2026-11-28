/* Admin Command Center tabs (학습·출석부, 원격 제어·공지, 분석·보안 감사),
 * CSV exporter, 1:1 direct message dialog, and single-student forced logout dialog. */
(() => {
  const esc = v => (window.CodeWikiLearning?.escape
    ? window.CodeWikiLearning.escape(v ?? '')
    : String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));

  const FEATURE_FLAG_META = [
    ['basicSession', 'Basic Session Review', '시험 대비 리뷰 탭 노출'],
    ['sqlGuide', 'ABAP SQL 가이드 · 연습', '구문법/신문법/SQL 연습 워크벤치'],
    ['dataGame', 'DATA 미니게임', 'ABAP 객체 분류 퀴즈'],
    ['study', '내 공부방', '학생 개인 학습 노트 및 폴더'],
    ['mentoring', '멘토링', '멘토링 활동 기록 (멘토 계정 대상)'],
    ['knowledgeMap', '개념 지도', '인터랙티브 개념 연결 그래프']
  ];

  const ACTION_LABELS = {
    set_status: '가입 상태 변경',
    delete_rejected: '반려 계정 삭제',
    update_username: '아이디 변경',
    reset_password: '비밀번호 재설정',
    logout_all: '전원 로그아웃',
    logout_student: '개별 강제 로그아웃',
    publish_notice: '실시간 공지 발송',
    toggle_notice: '공지 노출 전환',
    delete_notice: '공지 삭제',
    send_direct_message: '1:1 알림 발송',
    update_spotlight: '수업 스포트라이트',
    update_maintenance: '점검 모드 변경',
    update_feature_flags: '메뉴 잠금 변경',
    update_student_tools: '학생 전용 기능 변경'
  };

  const SECURITY_SEVERITY_META = {
    critical: { label: '위험', cls: 'is-critical' },
    high: { label: '높음', cls: 'is-high' },
    warn: { label: '주의', cls: 'is-warn' },
    info: { label: '정보', cls: 'is-info' }
  };

  const SECURITY_EVENT_LABELS = {
    login_failed: '로그인 실패',
    rate_limit_blocked: '요청 제한(Rate Limit) 차단',
    envelope_tampered: '암호화 패킷 위변조',
    replay_attack: '패킷 재전송(Replay) 공격',
    origin_denied: '비허용 Origin 접근',
    method_abuse: '비허용 HTTP 메서드',
    unauthorized_admin_access: '비인가 관리자 API 호출',
    admin_password_failed: '관리자 비밀번호 불일치',
    admin_route_probe: '관리자 경로 직접 탐색',
    suspicious_input: 'SQLi / XSS 의심 입력',
    signup_failed: '회원가입 검증 실패'
  };

  const SECURITY_SOURCE_LABELS = {
    login: '로그인',
    signup: '회원가입',
    'secure-auth': '인증 게이트웨이(DB)',
    'edge-auth': 'Edge 보안 게이트웨이',
    'admin-rpc': '관리자 API',
    client: '학생 브라우저',
    search: '문서 검색창'
  };

  const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
  const PAGE_LABELS = {
    'page:study': '내 공부방',
    'page:mentoring': '멘토링',
    'page:foundation': '파운데이션',
    'page:map': '개념 지도',
    'page:data-game': 'DATA 미니게임',
    'page:board': '건의 게시판',
    'page:admin': '관리자 페이지',
    other: '탐색 중'
  };

  function docTitle(docId) {
    if (!docId) return '탐색 중';
    if (PAGE_LABELS[docId]) return PAGE_LABELS[docId];
    return window.WIKI_DOCS?.[docId]?.title || docId;
  }

  function formatDateTime(value) {
    const d = new Date(value);
    if (!value || Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  }

  function formatDateTimeSec(value) {
    const d = new Date(value);
    if (!value || Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  function formatSecurityDetailsText(ev) {
    const d = ev?.details && typeof ev.details === 'object' ? ev.details : {};
    const parts = [];
    if (d.rpc) parts.push(`API: ${d.rpc}`);
    if (d.origin) parts.push(`Origin: ${d.origin}`);
    if (d.method) parts.push(`Method: ${d.method}`);
    if (d.reason) parts.push(`원인: ${d.reason}`);
    if (d.bucket_type) parts.push(`버킷: ${d.bucket_type}`);
    if (Number(d.retry_after) > 0) parts.push(`차단 대기: ${d.retry_after}초`);
    if (Number(d.recent_15m_fails) > 1) parts.push(`최근 15분 ${d.recent_15m_fails}회 누적`);
    if (d.account_exists === false) parts.push('미등록 아이디');
    else if (d.account_role === 'admin') parts.push('관리자 계정 표적');
    if (d.field) parts.push(`입력 필드: ${d.field}`);
    if (d.sample) parts.push(`샘플: ${d.sample}`);
    if (d.query) parts.push(`검색어: ${d.query}`);
    if (d.path) parts.push(`경로: ${d.path}`);
    if (d.token_state) parts.push(`토큰: ${d.token_state === 'non_admin_session' ? '비관리자 세션' : d.token_state === 'null' ? '토큰 없음' : '유효하지 않음/만료'}`);
    if (d.operation) parts.push(`작업: ${d.operation}`);
    if (d.has_query) parts.push('URL 쿼리스트링 포함');
    if (d.malformed_password) parts.push('비정상 비밀번호 형식');
    return parts;
  }

  function formatShortTime(value) {
    const d = new Date(value);
    if (!value || Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  }

  function formatDuration(sec) {
    const s = Math.max(0, Number(sec) || 0);
    if (!s) return '—';
    if (s < 60) return `${s}초`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return rem ? `${m}분 ${rem}초` : `${m}분`;
  }

  function csvCell(value) {
    let str = value == null ? '' : String(value);
    // Defuse Excel/LibreOffice/Sheets CSV formula injection including leading pipe/newline/spaces.
    if (/^[=+\-@|\t\r\n]|^\s+[=+\-@|]/.test(str)) str = "'" + str;
    if (/[",\r\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
    return str;
  }

  function downloadCsv(filename, headers, rows) {
    const lines = [headers.map(csvCell).join(',')];
    for (const row of rows) lines.push(row.map(csvCell).join(','));
    const csv = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function summarizeAuditDetails(action, details) {
    if (!details || typeof details !== 'object') return '—';
    if (action === 'set_status') return `${details.from || '?'} → ${details.to || '?'}`;
    if (action === 'update_username') return `${details.from || '?'} → ${details.to || '?'}`;
    if (action === 'logout_all') return `${Number(details.logged_out_count) || 0}명 종료`;
    if (action === 'logout_student') return details.was_active ? '활성 세션 종료' : '세션 초기화';
    if (action === 'publish_notice') return `대상: ${details.target_class || '전체'}`;
    if (action === 'toggle_notice') return details.active ? '노출 켜기' : '노출 중지';
    if (action === 'send_direct_message') return details.title || '';
    if (action === 'update_spotlight') return details.active ? `${details.label || details.doc_id} 발송` : '스포트라이트 종료';
    if (action === 'update_maintenance') return details.enabled ? '점검 모드 ON' : '점검 모드 OFF';
    if (action === 'update_feature_flags') {
      const off = FEATURE_FLAG_META.filter(([k]) => details[k] === false).map(([, label]) => label);
      return off.length ? `잠금: ${off.join(', ')}` : '모든 메뉴 공개';
    }
    if (action === 'update_student_tools') {
      const after = details.after || {};
      const on = [['mentoring', '멘토링'], ['foundation', '파운데이션']].filter(([k]) => after[k] === true).map(([, l]) => l);
      return on.length ? `허용: ${on.join(', ')}` : '전용 기능 모두 해제';
    }
    return JSON.stringify(details).slice(0, 120);
  }

  function getDocOptions() {
    const docs = Object.values(window.WIKI_DOCS || {})
      .filter(d => d && d.track !== 'ui5' && !d.isHome && d.id)
      .sort((a, b) => {
        if (a.id === 'basic-session-review') return -1;
        if (b.id === 'basic-session-review') return 1;
        return String(a.title || a.id).localeCompare(String(b.title || b.id), 'ko', { numeric: true });
      });
    return docs.map(d => ({ id: d.id, title: d.title || d.id }));
  }

  function createController({ host, callRpc, getSession, getStudents, isActive, getCurrentTab, getDialog, getDialogVersion, setDialogBusy, closeDialog, onMessage, onPresenceRefresh, onSecurityAlertsChange }) {
    let dashData = null, dashLoading = false, dashError = '', dashVersion = 0;
    let unitSortAsc = false;
    let inactiveThreshold = 7;

    let ctrlData = null, ctrlLoading = false, ctrlError = '', ctrlVersion = 0;
    let ctrlBusy = false;
    let noticeFeedFilter = 'all'; // 'all' | 'broadcast' | 'dm'
    let fallbackStudents = [], studentsLoading = false, studentsVersion = 0;
    let dmSearchQuery = '', dmClassFilter = 'ALL';
    const dmSelectedIds = new Set();

    let insData = null, insLoading = false, insError = '', insVersion = 0;
    let insDays = 14;
    let auditFilter = '';
    let secSeverityFilter = '';
    let secTypeFilter = '';
    let secSearchQuery = '';
    let secAckBusy = false;
    let secAckAtLocal = null;
    let secBannerDismissedAt = 0;

    function secAckStorageKey(adminId) {
      return adminId ? `codewiki_sec_ack_v1:${adminId}` : '';
    }

    function readLocalSecAck(adminId) {
      const key = secAckStorageKey(adminId);
      if (!key) return null;
      try {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
        const parsed = raw ? JSON.parse(raw) : null;
        if (!parsed || !parsed.ackAt) return null;
        return parsed;
      } catch {
        return null;
      }
    }

    function writeLocalSecAck(adminId, ackIso, ackedCount) {
      const key = secAckStorageKey(adminId);
      if (!key) return;
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(key, JSON.stringify({ ackAt: ackIso, ackedCount: Number(ackedCount) || 0 }));
        }
      } catch {}
    }

    function parseTimeMs(value) {
      if (!value) return 0;
      const ms = new Date(value).getTime();
      return Number.isFinite(ms) ? ms : 0;
    }

    function computeSecurityAckStats(data, { forBanner = false } = {}) {
      const secSum = data?.security_summary || {};
      const secEvents = Array.isArray(data?.security_events) ? data.security_events : [];
      const s = getSession();
      const hasServerAck = Boolean(data && Object.prototype.hasOwnProperty.call(data, 'security_ack_at'));
      const serverAckMs = parseTimeMs(data?.security_ack_at);
      const localSaved = readLocalSecAck(s?.id);
      const localAckMs = Math.max(
        parseTimeMs(secAckAtLocal),
        hasServerAck ? 0 : parseTimeMs(localSaved?.ackAt)
      );
      const effectiveAckMs = forBanner
        ? Math.max(serverAckMs, secBannerDismissedAt, hasServerAck ? 0 : parseTimeMs(localSaved?.ackAt))
        : Math.max(serverAckMs, localAckMs);
      const rawAlerts24h = Number(secSum.alerts_24h) || 0;
      const nowMs = Date.now();
      const countAfter = (ms, only24h) => secEvents.filter(ev => {
        if (ev.severity !== 'high' && ev.severity !== 'critical') return false;
        const t = parseTimeMs(ev.created_at);
        if (t <= ms) return false;
        if (only24h && nowMs - t > 86400000) return false;
        return true;
      }).length;

      let unackedAlerts24h;
      if (hasServerAck && typeof secSum.unacked_alerts_24h === 'number' && effectiveAckMs <= serverAckMs) {
        unackedAlerts24h = Number(secSum.unacked_alerts_24h) || 0;
      } else if (effectiveAckMs > 0) {
        unackedAlerts24h = countAfter(effectiveAckMs, true);
      } else {
        unackedAlerts24h = rawAlerts24h;
      }

      let unackedCritical = Number(secSum.critical_count) || 0;
      let unackedHigh = Number(secSum.high_count) || 0;
      if (effectiveAckMs > 0) {
        if (hasServerAck && typeof secSum.unacked_high_or_critical === 'number' && secSum.unacked_high_or_critical === 0 && effectiveAckMs <= serverAckMs) {
          unackedCritical = 0;
          unackedHigh = 0;
        } else {
          unackedCritical = secEvents.filter(ev => ev.severity === 'critical' && parseTimeMs(ev.created_at) > effectiveAckMs).length;
          unackedHigh = secEvents.filter(ev => ev.severity === 'high' && parseTimeMs(ev.created_at) > effectiveAckMs).length;
        }
      }

      return {
        ackMs: effectiveAckMs,
        ackIso: effectiveAckMs > 0 ? new Date(effectiveAckMs).toISOString() : null,
        rawAlerts24h,
        unackedAlerts24h,
        unackedCritical,
        unackedHigh
      };
    }

    async function acknowledgeSecurityAlerts({ manual = false } = {}) {
      const s = getSession();
      if (!s || !insData) return;
      if (manual && secAckBusy) return;
      const secEvents = Array.isArray(insData.security_events) ? insData.security_events : [];
      const latestEventMs = secEvents.reduce((max, ev) => Math.max(max, parseTimeMs(ev.created_at)), 0);
      const nextMs = Math.max(Date.now(), latestEventMs + 1);
      const nextIso = new Date(nextMs).toISOString();
      const rawAlerts24h = Number(insData?.security_summary?.alerts_24h) || 0;

      secAckAtLocal = nextIso;
      if (manual) secBannerDismissedAt = nextMs;
      writeLocalSecAck(s.id, nextIso, rawAlerts24h);
      onSecurityAlertsChange?.(0);

      if (manual) {
        if (insData.security_summary) {
          insData.security_summary.unacked_alerts_24h = 0;
          insData.security_summary.unacked_high_or_critical = 0;
        }
        insData.security_ack_at = nextIso;
        secAckBusy = true;
        renderTab('security');
      }

      try {
        const res = await callRpc('cw_admin_ack_security_alerts', {}, s);
        if (getSession() !== s) return;
        if (res?.ok === true && res.ack_at) {
          secAckAtLocal = res.ack_at;
          if (manual) secBannerDismissedAt = Math.max(secBannerDismissedAt, parseTimeMs(res.ack_at));
          writeLocalSecAck(s.id, res.ack_at, rawAlerts24h);
          if (insData) {
            insData.security_ack_at = res.ack_at;
            if (insData.security_summary) {
              insData.security_summary.unacked_alerts_24h = 0;
              insData.security_summary.unacked_high_or_critical = 0;
            }
          }
        }
        if (manual) onMessage('보안 알림을 확인 완료 처리했습니다. 새 고위험 이벤트가 발생하면 다시 표시됩니다.');
      } catch (err) {
        if (manual && getSession() === s) {
          onMessage(err?.code === 'PGRST202'
            ? '이 브라우저에서 보안 알림을 확인 완료 처리했습니다.'
            : '보안 알림 확인 상태를 서버에 저장하지 못했지만 현재 화면에서는 숨겼습니다.');
        }
      } finally {
        if (manual) {
          secAckBusy = false;
          if (getSession() === s && getCurrentTab?.() === 'security') renderTab('security');
        }
      }
    }

    const isSameDialog = (s, v, dlg) => getSession() === s && getDialogVersion() === v && Boolean(dlg?.open);

    function getApprovedStudents() {
      const fromParent = typeof getStudents === 'function' ? getStudents() : [];
      const src = Array.isArray(fromParent) && fromParent.length ? fromParent : fallbackStudents;
      return src
        .filter(u => u && u.id && u.status === 'approved')
        .slice()
        .sort((a, b) =>
          String(a.class_name || '기본반').localeCompare(String(b.class_name || '기본반'), 'ko', { numeric: true }) ||
          String(a.full_name || '').localeCompare(String(b.full_name || ''), 'ko', { numeric: true })
        );
    }

    async function ensureStudentsForDm() {
      const s = getSession();
      if (!s || getApprovedStudents().length || studentsLoading) return;
      const v = ++studentsVersion;
      studentsLoading = true;
      try {
        const res = await callRpc('cw_admin_student_directory', {}, s);
        if (getSession() !== s || studentsVersion !== v) return;
        if (Array.isArray(res)) fallbackStudents = res;
      } catch {}
      finally {
        if (studentsVersion === v) {
          studentsLoading = false;
          if (getCurrentTab?.() === 'notices' && !refreshDmPickerInPlace()) renderTab('notices');
        }
      }
    }

    function reset() {
      dashVersion++; ctrlVersion++; insVersion++; studentsVersion++;
      dashData = null; dashLoading = false; dashError = '';
      ctrlData = null; ctrlLoading = false; ctrlError = ''; ctrlBusy = false;
      noticeFeedFilter = 'all';
      fallbackStudents = []; studentsLoading = false;
      dmSearchQuery = ''; dmClassFilter = 'ALL'; dmSelectedIds.clear();
      insData = null; insLoading = false; insError = '';
      auditFilter = '';
      secSeverityFilter = '';
      secTypeFilter = '';
      secSearchQuery = '';
      secAckBusy = false;
      secAckAtLocal = null;
      secBannerDismissedAt = 0;
    }

    function invalidate() {
      dashVersion++; ctrlVersion++; insVersion++; studentsVersion++;
      dashData = null; dashLoading = false;
      ctrlData = null; ctrlLoading = false;
      fallbackStudents = []; studentsLoading = false;
      insData = null; insLoading = false;
    }

    function showNoticeReadsDialog(noticeId) {
      const s = getSession();
      if (!s) return;
      const { dlg, version: dv } = getDialog('noticeReadsTitle', true);
      dlg.innerHTML = `<div class="profile-dialog-header"><h2 id="noticeReadsTitle">공지 읽음 현황</h2><button type="button" class="icon-btn" data-insight-dialog-close aria-label="닫기">✕</button></div><p class="members-reset-note">읽음 현황을 불러오는 중…</p>`;
      dlg.querySelectorAll('[data-insight-dialog-close]').forEach(b => b.addEventListener('click', closeDialog));
      dlg.showModal();
      callRpc('cw_admin_notice_reads', { p_notice_id: noticeId }, s).then(data => {
        if (!isSameDialog(s, dv, dlg)) return;
        const read = Array.isArray(data?.read_users) ? data.read_users : [];
        const unread = Array.isArray(data?.unread_users) ? data.unread_users : [];
        const total = read.length + unread.length;
        const pct = total ? Math.round((read.length / total) * 100) : 0;
        dlg.innerHTML = `
          <div class="profile-dialog-header">
            <h2 id="noticeReadsTitle">${esc(data?.notice?.title || '공지 읽음 현황')}</h2>
            <button type="button" class="icon-btn" data-insight-dialog-close aria-label="닫기">✕</button>
          </div>
          <p class="members-reset-note">읽음 <strong>${read.length}명</strong> / 미확인 <strong>${unread.length}명</strong> (읽음률 ${pct}%)</p>
          <div class="admin-reads-grid">
            <div class="admin-reads-col">
              <h4>읽음 (${read.length}명)</h4>
              <ul class="admin-reads-list">${read.length ? read.map(u => `<li><span>${esc(u.full_name)} <small>${esc(u.class_name || '')}${u.student_number ? ` · ${u.student_number}번` : ''}</small></span><time>${esc(formatShortTime(u.read_at))}</time></li>`).join('') : '<li class="admin-reads-empty">아직 읽은 학생이 없습니다.</li>'}</ul>
            </div>
            <div class="admin-reads-col">
              <h4>미확인 (${unread.length}명)</h4>
              <ul class="admin-reads-list">${unread.length ? unread.map(u => `<li><span>${esc(u.full_name)} <small>${esc(u.class_name || '')}${u.student_number ? ` · ${u.student_number}번` : ''}</small></span><span class="admin-unread-pill">미확인</span></li>`).join('') : '<li class="admin-reads-empty">모든 대상 학생이 확인했습니다.</li>'}</ul>
            </div>
          </div>
          <div class="profile-dialog-actions"><button type="button" class="toss-primary-btn" data-insight-dialog-close>닫기</button></div>`;
        dlg.querySelectorAll('[data-insight-dialog-close]').forEach(b => b.addEventListener('click', closeDialog));
      }).catch(() => {
        if (!isSameDialog(s, dv, dlg)) return;
        dlg.innerHTML = `<div class="profile-dialog-header"><h2 id="noticeReadsTitle">공지 읽음 현황</h2><button type="button" class="icon-btn" data-insight-dialog-close aria-label="닫기">✕</button></div><p class="members-reset-note">읽음 현황을 불러오지 못했습니다.</p><div class="profile-dialog-actions"><button type="button" class="toss-chip-btn" data-insight-dialog-close>닫기</button></div>`;
        dlg.querySelectorAll('[data-insight-dialog-close]').forEach(b => b.addEventListener('click', closeDialog));
      });
    }

    function openDirectMessageDialog(student) {
      const s = getSession();
      if (!s || !student) return;
      let busy = false;
      const { dlg, version: dv } = getDialog('adminDmTitle', false);
      dlg.innerHTML = `
        <div class="profile-dialog-header">
          <h2 id="adminDmTitle">1:1 운영 알림 발송</h2>
          <button type="button" class="icon-btn" data-dm-close aria-label="닫기">✕</button>
        </div>
        <p class="members-reset-note"><strong>${esc(student.full_name)}</strong> (${esc(student.class_name || '기본반')} · @${esc(student.username)}) 학생에게만 보이는 팝업 알림을 보냅니다.</p>
        <form id="adminDmForm">
          <label for="adminDmSubject">알림 제목</label>
          <input id="adminDmSubject" type="text" maxlength="120" placeholder="예: 출석번호 확인 부탁드립니다" required>
          <label for="adminDmBody">알림 내용</label>
          <textarea id="adminDmBody" rows="4" maxlength="1000" placeholder="학생 화면에 표시할 안내 내용을 입력해 주세요." required></textarea>
          <p id="adminDmStatus" role="status"></p>
          <div class="profile-dialog-actions">
            <button type="button" class="toss-chip-btn" data-dm-close>취소</button>
            <button type="submit" class="toss-primary-btn">알림 발송</button>
          </div>
        </form>`;
      dlg.querySelectorAll('[data-dm-close]').forEach(b => b.addEventListener('click', () => { if (!busy) closeDialog(); }));
      const form = dlg.querySelector('#adminDmForm');
      const titleInput = dlg.querySelector('#adminDmSubject');
      const bodyInput = dlg.querySelector('#adminDmBody');
      const statusEl = dlg.querySelector('#adminDmStatus');
      form?.addEventListener('submit', async e => {
        e.preventDefault();
        if (busy || !isSameDialog(s, dv, dlg) || !form.isConnected) return;
        const title = titleInput.value.trim();
        const body = bodyInput.value.trim();
        if (!title || !body) { statusEl.textContent = '제목과 내용을 모두 입력해 주세요.'; return; }
        busy = true;
        setDialogBusy?.(true);
        form.querySelectorAll('input,textarea,button').forEach(el => { el.disabled = true; });
        statusEl.textContent = '발송 중…';
        try {
          const res = await callRpc('cw_admin_send_direct_message', { p_target_id: student.id, p_title: title, p_body: body }, s);
          if (!isSameDialog(s, dv, dlg) || !form.isConnected) return;
          if (res?.ok !== true) throw new Error();
          void window.CodeWikiTelemetry?.notifyRuntimeUpdate?.();
          closeDialog();
          ctrlData = null;
          onMessage(`${student.full_name}님에게 1:1 알림을 발송했습니다.`);
        } catch (err) {
          if (isSameDialog(s, dv, dlg) && form.isConnected) {
            statusEl.textContent = err?.code === 'PGRST202'
              ? '1:1 알림 기능이 아직 서버에 적용되지 않았습니다.'
              : '알림을 발송하지 못했습니다. 잠시 후 다시 시도해 주세요.';
          }
        } finally {
          busy = false;
          if (getDialogVersion() === dv) setDialogBusy?.(false);
          if (isSameDialog(s, dv, dlg) && form.isConnected) {
            form.querySelectorAll('input,textarea,button').forEach(el => { el.disabled = false; });
          }
        }
      });
      dlg.showModal();
      titleInput?.focus?.();
    }

    function openSingleLogoutDialog(student) {
      const s = getSession();
      if (!s || !student) return;
      let busy = false;
      const { dlg, version: dv } = getDialog('singleLogoutTitle', false);
      dlg.innerHTML = `
        <div class="profile-dialog-header">
          <h2 id="singleLogoutTitle">개별 강제 로그아웃</h2>
          <button type="button" class="icon-btn" data-single-logout-close aria-label="닫기">✕</button>
        </div>
        <p class="members-reset-note"><strong>${esc(student.full_name)}</strong> (@${esc(student.username)}) 학생의 현재 세션을 즉시 종료합니다.<br>다른 학생의 세션에는 영향을 주지 않습니다.</p>
        <p id="singleLogoutStatus" role="status"></p>
        <div class="profile-dialog-actions">
          <button type="button" class="toss-chip-btn" data-single-logout-close>취소</button>
          <button type="button" id="confirmSingleLogoutBtn" class="toss-chip-btn members-danger-btn">강제 로그아웃</button>
        </div>`;
      dlg.querySelectorAll('[data-single-logout-close]').forEach(b => b.addEventListener('click', () => { if (!busy) closeDialog(); }));
      const confirmBtn = dlg.querySelector('#confirmSingleLogoutBtn');
      const statusEl = dlg.querySelector('#singleLogoutStatus');
      confirmBtn?.addEventListener('click', async () => {
        if (busy || !isSameDialog(s, dv, dlg)) return;
        busy = true;
        setDialogBusy?.(true);
        dlg.querySelectorAll('button').forEach(b => { b.disabled = true; });
        statusEl.textContent = '세션 종료 중…';
        try {
          const res = await callRpc('cw_admin_logout_student', { p_target_id: student.id }, s);
          if (!isSameDialog(s, dv, dlg)) return;
          if (res?.ok !== true) throw new Error();
          void window.CodeWikiPresence?.notifySessionCheck?.();
          closeDialog();
          onMessage(res.was_active
            ? `${student.full_name}님의 활성 세션을 즉시 종료했습니다.`
            : `${student.full_name}님은 이미 로그아웃 상태였으며 세션을 초기화했습니다.`);
          onPresenceRefresh?.();
        } catch (err) {
          if (isSameDialog(s, dv, dlg)) {
            statusEl.textContent = err?.code === 'PGRST202'
              ? '개별 강제 로그아웃 기능이 아직 서버에 적용되지 않았습니다.'
              : '강제 로그아웃 처리에 실패했습니다.';
          }
        } finally {
          busy = false;
          if (getDialogVersion() === dv) setDialogBusy?.(false);
          if (isSameDialog(s, dv, dlg)) dlg.querySelectorAll('button').forEach(b => { b.disabled = false; });
        }
      });
      dlg.showModal();
      (dlg.querySelector('.profile-dialog-actions [data-single-logout-close]') || confirmBtn)?.focus?.();
    }

    function openDeleteNoticeDialog(noticeId, noticeTitle) {
      const s = getSession();
      if (!s || !noticeId) return;
      let busy = false;
      const { dlg, version: dv } = getDialog('deleteNoticeTitle', false);
      dlg.innerHTML = `
        <div class="profile-dialog-header">
          <h2 id="deleteNoticeTitle">실시간 공지 삭제</h2>
          <button type="button" class="icon-btn" data-del-notice-close aria-label="닫기">✕</button>
        </div>
        <p class="members-reset-note"><strong>${esc(noticeTitle || '선택한 공지')}</strong>와 해당 공지의 읽음 기록을 삭제할까요?<br>이 작업은 되돌릴 수 없습니다.</p>
        <p id="deleteNoticeStatus" role="status"></p>
        <div class="profile-dialog-actions">
          <button type="button" class="toss-chip-btn" data-del-notice-close>취소</button>
          <button type="button" id="confirmDeleteNoticeBtn" class="toss-chip-btn members-danger-btn">공지 삭제</button>
        </div>`;
      dlg.querySelectorAll('[data-del-notice-close]').forEach(b => b.addEventListener('click', () => { if (!busy) closeDialog(); }));
      const confirmBtn = dlg.querySelector('#confirmDeleteNoticeBtn');
      const statusEl = dlg.querySelector('#deleteNoticeStatus');
      confirmBtn?.addEventListener('click', async () => {
        if (busy || !isSameDialog(s, dv, dlg)) return;
        busy = true;
        setDialogBusy?.(true);
        dlg.querySelectorAll('button').forEach(b => { b.disabled = true; });
        statusEl.textContent = '삭제 중…';
        try {
          const res = await callRpc('cw_admin_update_notice', { p_notice_id: noticeId, p_active: null, p_delete: true }, s);
          if (!isSameDialog(s, dv, dlg)) return;
          if (res?.ok !== true) throw new Error();
          void window.CodeWikiTelemetry?.notifyRuntimeUpdate?.();
          closeDialog();
          onMessage('실시간 공지를 삭제했습니다.');
          await loadControls(true);
        } catch {
          if (isSameDialog(s, dv, dlg)) statusEl.textContent = '공지를 삭제하지 못했습니다.';
        } finally {
          busy = false;
          if (getDialogVersion() === dv) setDialogBusy?.(false);
          if (isSameDialog(s, dv, dlg)) dlg.querySelectorAll('button').forEach(b => { b.disabled = false; });
        }
      });
      dlg.showModal();
      (dlg.querySelector('.profile-dialog-actions [data-del-notice-close]') || confirmBtn)?.focus?.();
    }

    function openMaintenanceConfirmDialog(nextEnabled) {
      const s = getSession();
      if (!s || ctrlBusy) return;
      const currentMsg = String(
        host.querySelector('#adminMaintenanceForm [name="message"]')?.value ??
        ctrlData?.settings?.maintenance?.message ??
        '현재 사이트 점검 중입니다. 잠시 후 다시 이용해 주세요.'
      ).trim() || '현재 사이트 점검 중입니다. 잠시 후 다시 이용해 주세요.';
      let busy = false;
      const { dlg, version: dv } = getDialog('maintenanceConfirmTitle', false);
      dlg.innerHTML = nextEnabled
        ? `<div class="profile-dialog-header">
            <h2 id="maintenanceConfirmTitle">원격 점검 모드를 켤까요?</h2>
            <button type="button" class="icon-btn" data-maint-close aria-label="닫기">✕</button>
          </div>
          <p class="members-reset-note">확인을 누르면 현재 접속 중인 <strong>모든 학생 화면이 즉시 잠기고</strong> 아래 안내 문구가 표시됩니다. 관리자 계정은 정상적으로 이용할 수 있습니다.</p>
          <blockquote class="admin-maint-preview-quote">${esc(currentMsg)}</blockquote>
          <p id="maintConfirmStatus" role="status"></p>
          <div class="profile-dialog-actions">
            <button type="button" class="toss-chip-btn" data-maint-close>취소</button>
            <button type="button" id="confirmMaintenanceBtn" class="toss-chip-btn members-danger-btn">점검 모드 켜기 (ON)</button>
          </div>`
        : `<div class="profile-dialog-header">
            <h2 id="maintenanceConfirmTitle">원격 점검 모드를 해제할까요?</h2>
            <button type="button" class="icon-btn" data-maint-close aria-label="닫기">✕</button>
          </div>
          <p class="members-reset-note">확인을 누르면 학생 화면 잠금이 즉시 해제되어 모든 승인 학생이 다시 사이트를 이용할 수 있습니다.</p>
          <p id="maintConfirmStatus" role="status"></p>
          <div class="profile-dialog-actions">
            <button type="button" class="toss-chip-btn" data-maint-close>취소</button>
            <button type="button" id="confirmMaintenanceBtn" class="toss-primary-btn">점검 모드 끄기 (OFF)</button>
          </div>`;
      dlg.querySelectorAll('[data-maint-close]').forEach(b => b.addEventListener('click', () => { if (!busy) closeDialog(); }));
      const confirmBtn = dlg.querySelector('#confirmMaintenanceBtn');
      const statusEl = dlg.querySelector('#maintConfirmStatus');
      confirmBtn?.addEventListener('click', async () => {
        if (busy || !isSameDialog(s, dv, dlg)) return;
        busy = true;
        ctrlBusy = true;
        setDialogBusy?.(true);
        dlg.querySelectorAll('button').forEach(b => { b.disabled = true; });
        statusEl.textContent = nextEnabled ? '점검 모드를 켜는 중…' : '점검 모드를 해제하는 중…';
        let succeeded = false;
        try {
          const res = await callRpc('cw_admin_update_setting', {
            p_key: 'maintenance',
            p_value: { enabled: nextEnabled, message: currentMsg }
          }, s);
          if (!isSameDialog(s, dv, dlg)) return;
          if (res?.ok !== true) throw new Error();
          void window.CodeWikiTelemetry?.notifyRuntimeUpdate?.();
          closeDialog();
          onMessage(nextEnabled ? '원격 점검 모드를 켰습니다 (ON). 학생 화면이 즉시 잠깁니다.' : '원격 점검 모드를 해제했습니다 (OFF).');
          succeeded = true;
        } catch {
          if (isSameDialog(s, dv, dlg)) statusEl.textContent = '점검 모드 상태를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.';
        } finally {
          busy = false;
          ctrlBusy = false;
          if (getDialogVersion() === dv) setDialogBusy?.(false);
          if (isSameDialog(s, dv, dlg)) dlg.querySelectorAll('button').forEach(b => { b.disabled = false; });
        }
        if (succeeded) await loadControls(true);
      });
      dlg.showModal();
      (dlg.querySelector('.profile-dialog-actions [data-maint-close]') || confirmBtn)?.focus?.();
    }

    async function loadDashboard(force = false) {
      const s = getSession();
      if (!s || (dashLoading && !force)) return;
      const v = ++dashVersion;
      const rerenderDash = () => {
        const cur = getCurrentTab?.();
        if (cur === 'dashboard' || cur === 'insights') renderTab(cur);
      };
      dashLoading = true; dashError = '';
      rerenderDash();
      try {
        const res = await callRpc('cw_admin_learning_overview', {}, s);
        if (getSession() !== s || dashVersion !== v) return;
        dashData = res; dashLoading = false;
        rerenderDash();
      } catch (err) {
        if (getSession() === s && dashVersion === v) {
          dashLoading = false;
          dashError = err?.code === 'PGRST202'
            ? '출석부 대시보드 기능이 아직 서버 DB에 적용되지 않았습니다.'
            : '출석부 데이터를 불러오지 못했습니다.';
          rerenderDash();
        }
      }
    }

    async function loadControls(force = false) {
      const s = getSession();
      if (!s || (ctrlLoading && !force)) return;
      const v = ++ctrlVersion;
      const rerenderCurrent = () => {
        const cur = getCurrentTab?.();
        if (cur === 'notices' || cur === 'controls') renderTab(cur);
      };
      ctrlLoading = true; ctrlError = '';
      rerenderCurrent();
      try {
        const res = await callRpc('cw_admin_controls_state', {}, s);
        if (getSession() !== s || ctrlVersion !== v) return;
        ctrlData = res; ctrlLoading = false;
        rerenderCurrent();
      } catch (err) {
        if (getSession() === s && ctrlVersion === v) {
          ctrlLoading = false;
          ctrlError = err?.code === 'PGRST202'
            ? '공지·원격 제어 기능이 아직 서버 DB에 적용되지 않았습니다.'
            : '공지·원격 제어 상태를 불러오지 못했습니다.';
          rerenderCurrent();
        }
      }
    }

    async function loadInsights(days = insDays, force = false) {
      const s = getSession();
      if (!s || (insLoading && !force && insDays === days)) return;
      insDays = days;
      const v = ++insVersion;
      const rerenderAnalytics = () => {
        const cur = getCurrentTab?.();
        if (cur === 'insights' || cur === 'security') renderTab(cur);
      };
      insLoading = true; insError = '';
      rerenderAnalytics();
      try {
        const res = await callRpc('cw_admin_insights_and_security', { p_days: days }, s);
        if (getSession() !== s || insVersion !== v) return;
        insData = res; insLoading = false;
        const ackStats = computeSecurityAckStats(res);
        if (getCurrentTab?.() === 'security' && ackStats.unackedAlerts24h > 0) {
          // Viewing the Security tab acknowledges unread sidebar alerts immediately while keeping
          // the current visit's banner visible until dismissed or revisited.
          void acknowledgeSecurityAlerts({ manual: false });
        } else {
          onSecurityAlertsChange?.(ackStats.unackedAlerts24h);
        }
        rerenderAnalytics();
      } catch (err) {
        if (getSession() === s && insVersion === v) {
          insLoading = false;
          insError = err?.code === 'PGRST202'
            ? '분석·보안 검사 기능이 아직 서버 DB에 적용되지 않았습니다.'
            : '분석·보안 데이터를 불러오지 못했습니다.';
          rerenderAnalytics();
        }
      }
    }

    function renderDashboardHtml() {
      if (dashLoading && !dashData) return '<p class="members-reset-note">출석부 현황을 불러오는 중…</p>';
      if (dashError) return `<p class="members-reset-note" role="alert">${esc(dashError)}</p>`;
      if (!dashData) return '';

      const sum = dashData.summary || {};
      const roster = Array.isArray(dashData.roster_classes) ? dashData.roster_classes : [];
      const unreg = Array.isArray(dashData.unregistered_roster) ? dashData.unregistered_roster : [];
      const heatmap = Array.isArray(dashData.login_heatmap) ? dashData.login_heatmap : [];
      const daily = Array.isArray(dashData.daily_logins) ? dashData.daily_logins : [];
      const inactiveAll = Array.isArray(dashData.inactive_students) ? dashData.inactive_students : [];
      const study = dashData.study_stats || {};

      const rosterTotals = roster.reduce((acc, r) => ({ total: acc.total + (r.roster_total || 0), reg: acc.reg + (r.registered_count || 0) }), { total: 0, reg: 0 });
      const rosterPct = rosterTotals.total ? Math.round((rosterTotals.reg / rosterTotals.total) * 1000) / 10 : 0;

      const heatMapIndex = new Map();
      let maxHeat = 1;
      for (const cell of heatmap) {
        const key = `${cell.dow}:${cell.hour}`;
        const c = Number(cell.count) || 0;
        heatMapIndex.set(key, c);
        if (c > maxHeat) maxHeat = c;
      }

      const maxDaily = Math.max(1, ...daily.map(d => Number(d.unique_students) || 0));
      const inactiveFiltered = inactiveAll.filter(u => {
        if (inactiveThreshold === -1) return !u.last_login_at;
        return !u.last_login_at || Number(u.days_inactive) >= inactiveThreshold;
      });

      const dowOrder = [1, 2, 3, 4, 5, 6, 0];

      return `
        <div class="admin-kpi-grid">
          <div class="admin-kpi-card"><span class="admin-kpi-label">전체 학생</span><strong class="admin-kpi-value">${sum.total_students ?? 0}명</strong><span class="admin-kpi-sub">승인 ${sum.approved ?? 0} · 대기 ${sum.pending ?? 0} · 반려 ${sum.rejected ?? 0}</span></div>
          <div class="admin-kpi-card"><span class="admin-kpi-label">오늘 활성 (DAU)</span><strong class="admin-kpi-value">${sum.dau_today ?? 0}명</strong><span class="admin-kpi-sub">최근 7일 활성 ${sum.active_7d ?? 0}명</span></div>
          <div class="admin-kpi-card"><span class="admin-kpi-label">출석부 가입률</span><strong class="admin-kpi-value">${rosterTotals.total ? `${rosterPct}%` : '—'}</strong><span class="admin-kpi-sub">${rosterTotals.total ? `${rosterTotals.reg} / ${rosterTotals.total}명 (미가입 ${unreg.length}명)` : '등록된 출석부 없음'}</span></div>
          <div class="admin-kpi-card"><span class="admin-kpi-label">평균 완료 문서</span><strong class="admin-kpi-value">${sum.avg_completed_docs ?? 0}개</strong><span class="admin-kpi-sub">승인 학생 1인 기준</span></div>
          <div class="admin-kpi-card"><span class="admin-kpi-label">공부방 활용 (메타 집계)</span><strong class="admin-kpi-value">${study.active_authors ?? 0}명</strong><span class="admin-kpi-sub">총 ${study.total_notes ?? 0}개 노트 · 7일 수정 ${study.notes_updated_7d ?? 0}개 · 내용 비공개</span></div>
        </div>

        <div class="admin-panel-grid">
          <section class="admin-panel">
            <div class="admin-panel-head"><div><h3>최근 14일 일별 순방문자 (DAU)</h3><p>한국 시간(KST) 기준 하루 동안 로그인·재방문한 고유 학생 수입니다.</p></div></div>
            <div class="admin-daily-chart-wrap"><div class="admin-daily-chart" role="img" aria-label="최근 14일 일별 순방문자 추이">
              ${daily.map(d => {
                const h = Math.max(4, Math.round(((Number(d.unique_students) || 0) / maxDaily) * 100));
                return `<div class="admin-daily-col" title="${esc(d.day)}: 고유 ${d.unique_students}명 / 총 ${d.total_logins}회"><span class="admin-daily-val">${d.unique_students}</span><div class="admin-daily-bar-wrap"><div class="admin-daily-bar" style="height:${h}%"></div></div><span class="admin-daily-day">${esc(String(d.day || '').slice(5))}</span></div>`;
              }).join('')}
            </div></div>
          </section>

          <section class="admin-panel">
            <div class="admin-panel-head"><div><h3>요일 × 시간대 접속 히트맵 (최근 30일)</h3><p>학생들이 언제 가장 활발히 학습하는지 KST 기준으로 집계합니다.</p></div></div>
            <div class="admin-heatmap-wrap">
              <div class="admin-heatmap-grid">
                <div class="admin-hm-corner"></div>
                ${Array.from({ length: 24 }, (_, hr) => `<div class="admin-hm-hr">${hr % 3 === 0 ? hr : ''}</div>`).join('')}
                ${dowOrder.map(dow => `
                  <div class="admin-hm-dow">${DOW_LABELS[dow]}</div>
                  ${Array.from({ length: 24 }, (_, hr) => {
                    const cnt = heatMapIndex.get(`${dow}:${hr}`) || 0;
                    const level = cnt === 0 ? 0 : Math.min(4, Math.ceil((cnt / maxHeat) * 4));
                    return `<div class="admin-hm-cell lvl-${level}" title="${DOW_LABELS[dow]}요일 ${hr}시: ${cnt}회"></div>`;
                  }).join('')}
                `).join('')}
              </div>
            </div>
          </section>
        </div>

        <section class="admin-panel">
          <div class="admin-panel-head">
            <div><h3>출석부 대조 · 미가입자 현황</h3><p>명단 기준 가입 진행률과 아직 가입하지 않은 학생입니다.</p></div>
            ${unreg.length ? '<button type="button" class="toss-chip-btn" data-export-unreg>미가입자 CSV</button>' : ''}
          </div>
          ${roster.length ? `<div class="admin-bar-list">${roster.map(r => {
            const p = r.roster_total ? Math.round((r.registered_count / r.roster_total) * 100) : 0;
            return `<div class="admin-bar-row"><div class="admin-bar-meta"><strong>${esc(r.class_name)}</strong><span>${r.registered_count}/${r.roster_total}명 (${p}%) · 승인 ${r.approved_count} · 대기 ${r.pending_count}</span></div><div class="admin-bar-track"><div class="admin-bar-fill" style="width:${p}%"></div></div></div>`;
          }).join('')}</div>` : '<p class="members-reset-note">등록된 출석부 명단이 없습니다.</p>'}
          ${unreg.length ? `
            <div class="admin-subtable-wrap">
              <table class="members-table admin-compact-table">
                <thead><tr><th>반</th><th>출석번호</th><th>이름</th></tr></thead>
                <tbody>${unreg.map(u => `<tr><td>${esc(u.class_name)}</td><td>${esc(u.student_number)}번</td><td>${esc(u.full_name)}</td></tr>`).join('')}</tbody>
              </table>
            </div>` : (roster.length ? '<p class="admin-ok-note">출석부 학생이 모두 가입했습니다.</p>' : '')}
        </section>

        <section class="admin-panel">
          <div class="admin-panel-head">
            <div><h3>미접속 · 이탈 감지 학생 (${inactiveFiltered.length}명)</h3><p>승인 완료 학생 중 최근 접속이 뜸한 학생을 확인하고 바로 1:1 알림을 보낼 수 있습니다.</p></div>
            <div class="admin-chip-group">
              ${[[3, '3일 이상'], [7, '7일 이상'], [14, '14일 이상'], [-1, '로그인 없음']].map(([val, label]) =>
                `<button type="button" class="toss-chip-btn ${inactiveThreshold === val ? 'active' : ''}" data-inactive-days="${val}">${label}</button>`
              ).join('')}
            </div>
          </div>
          ${inactiveFiltered.length ? `
            <div class="members-table-wrap">
              <table class="members-table admin-compact-table">
                <thead><tr><th>반</th><th>번호</th><th>이름</th><th>아이디</th><th>마지막 로그인</th><th>미접속</th><th>완료 문서</th><th class="members-actions-col">조치</th></tr></thead>
                <tbody>${inactiveFiltered.map(u => `<tr>
                  <td>${esc(u.class_name || '기본반')}</td>
                  <td>${esc(u.student_number ?? '—')}</td>
                  <td>${esc(u.full_name)}</td>
                  <td>${esc(u.username)}</td>
                  <td class="members-time-cell">${esc(formatDateTime(u.last_login_at))}</td>
                  <td><span class="admin-warn-pill">${u.last_login_at ? `${u.days_inactive}일 전` : '기록 없음'}</span></td>
                  <td>${u.completed_docs ?? 0}개</td>
                  <td class="members-actions-cell"><div class="members-row-actions"><button type="button" class="toss-chip-btn" data-dm-inactive="${esc(u.id)}">1:1 알림</button></div></td>
                </tr>`).join('')}</tbody>
              </table>
            </div>` : '<p class="admin-ok-note">선택한 기준에 해당하는 장기 미접속 학생이 없습니다.</p>'}
        </section>`;
    }

    function filterDmRecipients(approvedStudents) {
      const q = dmSearchQuery.trim().toLocaleLowerCase();
      return approvedStudents.filter(u => {
        const cls = u.class_name || '기본반';
        if (dmClassFilter !== 'ALL' && cls !== dmClassFilter) return false;
        if (q && !`${u.full_name || ''} ${u.username || ''} ${cls}`.toLocaleLowerCase().includes(q)) return false;
        return true;
      });
    }

    function renderDmRecipientPickerHtml(approvedStudents) {
      const classes = [...new Set(approvedStudents.map(u => u.class_name || '기본반'))].sort((a, b) => a.localeCompare(b, 'ko', { numeric: true }));
      if (dmClassFilter !== 'ALL' && !classes.includes(dmClassFilter)) dmClassFilter = 'ALL';
      const visible = filterDmRecipients(approvedStudents);
      const validIds = new Set(approvedStudents.map(u => String(u.id)));
      for (const id of [...dmSelectedIds]) if (!validIds.has(id)) dmSelectedIds.delete(id);
      const selectedCount = dmSelectedIds.size;

      return `
        <div class="admin-dm-picker" id="adminDmRecipientPicker">
          <div class="admin-dm-picker-head">
            <span class="admin-dm-picker-label">대상 학생 (복수 선택 가능) <strong class="admin-meta-pill">${selectedCount}명 선택됨</strong></span>
            <div class="admin-chip-group">
              <button type="button" class="toss-chip-btn" data-dm-select-visible ${!visible.length ? 'disabled' : ''}>표시 전체 선택</button>
              <button type="button" class="toss-chip-btn" data-dm-clear-all ${!selectedCount ? 'disabled' : ''}>선택 해제</button>
            </div>
          </div>
          <div class="admin-dm-picker-filters">
            <input id="adminDmRecipientSearch" type="search" placeholder="이름, 아이디 또는 반 검색" value="${esc(dmSearchQuery)}">
            ${classes.length > 1 ? `<div class="admin-chip-group">${[['ALL', '전체 반'], ...classes.map(c => [c, c])].map(([id, label]) =>
              `<button type="button" class="toss-chip-btn${dmClassFilter === id ? ' active' : ''}" data-dm-class="${esc(id)}">${esc(label)}</button>`
            ).join('')}</div>` : ''}
          </div>
          <div class="admin-dm-recipient-list" role="group" aria-label="1:1 알림 대상 학생 선택">
            ${studentsLoading && !approvedStudents.length
              ? '<p class="members-reset-note">승인 학생 목록을 불러오는 중…</p>'
              : visible.length
                ? visible.map(u => {
                  const checked = dmSelectedIds.has(String(u.id));
                  return `<label class="admin-dm-recipient-item${checked ? ' is-selected' : ''}">
                    <input type="checkbox" name="target_ids" value="${esc(u.id)}" data-dm-recipient="${esc(u.id)}" ${checked ? 'checked' : ''} ${ctrlBusy ? 'disabled' : ''}>
                    <span><strong>${esc(u.full_name)}</strong> <small>${esc(u.class_name || '기본반')} · @${esc(u.username)}</small></span>
                  </label>`;
                }).join('')
                : '<p class="members-reset-note">조건에 맞는 승인 학생이 없습니다.</p>'}
          </div>
          ${selectedCount > 30 ? '<p class="admin-dm-picker-warn" role="alert">한 번에 최대 30명까지 발송할 수 있습니다. 전체 대상은 왼쪽 실시간 공지 발송을 이용해 주세요.</p>' : ''}
        </div>`;
    }

    function renderNoticesHtml() {
      if (ctrlLoading && !ctrlData) return '<p class="members-reset-note">공지 · 알림 현황을 불러오는 중…</p>';
      if (ctrlError) return `<p class="members-reset-note" role="alert">${esc(ctrlError)}</p>`;
      if (!ctrlData) return '';

      const settings = ctrlData.settings || {};
      const sp = settings.spotlight || { active: false, doc_id: '', label: '', message: '' };
      const notices = Array.isArray(ctrlData.notices) ? ctrlData.notices : [];
      const dms = Array.isArray(ctrlData.direct_messages) ? ctrlData.direct_messages : [];
      const docOptions = getDocOptions();
      const classOptions = ['1반', '2반', '3반', '4반', '5반', '6반', '7반'];
      const approvedStudents = getApprovedStudents();

      const unifiedFeed = [
        ...notices.map(n => ({ kind: 'broadcast', created_at: n.created_at, raw: n })),
        ...dms.map(m => ({ kind: 'dm', created_at: m.created_at, raw: m }))
      ].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

      const filteredFeed = noticeFeedFilter === 'all'
        ? unifiedFeed
        : unifiedFeed.filter(item => item.kind === noticeFeedFilter);

      return `
        <section class="admin-panel admin-unified-feed-panel">
          <div class="admin-panel-head">
            <div>
              <h3>알림 발송 내역 (${unifiedFeed.length}건)</h3>
              <p>전체 공지와 학생별 1:1 알림 발송 기록 및 읽음 상태를 한곳에서 확인합니다.</p>
            </div>
            <div class="admin-chip-group" role="group" aria-label="알림 종류 필터">
              <button type="button" class="toss-chip-btn${noticeFeedFilter === 'all' ? ' active' : ''}" data-notice-feed-filter="all">전체 (${unifiedFeed.length})</button>
              <button type="button" class="toss-chip-btn${noticeFeedFilter === 'broadcast' ? ' active' : ''}" data-notice-feed-filter="broadcast">전체 공지 (${notices.length})</button>
              <button type="button" class="toss-chip-btn${noticeFeedFilter === 'dm' ? ' active' : ''}" data-notice-feed-filter="dm">학생별 1:1 알림 (${dms.length})</button>
            </div>
          </div>
          ${filteredFeed.length ? `<div class="members-table-wrap admin-feed-table-wrap"><table class="members-table admin-compact-table admin-feed-table">
            <thead><tr><th>종류</th><th>발송 시각</th><th>대상</th><th>제목 · 내용</th><th>확인 현황</th><th class="members-actions-col">관리</th></tr></thead>
            <tbody>${filteredFeed.map(item => {
              if (item.kind === 'broadcast') {
                const n = item.raw;
                const targetCnt = Math.max(0, Number(n.target_count) || 0);
                const readCnt = Math.max(0, Number(n.read_count) || 0);
                const pct = targetCnt ? Math.min(100, Math.round((readCnt / targetCnt) * 100)) : 0;
                const excerpt = String(n.body || '').replace(/\s+/g, ' ').trim();
                return `<tr class="${n.active ? '' : 'is-feed-inactive'}">
                  <td><span class="admin-meta-pill">전체 공지</span></td>
                  <td class="members-time-cell">${esc(formatShortTime(n.created_at))}</td>
                  <td><span class="admin-status-pill ${n.active ? 'is-on' : 'is-off'}">${n.active ? '노출 중' : '중지'}</span> <small>${esc(n.target_class || '전체 반')}</small></td>
                  <td class="admin-feed-content-cell"><strong>${esc(n.title)}</strong><span>${esc(excerpt.slice(0, 100))}${excerpt.length > 100 ? '…' : ''}</span></td>
                  <td class="members-time-cell"><strong>${readCnt}</strong> / ${targetCnt}명 (${pct}%)</td>
                  <td class="members-actions-cell"><div class="members-row-actions">
                    <button type="button" class="toss-chip-btn" data-notice-reads="${esc(n.id)}">읽음 명단</button>
                    <button type="button" class="toss-chip-btn" data-notice-toggle="${esc(n.id)}" data-notice-next="${n.active ? 'false' : 'true'}" ${ctrlBusy ? 'disabled' : ''}>${n.active ? '중지' : '켜기'}</button>
                    <button type="button" class="toss-chip-btn members-danger-btn" data-notice-delete="${esc(n.id)}" ${ctrlBusy ? 'disabled' : ''}>삭제</button>
                  </div></td>
                </tr>`;
              }
              const m = item.raw;
              const excerpt = String(m.body || '').replace(/\s+/g, ' ').trim();
              return `<tr>
                <td><span class="admin-dm-pill">1:1 알림</span></td>
                <td class="members-time-cell">${esc(formatShortTime(m.created_at))}</td>
                <td>${esc(m.full_name)} <small>(${esc(m.class_name || '기본반')} · @${esc(m.username)})</small></td>
                <td class="admin-feed-content-cell"><strong>${esc(m.title)}</strong><span>${esc(excerpt.slice(0, 100))}${excerpt.length > 100 ? '…' : ''}</span></td>
                <td>${m.read_at ? `<span class="admin-status-pill is-on">읽음 · ${esc(formatShortTime(m.read_at))}</span>` : '<span class="admin-unread-pill">미확인</span>'}</td>
                <td class="members-actions-cell"><span class="admin-feed-dash">—</span></td>
              </tr>`;
            }).join('')}</tbody>
          </table></div>` : '<p class="members-reset-note">표시할 알림 발송 내역이 없습니다.</p>'}
        </section>

        <div class="admin-panel-grid">
          <div class="admin-stack-col">
            <section class="admin-panel">
              <div class="admin-panel-head"><div><h3>배포 없는 실시간 공지 발송</h3><p>저장 즉시 접속 중인 학생 화면에 공지 팝업이 뜨고, 읽음 여부가 실시간 집계됩니다.</p></div></div>
              <form id="adminPublishNoticeForm" class="admin-form-stack">
                <div class="admin-form-row">
                  <label>배지<input name="badge" type="text" maxlength="40" value="실시간 공지"></label>
                  <label>대상 반<select name="target_class"><option value="">전체 반</option>${classOptions.map(c => `<option value="${c}">${c}</option>`).join('')}</select></label>
                </div>
                <label>공지 제목<input name="title" type="text" maxlength="160" placeholder="예: 오늘 수업 자료 업데이트 안내" required></label>
                <label>공지 내용 (빈 줄로 항목 구분)<textarea name="body" rows="4" maxlength="4000" placeholder="학생들에게 전달할 공지 내용을 입력해 주세요." required></textarea></label>
                <label>하단 응원 문구 (선택)<input name="cheer" type="text" maxlength="200" placeholder="예: 시험공부 화이팅입니다!"></label>
                <div class="admin-form-actions">
                  <button type="submit" class="toss-primary-btn" ${ctrlBusy ? 'disabled' : ''}>전체 공지 발송</button>
                </div>
              </form>
            </section>

            <section class="admin-panel">
              <div class="admin-panel-head">
                <div><h3>수업 실시간 스포트라이트 (상단 알림 배너)</h3><p>접속 중인 모든 학생 상단에 특정 문서 바로가기 배너를 실시간으로 띄웁니다.</p></div>
                ${sp.active ? '<span class="admin-status-pill is-on">송출 중</span>' : '<span class="admin-status-pill is-off">대기</span>'}
              </div>
              <form id="adminSpotlightForm" class="admin-form-stack">
                <label>공유할 문서<select name="doc_id" required>
                  <option value="">문서를 선택하세요</option>
                  ${docOptions.map(d => `<option value="${esc(d.id)}" ${sp.doc_id === d.id ? 'selected' : ''}>${esc(d.title)}</option>`).join('')}
                </select></label>
                <label>한 줄 안내 문구<input name="message" type="text" maxlength="300" value="${esc(sp.message || '')}" placeholder="예: 지금 Basic Session 놓친 포인트 같이 확인해요!"></label>
                <div class="admin-form-actions">
                  <button type="submit" class="toss-primary-btn" ${ctrlBusy ? 'disabled' : ''}>스포트라이트 발송</button>
                  ${sp.active ? `<button type="button" class="toss-chip-btn members-danger-btn" data-stop-spotlight ${ctrlBusy ? 'disabled' : ''}>송출 종료</button>` : ''}
                </div>
              </form>
            </section>
          </div>

          <section class="admin-panel">
            <div class="admin-panel-head">
              <div><h3>1:1 학생 알림 보내기 (복수 선택)</h3><p>여러 학생을 한 번에 선택해 동일한 개인 팝업 알림을 즉시 발송할 수 있습니다.</p></div>
            </div>
            <form id="adminInlineDmForm" class="admin-form-stack">
              ${renderDmRecipientPickerHtml(approvedStudents)}
              <label>알림 제목<input name="title" type="text" maxlength="120" placeholder="예: 출석번호 확인 부탁드립니다" required></label>
              <label>알림 내용<textarea name="body" rows="4" maxlength="1000" placeholder="선택한 학생 화면에 표시할 안내 내용을 입력해 주세요." required></textarea></label>
              <div class="admin-form-actions">
                <button type="submit" class="toss-primary-btn" ${ctrlBusy || dmSelectedIds.size === 0 || dmSelectedIds.size > 30 ? 'disabled' : ''}>선택한 ${dmSelectedIds.size}명에게 알림 발송</button>
              </div>
            </form>
          </section>
        </div>`;
    }

    function renderControlsHtml() {
      if (ctrlLoading && !ctrlData) return '<p class="members-reset-note">원격 제어 상태를 불러오는 중…</p>';
      if (ctrlError) return `<p class="members-reset-note" role="alert">${esc(ctrlError)}</p>`;
      if (!ctrlData) return '';

      const settings = ctrlData.settings || {};
      const maint = settings.maintenance || { enabled: false, message: '' };
      const flags = settings.feature_flags || {};

      return `
        <div class="admin-panel-grid">
          <section class="admin-panel">
            <div class="admin-panel-head">
              <div><h3>원격 점검 모드 (Maintenance)</h3><p>켜면 학생 화면만 점검 안내로 잠기고, 관리자는 정상 접속됩니다.</p></div>
              <span class="admin-status-pill ${maint.enabled ? 'is-danger' : 'is-off'}">${maint.enabled ? '점검 중 ON' : '정상 운영 OFF'}</span>
            </div>
            <div class="admin-maint-toggle-box${maint.enabled ? ' is-on' : ''}">
              <div>
                <strong>${maint.enabled ? '학생 접속이 차단된 상태입니다' : '현재 모든 학생이 정상 접속 중입니다'}</strong>
                <span>${maint.enabled ? 'OFF로 전환하면 학생 화면 잠금이 즉시 해제됩니다.' : 'ON으로 전환 시 확인 팝업을 거쳐 학생 화면을 잠급니다.'}</span>
              </div>
              <button type="button" role="switch" aria-checked="${Boolean(maint.enabled)}" aria-label="원격 점검 모드 전환" class="admin-power-toggle${maint.enabled ? ' is-on' : ''}" data-toggle-maintenance ${ctrlBusy ? 'disabled' : ''}>
                <span class="admin-power-track" aria-hidden="true"><span class="admin-power-thumb"></span></span>
                <span class="admin-power-label">${maint.enabled ? 'ON' : 'OFF'}</span>
              </button>
            </div>
            <form id="adminMaintenanceForm" class="admin-form-stack">
              <label>점검 안내 문구<textarea name="message" rows="3" maxlength="500">${esc(maint.message || '현재 사이트 점검 중입니다. 잠시 후 다시 이용해 주세요.')}</textarea></label>
              <div class="admin-form-actions">
                <button type="submit" class="toss-chip-btn" ${ctrlBusy ? 'disabled' : ''}>안내 문구 저장</button>
              </div>
            </form>
          </section>

          <section class="admin-panel">
            <div class="admin-panel-head"><div><h3>학생 메뉴 원격 잠금 (Feature Flags)</h3><p>시험 시간·수업 진도에 맞춰 배포 없이 메뉴를 켜고 끌 수 있습니다.</p></div></div>
            <div class="admin-flag-list">
              ${FEATURE_FLAG_META.map(([key, label, desc]) => {
                const on = flags[key] !== false;
                return `<label class="admin-flag-item"><div><strong>${esc(label)}</strong><span>${esc(desc)}</span></div><input type="checkbox" data-feature-flag="${key}" ${on ? 'checked' : ''} ${ctrlBusy ? 'disabled' : ''}></label>`;
              }).join('')}
            </div>
          </section>
        </div>`;
    }

    function renderInsightsHtml() {
      if ((insLoading && !insData) || (dashLoading && !dashData && !insData)) return '<p class="members-reset-note">학습 분석 데이터를 불러오는 중…</p>';
      if (insError && dashError) return `<p class="members-reset-note" role="alert">${esc(insError)}</p>`;
      if (!insData && !dashData) return '';

      const sum = dashData?.summary || {};
      const approvedBase = Math.max(1, Number(sum.approved) || 1);
      const units = Array.isArray(dashData?.unit_progress) ? dashData.unit_progress.slice() : [];
      const unitPctMap = new Map(units.map(u => [u.doc_id, {
        count: Number(u.completed_count) || 0,
        pct: Math.min(100, Math.round(((Number(u.completed_count) || 0) / approvedBase) * 100))
      }]));

      const sortedUnits = units.slice().sort((a, b) => unitSortAsc
        ? (a.completed_count - b.completed_count) || a.doc_id.localeCompare(b.doc_id)
        : (b.completed_count - a.completed_count) || a.doc_id.localeCompare(b.doc_id));

      const topDocs = Array.isArray(insData?.top_docs) ? insData.top_docs : [];
      const topSearches = Array.isArray(insData?.top_searches) ? insData.top_searches : [];
      const failedSearches = Array.isArray(insData?.failed_searches) ? insData.failed_searches : [];
      const topCopies = Array.isArray(insData?.top_copies) ? insData.top_copies : [];
      const quizzes = Array.isArray(insData?.hardest_quizzes) ? insData.hardest_quizzes : [];
      const devices = Array.isArray(insData?.device_breakdown) ? insData.device_breakdown : [];

      const maxViews = Math.max(1, ...topDocs.map(d => Number(d.views) || 0));
      const totalDeviceViews = devices.reduce((s, d) => s + (Number(d.count) || 0), 0);
      const deviceLabels = { desktop: 'PC', mobile: '모바일', tablet: '태블릿' };

      // Learning Insight #1: Track-level completion averages (BC400 / BC430 / 실전·가이드)
      const trackBuckets = {
        bc400: { label: 'BC400 (ABAP Workbench)', items: [] },
        bc430: { label: 'BC430 (ABAP Dictionary)', items: [] },
        guide: { label: '실전 · SQL · 참고 가이드', items: [] }
      };
      for (const u of units) {
        const pct = Math.min(100, Math.round(((Number(u.completed_count) || 0) / approvedBase) * 100));
        if (/^unit-\d+/.test(u.doc_id)) trackBuckets.bc400.items.push(pct);
        else if (/^bc430-\d+/.test(u.doc_id)) trackBuckets.bc430.items.push(pct);
        else trackBuckets.guide.items.push(pct);
      }
      const trackSummary = Object.values(trackBuckets).map(b => ({
        label: b.label,
        docs: b.items.length,
        avgPct: b.items.length ? Math.round(b.items.reduce((a, c) => a + c, 0) / b.items.length) : 0
      })).filter(t => t.docs > 0);
      const avgUnitPct = units.length
        ? Math.round(units.reduce((acc, u) => acc + Math.min(100, ((Number(u.completed_count) || 0) / approvedBase) * 100), 0) / units.length)
        : null;

      // Learning Insight #2: Search fulfillment rate
      const totalSearchCount = topSearches.reduce((s, x) => s + (Number(x.count) || 0), 0);
      const failedSearchCount = failedSearches.reduce((s, x) => s + (Number(x.count) || 0), 0);
      const allSearchAttempts = totalSearchCount + failedSearchCount;
      const searchSuccessPct = allSearchAttempts ? Math.round((totalSearchCount / allSearchAttempts) * 100) : null;

      // Learning Insight #3: Quiz & SQL practice accuracy rollup
      const quizTotals = quizzes.reduce((acc, q) => {
        const att = Number(q.attempts) || 0;
        const wr = Number(q.wrong_count) || 0;
        acc.attempts += att;
        acc.wrong += wr;
        const k = q.source === 'sql-practice' ? 'sql' : 'game';
        acc[k].attempts += att;
        acc[k].wrong += wr;
        return acc;
      }, { attempts: 0, wrong: 0, sql: { attempts: 0, wrong: 0 }, game: { attempts: 0, wrong: 0 } });
      const overallQuizAccuracy = quizTotals.attempts
        ? Math.round(((quizTotals.attempts - quizTotals.wrong) / quizTotals.attempts) * 100)
        : null;

      // Learning Insight #4: Bottleneck radar (high views vs low completion rate) & longest study dwell time
      const bottlenecks = topDocs
        .filter(d => d.doc_id && !String(d.doc_id).startsWith('page:') && d.doc_id !== 'welcome-abap')
        .map(d => {
          const prog = unitPctMap.get(d.doc_id) || { count: 0, pct: 0 };
          return {
            doc_id: d.doc_id,
            views: Number(d.views) || 0,
            avg_stay_sec: Number(d.avg_stay_sec) || 0,
            completed_count: prog.count,
            completed_pct: prog.pct,
            gapScore: (Number(d.views) || 0) * (100 - prog.pct)
          };
        })
        .filter(d => d.views >= 2 && d.completed_pct < 70)
        .sort((a, b) => b.gapScore - a.gapScore)
        .slice(0, 8);

      const longestStayDocs = topDocs
        .filter(d => Number(d.avg_stay_sec) > 0)
        .slice()
        .sort((a, b) => (Number(b.avg_stay_sec) || 0) - (Number(a.avg_stay_sec) || 0))
        .slice(0, 8);

      const copyMap = new Map(topCopies.map(c => [c.doc_id, Number(c.count) || 0]));
      const totalCopies = topCopies.reduce((s, c) => s + (Number(c.count) || 0), 0);
      const topBottleneck = bottlenecks[0] || null;

      const partialErrorBanner = (insError || dashError)
        ? `<p class="members-reset-note" role="alert">${esc(insError || dashError)}</p>`
        : '';

      return `
        ${partialErrorBanner}
        <div class="admin-toolbar-row">
          <span class="members-reset-note">학습 행동·검색·퀴즈 통계는 개인 식별자 없이 익명 집계되며, 단원 완료율과 교차 분석합니다.</span>
          <div class="admin-chip-group">
            ${[7, 14, 30].map(d => `<button type="button" class="toss-chip-btn ${insDays === d ? 'active' : ''}" data-insights-days="${d}">최근 ${d}일</button>`).join('')}
          </div>
        </div>

        <div class="admin-kpi-grid">
          <div class="admin-kpi-card"><span class="admin-kpi-label">평균 단원 완료율</span><strong class="admin-kpi-value">${avgUnitPct !== null ? `${avgUnitPct}%` : '—'}</strong><span class="admin-kpi-sub">기록된 ${units.length}개 문서 · 승인 ${sum.approved ?? 0}명 기준</span></div>
          <div class="admin-kpi-card"><span class="admin-kpi-label">검색 충족률</span><strong class="admin-kpi-value">${searchSuccessPct !== null ? `${searchSuccessPct}%` : '—'}</strong><span class="admin-kpi-sub">${allSearchAttempts ? `성공 ${totalSearchCount}회 · 실패 ${failedSearchCount}회` : '수집된 검색 없음'}</span></div>
          <div class="admin-kpi-card"><span class="admin-kpi-label">퀴즈 · SQL 평균 정답률</span><strong class="admin-kpi-value">${overallQuizAccuracy !== null ? `${overallQuizAccuracy}%` : '—'}</strong><span class="admin-kpi-sub">${quizTotals.attempts ? `총 ${quizTotals.attempts}회 풀이 (오답 ${quizTotals.wrong}회)` : '수집된 풀이 없음'}</span></div>
          <div class="admin-kpi-card${topBottleneck ? ' is-attention' : ''}"><span class="admin-kpi-label">핵심 복습 병목 문서</span><strong class="admin-kpi-value admin-kpi-value-sm">${topBottleneck ? esc(docTitle(topBottleneck.doc_id)) : '양호'}</strong><span class="admin-kpi-sub">${topBottleneck ? `조회 ${topBottleneck.views}회 · 완료율 ${topBottleneck.completed_pct}%` : '고조회·저완료 병목 없음'}</span></div>
          <div class="admin-kpi-card"><span class="admin-kpi-label">예제 코드 복사</span><strong class="admin-kpi-value">${totalCopies}회</strong><span class="admin-kpi-sub">최근 ${insDays}일 실습 코드 활용</span></div>
        </div>

        <div class="admin-panel-grid">
          <section class="admin-panel">
            <div class="admin-panel-head">
              <div><h3>단원별 학습 완료율</h3><p>승인 학생(${sum.approved ?? 0}명) 중 완료 체크한 비율입니다.</p></div>
              <button type="button" class="toss-chip-btn" data-toggle-unit-sort>${unitSortAsc ? '완료율 높은 순' : '완료율 낮은 순'}</button>
            </div>
            ${trackSummary.length ? `<div class="admin-device-strip">${trackSummary.map(t => `<div class="admin-device-pill"><strong>${esc(t.label)}</strong><span>평균 ${t.avgPct}% (${t.docs}개)</span></div>`).join('')}</div>` : ''}
            ${sortedUnits.length ? `<div class="admin-bar-list admin-scroll-list">${sortedUnits.map(u => {
              const pct = Math.min(100, Math.round(((Number(u.completed_count) || 0) / approvedBase) * 100));
              const copies = copyMap.get(u.doc_id) || 0;
              return `<div class="admin-bar-row"><div class="admin-bar-meta"><strong title="${esc(u.doc_id)}">${esc(docTitle(u.doc_id))}</strong><span>${u.completed_count}명 (${pct}%)${copies ? ` · 복사 ${copies}회` : ''}</span></div><div class="admin-bar-track"><div class="admin-bar-fill" style="width:${pct}%"></div></div></div>`;
            }).join('')}</div>` : '<p class="members-reset-note">아직 기록된 학습 완료 데이터가 없습니다.</p>'}
          </section>

          <section class="admin-panel">
            <div class="admin-panel-head">
              <div><h3>학습 병목 · 집중 체류 레이더</h3><p>많이 보지만 완료율이 낮은 단원(이해 병목)과 평균 체류시간이 긴 문서를 뽑아냅니다.</p></div>
            </div>
            <h4 class="admin-subsection-title">고조회 · 저완료 병목 후보 (복습 보강 추천)</h4>
            ${bottlenecks.length ? `<div class="admin-subtable-wrap"><table class="members-table admin-compact-table">
              <thead><tr><th>문서</th><th>조회</th><th>완료율</th><th>평균 체류</th></tr></thead>
              <tbody>${bottlenecks.map(b => `<tr>
                <td><strong>${esc(docTitle(b.doc_id))}</strong></td>
                <td>${b.views}회</td>
                <td><span class="admin-warn-pill">${b.completed_pct}% (${b.completed_count}명)</span></td>
                <td class="members-time-cell">${esc(formatDuration(b.avg_stay_sec))}</td>
              </tr>`).join('')}</tbody>
            </table></div>` : '<p class="admin-ok-note">조회 대비 완료율이 크게 처지는 병목 문서가 아직 없습니다.</p>'}

            <h4 class="admin-subsection-title">평균 체류시간 TOP (고난도 · 집중 학습 구간)</h4>
            ${longestStayDocs.length ? `<div class="admin-tag-cloud">${longestStayDocs.map(d => `<span class="admin-tag-pill">${esc(docTitle(d.doc_id))} <b>${esc(formatDuration(d.avg_stay_sec))}</b></span>`).join('')}</div>` : '<p class="members-reset-note">체류시간 통계가 아직 수집되지 않았습니다.</p>'}
          </section>
        </div>

        <div class="admin-panel-grid">
          <section class="admin-panel">
            <div class="admin-panel-head"><div><h3>인기 문서 TOP 15 & 평균 체류시간</h3><p>최근 ${insDays}일 기준 문서 조회수와 평균 체류시간입니다.</p></div></div>
            ${topDocs.length ? `<div class="admin-bar-list">${topDocs.map(d => {
              const w = Math.round(((Number(d.views) || 0) / maxViews) * 100);
              return `<div class="admin-bar-row"><div class="admin-bar-meta"><strong title="${esc(d.doc_id)}">${esc(docTitle(d.doc_id))}</strong><span>${d.views}회 · 평균 ${esc(formatDuration(d.avg_stay_sec))}</span></div><div class="admin-bar-track"><div class="admin-bar-fill" style="width:${w}%"></div></div></div>`;
            }).join('')}</div>` : '<p class="members-reset-note">아직 수집된 문서 열람 통계가 없습니다.</p>'}
          </section>

          <section class="admin-panel">
            <div class="admin-panel-head"><div><h3>검색 실패어 (결과 0건) & 인기 검색어</h3><p>검색 실패어는 학생들이 찾지만 사이트에 아직 없는 콘텐츠 보강 포인트입니다.</p></div></div>
            <h4 class="admin-subsection-title">검색 실패어 TOP 20 (콘텐츠 보강 레이더)</h4>
            ${failedSearches.length ? `<div class="admin-tag-cloud">${failedSearches.map(s => `<span class="admin-tag-pill is-danger">${esc(s.query)} <b>${s.count}</b></span>`).join('')}</div>` : '<p class="members-reset-note">검색 결과가 0건이었던 검색어가 없습니다.</p>'}
            <h4 class="admin-subsection-title">많이 검색된 키워드 TOP 20</h4>
            ${topSearches.length ? `<div class="admin-tag-cloud">${topSearches.map(s => `<span class="admin-tag-pill">${esc(s.query)} <b>${s.count}</b></span>`).join('')}</div>` : '<p class="members-reset-note">아직 수집된 검색어 통계가 없습니다.</p>'}
          </section>
        </div>

        <div class="admin-panel-grid">
          <section class="admin-panel">
            <div class="admin-panel-head"><div><h3>많이 복사된 예제 코드 & 접속 기기 비율</h3><p>어느 문서의 ABAP 예제 코드가 가장 자주 복사되는지 보여줍니다.</p></div></div>
            ${devices.length ? `<div class="admin-device-strip">${devices.map(d => {
              const p = totalDeviceViews ? Math.round((d.count / totalDeviceViews) * 100) : 0;
              return `<div class="admin-device-pill"><strong>${esc(deviceLabels[d.device_type] || d.device_type)}</strong><span>${p}% (${d.count}회)</span></div>`;
            }).join('')}</div>` : ''}
            ${topCopies.length ? `<div class="admin-bar-list">${topCopies.map(c => `<div class="admin-bar-row"><div class="admin-bar-meta"><strong>${esc(docTitle(c.doc_id))}</strong><span>${c.count}회 복사</span></div></div>`).join('')}</div>` : '<p class="members-reset-note">아직 수집된 코드 복사 통계가 없습니다.</p>'}
          </section>

          <section class="admin-panel">
            <div class="admin-panel-head"><div><h3>퀴즈 · SQL 오답률 TOP 15</h3><p>DATA 미니게임 및 ABAP SQL 연습문제 중 학생들이 가장 많이 틀리는 문항입니다.</p></div></div>
            ${(quizTotals.game.attempts || quizTotals.sql.attempts) ? `<div class="admin-device-strip">
              ${quizTotals.game.attempts ? `<div class="admin-device-pill"><strong>DATA 게임</strong><span>오답률 ${Math.round((quizTotals.game.wrong / quizTotals.game.attempts) * 100)}% (${quizTotals.game.attempts}회)</span></div>` : ''}
              ${quizTotals.sql.attempts ? `<div class="admin-device-pill"><strong>SQL 연습</strong><span>오답률 ${Math.round((quizTotals.sql.wrong / quizTotals.sql.attempts) * 100)}% (${quizTotals.sql.attempts}회)</span></div>` : ''}
            </div>` : ''}
            ${quizzes.length ? `<div class="admin-subtable-wrap"><table class="members-table admin-compact-table">
              <thead><tr><th>유형</th><th>문항</th><th>시도</th><th>오답률</th></tr></thead>
              <tbody>${quizzes.map(q => `<tr><td>${esc(q.source === 'sql-practice' ? 'SQL 연습' : 'DATA 게임')}</td><td>${esc(q.label || q.target_key)}</td><td>${q.attempts}회</td><td><span class="admin-warn-pill">${q.wrong_rate}% (${q.wrong_count}/${q.attempts})</span></td></tr>`).join('')}</tbody>
            </table></div>` : '<p class="members-reset-note">아직 수집된 퀴즈/SQL 풀이 통계가 없습니다.</p>'}
          </section>
        </div>`;
    }

    function filterSecurityEvents(events) {
      const q = secSearchQuery.trim().toLowerCase();
      return events.filter(ev => {
        if (secSeverityFilter && ev.severity !== secSeverityFilter) return false;
        if (secTypeFilter && ev.event_type !== secTypeFilter) return false;
        if (!q) return true;
        const hay = [
          ev.target_account, ev.user_full_name, ev.user_class_name,
          ev.client_fp, ev.reason_code, ev.summary,
          SECURITY_EVENT_LABELS[ev.event_type] || ev.event_type,
          SECURITY_SOURCE_LABELS[ev.source] || ev.source,
          ...formatSecurityDetailsText(ev)
        ].join(' ').toLowerCase();
        return hay.includes(q);
      });
    }

    function renderSecurityEventsTableHtml(events) {
      const filtered = filterSecurityEvents(events);
      if (!filtered.length) {
        return `<p class="members-reset-note">${events.length ? '선택한 필터/검색 조건에 일치하는 보안 이벤트가 없습니다.' : '최근 기간 중 기록된 보안 공격 · 실패 이벤트가 없습니다.'}</p>`;
      }
      return `<div class="members-table-wrap admin-sec-events-wrap"><table class="members-table admin-compact-table admin-sec-table">
        <thead><tr><th>발생 시각 (KST)</th><th>위험도</th><th>공격 · 이벤트 유형</th><th>대상 계정</th><th>출처 · 지문</th><th>상세 내용</th></tr></thead>
        <tbody>${filtered.map(ev => {
          const sev = SECURITY_SEVERITY_META[ev.severity] || SECURITY_SEVERITY_META.warn;
          const evLabel = SECURITY_EVENT_LABELS[ev.event_type] || ev.event_type;
          const srcLabel = SECURITY_SOURCE_LABELS[ev.source] || ev.source || '—';
          const detailTags = formatSecurityDetailsText(ev);
          const acctHtml = ev.target_account
            ? `<strong>${esc(ev.target_account === '미인증 요청' ? ev.target_account : '@' + ev.target_account)}</strong>${ev.user_full_name
              ? `<span class="admin-sec-sub">${esc(ev.user_full_name)}${ev.user_role === 'admin' ? ' · 관리자' : ev.user_class_name ? ` · ${esc(ev.user_class_name)}` : ''}</span>`
              : ev.target_account !== '미인증 요청' && ev.details?.account_exists === false
                ? '<span class="admin-sec-sub is-unreg">미등록 아이디</span>'
                : ''}`
            : '<span class="admin-sec-sub">—</span>';
          const fpHtml = ev.client_fp
            ? `<code class="admin-sec-fp">${esc(ev.client_fp === 'no-ip' ? 'IP 미확인' : 'fp:' + ev.client_fp)}</code>`
            : '';
          return `<tr class="admin-sec-row-${esc(ev.severity)}">
            <td class="members-time-cell">${esc(formatDateTimeSec(ev.created_at))}</td>
            <td><span class="admin-sev-pill ${sev.cls}">${sev.label}</span></td>
            <td>
              <strong>${esc(evLabel)}</strong>
              ${ev.reason_code ? `<code class="admin-sec-code">${esc(ev.reason_code)}</code>` : ''}
            </td>
            <td>${acctHtml}</td>
            <td><span>${esc(srcLabel)}</span>${fpHtml}</td>
            <td>
              <div class="admin-sec-detail-text">${esc(ev.summary || '—')}</div>
              ${detailTags.length ? `<div class="admin-sec-detail-tags">${detailTags.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>`;
    }

    function refreshSecurityEventsInPlace() {
      const box = host.querySelector('#adminSecEventsBox');
      if (!box || !insData) return false;
      const all = Array.isArray(insData.security_events) ? insData.security_events : [];
      const filtered = filterSecurityEvents(all);
      box.innerHTML = renderSecurityEventsTableHtml(all);
      const countEl = host.querySelector('#adminSecEventsCount');
      if (countEl) countEl.textContent = `${filtered.length}건${filtered.length !== all.length ? ` / 전체 ${all.length}건` : ''}`;
      return true;
    }

    function renderSecurityHtml() {
      if (insLoading && !insData) return '<p class="members-reset-note">보안 검사 및 감사 데이터를 불러오는 중…</p>';
      if (insError) return `<p class="members-reset-note" role="alert">${esc(insError)}</p>`;
      if (!insData) return '';

      const secSum = insData.security_summary || {};
      const secEvents = Array.isArray(insData.security_events) ? insData.security_events : [];
      const targeted = Array.isArray(insData.targeted_accounts) ? insData.targeted_accounts : [];
      const breakdown = Array.isArray(insData.attack_breakdown) ? insData.attack_breakdown : [];
      const topSources = Array.isArray(insData.top_sources) ? insData.top_sources : [];
      const limits = Array.isArray(insData.rate_limits) ? insData.rate_limits : [];
      const errors = Array.isArray(insData.client_errors) ? insData.client_errors : [];
      const auditAll = Array.isArray(insData.audit_logs) ? insData.audit_logs : [];
      const audits = auditFilter ? auditAll.filter(a => a.action === auditFilter) : auditAll;
      const blockedLimits = limits.filter(l => l.blocked).length;
      const deviceLabels = { desktop: 'PC', mobile: '모바일', tablet: '태블릿' };

      const criticalCount = Number(secSum.critical_count) || 0;
      const highCount = Number(secSum.high_count) || 0;
      const warnCount = Number(secSum.warn_count) || 0;
      const infoCount = Number(secSum.info_count) || 0;
      const ackStats = computeSecurityAckStats(insData, { forBanner: true });
      const alerts24h = ackStats.rawAlerts24h;
      const unackedAlerts24h = ackStats.unackedAlerts24h;
      const unackedCritical = ackStats.unackedCritical;
      const unackedHigh = ackStats.unackedHigh;
      const loginFailures = Number(secSum.login_failures) || 0;
      const rateLimitBlocks = Number(secSum.rate_limit_blocks) || 0;
      const tamperOrOrigin = Number(secSum.tamper_or_origin) || 0;
      const unauthorizedAdmin = Number(secSum.unauthorized_admin) || 0;
      const suspiciousInputs = Number(secSum.suspicious_inputs) || 0;
      const uniqueSources = Number(secSum.unique_sources) || 0;
      const targetedCount = Number(secSum.targeted_accounts_count) || targeted.length;
      const maxBreakdown = Math.max(1, ...breakdown.map(b => Number(b.count) || 0));
      const hasRepeatedLoginFailures = targeted.some(t => (Number(t.login_failures) || 0) > 5);
      const hasUnackedSuspicious = suspiciousInputs > 0 && (ackStats.ackMs === 0 || secEvents.some(ev => ev.event_type === 'suspicious_input' && parseTimeMs(ev.created_at) > ackStats.ackMs));
      const hasUnackedAlerts = unackedAlerts24h > 0 || unackedCritical > 0 || unackedHigh > 0;

      const filteredEvents = filterSecurityEvents(secEvents);
      const threatLevel = (unackedCritical > 0 || blockedLimits > 0 || unackedAlerts24h >= 3)
        ? 'danger'
        : (unackedHigh > 0 || hasUnackedSuspicious || (ackStats.ackMs === 0 && hasRepeatedLoginFailures))
          ? 'warn'
          : 'safe';
      const threatCopy = threatLevel === 'danger'
        ? {
            badge: '경고 · 공격/차단 감지',
            title: '악의적 접근 시도 또는 Rate Limit 차단이 감지되었습니다',
            desc: `미확인 고위험 경보 ${unackedAlerts24h}건 (24h 누적 ${alerts24h}건) · 현재 차단 중 버킷 ${blockedLimits}건 · 확인 후 아래 버튼으로 알림을 정리할 수 있습니다.`
          }
        : threatLevel === 'warn'
          ? {
              badge: '주의 · 모니터링 권장',
              title: '반복 로그인 실패(6회 이상) 또는 주의 이벤트가 포착되었습니다',
              desc: `최근 ${insDays}일 로그인 실패 ${loginFailures}건 · 미확인 고위험 이벤트 ${unackedCritical + unackedHigh}건입니다.`
            }
          : ackStats.ackMs > 0 && alerts24h > 0
            ? {
                badge: '확인 완료 · 정상 운영',
                title: '미확인 고위험 경보가 없습니다',
                desc: `마지막 확인 시각 ${formatShortTime(ackStats.ackIso)} · 이후 새로 발생한 고위험 경보가 없습니다. (24h 누적 기록 ${alerts24h}건은 아래 타임라인에서 언제든 조회 가능)`
              }
            : {
                badge: '안전 · 정상 운영',
                title: '현재 확인된 고위험 공격 징후가 없습니다',
                desc: `최근 ${insDays}일 동안 차단된 공격이나 고위험 이상 징후가 감지되지 않았습니다. (계정당 로그인 실패 5회 이하는 일반 오타로 분류)`
              };

      const sevCounts = {
        '': secEvents.length,
        critical: secEvents.filter(e => e.severity === 'critical').length,
        high: secEvents.filter(e => e.severity === 'high').length,
        warn: secEvents.filter(e => e.severity === 'warn').length,
        info: secEvents.filter(e => e.severity === 'info').length
      };

      return `
        <div class="admin-toolbar-row">
          <span class="members-reset-note">인증·암호화 게이트웨이·관리자 API·검색 입력 이상을 30일간 누적 기록하며 원본 비밀번호·토큰·원본 IP는 절대 저장하지 않습니다.</span>
          <div class="admin-chip-group">
            ${[7, 14, 30].map(d => `<button type="button" class="toss-chip-btn ${insDays === d ? 'active' : ''}" data-insights-days="${d}">최근 ${d}일</button>`).join('')}
            ${(hasUnackedAlerts || threatLevel !== 'safe') ? `<button type="button" class="toss-chip-btn" data-ack-security-alerts ${secAckBusy ? 'disabled' : ''}>확인 완료 · 알림 지우기</button>` : ''}
            <button type="button" class="toss-chip-btn" data-refresh-security>새로고침</button>
          </div>
        </div>

        <section class="admin-sec-banner is-${threatLevel}" role="status">
          <div class="admin-sec-banner-main">
            <span class="admin-sev-pill ${threatLevel === 'danger' ? 'is-critical' : threatLevel === 'warn' ? 'is-warn' : 'is-safe'}">${threatCopy.badge}</span>
            <div>
              <strong>${threatCopy.title}</strong>
              <p>${threatCopy.desc}</p>
            </div>
          </div>
          ${threatLevel !== 'safe' ? `<div class="admin-chip-group"><button type="button" class="toss-chip-btn" data-ack-security-alerts ${secAckBusy ? 'disabled' : ''}>확인 완료</button><a href="#admin/controls" class="toss-chip-btn members-danger-btn">원격 점검 모드</a></div>` : ''}
        </section>

        <div class="admin-sec-scope-note">
          <strong>실시간 감지 항목:</strong> 로그인 실패 누적(동일 계정 6회 이상 위험 경보 · 미등록 스캔) · Rate Limit 차단(계정/IP/전체) · JWE 암호화 위변조/리플레이/Origin 위조 · 비인가 관리자 API 호출 · SQLi/XSS 의심 입력 · 관리자 경로 탐색 · 클라이언트 예외
          <span>※ 정적 호스팅 외부 URL 404/봇 스캔은 Cloudflare WAF 앞단 연결 시 추가 관제 가능</span>
        </div>

        <div class="admin-kpi-grid">
          <div class="admin-kpi-card${unackedAlerts24h > 0 || unackedCritical > 0 ? ' is-danger-card' : ''}"><span class="admin-kpi-label">미확인 고위험 (24h)</span><strong class="admin-kpi-value">${unackedAlerts24h}건</strong><span class="admin-kpi-sub">24h 전체 ${alerts24h} · ${insDays}일 위험 ${criticalCount} · 높음 ${highCount}</span></div>
          <div class="admin-kpi-card${hasRepeatedLoginFailures ? ' is-attention' : ''}"><span class="admin-kpi-label">로그인 실패 (${insDays}일)</span><strong class="admin-kpi-value">${loginFailures}회</strong><span class="admin-kpi-sub">5회 이하 일반 기록 · 제한 차단 ${rateLimitBlocks}건</span></div>
          <div class="admin-kpi-card${(tamperOrOrigin + unauthorizedAdmin + suspiciousInputs) > 0 ? ' is-danger-card' : ''}"><span class="admin-kpi-label">공격 · 위변조 차단</span><strong class="admin-kpi-value">${tamperOrOrigin + unauthorizedAdmin + suspiciousInputs}건</strong><span class="admin-kpi-sub">암호화/Origin ${tamperOrOrigin} · 권한 ${unauthorizedAdmin} · 입력 ${suspiciousInputs}</span></div>
          <div class="admin-kpi-card${blockedLimits ? ' is-danger-card' : ''}"><span class="admin-kpi-label">차단 중 Rate Limit</span><strong class="admin-kpi-value">${blockedLimits}건</strong><span class="admin-kpi-sub">활성 버킷 전체 ${limits.length}건 (최근 1h)</span></div>
          <div class="admin-kpi-card${uniqueSources >= 2 ? ' is-attention' : ''}"><span class="admin-kpi-label">감지된 출처 지문</span><strong class="admin-kpi-value">${uniqueSources}개</strong><span class="admin-kpi-sub">서버 HMAC IP 지문 기준 (익명)</span></div>
          <div class="admin-kpi-card${errors.length ? ' is-attention' : ''}"><span class="admin-kpi-label">클라이언트 에러</span><strong class="admin-kpi-value">${errors.length}건</strong><span class="admin-kpi-sub">최근 ${insDays}일 학생 브라우저 JS 예외</span></div>
        </div>

        <div class="admin-panel-grid">
          <section class="admin-panel">
            <div class="admin-panel-head"><div><h3>집중 표적 계정 TOP 10</h3><p>로그인 실패·차단·비인가 시도가 집중된 계정입니다. 미등록 아이디 반복 시도는 계정 열거 스캔 징후입니다.</p></div></div>
            ${targeted.length ? `<div class="admin-subtable-wrap"><table class="members-table admin-compact-table">
              <thead><tr><th>대상 계정</th><th>이벤트</th><th>고위험</th><th>출처</th><th>최근 시각</th><th class="members-actions-col">조치</th></tr></thead>
              <tbody>${targeted.map(t => {
                const roleBadge = t.role === 'admin'
                  ? '<span class="admin-sev-pill is-critical">관리자 표적</span>'
                  : t.user_id
                    ? `<span class="admin-sec-sub">${esc(t.full_name || '')}${t.class_name ? ` · ${esc(t.class_name)}` : ''}</span>`
                    : '<span class="admin-sev-pill is-warn">미등록 아이디</span>';
                const canLogout = Boolean(t.user_id && t.role === 'student');
                return `<tr>
                  <td><strong>@${esc(t.target_account)}</strong><div>${roleBadge}</div></td>
                  <td><strong>${t.total_events}건</strong>${t.login_failures ? `<span class="admin-sec-sub">실패 ${t.login_failures}회</span>` : ''}</td>
                  <td>${t.high_or_critical ? `<span class="admin-warn-pill">${t.high_or_critical}건</span>` : '0건'}</td>
                  <td>${t.unique_sources ? `${t.unique_sources}곳` : '—'}</td>
                  <td class="members-time-cell">${esc(formatShortTime(t.last_seen_at))}</td>
                  <td class="members-actions-cell"><div class="members-row-actions">${canLogout ? `<button type="button" class="toss-chip-btn members-danger-btn" data-logout-alert-user="${esc(t.user_id)}" data-logout-alert-name="${esc(t.full_name || t.target_account)}" data-logout-alert-username="${esc(t.target_account)}">세션 종료</button>` : '<span class="admin-sec-sub">—</span>'}</div></td>
                </tr>`;
              }).join('')}</tbody>
            </table></div>` : '<p class="admin-ok-note">최근 기간 중 반복 공격·실패가 집중된 계정이 없습니다.</p>'}
          </section>

          <section class="admin-panel">
            <div class="admin-panel-head"><div><h3>공격 유형별 분포 & 출처(IP 지문) 분석</h3><p>같은 IP 지문에서 여러 계정을 번갈아 시도하면 계정 대입(Credential Stuffing) 의심으로 표시됩니다.</p></div></div>
            ${breakdown.length ? `<div class="admin-bar-list">${breakdown.map(b => {
              const w = Math.round(((Number(b.count) || 0) / maxBreakdown) * 100);
              return `<div class="admin-bar-row"><div class="admin-bar-meta"><strong>${esc(SECURITY_EVENT_LABELS[b.event_type] || b.event_type)}</strong><span>${b.count}건${b.high_or_critical ? ` (고위험 ${b.high_or_critical})` : ''}</span></div><div class="admin-bar-track"><div class="admin-bar-fill${b.high_or_critical ? ' is-danger' : ''}" style="width:${w}%"></div></div></div>`;
            }).join('')}</div>` : '<p class="admin-ok-note">집계된 보안 공격 유형이 없습니다.</p>'}

            <h4 class="admin-subsection-title">출처별 활동 TOP 10 (익명 HMAC IP 지문)</h4>
            ${topSources.length ? `<div class="admin-subtable-wrap"><table class="members-table admin-compact-table">
              <thead><tr><th>출처 지문</th><th>이벤트</th><th>시도 계정</th><th>주요 유형</th><th>최근 시각</th></tr></thead>
              <tbody>${topSources.map(src => {
                const stuffing = Number(src.distinct_accounts) >= 3;
                const types = (src.event_types || []).slice(0, 3).map(t => SECURITY_EVENT_LABELS[t] || t).join(', ');
                return `<tr>
                  <td><code class="admin-sec-fp">${esc(src.client_fp === 'no-ip' ? 'IP 미확인' : 'fp:' + src.client_fp)}</code>${stuffing ? ' <span class="admin-sev-pill is-critical">계정 대입 의심</span>' : ''}</td>
                  <td><strong>${src.total_events}건</strong>${src.high_or_critical ? ` <span class="admin-warn-pill">고위험 ${src.high_or_critical}</span>` : ''}</td>
                  <td>${src.distinct_accounts}개</td>
                  <td>${esc(types || '—')}</td>
                  <td class="members-time-cell">${esc(formatShortTime(src.last_seen_at))}</td>
                </tr>`;
              }).join('')}</tbody>
            </table></div>` : '<p class="members-reset-note">기록된 외부 출처 지문이 없습니다.</p>'}
          </section>
        </div>

        <section class="admin-panel">
          <div class="admin-panel-head">
            <div><h3>실시간 보안 이벤트 타임라인 (<span id="adminSecEventsCount">${filteredEvents.length}건${filteredEvents.length !== secEvents.length ? ` / 전체 ${secEvents.length}건` : ''}</span>)</h3><p>로그인 실패, 차단, 위변조, 비인가 접근, 악성 입력 시도 등 최근 150건의 상세 기록(30일 보관)입니다.</p></div>
            <div class="admin-chip-group">
              ${secEvents.length ? '<button type="button" class="toss-chip-btn" data-export-security>보안 이벤트 CSV</button>' : ''}
            </div>
          </div>
          <div class="admin-sec-filter-bar">
            <div class="admin-chip-group">
              ${[['', '전체'], ['critical', '위험'], ['high', '높음'], ['warn', '주의'], ['info', '정보']].map(([k, label]) =>
                `<button type="button" class="toss-chip-btn ${secSeverityFilter === k ? 'active' : ''}" data-sec-severity="${k}">${label} (${sevCounts[k] || 0})</button>`
              ).join('')}
            </div>
            <div class="admin-sec-filter-inputs">
              <select id="adminSecTypeFilter" aria-label="공격 유형 필터">
                <option value="">전체 공격 유형</option>
                ${Object.entries(SECURITY_EVENT_LABELS).map(([k, label]) => `<option value="${k}" ${secTypeFilter === k ? 'selected' : ''}>${esc(label)}</option>`).join('')}
              </select>
              <input id="adminSecEventSearch" class="admin-sec-search" type="search" value="${esc(secSearchQuery)}" placeholder="계정·지문·코드·상세 검색" aria-label="보안 이벤트 검색">
            </div>
          </div>
          <div id="adminSecEventsBox">${renderSecurityEventsTableHtml(secEvents)}</div>
        </section>

        <div class="admin-panel-grid">
          <section class="admin-panel">
            <div class="admin-panel-head"><div><h3>실시간 Rate Limit 버킷 모니터 (최근 1시간)</h3><p>계정·IP·게이트웨이별 현재 요청량과 임계치 도달(차단) 여부를 표시합니다.</p></div></div>
            ${limits.length ? `<div class="admin-subtable-wrap"><table class="members-table admin-compact-table">
              <thead><tr><th>유형</th><th>시도 / 한도</th><th>상태</th><th>남은 시간 · 해제</th></tr></thead>
              <tbody>${limits.map(l => {
                const maxA = Number(l.max_attempts) || 0;
                const rem = Number(l.remaining_sec) || 0;
                return `<tr>
                  <td>${esc(l.category)}</td>
                  <td><strong>${l.attempts}</strong>${maxA ? ` / ${maxA}회` : '회'}</td>
                  <td>${l.blocked ? '<span class="admin-status-pill is-danger">차단 중</span>' : '<span class="admin-status-pill is-off">정상 범위</span>'}</td>
                  <td class="members-time-cell">${rem > 0 ? `${rem}초 남음 · ` : ''}${esc(formatShortTime(l.resets_at))}</td>
                </tr>`;
              }).join('')}</tbody>
            </table></div>` : '<p class="admin-ok-note">활성 상태의 로그인/요청 제한 버킷이 없습니다.</p>'}
          </section>

          <section class="admin-panel">
            <div class="admin-panel-head"><div><h3>실시간 클라이언트 에러 수집기 (${errors.length}건)</h3><p>학생 브라우저에서 발생한 JS 오류 및 미처리 예외가 자동으로 수집됩니다.</p></div></div>
            ${errors.length ? `<div class="admin-subtable-wrap"><table class="members-table admin-compact-table">
              <thead><tr><th>발생 시각</th><th>페이지</th><th>유형</th><th>메시지</th><th>기기</th></tr></thead>
              <tbody>${errors.map(e => `<tr>
                <td class="members-time-cell">${esc(formatShortTime(e.created_at))}</td>
                <td><code>${esc(e.target_key)}</code></td>
                <td>${esc(e.source || 'error')}</td>
                <td>${esc(e.message)}</td>
                <td>${esc(deviceLabels[e.device_type] || e.device_type)}</td>
              </tr>`).join('')}</tbody>
            </table></div>` : '<p class="admin-ok-note">최근 기간 중 수집된 클라이언트 에러가 없습니다.</p>'}
          </section>
        </div>

        <section class="admin-panel">
          <div class="admin-panel-head">
            <div><h3>관리자 작업 감사 로그 (${audits.length}건)</h3><p>승인, 계정 변경, 로그아웃, 공지·원격 제어 작업 이력을 시간순으로 보관합니다.</p></div>
            <div class="admin-chip-group">
              <select id="adminAuditFilter" aria-label="작업 유형 필터">
                <option value="">전체 작업</option>
                ${Object.entries(ACTION_LABELS).map(([k, label]) => `<option value="${k}" ${auditFilter === k ? 'selected' : ''}>${esc(label)}</option>`).join('')}
              </select>
              ${audits.length ? '<button type="button" class="toss-chip-btn" data-export-audit>감사 로그 CSV</button>' : ''}
            </div>
          </div>
          ${audits.length ? `<div class="members-table-wrap"><table class="members-table admin-compact-table">
            <thead><tr><th>시각</th><th>관리자</th><th>작업</th><th>대상</th><th>상세</th></tr></thead>
            <tbody>${audits.map(a => `<tr>
              <td class="members-time-cell">${esc(formatDateTime(a.created_at))}</td>
              <td>${esc(a.admin_name)}</td>
              <td><span class="admin-meta-pill">${esc(ACTION_LABELS[a.action] || a.action)}</span></td>
              <td>${esc(a.target_label || '—')}</td>
              <td>${esc(summarizeAuditDetails(a.action, a.details))}</td>
            </tr>`).join('')}</tbody>
          </table></div>` : '<p class="members-reset-note">표시할 관리자 작업 로그가 없습니다.</p>'}
        </section>`;
    }

    function refreshDmPickerInPlace() {
      const picker = host.querySelector('#adminDmRecipientPicker');
      if (!picker) return false;
      const doc = globalThis.document;
      const activeEl = doc?.activeElement;
      const keepSearch = activeEl?.id === 'adminDmRecipientSearch' && picker.contains?.(activeEl);
      const selStart = keepSearch && typeof activeEl.selectionStart === 'number' ? activeEl.selectionStart : null;
      const selEnd = keepSearch && typeof activeEl.selectionEnd === 'number' ? activeEl.selectionEnd : null;
      const approved = getApprovedStudents();
      const tmp = document.createElement('div');
      tmp.innerHTML = renderDmRecipientPickerHtml(approved);
      const nextPicker = tmp.firstElementChild;
      if (nextPicker) picker.replaceWith(nextPicker);
      const submitBtn = host.querySelector('#adminInlineDmForm button[type="submit"]');
      if (submitBtn) {
        submitBtn.textContent = `선택한 ${dmSelectedIds.size}명에게 알림 발송`;
        submitBtn.disabled = ctrlBusy || dmSelectedIds.size === 0 || dmSelectedIds.size > 30;
      }
      if (keepSearch) {
        const input = host.querySelector('#adminDmRecipientSearch');
        input?.focus?.({ preventScroll: true });
        if (selStart !== null && selEnd !== null) try { input?.setSelectionRange?.(selStart, selEnd); } catch {}
      }
      return true;
    }

    function renderTab(tab) {
      if (typeof isActive === 'function' && !isActive()) return;
      if (typeof getCurrentTab === 'function' && getCurrentTab() !== tab) return;
      const target = host.querySelector('#membersTable');
      if (!target) return;
      if (tab === 'dashboard') target.innerHTML = renderDashboardHtml();
      else if (tab === 'notices') target.innerHTML = renderNoticesHtml();
      else if (tab === 'controls') target.innerHTML = renderControlsHtml();
      else if (tab === 'insights') target.innerHTML = renderInsightsHtml();
      else if (tab === 'security') target.innerHTML = renderSecurityHtml();
    }

    function ensureLoaded(tab) {
      if (tab === 'dashboard') {
        if (!dashData && !dashLoading) void loadDashboard();
        else renderTab('dashboard');
      } else if (tab === 'notices') {
        void ensureStudentsForDm();
        if (!ctrlData && !ctrlLoading) void loadControls();
        else renderTab('notices');
      } else if (tab === 'controls') {
        if (!ctrlData && !ctrlLoading) void loadControls();
        else renderTab('controls');
      } else if (tab === 'insights') {
        if (!dashData && !dashLoading) void loadDashboard();
        if (!insData && !insLoading) void loadInsights(insDays);
        else renderTab('insights');
      } else if (tab === 'security') {
        if (!insData && !insLoading) void loadInsights(insDays);
        else {
          if (insData && computeSecurityAckStats(insData).unackedAlerts24h > 0) {
            void acknowledgeSecurityAlerts({ manual: false });
          }
          renderTab('security');
        }
      }
    }

    async function handleClick(e) {
      const s = getSession();
      if (!s) return false;

      if (e.target.closest('[data-toggle-unit-sort]')) {
        unitSortAsc = !unitSortAsc;
        renderTab(getCurrentTab?.() === 'dashboard' ? 'dashboard' : 'insights');
        return true;
      }
      const feedFilterBtn = e.target.closest('[data-notice-feed-filter]');
      if (feedFilterBtn) {
        noticeFeedFilter = feedFilterBtn.dataset.noticeFeedFilter || 'all';
        renderTab('notices');
        return true;
      }
      const dmClassBtn = e.target.closest('[data-dm-class]');
      if (dmClassBtn) {
        dmClassFilter = dmClassBtn.dataset.dmClass || 'ALL';
        if (!refreshDmPickerInPlace()) renderTab('notices');
        return true;
      }
      if (e.target.closest('[data-dm-select-visible]')) {
        for (const u of filterDmRecipients(getApprovedStudents())) dmSelectedIds.add(String(u.id));
        if (!refreshDmPickerInPlace()) renderTab('notices');
        return true;
      }
      if (e.target.closest('[data-dm-clear-all]')) {
        dmSelectedIds.clear();
        if (!refreshDmPickerInPlace()) renderTab('notices');
        return true;
      }
      const inactBtn = e.target.closest('[data-inactive-days]');
      if (inactBtn) {
        inactiveThreshold = Number(inactBtn.dataset.inactiveDays);
        renderTab('dashboard');
        return true;
      }
      if (e.target.closest('[data-export-unreg]')) {
        const list = Array.isArray(dashData?.unregistered_roster) ? dashData.unregistered_roster : [];
        downloadCsv('codewiki-unregistered-roster.csv', ['반', '출석번호', '이름'], list.map(u => [u.class_name, u.student_number, u.full_name]));
        return true;
      }
      const dmInact = e.target.closest('[data-dm-inactive]');
      if (dmInact) {
        const stu = (dashData?.inactive_students || []).find(u => u.id === dmInact.dataset.dmInactive);
        if (stu) openDirectMessageDialog(stu);
        return true;
      }
      const readsBtn = e.target.closest('[data-notice-reads]');
      if (readsBtn) {
        showNoticeReadsDialog(readsBtn.dataset.noticeReads);
        return true;
      }
      const toggleNotice = e.target.closest('[data-notice-toggle]');
      if (toggleNotice && !ctrlBusy) {
        ctrlBusy = true;
        try {
          const res = await callRpc('cw_admin_update_notice', {
            p_notice_id: toggleNotice.dataset.noticeToggle,
            p_active: toggleNotice.dataset.noticeNext === 'true',
            p_delete: false
          }, s);
          if (getSession() !== s) return true;
          if (res?.ok !== true) throw new Error();
          void window.CodeWikiTelemetry?.notifyRuntimeUpdate?.();
          onMessage(res.active ? '공지 노출을 다시 켰습니다.' : '공지 노출을 중지했습니다.');
          ctrlBusy = false;
          await loadControls(true);
        } catch {
          ctrlBusy = false;
          if (getSession() === s) onMessage('공지 상태를 변경하지 못했습니다.');
        }
        return true;
      }
      const delNotice = e.target.closest('[data-notice-delete]');
      if (delNotice && !ctrlBusy) {
        const noticeObj = (ctrlData?.notices || []).find(n => n.id === delNotice.dataset.noticeDelete);
        openDeleteNoticeDialog(delNotice.dataset.noticeDelete, noticeObj?.title || '');
        return true;
      }
      if (e.target.closest('[data-toggle-maintenance]') && !ctrlBusy) {
        const currentEnabled = Boolean(ctrlData?.settings?.maintenance?.enabled);
        openMaintenanceConfirmDialog(!currentEnabled);
        return true;
      }
      if (e.target.closest('[data-stop-spotlight]') && !ctrlBusy) {
        ctrlBusy = true;
        try {
          const res = await callRpc('cw_admin_update_setting', {
            p_key: 'spotlight',
            p_value: { active: false, doc_id: '', section_id: '', label: '', message: '' }
          }, s);
          if (getSession() !== s) return true;
          if (res?.ok !== true) throw new Error();
          void window.CodeWikiTelemetry?.notifyRuntimeUpdate?.();
          onMessage('수업 스포트라이트를 종료했습니다.');
          ctrlBusy = false;
          await loadControls(true);
        } catch {
          ctrlBusy = false;
          if (getSession() === s) onMessage('스포트라이트를 종료하지 못했습니다.');
        }
        return true;
      }
      const daysBtn = e.target.closest('[data-insights-days]');
      if (daysBtn) {
        void loadInsights(Number(daysBtn.dataset.insightsDays) || 14, true);
        return true;
      }
      if (e.target.closest('[data-ack-security-alerts]')) {
        void acknowledgeSecurityAlerts({ manual: true });
        return true;
      }
      if (e.target.closest('[data-refresh-security]')) {
        void loadInsights(insDays, true);
        return true;
      }
      const secSevBtn = e.target.closest('[data-sec-severity]');
      if (secSevBtn) {
        secSeverityFilter = secSevBtn.dataset.secSeverity || '';
        renderTab('security');
        return true;
      }
      if (e.target.closest('[data-export-security]')) {
        const list = filterSecurityEvents(Array.isArray(insData?.security_events) ? insData.security_events : []);
        downloadCsv('codewiki-security-events.csv',
          ['시각(KST)', '위험도', '유형', '사유코드', '대상계정', '출처', '익명지문', '요약', '상세'],
          list.map(ev => [
            formatDateTimeSec(ev.created_at),
            SECURITY_SEVERITY_META[ev.severity]?.label || ev.severity,
            SECURITY_EVENT_LABELS[ev.event_type] || ev.event_type,
            ev.reason_code || '',
            ev.target_account || '',
            SECURITY_SOURCE_LABELS[ev.source] || ev.source || '',
            ev.client_fp || '',
            ev.summary || '',
            formatSecurityDetailsText(ev).join(' / ')
          ]));
        return true;
      }
      if (e.target.closest('[data-export-audit]')) {
        const list = (insData?.audit_logs || []).filter(a => !auditFilter || a.action === auditFilter);
        downloadCsv('codewiki-admin-audit.csv', ['시각(KST)', '관리자', '작업', '대상', '상세'],
          list.map(a => [formatDateTime(a.created_at), a.admin_name, ACTION_LABELS[a.action] || a.action, a.target_label, summarizeAuditDetails(a.action, a.details)]));
        return true;
      }
      const alertLogout = e.target.closest('[data-logout-alert-user]');
      if (alertLogout) {
        openSingleLogoutDialog({
          id: alertLogout.dataset.logoutAlertUser,
          full_name: alertLogout.dataset.logoutAlertName || '학생',
          username: alertLogout.dataset.logoutAlertUsername || ''
        });
        return true;
      }
      return false;
    }

    function handleInput(e) {
      if (e.target?.id === 'adminDmRecipientSearch') {
        dmSearchQuery = e.target.value || '';
        if (!refreshDmPickerInPlace()) renderTab('notices');
        return true;
      }
      if (e.target?.id === 'adminSecEventSearch') {
        secSearchQuery = e.target.value || '';
        if (!refreshSecurityEventsInPlace()) renderTab('security');
        return true;
      }
      return false;
    }

    async function handleChange(e) {
      const s = getSession();
      if (!s) return false;
      const dmBox = e.target.closest?.('[data-dm-recipient]');
      if (dmBox) {
        const uid = String(dmBox.dataset.dmRecipient || '');
        if (uid) {
          if (dmBox.checked) dmSelectedIds.add(uid);
          else dmSelectedIds.delete(uid);
          if (!refreshDmPickerInPlace()) renderTab('notices');
        }
        return true;
      }
      if (e.target.id === 'adminSecTypeFilter') {
        secTypeFilter = e.target.value;
        if (!refreshSecurityEventsInPlace()) renderTab('security');
        return true;
      }
      if (e.target.id === 'adminAuditFilter') {
        auditFilter = e.target.value;
        renderTab('security');
        return true;
      }
      const flagBox = e.target.closest?.('[data-feature-flag]');
      if (flagBox) {
        if (ctrlBusy) {
          flagBox.checked = !flagBox.checked;
          return true;
        }
        const nextFlags = { ...(ctrlData?.settings?.feature_flags || {}) };
        host.querySelectorAll('[data-feature-flag]').forEach(el => {
          nextFlags[el.dataset.featureFlag] = Boolean(el.checked);
        });
        ctrlBusy = true;
        try {
          const res = await callRpc('cw_admin_update_setting', { p_key: 'feature_flags', p_value: nextFlags }, s);
          if (getSession() !== s) return true;
          if (res?.ok !== true) throw new Error();
          if (ctrlData?.settings) ctrlData.settings.feature_flags = res.value;
          void window.CodeWikiTelemetry?.notifyRuntimeUpdate?.();
          onMessage('학생 메뉴 잠금 설정을 즉시 반영했습니다.');
        } catch {
          if (getSession() === s) {
            onMessage('메뉴 잠금 설정을 저장하지 못했습니다.');
            flagBox.checked = !flagBox.checked;
          }
        } finally {
          ctrlBusy = false;
        }
        return true;
      }
      return false;
    }

    async function handleSubmit(e) {
      const s = getSession();
      if (!s) return false;
      if (e.target.id === 'adminPublishNoticeForm') {
        e.preventDefault();
        if (ctrlBusy) return true;
        const fd = new FormData(e.target);
        const title = String(fd.get('title') || '').trim();
        const body = String(fd.get('body') || '').trim();
        if (!title || !body) return true;
        ctrlBusy = true;
        try {
          const res = await callRpc('cw_admin_publish_notice', {
            p_title: title,
            p_body: body,
            p_badge: String(fd.get('badge') || '실시간 공지').trim(),
            p_cheer: String(fd.get('cheer') || '').trim(),
            p_target_class: String(fd.get('target_class') || '').trim() || null
          }, s);
          if (getSession() !== s) return true;
          if (res?.ok !== true) throw new Error();
          void window.CodeWikiTelemetry?.notifyRuntimeUpdate?.();
          onMessage('실시간 공지를 발송했습니다. 접속 중인 학생에게 즉시 표시됩니다.');
          ctrlBusy = false;
          await loadControls(true);
        } catch {
          ctrlBusy = false;
          if (getSession() === s) onMessage('실시간 공지 발송에 실패했습니다.');
        }
        return true;
      }
      if (e.target.id === 'adminSpotlightForm') {
        e.preventDefault();
        if (ctrlBusy) return true;
        const fd = new FormData(e.target);
        const docId = String(fd.get('doc_id') || '').trim();
        if (!docId) return true;
        const label = docTitle(docId);
        const message = String(fd.get('message') || '').trim();
        ctrlBusy = true;
        try {
          const res = await callRpc('cw_admin_update_setting', {
            p_key: 'spotlight',
            p_value: { active: true, doc_id: docId, section_id: '', label, message }
          }, s);
          if (getSession() !== s) return true;
          if (res?.ok !== true) throw new Error();
          void window.CodeWikiTelemetry?.notifyRuntimeUpdate?.();
          onMessage(`[${label}] 수업 스포트라이트를 학생들에게 발송했습니다.`);
          ctrlBusy = false;
          await loadControls(true);
        } catch {
          ctrlBusy = false;
          if (getSession() === s) onMessage('스포트라이트 발송에 실패했습니다.');
        }
        return true;
      }
      if (e.target.id === 'adminInlineDmForm') {
        e.preventDefault();
        if (ctrlBusy) return true;
        const fd = new FormData(e.target);
        const targetIds = [...dmSelectedIds];
        const title = String(fd.get('title') || '').trim();
        const body = String(fd.get('body') || '').trim();
        if (!targetIds.length) {
          onMessage('알림을 받을 학생을 1명 이상 선택해 주세요.');
          return true;
        }
        if (targetIds.length > 30) {
          onMessage('한 번에 최대 30명까지 발송할 수 있습니다. 전체 공지를 이용해 주세요.');
          return true;
        }
        if (!title || !body) return true;
        const studentMap = new Map(getApprovedStudents().map(u => [String(u.id), u]));
        const dmForm = e.target;
        const setFormDisabled = disabled => {
          dmForm.querySelectorAll?.('input,textarea,select,button')?.forEach?.(el => { el.disabled = disabled; });
        };
        ctrlBusy = true;
        setFormDisabled(true);
        try {
          let sentCount = 0;
          let failCount = 0;
          let rateLimited = false;
          for (const targetId of targetIds) {
            try {
              const res = await callRpc('cw_admin_send_direct_message', { p_target_id: targetId, p_title: title, p_body: body }, s);
              if (getSession() !== s) return true;
              if (res?.ok === true) {
                sentCount++;
                dmSelectedIds.delete(targetId);
              } else {
                failCount++;
              }
            } catch (err) {
              if (getSession() !== s) return true;
              failCount++;
              if (err?.code === 'CW_RATE_LIMIT') { rateLimited = true; break; }
              if (err?.code === 'PGRST202') {
                ctrlBusy = false;
                setFormDisabled(false);
                onMessage('1:1 알림 기능이 아직 서버에 적용되지 않았습니다.');
                refreshDmPickerInPlace();
                return true;
              }
            }
          }
          if (sentCount > 0) void window.CodeWikiTelemetry?.notifyRuntimeUpdate?.();
          if (failCount === 0) {
            const firstName = studentMap.get(targetIds[0])?.full_name || '선택한 학생';
            dmSelectedIds.clear();
            onMessage(sentCount === 1
              ? `${firstName}님에게 1:1 알림을 발송했습니다.`
              : `선택한 ${sentCount}명에게 1:1 알림을 발송했습니다.`);
            ctrlBusy = false;
            await loadControls(true);
          } else if (sentCount > 0) {
            onMessage(`${sentCount}명 발송 완료, ${targetIds.length - sentCount}명 실패했습니다. 실패한 학생만 선택 유지됩니다.${rateLimited ? ' (요청 제한 도달)' : ''}`);
            ctrlBusy = false;
            setFormDisabled(false);
            refreshDmPickerInPlace();
          } else {
            onMessage(rateLimited ? '요청이 너무 빠릅니다. 잠시 후 다시 시도해 주세요.' : '1:1 알림 발송에 실패했습니다.');
            ctrlBusy = false;
            setFormDisabled(false);
            refreshDmPickerInPlace();
          }
        } catch {
          ctrlBusy = false;
          if (getSession() === s) {
            setFormDisabled(false);
            onMessage('1:1 알림 발송에 실패했습니다.');
            refreshDmPickerInPlace();
          }
        }
        return true;
      }
      if (e.target.id === 'adminMaintenanceForm') {
        e.preventDefault();
        if (ctrlBusy) return true;
        const enabled = Boolean(ctrlData?.settings?.maintenance?.enabled);
        const message = String(e.target.querySelector('[name="message"]')?.value || '').trim();
        ctrlBusy = true;
        try {
          const res = await callRpc('cw_admin_update_setting', {
            p_key: 'maintenance',
            p_value: { enabled, message }
          }, s);
          if (getSession() !== s) return true;
          if (res?.ok !== true) throw new Error();
          void window.CodeWikiTelemetry?.notifyRuntimeUpdate?.();
          onMessage('점검 안내 문구를 저장했습니다.');
          ctrlBusy = false;
          await loadControls(true);
        } catch {
          ctrlBusy = false;
          if (getSession() === s) onMessage('점검 안내 문구를 저장하지 못했습니다.');
        }
        return true;
      }
      return false;
    }

    return {
      reset,
      invalidate,
      ensureLoaded,
      renderTab,
      handleClick,
      handleInput,
      handleChange,
      handleSubmit,
      openDirectMessageDialog,
      openSingleLogoutDialog,
      downloadCsv,
      docTitle
    };
  }

  window.CodeWikiAdminInsights = { create: createController, downloadCsv, docTitle };
})();
