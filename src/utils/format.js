export function formatCurrency(value, currency = 'USD', locale = 'en-US', digits) {
  try {
    const options = { style: 'currency', currency, maximumFractionDigits: Number.isInteger(digits) ? digits : undefined };
    return new Intl.NumberFormat(locale || 'en-US', options).format(Number.isFinite(Number(value)) ? Number(value) : 0);
  } catch {
    return `${currency || 'USD'} ${(Number(value) || 0).toFixed(2)}`;
  }
}

export function formatDate(value, locale = 'en-GB') {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export function shortDate(value) {
  if (!value) return '—';
  return String(value).slice(0, 10);
}

export function titleCase(value = '') {
  return String(value).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}
