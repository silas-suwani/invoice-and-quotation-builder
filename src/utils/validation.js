import { calculateDocument } from '../calculations/documentTotals.js';

/** Validate numeric fields before a document is committed to IndexedDB. Incomplete
 * drafts are fine; invalid or internally inconsistent monetary inputs are not. */
export function validateDocumentNumbers(document) {
  const errors = [];
  const lines = Array.isArray(document?.lines) ? document.lines : [];

  lines.forEach((line, index) => {
    const row = index + 1;
    if (line.quantity === '' || !Number.isFinite(Number(line.quantity)) || Number(line.quantity) < 0) {
      errors.push(`Line ${row}: quantity must be a valid non-negative number.`);
    }
    if (line.unitPrice === '' || !Number.isFinite(Number(line.unitPrice)) || Number(line.unitPrice) < 0) {
      errors.push(`Line ${row}: unit price must be a valid non-negative number.`);
    }
    if (line.taxTreatment === 'taxable' && (line.taxRate === '' || !Number.isFinite(Number(line.taxRate)) || Number(line.taxRate) < 0 || Number(line.taxRate) > 100)) {
      errors.push(`Line ${row}: tax rate must be between 0 and 100.`);
    }
    const discount = line.discount || { mode: 'none', value: 0 };
    if (discount.mode !== 'none') {
      if (discount.value === '' || !Number.isFinite(Number(discount.value)) || Number(discount.value) < 0) {
        errors.push(`Line ${row}: discount must be a valid non-negative amount.`);
      } else if (discount.mode === 'percent' && Number(discount.value) > 100) {
        errors.push(`Line ${row}: percentage discount cannot exceed 100%.`);
      } else if (discount.mode === 'fixed' && Number(discount.value) > Math.max(0, Number(line.quantity) * Number(line.unitPrice))) {
        errors.push(`Line ${row}: fixed discount cannot exceed its gross amount.`);
      }
    }
  });

  const discount = document?.documentDiscount || { mode: 'none', value: 0 };
  if (discount.mode !== 'none') {
    if (discount.value === '' || !Number.isFinite(Number(discount.value)) || Number(discount.value) < 0) {
      errors.push('Document discount must be a valid non-negative amount.');
    } else if (discount.mode === 'percent' && Number(discount.value) > 100) {
      errors.push('A document percentage discount cannot exceed 100%.');
    } else if (discount.mode === 'fixed') {
      const totals = calculateDocument(document);
      if (Number(discount.value) > totals.lineNetSubtotal) errors.push('The fixed document discount cannot exceed the subtotal after line discounts.');
    }
  }

  (Array.isArray(document?.additionalCharges) ? document.additionalCharges : []).forEach((charge, index) => {
    if (charge.amount === '' || !Number.isFinite(Number(charge.amount)) || Number(charge.amount) < 0) {
      errors.push(`Additional charge ${index + 1}: amount must be a valid non-negative number.`);
    }
    if (charge.taxable && (charge.taxRate === '' || !Number.isFinite(Number(charge.taxRate)) || Number(charge.taxRate) < 0 || Number(charge.taxRate) > 100)) {
      errors.push(`Additional charge ${index + 1}: tax rate must be between 0 and 100.`);
    }
  });

  if (document?.type === 'receipt' && (document.amountReceived === '' || !Number.isFinite(Number(document.amountReceived)) || Number(document.amountReceived) < 0)) {
    errors.push('The receipt amount must be a valid non-negative number.');
  }
  return errors;
}
