import {EncryptJWT, importJWK} from 'jose';

const operations = new Set(['cw_login', 'cw_signup_with_roster', 'cw_admin_reset_student_password']);

// No plaintext fallback, credential persistence, or automatic mutation retries.
export function create({url, apiKey, fetcher = globalThis.fetch, clock = Date.now}) {
  const base = new URL(url);
  if (base.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) throw Error('HTTPS required');
  const endpoint = new URL('/functions/v1/secure-auth', base).href;
  let cached = null;
  async function publicKey(signal) {
    if (cached && cached.until > clock()) return cached;
    const response = await fetcher(endpoint, {method:'GET', headers:{apikey:apiKey}, signal, credentials:'omit', cache:'no-store', redirect:'error'});
    if (!response.ok) throw Error('secure-auth-unavailable');
    const data = await response.json();
    const jwk = data.jwk;
    if (data.version !== 1 || !jwk || jwk.kty !== 'RSA' || jwk.alg !== 'RSA-OAEP-256' ||
        jwk.d || jwk.p || jwk.q || typeof jwk.n !== 'string' || jwk.n.length < 512 ||
        typeof jwk.kid !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(jwk.kid) || !Number.isFinite(data.serverTime)) throw Error('invalid-auth-key');
    const key=await importJWK(jwk, 'RSA-OAEP-256');
    if(key.algorithm.modulusLength<3072)throw Error('invalid-auth-key');
    cached = {key, kid:jwk.kid, until:clock()+300000, offset:data.serverTime-clock()};
    return cached;
  }
  return {
    async request(operation, args, {signal} = {}) {
      if (!operations.has(operation)) throw Error('unsupported-auth-operation');
      try {
        const {key, kid, offset} = await publicKey(signal);
        if (signal?.aborted) throw Error('aborted');
        const now = Math.floor((clock()+offset)/1000);
        const envelope = await new EncryptJWT({operation, args})
          .setProtectedHeader({alg:'RSA-OAEP-256', enc:'A256GCM', kid, typ:'JWT'})
          .setIssuer('codewiki-browser').setAudience('codewiki-secure-auth')
          .setIssuedAt(now).setExpirationTime(now+60).setJti(crypto.randomUUID()).encrypt(key);
        if (signal?.aborted) throw Error('aborted');
        const response = await fetcher(endpoint, {method:'POST', headers:{apikey:apiKey, 'Content-Type':'application/json'},
          body:JSON.stringify({envelope}), signal, credentials:'omit', cache:'no-store', redirect:'error'});
        const data = await response.json();
        if (!response.ok || data?.code) {
          cached = null;
          // Do not display arbitrary proxy/server messages that might include inputs.
          const messages = {
            CW_INVALID_CREDENTIALS:'아이디 또는 비밀번호를 확인해 주세요.',
            CW_PASSWORD_POLICY:'비밀번호는 8자 이상이며 쉽게 추측할 수 없는 값이어야 합니다.',
            CW_INVALID_INPUT:'가입 정보를 확인해 주세요. 6반은 이름과 출석번호가 명단과 일치해야 합니다.',
            CW_SIGNUP_FAILED:'가입 신청을 처리하지 못했습니다. 입력 내용을 확인해 주세요.',
            CW_RATE_LIMIT:'시도 횟수를 초과했습니다. 잠시 후 다시 시도해 주세요.',
            CW_ADMIN_REQUIRED:'관리자 로그인이 필요합니다.', CW_ADMIN_PASSWORD:'관리자 비밀번호를 확인해 주세요.',
            CW_STUDENT_NOT_FOUND:'학생 계정을 찾을 수 없습니다.',
            CW_ENVELOPE_INVALID:'보안 요청이 만료되었거나 유효하지 않습니다. 다시 시도해 주세요.',
            CW_REPLAY:'이미 처리된 요청입니다. 결과를 확인한 뒤 다시 시도해 주세요.'
          };
          const code = Object.hasOwn(messages, data?.code) ? data.code : 'CW_AUTH_UNAVAILABLE';
          return {error:{code, message:messages[code] || '보안 로그인 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'}};
        }
        return {data};
      } catch {
        cached = null;
        throw Object.assign(Error('보안 로그인 서버에 연결하지 못했습니다.'), {code:'CW_AUTH_UNAVAILABLE'});
      }
    }
  };
}

if (typeof window !== 'undefined') window.CodeWikiSecureAuth = {create};
