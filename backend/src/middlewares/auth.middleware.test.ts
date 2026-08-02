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
});
