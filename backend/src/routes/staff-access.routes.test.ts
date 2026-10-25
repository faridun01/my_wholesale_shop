import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.mock('../db/prisma.js', () => ({
  default: {
    payment: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    invoice: { findUnique: vi.fn(), groupBy: vi.fn(), findMany: vi.fn() },
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

type MockResponse = {
  statusCode: number;
  body: any;
  status: (code: number) => MockResponse;
  json: (payload: unknown) => MockResponse;
};

const createMockResponse = (): MockResponse => ({
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
});

// Returns the final handler of a route (after any validation middlewares).
const getHandler = (router: any, method: string, path: string) => {
  const layer = router.stack.find((entry: any) => entry.route?.path === path && entry.route.methods[method]);
  const stack = layer.route.stack;
  return stack[stack.length - 1].handle;
};

const sellerUser = { id: 7, username: 'seller', role: 'SELLER', warehouseId: 1 };

let paymentsRouter: any;
let staffRouter: any;
let prisma: any;

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  paymentsRouter = (await import('./payments.routes.js')).default;
  staffRouter = (await import('./staff.routes.js')).default;
  prisma = (await import('../db/prisma.js')).default;
});

describe('payments: only ADMIN can record or cancel a payment', () => {
  it('rejects a seller creating a payment for their own invoice', async () => {
    const handler = getHandler(paymentsRouter, 'post', '/');
    const res = createMockResponse();

    await handler({ user: sellerUser, body: { invoice_id: 1, amount: 100 } }, res, vi.fn());

    expect(res.statusCode).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a seller cancelling a payment', async () => {
    const handler = getHandler(paymentsRouter, 'delete', '/:id');
    const res = createMockResponse();

    await handler({ user: sellerUser, params: { id: '3' } }, res, vi.fn());

    expect(res.statusCode).toBe(403);
    expect(prisma.payment.delete).not.toHaveBeenCalled();
  });
});

describe('staff summary access', () => {
  it('forbids a seller from reading another staff member', async () => {
    const handler = getHandler(staffRouter, 'get', '/:id/summary');
    const res = createMockResponse();

    await handler({ user: sellerUser, params: { id: 8 }, query: {} }, res, vi.fn());

    expect(res.statusCode).toBe(403);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('lets a seller read their own figures without profit', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: 7, username: 'seller', role: 'SELLER', active: true, warehouse: null });
    prisma.invoice.groupBy.mockResolvedValueOnce([]);
    const handler = getHandler(staffRouter, 'get', '/:id/summary');
    const res = createMockResponse();

    await handler({ user: sellerUser, params: { id: 7 }, query: {} }, res, vi.fn());

    expect(res.statusCode).toBe(200);
    expect(res.body.invoicesCount).toBe(0);
    expect(res.body).not.toHaveProperty('profit');
    expect(prisma.invoice.findMany).not.toHaveBeenCalled();
  });
});
