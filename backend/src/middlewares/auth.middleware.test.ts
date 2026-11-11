import { describe, it, expect } from 'vitest';

type MockResponse = {
  statusCode: number;
  body: unknown;
  status: (code: number) => MockResponse;
  json: (payload: unknown) => MockResponse;
};

const createMockResponse = (): MockResponse => {
  const res: MockResponse = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };

  return res;
};

describe('Auth Middleware', () => {
  it('authenticate returns 401 for malformed cookie without throwing', async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    const { authenticate } = await import('./auth.middleware.js');

    const req = {
      headers: {
        cookie: 'auth_token=%E0%A4%A',
      },
    } as any;
    const res = createMockResponse();
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    await authenticate(req, res as any, next as any);

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid token' });
  });

  it('staffOnly turns away customer-portal accounts and lets staff through', async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    const { staffOnly } = await import('./auth.middleware.js');
    for (const [role, passes] of [['CUSTOMER', false], ['customer', false], ['SELLER', true], ['MANAGER', true], ['ADMIN', true]] as const) {
      const res = createMockResponse();
      let nextCalled = false;
      staffOnly({ user: { id: 1, username: 'u', role } } as any, res as any, (() => { nextCalled = true; }) as any);
      expect([role, nextCalled, nextCalled ? 200 : res.statusCode]).toEqual([role, passes, passes ? 200 : 403]);
    }
  });

  it('mounts staffOnly on every staff API group and on uploads, not on the customer portal ones', async () => {
    const { readFileSync } = await import('node:fs');
    const app = readFileSync(new URL('../app.ts', import.meta.url), 'utf8');
    for (const group of ['invoices', 'customers', 'dashboard', 'reports', 'reminders', 'payments', 'expenses', 'staff', 'cash']) {
      expect(app).toMatch(new RegExp(`app\\.use\\('/api/${group}', authenticate, staffOnly, `));
    }
    expect(app).toContain("app.post('/api/upload', authenticate, staffOnly,");
    // Image URLs built by the frontend (utils/media.ts) live under /api/uploads.
    expect(app).toContain("app.use('/api/uploads', authenticateUploadAccess, serveUploads);");
    for (const portal of ['products', 'warehouses', 'settings', 'customer-orders']) {
      expect(app).toMatch(new RegExp(`app\\.use\\('/api/${portal}', authenticate, \\w+Routes\\)`));
    }
  });
});
