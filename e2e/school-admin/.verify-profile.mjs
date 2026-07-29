import fs from 'fs';
const raw = fs.readFileSync('/Users/likithkarnekota/Yugminds Website/Yugminds Backend/.env', 'utf8');
for (const line of raw.split('\n')) {
  const m = line.match(/^\s*(ADMIN_SEED_EMAIL|ADMIN_SEED_PASSWORD)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const { createQaFixture, teardownQaFixture } = await import('./fixture-client.ts');
const fixture = await createQaFixture();
const BACKEND = 'http://localhost:3001';
const loginRes = await fetch(`${BACKEND}/auth/login`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email: fixture.schoolAdmin.email, password: fixture.schoolAdmin.password})});
const loginBody = await loginRes.json();
const token = loginBody.tokens.accessToken;
const before = await (await fetch(`${BACKEND}/school-admin/profile`, {headers:{Authorization:`Bearer ${token}`}})).json();
console.log('BEFORE full_name:', before.full_name);
const patchRes = await fetch(`${BACKEND}/school-admin/profile`, {method:'PATCH', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`}, body: JSON.stringify({full_name: 'VERIFY UPDATED NAME'})});
console.log('PATCH status', patchRes.status, await patchRes.text());
const after = await (await fetch(`${BACKEND}/school-admin/profile`, {headers:{Authorization:`Bearer ${token}`}})).json();
console.log('AFTER full_name:', after.full_name);
await teardownQaFixture(fixture);
console.log('done');
