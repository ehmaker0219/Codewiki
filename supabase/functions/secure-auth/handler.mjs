import {importJWK, jwtDecrypt} from 'jose';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fields = {
  cw_login: ['p_username','p_password'],
  cw_signup_with_roster: ['p_username','p_password','p_full_name','p_class_name','p_mbti','p_birth_date','p_share_with_class','p_student_number'],
  cw_admin_reset_student_password: ['p_token','p_target_id','p_admin_password','p_new_password']
};
const errorStatuses = {CW_INVALID_CREDENTIALS:400, CW_PASSWORD_POLICY:400, CW_INVALID_INPUT:400, CW_SIGNUP_FAILED:400,
  CW_ADMIN_REQUIRED:403, CW_ADMIN_PASSWORD:400, CW_STUDENT_NOT_FOUND:404, CW_RATE_LIMIT:429, CW_REPLAY:409, CW_ENVELOPE_INVALID:400};

function validArgs(operation, args) {
  const allowed = Object.hasOwn(fields,operation) ? fields[operation] : null;
  if (!allowed || !args || typeof args !== 'object' || Array.isArray(args) ||
      Object.keys(args).length !== allowed.length || Object.keys(args).some(k=>!allowed.includes(k))) return false;
  for (const [key, value] of Object.entries(args)) {
    if (key === 'p_share_with_class') { if (typeof value !== 'boolean') return false; }
    else if (key === 'p_student_number') { if (value !== null && (!Number.isInteger(value) || value < 1 || value > 999)) return false; }
    else if (key === 'p_birth_date') { if (value !== null && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))) return false; }
    else if (typeof value !== 'string' || new TextEncoder().encode(value).length > (key.includes('password') ? 4096 : 300)) return false;
  }
  return operation !== 'cw_admin_reset_student_password' || (uuid.test(args.p_token) && uuid.test(args.p_target_id));
}

