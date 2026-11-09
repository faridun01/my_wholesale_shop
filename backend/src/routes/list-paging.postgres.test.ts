import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import express from 'express';
import { once } from 'node:events';
import type { Server } from 'node:http';
import { financialJsonReplacer } from '../utils/financial.js';
import { toLocalDateKey } from './reports.helpers.js';

describe('toLocalDateKey', () => {
  it('labels a moment with its calendar day in the server time zone', () => {
    expect(toLocalDateKey(new Date(2026, 9, 5, 0, 30))).toBe('2026-10-05');
    expect(toLocalDateKey(new Date(2026, 9, 5, 23, 59))).toBe('2026-10-05');
  });
});

// Never uses DATABASE_URL: runs only against the isolated *_financial_test database
// provisioned by scripts/test-financial-postgres.mjs.
const testUrl = process.env.FINANCIAL_TEST_DATABASE_URL;
const suite = testUrl ? describe : describe.skip;

suite('complete product and customer lists across pages', () => {
  let db: PrismaClient;
  let server: Server;
  let baseUrl: string;
  let warehouseId: number, adminId: number;
  const productIds: number[] = [];
  const customerIds: number[] = [];

  const collect = async (path: string) => {
    const pages: any[][] = [];
    for (let page = 1; page < 500; page += 1) {
      const separator = path.includes('?') ? '&' : '?';
      const response = await fetch(`${baseUrl}${path}${separator}page=${page}&limit=2`);
      expect(response.status).toBe(200);
      pages.push(await response.json() as any[]);
      if (response.headers.get('x-has-more') !== 'true') break;
    }
    return pages;
  };

  beforeAll(async () => {
    const parsed = new URL(testUrl!);
    if (!parsed.pathname.endsWith('_financial_test')) throw new Error('Refusing a non-isolated financial test database');
    db = new PrismaClient({ datasources: { db: { url: testUrl! } } });
    (globalThis as any).prisma = db;

    const stamp = crypto.randomUUID();
    warehouseId = (await db.warehouse.create({ data: { name: `Paging ${stamp}` } })).id;
    adminId = (await db.user.create({ data: { username: `p-${stamp}`, passwordHash: 'test-only', role: 'ADMIN', warehouseId } })).id;
    const categoryId = (await db.category.create({ data: { name: `Paging ${stamp}` } })).id;

    // The creation order is deliberately not the name order.
    for (const name of ['Яблоко', 'Абрикос', 'Манго', 'Вишня', 'Банан']) {
      const key = `${name}-${crypto.randomUUID()}`;
      const product = await db.product.create({ data: { name, nameKey: key, unit: 'pcs', warehouseId, categoryId, costPrice: 1, sellingPrice: 2, stock: 0 } });
      productIds.push(product.id);
    }
    for (let index = 0; index < 5; index += 1) {
      customerIds.push((await db.customer.create({ data: { name: `Paging ${stamp} ${index}` } })).id);
    }

    const app = express();
    app.set('json replacer', financialJsonReplacer);
    app.use((req, _res, next) => {
      (req as any).user = { id: adminId, role: 'ADMIN', warehouseId };
      next();
    });
    app.use('/products', (await import('./products.routes.js')).default);
    app.use('/customers', (await import('./customers.routes.js')).default);
    app.use((error: any, _req: any, res: any, _next: any) => res.status(error.status || 500).json({ error: error.message }));
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });

  afterAll(async () => {
    server?.close();
    await db?.$disconnect();
    delete (globalThis as any).prisma;
  });

  it('returns every product once, in a stable order, across pages', async () => {
    const pages = await collect(`/products?warehouseId=${warehouseId}`);
    const rows = pages.flat();

    expect(pages).toHaveLength(3);
    expect(rows.map((row) => row.id).sort((a, b) => a - b)).toEqual([...productIds].sort((a, b) => a - b));
    expect(rows.map((row) => row.name)).toEqual(['Абрикос', 'Банан', 'Вишня', 'Манго', 'Яблоко']);
  });

  it('reaches every customer across pages', async () => {
    const seen = new Set((await collect('/customers')).flat().map((row) => row.id));
    expect(customerIds.filter((id) => !seen.has(id))).toEqual([]);
  });
});
