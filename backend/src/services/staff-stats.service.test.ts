import { describe, it, expect, vi } from 'vitest';
import { StaffStatsService, buildStaffMetrics, type StaffStatsGroupRow } from './staff-stats.service.js';

const row = (
  userId: number,
  status: string,
  count: number,
  netAmount: number,
  paidAmount: number,
  returnedAmount = 0,
): StaffStatsGroupRow => ({
  userId,
  status,
  _count: { _all: count },
  _sum: { netAmount, paidAmount, returnedAmount },
});

describe('buildStaffMetrics', () => {
  it('returns zeros for a staff member without invoices', () => {
    const metrics = buildStaffMetrics([]);

    expect(metrics.invoicesCount).toBe(0);
    expect(metrics.soldAmount).toBe(0);
    expect(metrics.paidAmount).toBe(0);
    expect(metrics.debtAmount).toBe(0);
    expect(metrics.averageCheck).toBe(0);
    expect(metrics.collectionRate).toBe(0);
  });

  it('splits counts, sold, paid and debt by payment status', () => {
    const metrics = buildStaffMetrics([
      row(1, 'paid', 3, 300, 300),
      row(1, 'partial', 2, 200, 50, 10),
      row(1, 'unpaid', 1, 100, 0),
    ]);

    expect(metrics.invoicesCount).toBe(6);
    expect(metrics.soldAmount).toBe(600);
    expect(metrics.paidAmount).toBe(350);
    expect(metrics.debtAmount).toBe(250);
    expect(metrics.returnedAmount).toBe(10);
    expect(metrics.averageCheck).toBe(100);
    expect(metrics.collectionRate).toBeCloseTo(350 / 600);
    expect(metrics.byStatus).toEqual({
      paid: { count: 3, amount: 300, paid: 300, debt: 0 },
      partial: { count: 2, amount: 200, paid: 50, debt: 150 },
      unpaid: { count: 1, amount: 100, paid: 0, debt: 100 },
    });
  });

  it('never counts an overpayment (change) as more paid than was sold', () => {
    const metrics = buildStaffMetrics([row(1, 'paid', 1, 100, 120)]);

    expect(metrics.paidAmount).toBe(100);
    expect(metrics.debtAmount).toBe(0);
    expect(metrics.collectionRate).toBe(1);
  });
});

describe('StaffStatsService', () => {
  it('only aggregates non-cancelled invoices within the requested period and warehouse', async () => {
    const groupBy = vi.fn().mockResolvedValue([]);
    const client = {
      invoice: { groupBy },
      user: { findMany: vi.fn().mockResolvedValue([]) },
    };

    await StaffStatsService.getStaffStatsList({ start: '2026-10-01', end: '2026-10-31', warehouseId: 2 }, client as any);

    const where = groupBy.mock.calls[0][0].where;
    expect(where.cancelled).toBe(false);
    expect(where.warehouseId).toBe(2);
    expect(where.createdAt.gte).toEqual(new Date(2026, 9, 1));
    expect(where.createdAt.lte).toEqual(new Date(2026, 9, 31, 23, 59, 59, 999));
  });

  it('lists every staff member (zero sales included), hides customers, sorts by sales', async () => {
    const client = {
      invoice: {
        groupBy: vi.fn().mockResolvedValue([
          row(1, 'paid', 1, 100, 100),
          row(2, 'unpaid', 2, 500, 0),
          row(9, 'paid', 1, 50, 50),
        ]),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([
          { id: 1, username: 'Алишер', role: 'SELLER', active: true, warehouse: null },
          { id: 2, username: 'Фарид', role: 'SELLER', active: true, warehouse: null },
          { id: 3, username: 'Новый', role: 'SELLER', active: true, warehouse: null },
          { id: 4, username: 'Клиент', role: 'CUSTOMER', active: true, warehouse: null },
          { id: 9, username: 'Уволен', role: 'SELLER', active: false, warehouse: null },
        ]),
      },
    };

    const result = await StaffStatsService.getStaffStatsList({}, client as any);

    expect(result.staff.map((s) => s.username)).toEqual(['Фарид', 'Алишер', 'Уволен', 'Новый']);
    expect(result.staff.find((s) => s.id === 3)?.invoicesCount).toBe(0);
    expect(result.totals.soldAmount).toBe(650);
    expect(result.totals.debtAmount).toBe(500);
  });

  it('returns null for an unknown staff member', async () => {
    const client = {
      invoice: { groupBy: vi.fn(), findMany: vi.fn() },
      user: { findUnique: vi.fn().mockResolvedValue(null) },
    };

    const summary = await StaffStatsService.getStaffSummary(42, {}, { includeProfit: true }, client as any);

    expect(summary).toBeNull();
    expect(client.invoice.groupBy).not.toHaveBeenCalled();
  });

  it('scopes the summary to the user and includes profit only when requested', async () => {
    const groupBy = vi.fn().mockResolvedValue([{ status: 'partial', _count: { _all: 1 }, _sum: { netAmount: 100, paidAmount: 40, returnedAmount: 0 } }]);
    const findMany = vi.fn().mockResolvedValue([
      {
        netAmount: 100,
        items: [{ quantity: 2, returnedQty: 0, sellingPrice: 50, costPrice: 30, saleAllocations: [] }],
      },
    ]);
    const client = {
      invoice: { groupBy, findMany },
      user: { findUnique: vi.fn().mockResolvedValue({ id: 5, username: 'Алишер', role: 'SELLER', active: true, warehouse: null }) },
    };

    const withProfit = await StaffStatsService.getStaffSummary(5, {}, { includeProfit: true }, client as any);
    expect(groupBy.mock.calls[0][0].where.userId).toBe(5);
    expect(withProfit?.debtAmount).toBe(60);
    expect(withProfit?.profit).toBe(40);

    const withoutProfit = await StaffStatsService.getStaffSummary(5, {}, { includeProfit: false }, client as any);
    expect(withoutProfit).not.toHaveProperty('profit');
    expect(findMany).toHaveBeenCalledTimes(1);
  });
});
