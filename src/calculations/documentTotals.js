export function roundMoney(value, digits = 2) {
  const factor = 10 ** digits;
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round((number + Number.EPSILON) * factor) / factor;
}

export function getCurrencyDigits(currency = 'USD', locale = 'en-US') {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
  } catch {
    return 2;
  }
}

function safeNumber(value, fallback = 0) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function discountAmount(base, discount, digits) {
  if (!discount || discount.mode === 'none') return 0;
  const value = Math.max(0, safeNumber(discount.value));
  const amount = discount.mode === 'fixed' ? value : base * Math.min(value, 100) / 100;
  return roundMoney(Math.min(base, amount), digits);
}

/**
 * Calculate a document using one consistent order:
 * 1. Apply line discounts to quantity × unit price.
 * 2. Allocate the document discount proportionally across discounted line values.
 * 3. Apply/extract tax on each adjusted line according to the document tax mode.
 * 4. Apply configurable additional charges, taxing each only when enabled.
 * Monetary results are rounded using the selected currency's precision.
 */
export function calculateDocument(document = {}, currencyDigits) {
  const digits = Number.isInteger(currencyDigits) ? currencyDigits : getCurrencyDigits(document.currency || 'USD');
  const taxMode = document.taxMode === 'inclusive' ? 'inclusive' : 'exclusive';
  const lines = Array.isArray(document.lines) ? document.lines : [];
  const calculatedLines = lines.map((line) => {
    const quantity = Math.max(0, safeNumber(line.quantity));
    const unitPrice = Math.max(0, safeNumber(line.unitPrice));
    const gross = roundMoney(quantity * unitPrice, digits);
    const discount = discountAmount(gross, line.discount || { mode: 'none', value: 0 }, digits);
    const net = roundMoney(Math.max(0, gross - discount), digits);
    return {
      ...line,
      quantity,
      unitPrice,
      gross,
      lineDiscount: discount,
      net,
      taxRate: Math.max(0, Math.min(100, safeNumber(line.taxRate))),
      taxTreatment: line.taxTreatment || (safeNumber(line.taxRate) > 0 ? 'taxable' : 'zero'),
    };
  });

  const grossSubtotal = roundMoney(calculatedLines.reduce((sum, line) => sum + line.gross, 0), digits);
  const lineNetSubtotal = roundMoney(calculatedLines.reduce((sum, line) => sum + line.net, 0), digits);
  const docDiscount = discountAmount(lineNetSubtotal, document.documentDiscount || { mode: 'none', value: 0 }, digits);
  const discountFactor = lineNetSubtotal > 0 ? Math.max(0, (lineNetSubtotal - docDiscount) / lineNetSubtotal) : 0;
  const taxMap = new Map();
  let lineTaxTotal = 0;
  let chargeTaxTotal = 0;
  let taxableBase = 0;
  const linesWithTax = calculatedLines.map((line) => {
    const allocatedDiscount = roundMoney(line.net * (1 - discountFactor), digits);
    const afterDiscount = roundMoney(Math.max(0, line.net - allocatedDiscount), digits);
    const rate = line.taxTreatment === 'taxable' ? line.taxRate : 0;
    const tax = rate > 0
      ? roundMoney(taxMode === 'inclusive' ? afterDiscount * rate / (100 + rate) : afterDiscount * rate / 100, digits)
      : 0;
    const base = taxMode === 'inclusive' ? roundMoney(afterDiscount - tax, digits) : afterDiscount;
    lineTaxTotal = roundMoney(lineTaxTotal + tax, digits);
    taxableBase = roundMoney(taxableBase + base, digits);
    if (line.taxTreatment === 'exempt' || line.taxTreatment === 'zero') {
      const label = line.taxLabel || (line.taxTreatment === 'exempt' ? 'Exempt' : 'Zero rated');
      const key = `${label}|${line.taxTreatment}|0`;
      const row = taxMap.get(key) || { label, treatment: line.taxTreatment, rate: 0, taxableAmount: 0, amount: 0 };
      row.taxableAmount = roundMoney(row.taxableAmount + afterDiscount, digits);
      taxMap.set(key, row);
    } else {
      const label = line.taxLabel || (rate > 0 ? 'Tax' : 'Zero rated');
      const key = `${label}|${line.taxTreatment}|${rate}`;
      const row = taxMap.get(key) || { label, treatment: line.taxTreatment, rate, taxableAmount: 0, amount: 0 };
      row.taxableAmount = roundMoney(row.taxableAmount + base, digits);
      row.amount = roundMoney(row.amount + tax, digits);
      taxMap.set(key, row);
    }
    return { ...line, allocatedDocumentDiscount: allocatedDiscount, taxableAmount: base, taxAmount: tax, total: line.net };
  });

  const charges = Array.isArray(document.additionalCharges) ? document.additionalCharges : [];
  const calculatedCharges = charges.map((charge) => {
    const amount = Math.max(0, roundMoney(safeNumber(charge.amount), digits));
    const isTaxable = Boolean(charge.taxable) && (charge.taxTreatment || 'taxable') === 'taxable';
    const rate = isTaxable ? Math.max(0, Math.min(100, safeNumber(charge.taxRate))) : 0;
    const tax = rate > 0 ? roundMoney(taxMode === 'inclusive' ? amount * rate / (100 + rate) : amount * rate / 100, digits) : 0;
    const taxBase = taxMode === 'inclusive' ? roundMoney(amount - tax, digits) : amount;
    if (rate > 0 || charge.taxTreatment === 'exempt' || charge.taxTreatment === 'zero') {
      const treatment = rate > 0 ? 'taxable' : (charge.taxTreatment || 'zero');
      const label = charge.taxLabel || (treatment === 'exempt' ? 'Exempt' : treatment === 'zero' ? 'Zero rated' : 'Tax');
      const key = `${label}|${treatment}|${rate}`;
      const row = taxMap.get(key) || { label, treatment, rate, taxableAmount: 0, amount: 0 };
      row.taxableAmount = roundMoney(row.taxableAmount + taxBase, digits);
      row.amount = roundMoney(row.amount + tax, digits);
      taxMap.set(key, row);
    }
    chargeTaxTotal = roundMoney(chargeTaxTotal + tax, digits);
    taxableBase = roundMoney(taxableBase + taxBase, digits);
    return { ...charge, amount, taxAmount: tax, total: taxMode === 'inclusive' ? amount : roundMoney(amount + tax, digits) };
  });

  const chargeTotal = roundMoney(calculatedCharges.reduce((sum, charge) => sum + charge.total, 0), digits);
  const taxTotal = roundMoney(lineTaxTotal + chargeTaxTotal, digits);
  const lineBaseAfterDiscount = roundMoney(lineNetSubtotal - docDiscount, digits);
  const total = roundMoney(
    taxMode === 'inclusive'
      ? lineBaseAfterDiscount + chargeTotal
      : lineBaseAfterDiscount + lineTaxTotal + chargeTotal,
    digits,
  );

  // Keep tax breakdown reconciled to the exact displayed total after per-line rounding.
  const taxBreakdown = [...taxMap.values()].map((row) => ({ ...row, taxableAmount: roundMoney(row.taxableAmount, digits), amount: roundMoney(row.amount, digits) }));
  const breakdownSum = roundMoney(taxBreakdown.reduce((sum, row) => sum + row.amount, 0), digits);
  const reconciliation = roundMoney(taxTotal - breakdownSum, digits);
  if (reconciliation !== 0 && taxBreakdown.length) taxBreakdown[taxBreakdown.length - 1].amount = roundMoney(taxBreakdown[taxBreakdown.length - 1].amount + reconciliation, digits);

  return {
    currencyDigits: digits,
    taxMode,
    lines: linesWithTax,
    charges: calculatedCharges,
    subtotal: grossSubtotal,
    lineNetSubtotal,
    lineDiscountTotal: roundMoney(calculatedLines.reduce((sum, line) => sum + line.lineDiscount, 0), digits),
    documentDiscount: docDiscount,
    taxableBase: roundMoney(taxableBase, digits),
    taxTotal,
    taxBreakdown,
    chargeTotal,
    total,
  };
}

export function calculatePayments(payments = [], invoiceTotal = 0, credits = 0, currencyDigits = 2) {
  const validPayments = payments.filter((payment) => payment && payment.status !== 'void' && Number.isFinite(Number(payment.amount)) && Number(payment.amount) >= 0);
  const paid = roundMoney(validPayments.reduce((sum, payment) => sum + Number(payment.amount), 0), currencyDigits);
  const credit = roundMoney(Math.max(0, safeNumber(credits)), currencyDigits);
  const balance = roundMoney(Number(invoiceTotal || 0) - paid - credit, currencyDigits);
  return { paid, credits: credit, balance, overpayment: Math.max(0, roundMoney(-balance, currencyDigits)), payments: validPayments };
}
