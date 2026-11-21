/* One bounded heartbeat per minute while visible; no activity-history collection. */
(() => {
  let session=null,timer=null;
  const listing=s=>s?.role==='admin'&&(window.location.hash==='#admin/students'||window.location.hash==='#admin/logins');
  const publish=value=>window.CodeWikiAdminMembers?.setPresence(value);
  function schedule(s){clearTimeout(timer);if(session===s&&!document.hidden)timer=setTimeout(()=>void tick(),60000);}
  async function tick(){
    const s=session;if(!s||document.hidden||s.busy)return;
    const list=listing(s),now=Date.now();
    if(now-s.at<55000&&(!list||now-s.listAt<55000)){schedule(s);return;}
    s.busy=true;s.at=now;if(list)s.listAt=now;
    const controller=new AbortController();s.controller=controller;let deadline;
    try{
      const client=window.CodeWikiAuth?.getSupabaseClient();
      if(!client)throw Error('no-client');
      const request=client.rpc('cw_presence_heartbeat',{p_token:s.token,p_list:list});
      const timeout=new Promise((_,reject)=>{deadline=setTimeout(()=>{controller.abort();reject(Error('timeout'));},15000);});
      const result=await Promise.race([typeof request?.abortSignal==='function'?request.abortSignal(controller.signal):request,timeout]);
      if(result.error)throw result.error;
      if(session!==s)return;
      if(list&&listing(s))publish(Array.isArray(result.data)?result.data:false);
    }catch{if(session===s&&list&&listing(s))publish(false);}
    finally{
      clearTimeout(deadline);s.busy=false;s.controller=null;
      if(session===s){schedule(s);if(!list&&listing(s))void tick();}
    }
  }
  function setUser(user){
    const token=window.CodeWikiAuth?.getSessionToken();
    if(session?.id===user?.id&&session?.token===token&&session?.role===user?.role&&session?.status===user?.status)return;
    clearTimeout(timer);session?.controller?.abort();session=null;publish(null);
    if(token&&(user?.role==='admin'||(user?.role==='student'&&user.status==='approved'))){
      session={id:user.id,role:user.role,status:user.status,token,at:0,listAt:0,busy:false};void tick();
    }
  }
  document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden)void tick();});
  window.addEventListener('hashchange',()=>{if(listing(session))void tick();});
  window.CodeWikiPresence={setUser,refresh:()=>void tick()};
})();
