import { describe, expect, it } from 'vitest';
import { DEFAULT_NUMBERING, getDocumentStatus, reserveDocumentNumber, sanitizeFilename, todayISO } from '../utils/documentTypes';

describe('document numbering and status', () => {
  it('generates the next local sequence number per profile and type', async () => {
    const year = new Date().getFullYear();
    const settings = { numbering: DEFAULT_NUMBERING };
    const docs = [{ type: 'invoice', businessProfileId: 'business-a', number: `INV-${year}-0001` }, { type: 'invoice', businessProfileId: 'business-b', number: `INV-${year}-0008` }];
    expect(reserveDocumentNumber('invoice', 'business-a', settings, docs)).toBe(`INV-${year}-0002`);
    expect(reserveDocumentNumber('invoice', 'business-b', settings, docs)).toBe(`INV-${year}-0009`);
  });

  it('sanitizes filenames for download use', () => {
    expect(sanitizeFilename('INV:001 / Company Ltd?')).toBe('INV-001-Company-Ltd');
    expect(sanitizeFilename('')).toBe('document');
  });

  it('derives invoice status from payments and due date', () => {
    const base = { type: 'invoice', status: 'Issued', currency: 'USD', lines: [{ quantity: 1, unitPrice: 100, taxRate: 0, taxTreatment: 'zero' }], taxMode: 'exclusive', dueDate: '2020-01-01' };
    expect(getDocumentStatus(base, [], 0, todayISO())).toBe('Overdue');
    expect(getDocumentStatus(base, [{ amount: 100 }], 0, todayISO())).toBe('Paid');
    expect(getDocumentStatus(base, [{ amount: 10 }], 0, todayISO())).toBe('Overdue');
    expect(getDocumentStatus({ ...base, status: 'Draft' }, [], 0, todayISO())).toBe('Draft');
  });
});

it('expires draft and sent quotations without overwriting accepted quotations', () => {
  const expired = { type: 'quotation', status: 'Draft', validUntil: '2020-01-01' };
  expect(getDocumentStatus(expired, [], 0, todayISO())).toBe('Expired');
  expect(getDocumentStatus({ ...expired, status: 'Sent' }, [], 0, todayISO())).toBe('Expired');
  expect(getDocumentStatus({ ...expired, status: 'Accepted' }, [], 0, todayISO())).toBe('Accepted');
});
