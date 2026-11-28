const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
  const {generateKeyPair,exportJWK,EncryptJWT}=await import('jose');
  const {create}=await import('../auth/transport.mjs');
  const {createHandler}=await import('../supabase/functions/secure-auth/handler.mjs');
  const {privateKey,publicKey}=await generateKeyPair('RSA-OAEP-256',{modulusLength:3072,extractable:true});
  const jwk={...await exportJWK(privateKey),kid:'test-key',alg:'RSA-OAEP-256'};
  const origin='https://example.test',url='https://database.test',endpoint=url+'/functions/v1/secure-auth';
  const clock=()=>Date.now(), seen=[],wire=[],secReports=[];
  let result={session_token:crypto.randomUUID()},keyCalls=0;
  const handler=await createHandler({privateKeys:[jwk],origins:[origin],clock,rpc:async args=>{seen.push(args);return result;},reportSecurityEvent:ev=>secReports.push(ev)});
  const fetcher=async (address,options)=>{
    wire.push({address,method:options.method,body:options.body});
    if(options.method==='GET')keyCalls++;
    return handler(new Request(address,{...options,headers:{...options.headers,Origin:origin}}));
  };
  const client=create({url,apiKey:'public-fixture',fetcher});
  const fixturePassword='Synthetic-Transport-42!',fixtureAdmin='Synthetic-Admin-42!';
  const cases=[['cw_login',{p_username:'fixture-user',p_password:fixturePassword}],
    ['cw_signup_with_roster',{p_username:'fixture-user',p_password:fixturePassword,p_full_name:'Fixture',p_class_name:'2반',p_mbti:'INTJ',p_birth_date:null,p_share_with_class:false,p_student_number:null}],
    ['cw_admin_reset_student_password',{p_token:crypto.randomUUID(),p_target_id:crypto.randomUUID(),p_admin_password:fixtureAdmin,p_new_password:fixturePassword}]];
  for(const [operation,args] of cases){
    result=operation==='cw_admin_reset_student_password'?{ok:true,user_id:args.p_target_id}:{session_token:crypto.randomUUID()};
    const answer=await client.request(operation,args);
    assert.deepEqual(answer.data,result);
    assert.deepEqual(seen.at(-1).p_args,args,'server did not decrypt correctly');
    const request=wire.at(-1);assert.equal(request.method,'POST');assert.equal(request.address,endpoint);
    for(const secret of [fixturePassword,fixtureAdmin,args.p_token,args.p_username].filter(Boolean))assert.ok(!request.body.includes(secret),'plaintext on wire');
    assert.deepEqual(Object.keys(JSON.parse(request.body)),['envelope']);
  }
  assert.equal(keyCalls,1,'public key cache');
  assert.equal(new Set(seen.map(r=>r.p_request_id)).size,3,'request IDs not unique');
  assert.ok(seen.every(r=>!('p_client' in r)),'no client key without a platform IP header');
  // Per-client limits: strict IPv4/IPv6(/64) canonicalization + server-keyed HMAC-SHA-256.
  const {clientKey,normalizeClientIp}=await import('../supabase/functions/secure-auth/handler.mjs');
  const withIp=(ip)=>new Request(endpoint,{headers:{'cf-connecting-ip':ip}});
  const testSecret='codewiki-client-hmac-v2:'+jwk.d;
  assert.equal(normalizeClientIp(' 203.0.113.7 '),'v4:203.0.113.7');
  assert.equal(normalizeClientIp('::ffff:203.0.113.7'),'v4:203.0.113.7','IPv4-mapped IPv6 maps to IPv4');
  assert.equal(normalizeClientIp('2001:DB8::1'),'v6:2001:0db8:0000:0000');
  assert.equal(normalizeClientIp('2001:db8:0:0:aaaa:bbbb:cccc:dddd'),'v6:2001:0db8:0000:0000','IPv6 canonicalizes to /64 prefix');
  for(const bad of ['', 'not-an-ip', '1.2.3.4, 5.6.7.8', '...', ':::', '999.999.999.999', '010.0.0.1', 'fe80::1%eth0', '2001:db8::1::2', 'x'.repeat(60)]){
    assert.equal(normalizeClientIp(bad),null,'malformed IP rejected: '+bad);
    assert.equal(await clientKey(withIp(bad),testSecret),null,'malformed IP header ignored');
  }
  const k1=await clientKey(withIp('203.0.113.7'),testSecret),k2=await clientKey(withIp('203.0.113.8'),testSecret);
  const kOtherSecret=await clientKey(withIp('203.0.113.7'),'different-server-secret');
  assert.match(k1,/^[0-9a-f]{64}$/);assert.notEqual(k1,k2);assert.notEqual(k1,kOtherSecret,'HMAC key must differentiate digests');
  assert.equal(k1,await clientKey(withIp(' 203.0.113.7 '),testSecret));
  assert.equal(k1,await clientKey(withIp('::ffff:203.0.113.7'),testSecret));
  assert.equal(await clientKey(withIp('2001:DB8::1'),testSecret),await clientKey(withIp('2001:db8::9999:ffff'),testSecret),'same IPv6 /64 shares rate-limit key');
  const ipEnvelope=await (async()=>{const now=Math.floor(Date.now()/1000);
    return new EncryptJWT({operation:'cw_login',args:cases[0][1],iat:now,exp:now+60,jti:crypto.randomUUID(),iss:'codewiki-browser',aud:'codewiki-secure-auth'})
      .setProtectedHeader({alg:'RSA-OAEP-256',enc:'A256GCM',kid:'test-key',typ:'JWT'}).encrypt(publicKey);})();
  result={session_token:crypto.randomUUID()};
  await handler(new Request(endpoint,{method:'POST',headers:{
    Origin:origin,'Content-Type':'application/json','cf-connecting-ip':'203.0.113.7','cf-ipcountry':'KR',
    'user-agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
    'accept-language':'ko-KR,ko;q=0.9,en-US;q=0.8'
  },body:JSON.stringify({envelope:ipEnvelope})}));
  assert.equal(seen.at(-1).p_client,k1,'HMAC-keyed client key forwarded');
  assert.ok(!String(seen.at(-1).p_client).includes('203.0.113.7'),'rate-limit client key must stay HMAC-hashed');
  assert.equal(seen.at(-1).p_meta?.ip,'203.0.113.7','validated connecting IP forwarded in admin login metadata');
  assert.equal(seen.at(-1).p_meta?.country,'KR','country code extracted from cf-ipcountry');
  assert.equal(seen.at(-1).p_meta?.device_type,'mobile');
  assert.equal(seen.at(-1).p_meta?.device_model,'iPhone');
  assert.equal(seen.at(-1).p_meta?.os,'iOS 18.1');
  assert.equal(seen.at(-1).p_meta?.browser,'Safari 18');
  assert.equal(seen.at(-1).p_meta?.language,'ko-KR');
  assert.ok(!JSON.stringify(seen.at(-1).p_meta).includes(fixturePassword),'login metadata never contains passwords');
  // Korean Galaxy + Whale / Samsung Internet & Windows PC User-Agent parsing checks.
  const {extractLoginMeta}=await import('../supabase/functions/secure-auth/handler.mjs');
  const galMeta=extractLoginMeta(new Request(endpoint,{headers:{
    'cf-connecting-ip':'::ffff:198.51.100.12','cf-ipcountry':'KR',
    'user-agent':'Mozilla/5.0 (Linux; Android 14; SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36'
  }}));
  assert.equal(galMeta.ip,'198.51.100.12');
  assert.equal(galMeta.device_type,'mobile');
  assert.equal(galMeta.device_model,'Galaxy (SM-S928N)');
  assert.equal(galMeta.os,'Android 14');
  assert.equal(galMeta.browser,'Samsung Internet 25');
  const pcMeta=extractLoginMeta(new Request(endpoint,{headers:{
    'cf-connecting-ip':'2001:DB8::42',
    'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Whale/3.29.282.14 Safari/537.36'
  }}));
  assert.equal(pcMeta.ip,'2001:db8::42');
  assert.equal(pcMeta.device_type,'desktop');
  assert.equal(pcMeta.device_model,'Windows PC');
  assert.equal(pcMeta.os,'Windows 10/11');
  assert.equal(pcMeta.browser,'Whale 3');
  const response=await handler(new Request(endpoint,{headers:{Origin:origin}}));
  const keyResponse=await response.json();assert.deepEqual(Object.keys(keyResponse.jwk).sort(),['alg','e','kid','kty','n','use']);
  assert.equal(response.headers.get('cache-control'),'no-store');
  const encrypt=async (payload={},header={})=>{
    const now=Math.floor(Date.now()/1000);
    return new EncryptJWT({operation:'cw_login',args:cases[0][1],iat:now,exp:now+60,jti:crypto.randomUUID(),iss:'codewiki-browser',aud:'codewiki-secure-auth',...payload})
      .setProtectedHeader({alg:'RSA-OAEP-256',enc:'A256GCM',kid:'test-key',typ:'JWT',...header}).encrypt(publicKey);
  };
  const post=body=>handler(new Request(endpoint,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)}));
  const malformed=[{envelope:'plaintext'}, {p_password:fixturePassword}];
  for(const payload of [{exp:1},{iat:Math.floor(Date.now()/1000)+500,exp:Math.floor(Date.now()/1000)+550},
    {exp:Math.floor(Date.now()/1000)+3600},{aud:'other-service'},{iss:'other-client'},{jti:'invalid'},
    {operation:'cw_admin_list_users'},{args:{...cases[0][1],admin:true}},{args:{p_username:'fixture',p_password:{}}}])malformed.push({envelope:await encrypt(payload)});
  malformed.push({envelope:await encrypt({}, {kid:'unknown'})});
  const parts=(await encrypt()).split('.');parts[3]=(parts[3][0]==='A'?'B':'A')+parts[3].slice(1);malformed.push({envelope:parts.join('.')});
  malformed.push({envelope:await encrypt({}, {enc:'A128GCM'})});
  malformed.push({envelope:'x'.repeat(17000)});
  const before=seen.length;
  for(const bad of malformed){const r=await post(bad);assert.equal(r.status,400);assert.equal((await r.json()).code,'CW_ENVELOPE_INVALID');}
  assert.equal(seen.length,before,'invalid encryption reached database');
  assert.equal((await handler(new Request(endpoint,{headers:{Origin:'https://evil.test','cf-connecting-ip':'203.0.113.9'}}))).status,403);
  assert.equal((await handler(new Request(endpoint+'?password=synthetic',{headers:{Origin:origin}}))).status,400);
  assert.equal((await handler(new Request(endpoint,{method:'DELETE',headers:{Origin:origin}}))).status,405);
  assert.ok(secReports.some(e=>e.p_event_type==='origin_denied'&&e.p_reason_code==='CW_ORIGIN_DENIED'&&/^[0-9a-f]{64}$/.test(e.p_client)),'origin_denied reported with HMAC client key');
  assert.ok(secReports.some(e=>e.p_event_type==='envelope_tampered'&&e.p_reason_code==='CW_ENVELOPE_INVALID'),'envelope_tampered reported');
  assert.ok(secReports.some(e=>e.p_event_type==='method_abuse'&&e.p_reason_code==='CW_METHOD_NOT_ALLOWED'),'method_abuse reported');
  assert.ok(!JSON.stringify(secReports).includes('203.0.113.9')&&!JSON.stringify(secReports).includes(fixturePassword),'security reports never leak raw IP or password');
  // Edge per-isolate security report throttling caps noisy floods (max 20 / 60s per type+client) without affecting 403 responses.
  const beforeFlood=secReports.length;
  for(let i=0;i<30;i++){
    assert.equal((await handler(new Request(endpoint,{headers:{Origin:'https://flood.test','cf-connecting-ip':'198.51.100.42'}}))).status,403);
  }
  assert.equal(secReports.length-beforeFlood,20,'edge security reports throttled at 20/min per type+client');
  const failure=await createHandler({privateKeys:[jwk],origins:[origin],rpc:async()=>{throw Error(fixturePassword);}});
  const failed=await failure(new Request(endpoint,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({envelope:await encrypt()})}));
  assert.deepEqual(await failed.json(),{code:'CW_AUTH_UNAVAILABLE'});
  result={code:'CW_INVALID_CREDENTIALS',message:fixturePassword,details:fixtureAdmin};
  const error=await client.request('cw_login',cases[0][1]);assert.ok(!JSON.stringify(error).includes(fixturePassword));
  let requests=0;
  const unavailable=create({url,apiKey:'fixture',fetcher:async()=>{requests++;throw Error('network');}});
  await assert.rejects(unavailable.request('cw_login',cases[0][1]));assert.equal(requests,1,'plaintext fallback/retry');
  const ctrl=new AbortController();ctrl.abort();
  const canceled=create({url,apiKey:'fixture',fetcher});
  const previousPosts=wire.filter(r=>r.method==='POST').length;
  await assert.rejects(canceled.request('cw_login',cases[0][1],{signal:ctrl.signal}));
  assert.equal(wire.filter(r=>r.method==='POST').length,previousPosts);
  // Browser bundle must be exactly reproducible and expose only the client API.
  const build=require('esbuild').buildSync({entryPoints:['auth/transport.mjs'],bundle:true,minify:true,format:'iife',platform:'browser',target:['es2022'],write:false,legalComments:'eof'});
  const normalizeEol=s=>s.replace(/\r\n/g,'\n');
  assert.equal(normalizeEol(fs.readFileSync('js/secure-auth.js','utf8')),normalizeEol(build.outputFiles[0].text),'rebuild auth bundle');
  const context={window:{},crypto,TextEncoder,TextDecoder,URL,fetch};vm.runInNewContext(build.outputFiles[0].text,context);
  assert.equal(typeof context.window.CodeWikiSecureAuth.create,'function');
  const auth=fs.readFileSync('js/auth.js','utf8');
  assert.ok(!/getDemoUsers|saveDemoUsers|setDemoSession|data-demo-login/.test(auth));
  assert.match(auth,/removeItem\('codewiki_custom_users_v1'\)/);
  assert.match(auth,/secureAuth\.request/);
  const saved=new Map([['codewiki_custom_users_v1','old demo fixture'],['codewiki_custom_session_v1','old-session'],['private-note','keep-me']]);
  const element=()=>({classList:{add(){},remove(){}},addEventListener(){}});
  const boot={window:{},document:{body:element(),getElementById:element},localStorage:{removeItem:k=>saved.delete(k)}};
  vm.runInNewContext(auth.replace(/  renderAuthState\(\);\s*\}\)\(\);\s*$/,'})();'),boot);
  assert.equal(saved.has('codewiki_custom_users_v1'),false);
  assert.equal(saved.has('codewiki_custom_session_v1'),false);
  assert.equal(saved.get('private-note'),'keep-me','legacy cleanup deleted unrelated data');
  console.log('PASS: actual JWE login/signup/reset round trips, wire confidentiality, key cache, tamper/expiry/schema/origin rejection, safe errors, no fallback, abort and reproducible bundle');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
