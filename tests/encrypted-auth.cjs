const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
  const {generateKeyPair,exportJWK,EncryptJWT}=await import('jose');
  const {create}=await import('../auth/transport.mjs');
  const {createHandler}=await import('../supabase/functions/secure-auth/handler.mjs');
  const {privateKey,publicKey}=await generateKeyPair('RSA-OAEP-256',{modulusLength:3072,extractable:true});
  const jwk={...await exportJWK(privateKey),kid:'test-key',alg:'RSA-OAEP-256'};
  const origin='https://example.test',url='https://database.test',endpoint=url+'/functions/v1/secure-auth';
  const clock=()=>Date.now(), seen=[],wire=[];
  let result={session_token:crypto.randomUUID()},keyCalls=0;
  const handler=await createHandler({privateKeys:[jwk],origins:[origin],clock,rpc:async args=>{seen.push(args);return result;}});
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
  // Per-client limits: only a one-way hash of the platform IP reaches the database.
  const {clientKey}=await import('../supabase/functions/secure-auth/handler.mjs');
  const withIp=(ip)=>new Request(endpoint,{headers:{'cf-connecting-ip':ip}});
  const k1=await clientKey(withIp('203.0.113.7')),k2=await clientKey(withIp('203.0.113.8'));
  assert.match(k1,/^[0-9a-f]{64}$/);assert.notEqual(k1,k2);assert.equal(k1,await clientKey(withIp(' 203.0.113.7 ')));
  assert.equal(await clientKey(withIp('2001:DB8::1')),await clientKey(withIp('2001:db8::1')));
  for(const bad of ['', 'not-an-ip', '1.2.3.4, 5.6.7.8', 'x'.repeat(60)])assert.equal(await clientKey(withIp(bad)),null,'malformed IP header ignored');
  const ipEnvelope=await (async()=>{const now=Math.floor(Date.now()/1000);
    return new EncryptJWT({operation:'cw_login',args:cases[0][1],iat:now,exp:now+60,jti:crypto.randomUUID(),iss:'codewiki-browser',aud:'codewiki-secure-auth'})
      .setProtectedHeader({alg:'RSA-OAEP-256',enc:'A256GCM',kid:'test-key',typ:'JWT'}).encrypt(publicKey);})();
  result={session_token:crypto.randomUUID()};
  await handler(new Request(endpoint,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','cf-connecting-ip':'203.0.113.7'},body:JSON.stringify({envelope:ipEnvelope})}));
  assert.equal(seen.at(-1).p_client,k1,'hashed client key forwarded');
  assert.ok(!JSON.stringify(seen.at(-1)).includes('203.0.113.7'),'raw IP never forwarded');
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
  assert.equal((await handler(new Request(endpoint,{headers:{Origin:'https://evil.test'}}))).status,403);
  assert.equal((await handler(new Request(endpoint+'?password=synthetic',{headers:{Origin:origin}}))).status,400);
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
  assert.equal(fs.readFileSync('js/secure-auth.js','utf8'),build.outputFiles[0].text,'rebuild auth bundle');
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
