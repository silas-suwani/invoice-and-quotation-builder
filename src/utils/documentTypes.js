import { calculateDocument } from '../calculations/documentTotals.js';

export const DOCUMENT_TYPES = {
  invoice: { label: 'Invoice', plural: 'Invoices', prefix: 'INV', statuses: ['Draft', 'Issued', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled'] },
  quotation: { label: 'Quotation', plural: 'Quotations', prefix: 'QUO', statuses: ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired', 'Converted to Invoice'] },
  estimate: { label: 'Estimate', plural: 'Estimates', prefix: 'EST', statuses: ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired', 'Converted to Invoice'] },
  receipt: { label: 'Receipt', plural: 'Receipts', prefix: 'REC', statuses: ['Recorded', 'Cancelled'] },
  proforma: { label: 'Pro forma invoice', plural: 'Pro forma Invoices', prefix: 'PI', statuses: ['Draft', 'Issued', 'Cancelled'] },
  creditnote: { label: 'Credit note', plural: 'Credit Notes', prefix: 'CN', statuses: ['Draft', 'Issued', 'Cancelled'] },
};

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { id: 'create', label: 'Create document', icon: 'PlusCircle' },
  { id: 'invoices', label: 'Invoices', icon: 'FileText', type: 'invoice' },
  { id: 'quotations', label: 'Quotations', icon: 'FileCheck', type: 'quotation' },
  { id: 'estimates', label: 'Estimates', icon: 'ClipboardList', type: 'estimate' },
  { id: 'receipts', label: 'Receipts', icon: 'Receipt', type: 'receipt' },
  { id: 'proforma', label: 'Pro forma invoices', icon: 'FileSpreadsheet', type: 'proforma' },
  { id: 'creditnotes', label: 'Credit notes', icon: 'FileMinus', type: 'creditnote' },
  { id: 'customers', label: 'Customers', icon: 'Users' },
  { id: 'products', label: 'Products & services', icon: 'Package' },
  { id: 'business', label: 'Business profile', icon: 'Building2' },
  { id: 'templates', label: 'Document templates', icon: 'PanelsTopLeft' },
  { id: 'settings', label: 'Settings', icon: 'Settings' },
  { id: 'help', label: 'Help & about', icon: 'CircleHelp' },
];

export const DEFAULT_NUMBERING = Object.fromEntries(Object.entries(DOCUMENT_TYPES).map(([type, meta]) => [type, { prefix: meta.prefix, includeYear: true, startAt: 1, digits: 4 }]));

export function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function addDaysISO(dateString, days) {
  const date = new Date(`${dateString || todayISO()}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function createEmptyLine(profile = {}) {
  return {
    id: crypto.randomUUID(), itemId: '', name: '', description: '', quantity: 1, unit: 'Each', unitPrice: 0,
    discount: { mode: 'none', value: 0 }, taxTreatment: profile.defaultTaxRate > 0 ? 'taxable' : 'zero',
    taxLabel: profile.defaultTaxLabel || 'VAT', taxRate: Number(profile.defaultTaxRate || 0),
  };
}

export function createEmptyDocument(type = 'invoice', profile = {}, settings = {}, number = '') {
  const today = todayISO();
  const validDays = Number(settings.defaultQuotationValidity || 30);
  const dueDays = Number(settings.defaultDueDays || 14);
  return {
    id: crypto.randomUUID(), type, number, status: 'Draft', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    businessProfileId: profile.id || '', business: structuredCloneSafe(profile), customerId: '', customer: {},
    issueDate: today, dueDate: type === 'invoice' ? addDaysISO(today, dueDays) : '', validUntil: ['quotation', 'estimate', 'proforma'].includes(type) ? addDaysISO(today, validDays) : '',
    currency: profile.currency || 'USD', taxMode: profile.taxMode || 'exclusive', paperSize: settings.paperSize || 'a4', lines: [createEmptyLine(profile)],
    documentDiscount: { mode: 'none', value: 0 }, additionalCharges: [], paymentInstructions: profile.paymentInstructions || '',
    paymentTerms: profile.paymentTerms || '', terms: profile.defaultTerms || '', notes: type === 'invoice' ? (profile.defaultInvoiceNotes || '') : '',
    intro: '', scopeOfWork: '', deliveryDetails: '', estimatedCompletionDate: '', thankYouMessage: '', footer: '',
    paymentMethod: 'Bank Transfer', paymentReference: '', paymentDate: today, amountReceived: 0, relatedInvoiceId: '', originalInvoiceNumber: '',
    creditReason: '', projectDescription: '', template: settings.defaultTemplate || 'classic',
    appearance: { accentColor: profile.accentColor || '#4F46E5', fontFamily: 'Inter', fontSize: 10, logoPosition: 'left', logoSize: 'medium', logoWidth: 160, logoMaxHeight: 72, logoFit: 'contain', logoBackground: 'transparent', logoSpacing: 8, showLogo: true, showPaymentDetails: true, showTaxDetails: true, showNotes: true, showTerms: true, showFooter: true, compactTable: false },
    additionalData: {}, convertedFromId: '', relatedCreditNoteIds: [],
  };
}

export function structuredCloneSafe(value) {
  if (!value) return {};
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

export function getDocumentStatus(document, payments = [], credits = 0, referenceDate = todayISO()) {
  if (!document) return 'Draft';
  if (document.status === 'Cancelled') return 'Cancelled';
  if (document.type === 'invoice') {
    if (document.status === 'Draft') return 'Draft';
    const paymentTotal = payments.filter((p) => p.status !== 'void').reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const total = Number(document.calculated?.total ?? document.total ?? calculateDocument(document).total ?? 0);
    const balance = total - paymentTotal - Number(credits || 0);
    if (balance <= 0.00001) return 'Paid';
    if (document.dueDate && document.dueDate < referenceDate) return 'Overdue';
    if (paymentTotal > 0 || credits > 0) return 'Partially Paid';
    return 'Issued';
  }
  if (['quotation', 'estimate'].includes(document.type)) {
    if (['Accepted', 'Rejected', 'Converted to Invoice'].includes(document.status)) return document.status;
    if (document.validUntil && document.validUntil < referenceDate && ['Draft', 'Sent'].includes(document.status)) return 'Expired';
  }
  return document.status || 'Draft';
}


export function reserveDocumentNumber(type, profileId, settings = {}, documents = []) {
  const config = settings?.numbering?.[type] || DEFAULT_NUMBERING[type] || { prefix: type.toUpperCase().slice(0, 3), includeYear: true, startAt: 1, digits: 4 };
  const year = new Date().getFullYear();
  const prefix = `${config.prefix || type.toUpperCase().slice(0, 3)}${config.includeYear ? `-${year}` : ''}-`;
  const existing = documents.filter((doc) => doc.type === type && doc.businessProfileId === profileId).map((doc) => String(doc.number || ''));
  const matching = existing.filter((number) => number.startsWith(prefix)).map((number) => Number(number.slice(prefix.length))).filter(Number.isFinite);
  const nextNumber = Math.max(Number(config.startAt || 1) - 1, ...matching) + 1;
  return `${prefix}${String(nextNumber).padStart(Math.max(1, Math.min(10, Number(config.digits) || 4)), '0')}`;
}

export function sanitizeFilename(value) {
  const safe = String(value || 'document').normalize('NFKD').replace(/[\\/:*?"<>|\u0000-\u001F]/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return safe.slice(0, 120) || 'document';
}
