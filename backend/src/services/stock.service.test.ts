import { describe, it, expect, vi } from 'vitest';
import { StockService } from './stock.service.js';

describe('StockService', () => {
  it('should reject allocation if quantity is 0 or negative', async () => {
    await expect(StockService.allocateStock(1, 1, 0, 10)).rejects.toThrow(
      'Количество для списания должно быть больше 0'
    );
    await expect(StockService.allocateStock(1, 1, -5, 10)).rejects.toThrow(
      'Количество для списания должно быть больше 0'
    );
  });

  it('should throw error when available stock is insufficient', async () => {
    const mockClient = {
      productBatch: {
        findMany: vi.fn().mockResolvedValue([
          { id: 101, remainingQuantity: 3, costPrice: 100 },
        ]),
      },
    };

    await expect(
      StockService.allocateStock(1, 1, 10, 1, mockClient as any)
    ).rejects.toThrow('Недостаточно товара на складе');
  });

  it('should allocate stock FIFO from multiple batches correctly', async () => {
    const batches = [
      { id: 1, remainingQuantity: 5, costPrice: 10 },
      { id: 2, remainingQuantity: 10, costPrice: 12 },
    ];

    const mockClient = {
      productBatch: {
        findMany: vi.fn().mockResolvedValue(batches),
        update: vi.fn().mockResolvedValue({}),
        aggregate: vi.fn().mockResolvedValue({ _sum: { remainingQuantity: 8 } }),
      },
      saleAllocation: {
        create: vi.fn().mockResolvedValue({}),
      },
      product: {
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    // Allocate 7 units (5 from batch 1 @ 10, 2 from batch 2 @ 12)
    // Total cost = (5*10 + 2*12) = 74 / 7 = 10.57
    const avgCost = await StockService.allocateStock(1, 1, 7, 99, mockClient as any);

    expect(avgCost).toBe(10.57);
    expect(mockClient.productBatch.update).toHaveBeenCalledTimes(2);
    expect(mockClient.saleAllocation.create).toHaveBeenCalledTimes(2);
  });

  it('should detect correction write off reason correctly', () => {
    expect(StockService.isCorrectionWriteOffReason('Корректировка остатка')).toBe(true);
    expect(StockService.isCorrectionWriteOffReason('корректировка')).toBe(true);
    expect(StockService.isCorrectionWriteOffReason('Продажа по чеку')).toBe(false);
  });
});
