import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { csrfProtection, securityHeaders } from './security.middleware.js';
import { cspReportRouter } from '../routes/csp-report.routes.js';

describe('browser security boundary', () => {
  let server: ReturnType<ReturnType<typeof express>['listen']>, base: string;
  beforeAll(async () => {
    const app = express();
    app.use(securityHeaders);
    app.use('/reports', cspReportRouter);
    app.use(csrfProtection);
    app.all('/operation', (_req, res) => res.json({ ok: true }));
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    base = `http://127.0.0.1:${(server.address() as any).port}`;
  });
  afterAll(() => { server.close(); });
  it('allows the configured browser origin but refuses foreign and missing cookie provenance', async () => {
    for (const [headers, expected] of [
      [{ origin: 'http://localhost:3000', cookie: 'auth_token=test' }, 200],
      [{ origin: 'https://attacker.invalid', cookie: 'auth_token=test' }, 403],
      [{ origin: 'null', cookie: 'auth_token=test' }, 403],
      [{ cookie: 'auth_token=test' }, 403],
      [{ authorization: 'Bearer native-client' }, 200],
    ] as Array<[Record<string,string>, number]>) {
      expect((await fetch(`${base}/operation`, { method: 'POST', headers })).status).toBe(expected);
    }
    expect((await fetch(`${base}/operation`, { headers: { cookie: 'auth_token=test' } })).status).toBe(200);
  });
  it('sends report-only CSP, framing and MIME protection and ignores untrusted forwarded HTTPS', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    try {
      const response = await fetch(`${base}/operation`, { headers: { 'x-forwarded-proto': 'https' } });
      expect(response.headers.get('x-frame-options')).toBe('DENY');
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('content-security-policy-report-only')).toContain("connect-src 'self'");
      expect(response.headers.get('strict-transport-security')).toBeNull();
      const headers: Record<string, string> = {};
      securityHeaders({ secure: true } as any, { setHeader: (k: string, v: string) => { headers[k] = v; } } as any, () => {});
      expect(headers['Strict-Transport-Security']).toBe('max-age=300');
    } finally { vi.unstubAllEnvs(); }
  });
  it('collects bounded CSP reports without logging document paths or inline samples', async () => {
    const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const response = await fetch(`${base}/reports`, { method: 'POST', headers: { 'Content-Type': 'application/csp-report' }, body: JSON.stringify({ 'csp-report': { 'document-uri': 'https://crm.invalid/customer?secret=1', 'effective-directive': 'script-src-elem', 'blocked-uri': 'https://cdn.invalid/path?secret=2', 'script-sample': 'secret code' } }) });
      expect(response.status).toBe(204);
      expect(log).toHaveBeenCalledWith('CSP report', { directive: 'script-src-elem', blocked: 'https://cdn.invalid' });
      expect(JSON.stringify(log.mock.calls)).not.toContain('secret');
      expect((await fetch(`${base}/reports`, { method: 'POST', headers: { 'Content-Type': 'application/csp-report' }, body: JSON.stringify({ text: 'x'.repeat(17000) }) })).status).toBe(413);
    } finally { log.mockRestore(); }
  });
  it('protects static locations despite nginx add_header inheritance and keeps uploads private', () => {
    const nginx = readFileSync(new URL('../../../frontend/nginx.conf', import.meta.url), 'utf8');
    for (const location of ['= /index.html', '/assets/', '= /favicon.ico', '/']) {
      expect(nginx).toContain(`location ${location} {\n    include /etc/nginx/security-headers.conf;`);
    }
    expect(nginx).toContain('private, max-age=604800');
    const headers = readFileSync(new URL('../../../frontend/security-headers.conf', import.meta.url), 'utf8');
    expect(headers).toContain('Content-Security-Policy-Report-Only');
    expect(headers).toContain('report-uri /api/security/csp-report');
  });
});
