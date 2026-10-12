import { describe, expect, it } from 'vitest';
import { calculateDocument, calculatePayments, getCurrencyDigits } from '../calculations/documentTotals';

const line = (overrides = {}) => ({
  id: 'line-1', name: 'Service', quantity: 1, unitPrice: 100,
  discount: { mode: 'none', value: 0 }, taxTreatment: 'taxable', taxLabel: 'VAT', taxRate: 10,
  ...overrides,
});

describe('calculateDocument', () => {
  it('calculates tax-exclusive line totals', () => {
    const result = calculateDocument({ currency: 'USD', taxMode: 'exclusive', lines: [line({ quantity: 2, unitPrice: 50 })] });
    expect(result.subtotal).toBe(100);
    expect(result.taxTotal).toBe(10);
    expect(result.total).toBe(110);
    expect(result.lines[0].total).toBe(100);
  });

  it('applies line and document discounts before tax', () => {
    const result = calculateDocument({ currency: 'USD', taxMode: 'exclusive', lines: [line({ discount: { mode: 'percent', value: 10 }, taxRate: 15 })], documentDiscount: { mode: 'fixed', value: 5 } });
    expect(result.subtotal).toBe(100);
    expect(result.lineDiscountTotal).toBe(10);
    expect(result.lines[0].total).toBe(90);
    expect(result.documentDiscount).toBe(5);
    expect(result.taxTotal).toBe(12.75);
    expect(result.total).toBe(97.75);
  });

  it('supports different tax rates and treatment labels', () => {
    const result = calculateDocument({ currency: 'USD', taxMode: 'exclusive', lines: [line({ id: 'a', taxRate: 10 }), line({ id: 'b', unitPrice: 100, taxRate: 5, taxLabel: 'Sales tax' }), line({ id: 'c', unitPrice: 50, taxRate: 0, taxTreatment: 'exempt', taxLabel: 'Exempt' })] });
    expect(result.total).toBe(265);
    expect(result.taxTotal).toBe(15);
    expect(result.taxBreakdown).toHaveLength(3);
    expect(result.taxBreakdown.reduce((sum, row) => sum + row.amount, 0)).toBe(result.taxTotal);
  });

  it('extracts tax from tax-inclusive prices without adding it twice', () => {
    const result = calculateDocument({ currency: 'USD', taxMode: 'inclusive', lines: [line({ unitPrice: 110, taxRate: 10 })] });
    expect(result.total).toBe(110);
    expect(result.taxTotal).toBe(10);
    expect(result.lines[0].taxAmount).toBe(10);
    expect(result.lines[0].total).toBe(110);
  });

  it('does not double-count tax on additional charges', () => {
    const result = calculateDocument({ currency: 'USD', taxMode: 'exclusive', lines: [line()], additionalCharges: [{ id: 'ship', label: 'Delivery', amount: 10, taxable: true, taxRate: 10, taxLabel: 'VAT' }] });
    expect(result.taxTotal).toBe(11);
    expect(result.chargeTotal).toBe(11);
    expect(result.total).toBe(121);
  });

  it('handles fractional quantities and invalid numeric input safely', () => {
    const result = calculateDocument({ currency: 'USD', lines: [line({ quantity: 1.25, unitPrice: 80 }), line({ id: 'b', quantity: 'not-a-number', unitPrice: Infinity })] });
    expect(result.subtotal).toBe(100);
    expect(result.total).toBe(110);
    expect(Number.isFinite(result.total)).toBe(true);
  });

  it('uses currency-aware precision', () => {
    expect(getCurrencyDigits('JPY')).toBe(0);
    const result = calculateDocument({ currency: 'JPY', taxMode: 'exclusive', lines: [line({ quantity: 1, unitPrice: 100.4, taxRate: 10 })] });
    expect(result.subtotal).toBe(100);
    expect(result.total).toBe(110);
  });
});

describe('calculatePayments', () => {
  it('updates balances from recorded payments and linked credits', () => {
    const result = calculatePayments([{ amount: 20 }, { amount: 30 }, { amount: 500, status: 'void' }], 100, 10, 2);
    expect(result.paid).toBe(50);
    expect(result.credits).toBe(10);
    expect(result.balance).toBe(40);
    expect(result.overpayment).toBe(0);
  });

  it('flags an explicitly recorded overpayment', () => {
    const result = calculatePayments([{ amount: 120 }], 100, 0, 2);
    expect(result.balance).toBe(-20);
    expect(result.overpayment).toBe(20);
  });
});
