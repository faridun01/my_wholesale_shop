import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { getInvoiceLineRevenues } from './reports.helpers.js';

describe('batch revenue calculation and native runtime', () => {
  it('conserves discounted cents across returned, free and remaining lines', () => {
    const invoice = { netAmount: '.09', discount: '10', items: [
      { quantity: 3, returnedQty: 1, totalPrice: '.15', sellingPrice: '.05', eligibleNetAmount: '.13' },
      { quantity: 1, returnedQty: 1, totalPrice: '1', sellingPrice: '1', eligibleNetAmount: '.9' },
      { quantity: 1, returnedQty: 0, totalPrice: '0', sellingPrice: '0', eligibleNetAmount: '0' },
    ] };
    expect(getInvoiceLineRevenues(invoice)).toEqual([.09, 0, 0]);
    invoice.items[0].returnedQty = 3; invoice.netAmount = '0';
    expect(getInvoiceLineRevenues(invoice)).toEqual([0, 0, 0]);
  });
  it('keeps stable tie allocation without stale cached invoice totals', () => {
    const invoice = { netAmount: '.05', items: [1,2,3].map(id => ({ id, quantity: 1, sellingPrice: '.02', totalPrice: '.02' })) };
    expect(getInvoiceLineRevenues(invoice)).toEqual([.02, .02, .01]);
    invoice.netAmount = '.04';
    expect(getInvoiceLineRevenues(invoice)).toEqual([.02, .01, .01]);
  });
  it('loads Decimal with native Node ESM outside the Vitest module transformer', () => {
    const url = pathToFileURL(resolve('src/utils/financial.ts')).href;
    const output = execFileSync(process.execPath, ['--import', pathToFileURL(resolve('node_modules/tsx/dist/loader.mjs')).href, '--input-type=module', '-e', `const { decimal } = await import(${JSON.stringify(url)}); process.stdout.write(decimal('0.1').plus('0.2').toString());`], { encoding: 'utf8', timeout: 15000 });
    expect(output).toBe('0.3');
  });
});