async function readBody(request) {
  if (!request.body || !/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '') ||
      Number(request.headers.get('content-length')) > 16384) throw Error('invalid-body');
  const reader=request.body.getReader(), chunks=[];let length=0;
  try {
    while (true) {
      const {done,value}=await reader.read();if(done)break;
      length+=value.length;
      if(length>16384){await reader.cancel();throw Error('oversized-body');}
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes=new Uint8Array(length);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if (!body || Object.keys(body).length !== 1 || typeof body.envelope !== 'string') throw Error('invalid-body');
  return body.envelope;
}

// JWE gives confidentiality/integrity, not user identity. Database password/session
// checks remain mandatory, even for envelopes made with our public key.
// Per-client rate limiting uses the platform-set connecting IP (cf-connecting-ip
// on hosted Supabase). Strict IPv4/IPv6 parsing canonicalizes IPv6 to its /64
// prefix, and only a server-keyed HMAC-SHA-256 leaves this function; raw IPs
// are never stored or logged.
const ipv4Part = /^(?:0|[1-9]\d{0,2})$/;
const ipv6Group = /^[0-9a-f]{1,4}$/i;

function parseIpv4(text) {
  const parts = text.split('.');
  if (parts.length !== 4) return null;
  const nums = [];
  for (const part of parts) {
    if (!ipv4Part.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    nums.push(n);
  }
  return nums;
}

export function normalizeClientIp(raw) {
  const ip = String(raw || '').trim();
  if (!ip || ip.length > 45 || ip.includes('%')) return null;
  const v4 = parseIpv4(ip);
  if (v4) return 'v4:' + v4.join('.');
  if (!ip.includes(':')) return null;
  const doubleColons = ip.split('::');
  if (doubleColons.length > 2) return null;
  const parseSide = (side, allowTrailingV4) => {
    if (!side) return [];
    const tokens = side.split(':');
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (allowTrailingV4 && i === tokens.length - 1 && tok.includes('.')) {
        const mapped = parseIpv4(tok);
        if (!mapped) return null;
        out.push((mapped[0] << 8) | mapped[1], (mapped[2] << 8) | mapped[3]);
      } else {
        if (!ipv6Group.test(tok)) return null;
        out.push(parseInt(tok, 16));
      }
    }
    return out;
  };
  let groups;
  if (doubleColons.length === 2) {
    const left = parseSide(doubleColons[0], false);
    const right = parseSide(doubleColons[1], true);
    if (!left || !right) return null;
    const missing = 8 - (left.length + right.length);
    if (missing < 1) return null;
    groups = [...left, ...new Array(missing).fill(0), ...right];
  } else {
    groups = parseSide(ip, true);
    if (!groups || groups.length !== 8) return null;
  }
  // Canonicalize IPv4-mapped IPv6 (::ffff:a.b.c.d) to its IPv4 address.
  if (groups[0] === 0 && groups[1] === 0 && groups[2] === 0 && groups[3] === 0 && groups[4] === 0 && groups[5] === 0xffff) {
    return `v4:${groups[6] >> 8}.${groups[6] & 0xff}.${groups[7] >> 8}.${groups[7] & 0xff}`;
  }
  // Bucket IPv6 addresses by their /64 network prefix so rotating interface IDs cannot bypass limits.
  return 'v6:' + groups.slice(0, 4).map(g => g.toString(16).padStart(4, '0')).join(':');
}

async function importHmacKey(secret) {
  if (secret && typeof secret === 'object' && secret.type === 'secret') return secret;
  const raw = typeof secret === 'string' && secret ? secret : null;
  if (!raw) throw Error('missing-hmac-key');
  const material = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return crypto.subtle.importKey('raw', material, {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
}

export async function clientKey(request, hmacKey) {
  const normalized = normalizeClientIp(request.headers.get('cf-connecting-ip'));
  if (!normalized) return null;
  const key = await importHmacKey(hmacKey);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('codewiki-client-v2:' + normalized));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function createHandler({privateKeys, origins, rpc, clock=Date.now, clientHashKey}) {
  if (!Array.isArray(privateKeys) || !privateKeys.length || privateKeys.length > 2 || !origins?.length || origins.includes('*')) throw Error('invalid-config');
  const keys=new Map();
  for(const jwk of privateKeys){
    if(jwk.kty!=='RSA'||jwk.alg!=='RSA-OAEP-256'||typeof jwk.d!=='string'||typeof jwk.n!=='string'||jwk.n.length<512||
      typeof jwk.kid!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(jwk.kid)||keys.has(jwk.kid))throw Error('invalid-key');
    const key=await importJWK(jwk,'RSA-OAEP-256');
    if(key.algorithm.modulusLength<3072)throw Error('invalid-key');
    keys.set(jwk.kid,key);
  }
  const first=privateKeys[0], publicJwk={kty:'RSA',alg:'RSA-OAEP-256',use:'enc',kid:first.kid,n:first.n,e:first.e};
  // Server-only HMAC key prevents offline IPv4 rainbow-table reversal.
  const hmacKey=await importHmacKey(clientHashKey || ('codewiki-client-hmac-v2:' + first.d));
  return async request=>{
    const origin=request.headers.get('origin');
    const headers={'Cache-Control':'no-store','Content-Type':'application/json','X-Content-Type-Options':'nosniff','Vary':'Origin'};
    const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
    // Origin is defense-in-depth only. Non-browser callers can forge this header.
    if(!origin||!origins.includes(origin))return reply({code:'CW_ORIGIN_DENIED'},403);
    headers['Access-Control-Allow-Origin']=origin;
    if(request.method==='OPTIONS'){
      headers['Access-Control-Allow-Methods']='GET, POST, OPTIONS';
      headers['Access-Control-Allow-Headers']='apikey, content-type';
      return new Response(null,{status:204,headers});
    }
    const url=new URL(request.url);
    if(url.search)return reply({code:'CW_ENVELOPE_INVALID'},400);
    if(request.method==='GET')return reply({version:1,jwk:publicJwk,serverTime:clock()});
    if(request.method!=='POST')return reply({code:'CW_METHOD_NOT_ALLOWED'},405);
    let payload;
    try{
      const envelope=await readBody(request);
      const decrypted=await jwtDecrypt(envelope, header=>{
        if(header.typ!=='JWT'||!keys.has(header.kid))throw Error('invalid-key');
        return keys.get(header.kid);
      },{keyManagementAlgorithms:['RSA-OAEP-256'],contentEncryptionAlgorithms:['A256GCM'],
        issuer:'codewiki-browser',audience:'codewiki-secure-auth',requiredClaims:['iat','exp','jti'],
        maxTokenAge:60,clockTolerance:5,currentDate:new Date(clock())});
      payload=decrypted.payload;
      if(!Number.isInteger(payload.iat)||!Number.isInteger(payload.exp)||payload.exp<=payload.iat||
        payload.exp-payload.iat>60||!uuid.test(payload.jti)||!validArgs(payload.operation,payload.args))throw Error('invalid-payload');
    }catch{return reply({code:'CW_ENVELOPE_INVALID'},400);}
    try{
      const args={p_operation:payload.operation,p_args:payload.args,p_request_id:payload.jti,p_expires_at:new Date(payload.exp*1000).toISOString()};
      const client=await clientKey(request,hmacKey);
      if(client)args.p_client=client;
      const result=await rpc(args);
      if(result?.code){const status=Object.hasOwn(errorStatuses,result.code)?errorStatuses[result.code]:null;return reply({code:status?result.code:'CW_AUTH_UNAVAILABLE'},status||503);}
      if(payload.operation==='cw_admin_reset_student_password'){
        if(result?.ok!==true||result.user_id!==payload.args.p_target_id)throw Error('invalid-response');
        return reply({ok:true,user_id:result.user_id});
      }
      if(!uuid.test(result?.session_token))throw Error('invalid-response');
      // Auth UI immediately reads cw_me; no credentials or arbitrary DB diagnostics leave this endpoint.
      return reply({session_token:result.session_token});
    }catch{return reply({code:'CW_AUTH_UNAVAILABLE'},503);}
  };
}
