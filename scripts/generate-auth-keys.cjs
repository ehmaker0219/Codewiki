// Writes new private keys only to an ignored .env.* file, never stdout or SQL.
// Does not upload or deploy anything. Existing files are never overwritten.
const fs=require('node:fs'),path=require('node:path');
(async()=>{
  const output=path.resolve(process.argv[2]||'.env.auth-secrets');
  if(!path.basename(output).startsWith('.env.'))throw Error('Output must be an ignored .env.* file');
  const {generateKeyPair,exportJWK}=await import('jose');
  const {privateKey}=await generateKeyPair('RSA-OAEP-256',{modulusLength:3072,extractable:true});
  const jwk=await exportJWK(privateKey);
  Object.assign(jwk,{alg:'RSA-OAEP-256',use:'enc',kid:require('node:crypto').randomUUID()});
  fs.writeFileSync(output,`CW_AUTH_PRIVATE_JWKS=${JSON.stringify([jwk])}\nCW_AUTH_ALLOWED_ORIGINS=https://ehmaker0219.github.io\n`,{flag:'wx',mode:0o600});
  console.log('Created ignored auth secrets file. Keep it private; never paste its contents into chat, SQL, or Git.');
})().catch(()=>{console.error('Could not create auth secrets file. Use a new .env.* path; existing files are preserved.');process.exitCode=1;});
