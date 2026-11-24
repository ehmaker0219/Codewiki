import {createHandler} from './handler.mjs';

// No body, arguments, exception objects, passwords, tokens, or keys are logged.
const allowedOrigins = (Deno.env.get('CW_AUTH_ALLOWED_ORIGINS') || '').split(',').map(s=>s.trim()).filter(Boolean);
let handler: (request: Request) => Promise<Response>;
try {
  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (!url?.startsWith('https://') || !serviceKey) throw Error('missing-config');
  handler = await createHandler({
    privateKeys: JSON.parse(Deno.env.get('CW_AUTH_PRIVATE_JWKS') || 'null'),
    origins: allowedOrigins,
    clientHashKey: Deno.env.get('CW_AUTH_CLIENT_HASH_KEY') || undefined,
    rpc: async (args: unknown) => {
      const response = await fetch(`${url}/rest/v1/rpc/cw_secure_auth`, {
        method:'POST', headers:{apikey:serviceKey, Authorization:`Bearer ${serviceKey}`, 'Content-Type':'application/json'},
        body:JSON.stringify(args), signal:AbortSignal.timeout(10000), redirect:'error'
      });
      // Database status may be 4xx with an intentionally safe error code.
      const data = await response.json();
      if (!response.ok && !data?.code?.startsWith('CW_')) throw Error('rpc-unavailable');
      return data;
    }
  });
} catch {
  handler = async (request: Request) => {
    const origin = request.headers.get('origin');
    const headers: Record<string, string> = {'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
    if (origin && allowedOrigins.includes(origin) && !allowedOrigins.includes('*')) {
      headers['Access-Control-Allow-Origin'] = origin;
      if (request.method === 'OPTIONS') {
        headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
        headers['Access-Control-Allow-Headers'] = 'apikey, content-type';
        return new Response(null, {status:204, headers});
      }
    }
    return new Response('{"code":"CW_AUTH_UNAVAILABLE"}', {status:503, headers});
  };
}
Deno.serve(handler);
