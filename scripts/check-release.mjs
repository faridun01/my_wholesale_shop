import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

// Entirely disposable local stack; never reads .env or connects to the server.
const prefix = `wholesale-release-${Date.now()}`;
const network = `${prefix}-net`, pg = `${prefix}-pg`, backend = `${prefix}-api`, web = `${prefix}-web`;
const created = [];
const run = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 }).trim();
const wait = async predicate => {
  for (let i = 0; i < 80; i++) {
    try { if (await predicate()) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Isolated release stack did not become ready');
};
const password = randomUUID(), jwt = randomUUID();
const env = ['-e', `DATABASE_URL=postgresql://postgres:${password}@db:5432/release_test`, '-e', `JWT_SECRET=${jwt}`, '-e', `TWO_FACTOR_BACKUP_PEPPER=${randomUUID()}`, '-e', 'CORS_ORIGINS=https://crm.audit.invalid', '-e', 'FRONTEND_ORIGIN=https://crm.audit.invalid'];
const results = { checkedAt: new Date().toISOString(), commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), checks: [] };
try {
  run('network', 'create', network);
  run('run', '-d', '--name', pg, '--network', network, '--network-alias', 'db', '-e', `POSTGRES_PASSWORD=${password}`, '-e', 'POSTGRES_DB=release_test', 'postgres:16-alpine'); created.push(pg);
  await wait(() => run('exec', pg, 'pg_isready', '-U', 'postgres', '-d', 'release_test').includes('accepting connections'));
  let refused = false;
  try { run('run', '--rm', '--network', network, ...env, 'wholesale-audit-backend:20261111'); } catch { refused = true; }
  assert.equal(refused, true);
  assert.equal(run('exec', pg, 'psql', '-U', 'postgres', '-d', 'release_test', '-tAc', "SELECT to_regclass('public.invoices') IS NULL"), 't');
  results.checks.push('Pending migrations: startup refuses without changing the database');
  run('run', '-d', '--name', backend, '--network', network, '--network-alias', 'backend', ...env, '-e', 'APPLY_MIGRATIONS=true', 'wholesale-audit-backend:20261111'); created.push(backend);
  await wait(() => run('exec', backend, 'node', '-e', "fetch('http://127.0.0.1:3001/api/health').then(r=>{if(!r.ok)process.exit(1);console.log('ready')}).catch(()=>process.exit(1))").includes('ready'));
  results.checks.push('Explicit migration application on disposable PostgreSQL: backend healthy');
  // Verify default startup after migration, without running another migration.
  run('rm', '-f', backend); created.splice(created.indexOf(backend), 1);
  run('run', '-d', '--name', backend, '--network', network, '--network-alias', 'backend', ...env, 'wholesale-audit-backend:20261111'); created.push(backend);
  await wait(() => run('exec', backend, 'node', '-e', "fetch('http://127.0.0.1:3001/api/health').then(r=>{if(!r.ok)process.exit(1);console.log('ready')}).catch(()=>process.exit(1))").includes('ready'));
  results.checks.push('Default restart on migrated schema: backend healthy');
  run('run', '--rm', '--network', network, 'wholesale-audit-frontend:20261111', 'nginx', '-t');
  run('run', '-d', '--name', web, '--network', network, '-p', '127.0.0.1::80', 'wholesale-audit-frontend:20261111'); created.push(web);
  const port = run('port', web, '80/tcp').split(':').at(-1);
  const base = `http://127.0.0.1:${port}`;
  await wait(async () => (await fetch(base)).ok);
  const html = await (await fetch(base)).text();
  const asset = html.match(/src="(\/assets\/[^\"]+\.js)"/)?.[1]; assert.ok(asset);
  for (const path of ['/', '/index.html', '/customers', '/customers/debts', asset, '/assets/missing-audit.js']) {
    const r = await fetch(base + path, { headers: { 'X-Forwarded-Proto': 'https' } });
    assert.equal(r.status, path.includes('missing-audit') ? 404 : 200);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(r.headers.get('x-frame-options'), 'DENY');
    assert.ok(r.headers.get('referrer-policy'));
    assert.ok(r.headers.get('content-security-policy-report-only')?.includes('/api/security/csp-report'));
    assert.ok(r.headers.get('strict-transport-security'));
  }
  assert.equal((await fetch(base)).headers.get('strict-transport-security'), null);
  assert.equal((await fetch(base + '/api/health')).status, 200);
  assert.equal((await fetch(base + '/api/payments', { method: 'POST', headers: { Cookie: 'auth_token=fake', Origin: 'https://attacker.invalid' } })).status, 403);
  assert.equal((await fetch(base + '/api/security/csp-report', { method: 'POST', headers: { 'Content-Type': 'application/csp-report' }, body: JSON.stringify({ 'csp-report': { 'effective-directive': 'script-src', 'blocked-uri': 'inline' } }) })).status, 204);
  assert.equal((await fetch(base + '/uploads/nonexistent')).status, 401);
  results.checks.push('nginx -t; HTML/deep links/JS/404 security headers; HSTS HTTPS only; API proxy; CSRF; CSP reports; upload authentication');
  results.success = true;
} catch (error) {
  results.success = false;
  results.error = error.message;
  process.exitCode = 1;
} finally {
  for (const name of created.reverse()) { try { run('rm', '-f', name); } catch {} }
  try { run('network', 'rm', network); } catch {}
  writeFileSync('docs/release-smoke-results.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}
