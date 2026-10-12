import { describe, expect, it } from 'vitest';
import { validateDocumentNumbers } from '../utils/validation';

const base = () => ({
  type: 'invoice', status: 'Draft', currency: 'USD', taxMode: 'exclusive',
  lines: [{ quantity: 1, unitPrice: 100, taxTreatment: 'taxable', taxRate: 10, discount: { mode: 'none', value: 0 } }],
  documentDiscount: { mode: 'none', value: 0 }, additionalCharges: [],
});

describe('validateDocumentNumbers', () => {
  it('accepts valid and incomplete draft documents', () => {
    expect(validateDocumentNumbers(base())).toEqual([]);
  });

  it('rejects invalid quantities and unit prices', () => {
    const doc = base();
    doc.lines[0].quantity = '';
    doc.lines[0].unitPrice = -1;
    expect(validateDocumentNumbers(doc)).toHaveLength(2);
  });

  it('rejects discounts that exceed the available base', () => {
    const doc = base();
    doc.lines[0].discount = { mode: 'fixed', value: 101 };
    expect(validateDocumentNumbers(doc).some((message) => message.includes('fixed discount cannot exceed'))).toBe(true);
    doc.lines[0].discount = { mode: 'none', value: 0 };
    doc.documentDiscount = { mode: 'fixed', value: 101 };
    expect(validateDocumentNumbers(doc).some((message) => message.includes('fixed document discount cannot exceed'))).toBe(true);
  });

  it('rejects invalid tax values and charge amounts', () => {
    const doc = base();
    doc.lines[0].taxRate = 101;
    doc.additionalCharges = [{ label: 'Delivery', amount: '', taxable: false }];
    expect(validateDocumentNumbers(doc).some((message) => message.includes('tax rate'))).toBe(true);
    expect(validateDocumentNumbers(doc).some((message) => message.includes('charge 1: amount'))).toBe(true);
  });
});
