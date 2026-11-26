/* One bounded heartbeat per minute while visible; realtime wakeup verifies authoritatively in Postgres. */
(() => {
  const SIGNAL_CHANNEL = 'cw:session-signal';
  const SIGNAL_EVENT = 'session_check';
  let session=null,timer=null,wakeTimer=null,signalChannel=null,signalClient=null;
  const listing=s=>s?.role==='admin'&&(window.location.hash==='#admin/students'||window.location.hash==='#admin/logins');
  const publish=value=>window.CodeWikiAdminMembers?.setPresence(value);
  function teardownSignal(){
    clearTimeout(wakeTimer);wakeTimer=null;
    const ch=signalChannel,client=signalClient;
    signalChannel=null;signalClient=null;
    if(ch){
      try{client?.removeChannel?.(ch);}catch{}
    }
  }
  function setupSignal(s){
    teardownSignal();
    if(!s||s.role!=='student')return;
    const client=window.CodeWikiAuth?.getSupabaseClient?.();
    if(typeof client?.channel!=='function')return;
    try{
      const ch=client.channel(SIGNAL_CHANNEL);
      signalChannel=ch;signalClient=client;
      ch.on('broadcast',{event:SIGNAL_EVENT},()=>{
        if(session!==s||s.stopped)return;
        const now=Date.now();
        if(now-s.wakeAt<10000)return;
        s.wakeAt=now;
        if(document.hidden){s.needsVerify=true;return;}
        s.needsVerify=true;
        clearTimeout(wakeTimer);
        const jitter=150+Math.floor(Math.random()*550);
        wakeTimer=setTimeout(()=>{wakeTimer=null;if(session===s&&!s.stopped)void tick(true);},jitter);
      }).subscribe();
    }catch{teardownSignal();}
  }
  async function notifySessionCheck(){
    const client=window.CodeWikiAuth?.getSupabaseClient?.();
    if(typeof client?.channel!=='function')return false;
    let ch=null;
    try{
      ch=client.channel(SIGNAL_CHANNEL);
      if(typeof ch.httpSend==='function'){
        const res=await ch.httpSend(SIGNAL_EVENT,{at:Date.now()});
        return res?.success===true||res==='ok';
      }
      const status=await ch.send({type:'broadcast',event:SIGNAL_EVENT,payload:{at:Date.now()}});
      return status==='ok';
    }catch{return false;}
    finally{if(ch){try{client.removeChannel?.(ch);}catch{}}}
  }
  function schedule(s,delay=60000){clearTimeout(timer);if(session===s&&!s.stopped&&!document.hidden)timer=setTimeout(()=>void tick(),Math.max(1000,delay));}
  async function tick(force=false){
    const s=session;if(!s||s.stopped||document.hidden||s.busy)return;
    const forceCheck=Boolean(force||s.needsVerify);
    const list=listing(s),now=Date.now();
    if(!forceCheck&&now<s.retryAt){schedule(s,s.retryAt-now);return;}
    if(!forceCheck&&now-s.at<55000&&(!list||now-s.listAt<55000)){
      const refAt=list?Math.min(s.at,s.listAt):s.at;
      schedule(s,60000-(now-refAt));
      return;
    }
    s.needsVerify=false;
    s.busy=true;
    const controller=new AbortController();s.controller=controller;let deadline,failed=false;
    try{
      const client=window.CodeWikiAuth?.getSupabaseClient();
      if(!client)throw Error('no-client');
      const request=client.rpc('cw_presence_heartbeat',{p_token:s.token,p_list:list});
      const timeout=new Promise((_,reject)=>{deadline=setTimeout(()=>{controller.abort();reject(Error('timeout'));},15000);});
      const result=await Promise.race([typeof request?.abortSignal==='function'?request.abortSignal(controller.signal):request,timeout]);
      if(result.error)throw result.error;
      if(session!==s)return;
      const doneAt=Date.now();
      s.at=doneAt;if(list)s.listAt=doneAt;s.retryAt=0;
      if(list&&listing(s))publish(Array.isArray(result.data)?result.data:false);
    }catch(error){
      failed=true;
      if(session===s){
        if(list&&listing(s))publish(false);
        if(error?.code==='42501'){
          s.stopped=true;clearTimeout(timer);teardownSignal();
          const adminLogout=error?.details==='CW_ADMIN_LOGOUT'||error?.detail==='CW_ADMIN_LOGOUT';
          if(adminLogout&&typeof window.CodeWikiAuth?.handleForcedLogout==='function'){
            window.CodeWikiAuth.handleForcedLogout('관리자에 의해 로그아웃되었습니다.');
          }else{
            void window.CodeWikiAuth?.refresh?.();
          }
        }else{
          if(forceCheck)s.needsVerify=true;
          s.retryAt=Date.now()+10000;
        }
      }
    }
    finally{
      clearTimeout(deadline);s.busy=false;s.controller=null;
      if(session===s&&!s.stopped){
        schedule(s,failed?10000:60000);
        if(!failed&&s.needsVerify)void tick(true);
        else if(!failed&&!list&&listing(s))void tick();
      }
    }
  }
  function setUser(user){
    const token=window.CodeWikiAuth?.getSessionToken();
    if(session?.id===user?.id&&session?.token===token&&session?.role===user?.role&&session?.status===user?.status)return;
    clearTimeout(timer);teardownSignal();session?.controller?.abort();session=null;publish(null);
    if(token&&(user?.role==='admin'||(user?.role==='student'&&user.status==='approved'))){
      session={id:user.id,role:user.role,status:user.status,token,at:0,listAt:0,retryAt:0,wakeAt:0,needsVerify:false,busy:false,stopped:false};
      setupSignal(session);
      void tick();
    }
  }
  document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden)void tick();});
  window.addEventListener('hashchange',()=>{if(listing(session))void tick();});
  window.CodeWikiPresence={setUser,refresh:(force=false)=>void tick(Boolean(force)),notifySessionCheck};
})();
