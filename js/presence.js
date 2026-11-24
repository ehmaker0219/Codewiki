/* One bounded heartbeat per minute while visible; no activity-history collection. */
(() => {
  let session=null,timer=null;
  const listing=s=>s?.role==='admin'&&(window.location.hash==='#admin/students'||window.location.hash==='#admin/logins');
  const publish=value=>window.CodeWikiAdminMembers?.setPresence(value);
  function schedule(s,delay=60000){clearTimeout(timer);if(session===s&&!s.stopped&&!document.hidden)timer=setTimeout(()=>void tick(),Math.max(1000,delay));}
  async function tick(){
    const s=session;if(!s||s.stopped||document.hidden||s.busy)return;
    const list=listing(s),now=Date.now();
    if(now<s.retryAt){schedule(s,s.retryAt-now);return;}
    if(now-s.at<55000&&(!list||now-s.listAt<55000)){
      const refAt=list?Math.min(s.at,s.listAt):s.at;
      schedule(s,60000-(now-refAt));
      return;
    }
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
          s.stopped=true;clearTimeout(timer);
          void window.CodeWikiAuth?.refresh?.();
        }else{
          s.retryAt=Date.now()+10000;
        }
      }
    }
    finally{
      clearTimeout(deadline);s.busy=false;s.controller=null;
      if(session===s&&!s.stopped){schedule(s,failed?10000:60000);if(!failed&&!list&&listing(s))void tick();}
    }
  }
  function setUser(user){
    const token=window.CodeWikiAuth?.getSessionToken();
    if(session?.id===user?.id&&session?.token===token&&session?.role===user?.role&&session?.status===user?.status)return;
    clearTimeout(timer);session?.controller?.abort();session=null;publish(null);
    if(token&&(user?.role==='admin'||(user?.role==='student'&&user.status==='approved'))){
      session={id:user.id,role:user.role,status:user.status,token,at:0,listAt:0,retryAt:0,busy:false,stopped:false};void tick();
    }
  }
  document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden)void tick();});
  window.addEventListener('hashchange',()=>{if(listing(session))void tick();});
  window.CodeWikiPresence={setUser,refresh:()=>void tick()};
})();
