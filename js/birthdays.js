(() => {
  let session=null, rows=[], status='idle', requestVersion=0;
  const emit=()=>window.dispatchEvent(new Event('cw-birthdays-change'));
  const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
  function validDate(value) {
    if(!value) return true;
    const d=new Date(value+'T12:00:00Z');
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10)===value && value>='1900-01-01' && value<=today();
  }
  async function refresh() {
    const s=session;
    if(!s) return;
    const version=++requestVersion;
    rows=[];status='loading'; emit();
    try {
      const result=await window.CodeWikiAuth.getSupabaseClient().rpc('cw_list_birthdays',{p_token:s.token});
      if(session!==s||version!==requestVersion) return;
      if(result.error) throw result.error;
      // Whitelist public fields even if the server response ever gains extra fields.
      rows=(result.data||[]).filter(r=>typeof r.full_name==='string' && Number.isInteger(r.month) && r.month>=1 && r.month<=12 && Number.isInteger(r.day) && r.day>=1 && r.day<=new Date(Date.UTC(2000,r.month,0)).getUTCDate())
        .map(r=>({full_name:r.full_name,month:r.month,day:r.day}));
      status='ready';
    } catch { if(session===s&&version===requestVersion) {rows=[];status='error';} }
    if(session===s&&version===requestVersion) emit();
  }
  function setUser(user) {
    const token=window.CodeWikiAuth?.getSessionToken()||'';
    const approved=user && (user.status==='approved'||user.role==='admin');
    if(approved && session?.id===user.id && session.token===token) return;
    session=approved&&token?{id:user.id,token}:null;
    rows=[];status='idle';
    emit();
    if(session) void refresh();
  }
  window.CodeWikiBirthdays={setUser,refresh,validDate,today,
    getMembers:()=>rows.map(r=>({...r})).sort((a,b)=>a.full_name.localeCompare(b.full_name,'ko')||a.month-b.month||a.day-b.day),
    forDate:key=>rows.filter(r=>r.month===Number(key.slice(5,7))&&r.day===Number(key.slice(8,10))),
    getStatus:()=>status};
  window.addEventListener('storage',e=>{if(e.key==='codewiki_supa_token_v1'&&session&&e.newValue!==session.token)setUser(null);});
})();
