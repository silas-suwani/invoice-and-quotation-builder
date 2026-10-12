import React from 'react';
import { calculateDocument, calculatePayments } from '../calculations/documentTotals';
import { DOCUMENT_TYPES, createEmptyLine, getDocumentStatus } from '../utils/documentTypes';
import { formatCurrency, formatDate } from '../utils/format';
import { validateDocumentNumbers } from '../utils/validation';
import DocumentPreview from './DocumentPreview';
import LogoUploader from './LogoUploader';
import { Button, Field, Icon, Panel, SectionTitle, inputClass, selectClass, textareaClass, StatusBadge } from './common';

function setAtPath(source, path, value) {
  const parts = path.split('.');
  const result = { ...source };
  let cursor = result;
  let oldCursor = source;
  parts.slice(0, -1).forEach((part) => {
    cursor[part] = { ...(oldCursor?.[part] || {}) };
    cursor = cursor[part]; oldCursor = oldCursor?.[part];
  });
  cursor[parts[parts.length - 1]] = value;
  return result;
}

function FormSection({ title, description, children, defaultOpen = false }) {
  return <details open={defaultOpen} className="group rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
    <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:px-5 [&::-webkit-details-marker]:hidden"><div><span className="text-sm font-bold text-slate-900 dark:text-white">{title}</span>{description && <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>}</div><Icon name="ChevronDown" size={17} className="mt-0.5 shrink-0 text-slate-400 transition group-open:rotate-180" /></summary>
    <div className="border-t border-slate-100 px-4 py-4 dark:border-slate-800 sm:px-5">{children}</div>
  </details>;
}

function LineItemCard({ line, index, total, products, onUpdate, onRemove, onDuplicate, onMove }) {
  const update = (key, value) => onUpdate(line.id, key, value);
  function selectProduct(id) {
    const product = products.find((item) => item.id === id);
    if (!product) { update('itemId', ''); return; }
    onUpdate(line.id, '__all', {
      itemId: product.id, name: product.name || '', description: product.description || '', unit: product.unit || 'Each',
      unitPrice: Number(product.unitPrice || 0), taxRate: Number(product.taxRate || 0), taxLabel: product.taxLabel || 'VAT',
      taxTreatment: product.taxTreatment || (Number(product.taxRate) > 0 ? 'taxable' : 'zero'),
      discount: product.defaultDiscount ? { mode: 'percent', value: Number(product.defaultDiscount) } : { mode: 'none', value: 0 },
    });
  }
  return <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-700 sm:p-4">
    <div className="mb-3 flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500 dark:bg-slate-800">{index + 1}</span><span className="truncate text-xs font-bold text-slate-700 dark:text-slate-200">Line item</span></div><div className="flex items-center gap-1"><button type="button" title="Move line up" aria-label="Move line up" disabled={index === 0} onClick={() => onMove(index, index - 1)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"><Icon name="ArrowUp" size={14} /></button><button type="button" title="Move line down" aria-label="Move line down" disabled={index === total - 1} onClick={() => onMove(index, index + 1)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"><Icon name="ArrowDown" size={14} /></button><button type="button" title="Duplicate line" aria-label="Duplicate line" onClick={() => onDuplicate(line.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><Icon name="Copy" size={14} /></button><button type="button" title="Remove line" aria-label="Remove line" onClick={() => onRemove(line.id)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"><Icon name="Trash2" size={14} /></button></div></div>
    <div className="grid gap-3 sm:grid-cols-2">
      {products.length > 0 && <Field label="Add from catalogue"><select className={selectClass} value={line.itemId || ''} onChange={(event) => selectProduct(event.target.value)}><option value="">Custom line item</option>{products.filter((p) => p.active !== false).map((product) => <option key={product.id} value={product.id}>{product.name} · {product.unitPrice}</option>)}</select></Field>}
      <Field label="Item / service name" className={products.length ? '' : 'sm:col-span-2'}><input className={inputClass} value={line.name || ''} onChange={(event) => update('name', event.target.value)} placeholder="e.g. Website development" /></Field>
      <Field label="Description" className="sm:col-span-2"><textarea className={`${textareaClass} min-h-[60px]`} rows="2" value={line.description || ''} onChange={(event) => update('description', event.target.value)} placeholder="Optional details about this item" /></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="Quantity"><input type="number" min="0" step="0.001" className={inputClass} value={line.quantity ?? 1} onChange={(event) => update('quantity', event.target.value === '' ? '' : Math.max(0, Number(event.target.value)))} /></Field><Field label="Unit"><select className={selectClass} value={line.unit || 'Each'} onChange={(event) => update('unit', event.target.value)}>{['Each', 'Hour', 'Day', 'Week', 'Month', 'Kilometre', 'Kilogram', 'Metre', 'Square metre', 'Service', 'Custom'].map((unit) => <option key={unit}>{unit}</option>)}</select></Field></div>
      <Field label="Unit price"><div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{line.currencySymbol || ''}</span><input type="number" min="0" step="0.01" className={`${inputClass} ${line.currencySymbol ? 'pl-10' : ''}`} value={line.unitPrice ?? 0} onChange={(event) => update('unitPrice', event.target.value === '' ? '' : Math.max(0, Number(event.target.value)))} /></div></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="Discount type"><select className={selectClass} value={line.discount?.mode || 'none'} onChange={(event) => update('discount', { mode: event.target.value, value: event.target.value === 'none' ? 0 : Number(line.discount?.value || 0) })}><option value="none">No discount</option><option value="percent">Percentage (%)</option><option value="fixed">Fixed amount</option></select></Field><Field label={line.discount?.mode === 'percent' ? 'Discount (%)' : 'Discount amount'}><input type="number" min="0" max={line.discount?.mode === 'percent' ? 100 : undefined} step="0.01" disabled={!line.discount || line.discount.mode === 'none'} className={inputClass} value={line.discount?.value ?? 0} onChange={(event) => update('discount', { ...(line.discount || {}), value: event.target.value === '' ? '' : Math.max(0, Number(event.target.value)) })} /></Field></div>
      <div className="grid grid-cols-2 gap-3"><Field label="Tax treatment"><select className={selectClass} value={line.taxTreatment || 'taxable'} onChange={(event) => update('taxTreatment', event.target.value)}><option value="taxable">Taxable</option><option value="zero">Zero rated</option><option value="exempt">Exempt</option></select></Field><Field label="Tax rate (%)"><input type="number" min="0" max="100" step="0.01" disabled={(line.taxTreatment || 'taxable') !== 'taxable'} className={inputClass} value={line.taxRate ?? 0} onChange={(event) => update('taxRate', event.target.value === '' ? '' : Math.max(0, Math.min(100, Number(event.target.value))))} /></Field></div>
      <Field label="Tax label"><input className={inputClass} value={line.taxLabel || ''} onChange={(event) => update('taxLabel', event.target.value)} placeholder="e.g. VAT" /></Field>
    </div>
  </div>;
}

export default function DocumentEditor({
  document, profiles = [], activeProfile, customers = [], products = [], payments = [], allDocuments = [], settings = {},
  onDocumentChange, onSave, onClose, onDownload, onPrint, onRecordPayment, onEditPayment, onDeletePayment, onGenerateReceipt, onToast, onConvert,
}) {
  const [saveState, setSaveState] = React.useState('Changes not saved');
  const [tab, setTab] = React.useState('edit');
  const [validationErrors, setValidationErrors] = React.useState([]);
  const doc = document;
  const totals = calculateDocument(doc);
  const currencyAmount = (amount) => formatCurrency(amount, doc.currency || 'USD', 'en-US', totals.currencyDigits);
  const thisPayments = payments.filter((payment) => payment.invoiceId === doc.id && payment.status !== 'void');
  const paymentSummary = calculatePayments(thisPayments, totals.total, Number(doc.appliedCredits || 0), totals.currencyDigits);
  const update = (field, value) => onDocumentChange({ ...doc, [field]: value, updatedAt: new Date().toISOString() });
  const updateNested = (path, value) => onDocumentChange({ ...setAtPath(doc, path, value), updatedAt: new Date().toISOString() });
  const setLines = (callback) => update('lines', callback(doc.lines || []));
  const updateLine = (id, field, value) => setLines((lines) => lines.map((line) => line.id === id ? (field === '__all' ? { ...line, ...value } : setAtPath(line, field, value)) : line));
  const addLine = () => setLines((lines) => [...lines, createEmptyLine(doc.business || {})]);
  const removeLine = (id) => setLines((lines) => lines.filter((line) => line.id !== id));
  const duplicateLine = (id) => setLines((lines) => { const index = lines.findIndex((line) => line.id === id); if (index < 0) return lines; const copy = { ...structuredClone(lines[index]), id: crypto.randomUUID() }; return [...lines.slice(0, index + 1), copy, ...lines.slice(index + 1)]; });
  const moveLine = (from, to) => setLines((lines) => { if (to < 0 || to >= lines.length) return lines; const next = [...lines]; const [row] = next.splice(from, 1); next.splice(to, 0, row); return next; });
  const selectCustomer = (id) => {
    const customer = customers.find((item) => item.id === id);
    onDocumentChange({ ...doc, customerId: id, customer: customer ? { ...customer } : {}, updatedAt: new Date().toISOString() });
  };
  const selectProfile = (id) => {
    const selected = profiles.find((item) => item.id === id);
    if (!selected) return;
    onDocumentChange({ ...doc, businessProfileId: selected.id, business: structuredClone(selected), currency: selected.currency || doc.currency, appearance: { ...doc.appearance, accentColor: selected.accentColor || doc.appearance?.accentColor }, updatedAt: new Date().toISOString() });
  };
  const setLogo = (logo) => {
    const business = { ...(doc.business || {}) };
    if (logo) { const { dataUrl, ...metadata } = logo; business.logoDataUrl = dataUrl; business.logoMeta = metadata; }
    else { business.logoDataUrl = ''; business.logoMeta = null; }
    onDocumentChange({ ...doc, business, appearance: { ...doc.appearance, ...(logo ? { showLogo: true } : {}) }, updatedAt: new Date().toISOString() });
  };

  React.useEffect(() => {
    if (!doc?.id) return undefined;
    setSaveState('Changes not saved');
    const timer = window.setTimeout(async () => {
      setSaveState('Saving…');
      try { await onSave(doc, { silent: true }); setSaveState('Saved locally'); }
      catch (error) { setSaveState('Save failed'); setValidationErrors([error?.message || 'The draft could not be saved locally.']); }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [doc, onSave]);

  React.useEffect(() => {
    const warn = (event) => {
      if (['Changes not saved', 'Saving…', 'Save failed'].includes(saveState)) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saveState]);

  const doSave = async () => {
    setValidationErrors([]);
    const errors = validateDocumentNumbers(doc);
    if (!doc.number?.trim()) errors.push('Add a document number before saving.');
    const duplicate = allDocuments.find((item) => item.id !== doc.id && item.type === doc.type && item.businessProfileId === doc.businessProfileId && item.number === doc.number);
    if (duplicate) errors.push(`The number ${doc.number} is already used for this document type in the selected business profile.`);
    if (doc.status !== 'Draft' && !String(doc.customer?.name || doc.customer?.businessName || '').trim()) errors.push('Add a customer or recipient name before marking this document as issued or sent.');
    if (doc.status !== 'Draft' && !doc.issueDate) errors.push('Add an issue date before marking this document as issued or sent.');
    if (doc.type !== 'receipt' && !['creditnote'].includes(doc.type) && (!doc.lines || !doc.lines.length)) errors.push('Add at least one line item.');
    if (errors.length) { setValidationErrors(errors); onToast?.({ kind: 'error', title: 'Please review this document', message: errors[0] }); return; }
    setSaveState('Saving…');
    try { await onSave({ ...doc, updatedAt: new Date().toISOString() }, { silent: false }); setSaveState('Saved locally'); }
    catch (error) { setSaveState('Save failed'); setValidationErrors([error.message || 'Unable to save this document.']); }
  };

  const isInvoice = doc.type === 'invoice';
  const canLineEdit = doc.type !== 'receipt';
  const profileNames = profiles.map((item) => item.name).filter(Boolean).join(', ');

  return <div className="space-y-5">
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex min-w-0 items-start gap-3"><Button variant="ghost" size="icon" icon="ArrowLeft" onClick={onClose} title="Back to documents" /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="text-lg font-bold text-slate-900 dark:text-white">{doc.number || `New ${DOCUMENT_TYPES[doc.type]?.label || 'document'}`}</h1><StatusBadge status={getDocumentStatus(doc, thisPayments, Number(doc.appliedCredits || 0))} /></div><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{DOCUMENT_TYPES[doc.type]?.label} · {saveState}{profileNames ? ` · ${doc.business?.name || 'Business profile'}` : ''}</p></div></div>
      <div className="flex flex-wrap gap-2 sm:justify-end"><Button variant="secondary" size="sm" icon="Eye" onClick={() => setTab(tab === 'preview' ? 'edit' : 'preview')}>{tab === 'preview' ? 'Back to editor' : 'Full preview'}</Button><Button variant="secondary" size="sm" icon="Printer" onClick={onPrint}>Print</Button><Button size="sm" icon="Download" onClick={onDownload}>Download PDF</Button><Button variant="secondary" size="sm" icon="Save" onClick={doSave}>Save</Button></div>
    </div>

    {validationErrors.length > 0 && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"><div className="mb-1 flex items-center gap-2 font-bold"><Icon name="AlertCircle" size={16} />Please check the following</div><ul className="list-disc pl-6">{validationErrors.map((error) => <li key={error}>{error}</li>)}</ul></div>}

    {tab === 'preview' ? <div className="mx-auto max-w-4xl"><DocumentPreview document={doc} payments={thisPayments} previewMode /></div> : <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(430px,.9fr)]">
      <div className="min-w-0 space-y-3">
        <FormSection title="Document information" description="Number, dates, status, currency and template." defaultOpen>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Document number"><input className={inputClass} value={doc.number || ''} onChange={(e) => update('number', e.target.value)} /></Field>
            <Field label="Status"><select className={selectClass} value={doc.status || 'Draft'} onChange={(e) => update('status', e.target.value)}>{(DOCUMENT_TYPES[doc.type]?.statuses || ['Draft']).map((status) => <option key={status}>{status}</option>)}</select></Field>
            {profiles.length > 1 && <Field label="Business profile" className="sm:col-span-2"><select className={selectClass} value={doc.businessProfileId || ''} onChange={(e) => selectProfile(e.target.value)}>{profiles.map((item) => <option key={item.id} value={item.id}>{item.name || 'Unnamed business profile'}</option>)}</select></Field>}
            <Field label="Issue date"><input type="date" className={inputClass} value={doc.issueDate || ''} onChange={(e) => update('issueDate', e.target.value)} /></Field>
            {doc.type === 'invoice' && <Field label="Due date"><input type="date" className={inputClass} value={doc.dueDate || ''} onChange={(e) => update('dueDate', e.target.value)} /></Field>}
            {['quotation', 'estimate', 'proforma'].includes(doc.type) && <Field label="Valid until"><input type="date" className={inputClass} value={doc.validUntil || ''} onChange={(e) => update('validUntil', e.target.value)} /></Field>}
            {doc.type === 'receipt' && <Field label="Payment date"><input type="date" className={inputClass} value={doc.paymentDate || ''} onChange={(e) => update('paymentDate', e.target.value)} /></Field>}
            <Field label="Currency" hint="Changing currency does not convert existing amounts."><select className={selectClass} value={doc.currency || 'USD'} onChange={(e) => { if (e.target.value !== doc.currency && !window.confirm('Changing currency will not convert any amounts. Continue?')) return; update('currency', e.target.value); }}>{['USD', 'ZWG', 'ZAR', 'GBP', 'EUR', 'KES', 'NGN', 'CAD', 'AUD', 'BWP', 'INR', 'JPY', 'CHF', 'NZD'].map((code) => <option key={code} value={code}>{code}</option>)}</select></Field>
            {doc.type !== 'receipt' && <Field label="Tax calculation"><select className={selectClass} value={doc.taxMode || 'exclusive'} onChange={(e) => update('taxMode', e.target.value)}><option value="exclusive">Tax exclusive (add tax)</option><option value="inclusive">Tax inclusive (tax included in price)</option></select></Field>}
            <Field label="Document template"><select className={selectClass} value={doc.template || 'classic'} onChange={(e) => update('template', e.target.value)}><option value="classic">Classic Professional</option><option value="modern">Modern Minimal</option><option value="corporate">Corporate</option><option value="creative">Bold Creative</option></select></Field>
          </div>
        </FormSection>

        <FormSection title="Business details" description="These details are saved as a snapshot on this document.">
          {profiles.length > 1 && <Field label="Use a business profile"><select className={selectClass} value={doc.businessProfileId || ''} onChange={(e) => selectProfile(e.target.value)}>{profiles.map((item) => <option key={item.id} value={item.id}>{item.name || 'Unnamed business profile'}</option>)}</select></Field>}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Business / trading name"><input className={inputClass} value={doc.business?.name || ''} onChange={(e) => updateNested('business.name', e.target.value)} /></Field>
            <Field label="Legal name"><input className={inputClass} value={doc.business?.legalName || ''} onChange={(e) => updateNested('business.legalName', e.target.value)} /></Field>
            <Field label="Email"><input type="email" className={inputClass} value={doc.business?.email || ''} onChange={(e) => updateNested('business.email', e.target.value)} /></Field>
            <Field label="Phone"><input className={inputClass} value={doc.business?.phone || ''} onChange={(e) => updateNested('business.phone', e.target.value)} /></Field>
            <Field label="Street address"><input className={inputClass} value={doc.business?.streetAddress || ''} onChange={(e) => updateNested('business.streetAddress', e.target.value)} /></Field>
            <Field label="City / town"><input className={inputClass} value={doc.business?.city || ''} onChange={(e) => updateNested('business.city', e.target.value)} /></Field>
            <Field label="Country"><input className={inputClass} value={doc.business?.country || ''} onChange={(e) => updateNested('business.country', e.target.value)} /></Field>
            <Field label="Website"><input className={inputClass} value={doc.business?.website || ''} onChange={(e) => updateNested('business.website', e.target.value)} /></Field>
          </div>
        </FormSection>

        <FormSection title="Customer details" description="Choose a saved customer or enter details for this document." defaultOpen>
          <Field label="Select customer"><select className={selectClass} value={doc.customerId || ''} onChange={(e) => selectCustomer(e.target.value)}><option value="">Enter customer manually</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.email ? ` · ${customer.email}` : ''}</option>)}</select></Field>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Customer / business name"><input className={inputClass} value={doc.customer?.name || ''} onChange={(e) => updateNested('customer.name', e.target.value)} placeholder="Customer name" /></Field>
            <Field label="Contact person"><input className={inputClass} value={doc.customer?.contactPerson || ''} onChange={(e) => updateNested('customer.contactPerson', e.target.value)} /></Field>
            <Field label="Email"><input type="email" className={inputClass} value={doc.customer?.email || ''} onChange={(e) => updateNested('customer.email', e.target.value)} /></Field>
            <Field label="Phone"><input className={inputClass} value={doc.customer?.phone || ''} onChange={(e) => updateNested('customer.phone', e.target.value)} /></Field>
            <Field label="Billing address"><input className={inputClass} value={doc.customer?.address || ''} onChange={(e) => updateNested('customer.address', e.target.value)} /></Field>
            <Field label="City / town"><input className={inputClass} value={doc.customer?.city || ''} onChange={(e) => updateNested('customer.city', e.target.value)} /></Field>
            <Field label="Country"><input className={inputClass} value={doc.customer?.country || ''} onChange={(e) => updateNested('customer.country', e.target.value)} /></Field>
            <Field label="Tax number (optional)"><input className={inputClass} value={doc.customer?.taxNumber || ''} onChange={(e) => updateNested('customer.taxNumber', e.target.value)} /></Field>
          </div>
          <p className="mt-3 text-[11px] text-slate-500">Editing customer details here changes this document only, not the saved customer record.</p>
        </FormSection>

        <FormSection title="Logo & branding" description="Customize the saved logo snapshot for this document.">
          <LogoUploader logoDataUrl={doc.business?.logoDataUrl || ''} logoMeta={doc.business?.logoMeta} onChange={setLogo} onError={(message) => onToast?.({ kind: 'error', title: 'Logo upload failed', message })} compact />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Show logo on this document"><select className={selectClass} value={doc.appearance?.showLogo === false ? 'no' : 'yes'} onChange={(e) => updateNested('appearance.showLogo', e.target.value === 'yes')}><option value="yes">Show logo</option><option value="no">Hide logo (keep saved)</option></select></Field>
            <Field label="Logo alignment"><select className={selectClass} value={doc.appearance?.logoPosition || 'left'} onChange={(e) => updateNested('appearance.logoPosition', e.target.value)}><option value="left">Top left</option><option value="center">Centered</option><option value="right">Top right</option></select></Field>
            <Field label="Logo width (px)"><input type="number" min="52" max="260" className={inputClass} value={doc.appearance?.logoWidth ?? 160} onChange={(e) => updateNested('appearance.logoWidth', Math.max(52, Math.min(260, Number(e.target.value) || 160)))} /></Field>
            <Field label="Maximum logo height (px)"><input type="number" min="32" max="160" className={inputClass} value={doc.appearance?.logoMaxHeight ?? 72} onChange={(e) => updateNested('appearance.logoMaxHeight', Math.max(32, Math.min(160, Number(e.target.value) || 72)))} /></Field>
            <Field label="Image fit"><select className={selectClass} value={doc.appearance?.logoFit || 'contain'} onChange={(e) => updateNested('appearance.logoFit', e.target.value)}><option value="contain">Contain (preserve full logo)</option><option value="cover">Cover (crop if needed)</option></select></Field>
            <Field label="Document font"><select className={selectClass} value={doc.appearance?.fontFamily || 'Inter'} onChange={(e) => updateNested('appearance.fontFamily', e.target.value)}><option value="Inter">Inter / sans-serif</option><option value="Georgia">Georgia / serif</option><option value="Courier New">Monospace</option></select></Field>
            <Field label="Document font size"><select className={selectClass} value={doc.appearance?.fontSize || 10} onChange={(e) => updateNested('appearance.fontSize', Number(e.target.value))}><option value={9}>Compact</option><option value={10}>Standard</option><option value={11}>Large</option><option value={12}>Extra large</option></select></Field>
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><input type="checkbox" checked={Boolean(doc.appearance?.compactTable)} onChange={(e) => updateNested('appearance.compactTable', e.target.checked)} /> Compact line-item table</label>
            <Field label="Optional background"><select className={selectClass} value={doc.appearance?.logoBackground || 'transparent'} onChange={(e) => updateNested('appearance.logoBackground', e.target.value)}><option value="transparent">Transparent</option><option value="#FFFFFF">White</option><option value="#F8FAFC">Light grey</option></select></Field>
            <Field label="Space around logo (px)"><input type="number" min="0" max="24" className={inputClass} value={doc.appearance?.logoSpacing ?? 8} onChange={(e) => updateNested('appearance.logoSpacing', Math.max(0, Math.min(24, Number(e.target.value) || 0)))} /></Field>
            <Field label="Brand accent colour"><div className="flex gap-2"><input type="color" aria-label="Pick accent colour" className="h-10 w-12 cursor-pointer rounded-lg border border-slate-200 bg-white p-1" value={doc.appearance?.accentColor || '#4F46E5'} onChange={(e) => updateNested('appearance.accentColor', e.target.value)} /><input className={inputClass} value={doc.appearance?.accentColor || '#4F46E5'} pattern="^#[0-9A-Fa-f]{6}$" onChange={(e) => updateNested('appearance.accentColor', e.target.value)} /></div></Field>
          </div>
          <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="secondary" icon="RotateCcw" onClick={() => onDocumentChange({ ...doc, business: { ...doc.business, logoDataUrl: activeProfile?.logoDataUrl || '', logoMeta: activeProfile?.logoMeta || null }, appearance: { ...doc.appearance, logoPosition: activeProfile?.logoPosition || 'left', logoWidth: activeProfile?.logoWidth || 160, logoMaxHeight: activeProfile?.logoMaxHeight || 72, showLogo: true, accentColor: activeProfile?.accentColor || '#4F46E5' } })}>Use current business branding</Button><Button size="sm" variant="ghost" onClick={() => update('template', 'classic')}>Reset template</Button></div>
        </FormSection>

        {canLineEdit && <FormSection title="Products & services" description="Add catalogue items or build custom line items." defaultOpen>
          <div className="mb-4 flex items-center justify-between gap-3"><p className="text-xs text-slate-500">Amounts update automatically as you type.</p><Button size="sm" variant="secondary" icon="Plus" onClick={addLine}>Add line</Button></div>
          <div className="space-y-3">{(doc.lines || []).map((line, index) => <LineItemCard key={line.id} line={line} index={index} total={doc.lines.length} products={products} onUpdate={updateLine} onRemove={removeLine} onDuplicate={duplicateLine} onMove={moveLine} />)}</div>
          {!doc.lines?.length && <div className="rounded-xl bg-slate-50 px-4 py-5 text-center text-xs text-slate-500 dark:bg-slate-950">No line items added yet.</div>}
          <Button className="mt-3 w-full" variant="secondary" icon="Plus" onClick={addLine}>Add another item</Button>
        </FormSection>}

        {doc.type === 'receipt' ? <FormSection title="Receipt payment details" description="A receipt records payment details entered by you; it does not verify an external transaction." defaultOpen>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Amount received"><input type="number" min="0" step="0.01" className={inputClass} value={doc.amountReceived ?? 0} onChange={(e) => update('amountReceived', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} /></Field>
            <Field label="Payment method"><select className={selectClass} value={doc.paymentMethod || 'Bank Transfer'} onChange={(e) => update('paymentMethod', e.target.value)}>{['Cash', 'Bank Transfer', 'Card', 'Mobile Money', 'Cheque', 'Other'].map((method) => <option key={method}>{method}</option>)}</select></Field>
            <Field label="Reference"><input className={inputClass} value={doc.paymentReference || ''} onChange={(e) => update('paymentReference', e.target.value)} /></Field>
            <Field label="Related invoice number"><select className={selectClass} value={doc.relatedInvoiceId || ''} onChange={(e) => { const related = allDocuments.find((d) => d.id === e.target.value); onDocumentChange({ ...doc, relatedInvoiceId: e.target.value, relatedInvoiceNumber: related?.number || '', ...(related?.customer ? { customer: { ...related.customer }, customerId: related.customerId || '' } : {}), updatedAt: new Date().toISOString() }); }}><option value="">Not linked</option>{allDocuments.filter((item) => item.type === 'invoice').map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.number} · {invoice.customer?.name || 'Customer'}</option>)}</select></Field>
            <Field label="Payment description" className="sm:col-span-2"><textarea className={textareaClass} value={doc.paymentDescription || ''} onChange={(e) => update('paymentDescription', e.target.value)} /></Field>
          </div>
        </FormSection> : null}

        {doc.type === 'invoice' && <FormSection title="Payment tracking" description="Record a payment and see the current balance." defaultOpen>
          <div className="grid grid-cols-3 gap-2"><div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="text-[10px] text-slate-500">Invoice total</p><p className="mt-1 break-words text-sm font-bold text-slate-900 dark:text-white">{currencyAmount(totals.total)}</p></div><div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="text-[10px] text-slate-500">Recorded paid</p><p className="mt-1 break-words text-sm font-bold text-emerald-600">{currencyAmount(paymentSummary.paid)}</p></div><div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="text-[10px] text-slate-500">Balance</p><p className="mt-1 break-words text-sm font-bold text-slate-900 dark:text-white">{currencyAmount(paymentSummary.balance)}</p></div></div>
          <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" icon="Wallet" onClick={() => onRecordPayment?.(doc)}>Record payment</Button>{thisPayments.length > 0 && <Button size="sm" variant="secondary" icon="Receipt" onClick={() => onGenerateReceipt?.(doc, thisPayments[thisPayments.length - 1])}>Create receipt from latest payment</Button>}</div>
          {thisPayments.length > 0 && <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">{thisPayments.map((payment) => <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><div><p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{formatDate(payment.date)} · {payment.method}</p><p className="mt-1 text-[11px] text-slate-500">{payment.reference || 'No reference'} {payment.notes ? `· ${payment.notes}` : ''}</p></div><div className="text-right"><p className="text-sm font-bold text-slate-900 dark:text-white">{currencyAmount(payment.amount)}</p><div className="mt-1 flex flex-wrap justify-end gap-2"><button className="text-[11px] font-semibold text-primary hover:underline" onClick={() => onGenerateReceipt?.(doc, payment)}>Generate receipt</button><button className="text-[11px] font-semibold text-slate-500 hover:underline" onClick={() => onEditPayment?.(doc, payment)}>Edit</button><button className="text-[11px] font-semibold text-red-600 hover:underline" onClick={() => onDeletePayment?.(payment)}>Delete</button></div></div></div>)}</div>}
        </FormSection>}

        {(doc.type === 'quotation' || doc.type === 'estimate') && <FormSection title="Project details" description="Optional scope, delivery and completion information.">
          <div className="space-y-3"><Field label="Scope of work"><textarea className={textareaClass} value={doc.scopeOfWork || ''} onChange={(e) => update('scopeOfWork', e.target.value)} /></Field><Field label="Delivery details"><textarea className={textareaClass} value={doc.deliveryDetails || ''} onChange={(e) => update('deliveryDetails', e.target.value)} /></Field><Field label="Estimated completion date"><input type="date" className={inputClass} value={doc.estimatedCompletionDate || ''} onChange={(e) => update('estimatedCompletionDate', e.target.value)} /></Field></div>
        </FormSection>}

        {doc.type === 'creditnote' && <FormSection title="Credit note details" description="Keep the original invoice as a separate record.">
          <div className="space-y-3"><Field label="Original invoice"><select className={selectClass} value={doc.relatedInvoiceId || ''} onChange={(e) => { const invoice = allDocuments.find((d) => d.id === e.target.value); onDocumentChange({ ...doc, relatedInvoiceId: e.target.value, originalInvoiceNumber: invoice?.number || '', ...(invoice ? { customer: { ...invoice.customer }, customerId: invoice.customerId || '' } : {}), updatedAt: new Date().toISOString() }); }}><option value="">Select invoice (optional)</option>{allDocuments.filter((item) => item.type === 'invoice').map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.number} · {invoice.customer?.name || 'Customer'}</option>)}</select></Field><Field label="Reason for credit"><textarea className={textareaClass} value={doc.creditReason || ''} onChange={(e) => update('creditReason', e.target.value)} placeholder="Describe why this credit note is being issued" /></Field></div>
        </FormSection>}

        {doc.type !== 'receipt' && <FormSection title="Discounts, taxes & charges" description="Configure a document discount and additional delivery or service charges." defaultOpen>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Document discount type"><select className={selectClass} value={doc.documentDiscount?.mode || 'none'} onChange={(e) => update('documentDiscount', { mode: e.target.value, value: e.target.value === 'none' ? 0 : Number(doc.documentDiscount?.value || 0) })}><option value="none">No discount</option><option value="percent">Percentage (%)</option><option value="fixed">Fixed amount</option></select></Field><Field label={doc.documentDiscount?.mode === 'percent' ? 'Discount (%)' : 'Discount amount'}><input disabled={!doc.documentDiscount || doc.documentDiscount.mode === 'none'} type="number" min="0" max={doc.documentDiscount?.mode === 'percent' ? 100 : undefined} step="0.01" className={inputClass} value={doc.documentDiscount?.value ?? 0} onChange={(e) => update('documentDiscount', { ...doc.documentDiscount, value: e.target.value === '' ? '' : Math.max(0, Number(e.target.value)) })} /></Field></div>
          <div className="mt-4"><SectionTitle title="Additional charges" description="Shipping, handling or other charges (optional)." action={<Button size="sm" variant="secondary" icon="Plus" onClick={() => update('additionalCharges', [...(doc.additionalCharges || []), { id: crypto.randomUUID(), label: 'Delivery', amount: 0, taxable: false, taxRate: 0, taxTreatment: 'taxable', taxLabel: 'VAT' }])}>Add charge</Button>} />
            {(doc.additionalCharges || []).length === 0 && <p className="rounded-xl bg-slate-50 px-3 py-3 text-xs text-slate-500 dark:bg-slate-950">No additional charges.</p>}
            <div className="space-y-2">{(doc.additionalCharges || []).map((charge, index) => <div key={charge.id || index} className="grid gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700 sm:grid-cols-[1fr_120px_auto]"><Field label="Label"><input className={inputClass} value={charge.label || ''} onChange={(e) => update('additionalCharges', doc.additionalCharges.map((item) => item.id === charge.id ? { ...item, label: e.target.value } : item))} /></Field><Field label="Amount"><input className={inputClass} type="number" min="0" step="0.01" value={charge.amount ?? 0} onChange={(e) => update('additionalCharges', doc.additionalCharges.map((item) => item.id === charge.id ? { ...item, amount: e.target.value === '' ? '' : Math.max(0, Number(e.target.value)) } : item))} /></Field><div className="flex items-end"><Button size="icon" variant="ghost" icon="Trash2" title="Remove charge" onClick={() => update('additionalCharges', doc.additionalCharges.filter((item) => item.id !== charge.id))} /></div><label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 sm:col-span-3"><input type="checkbox" checked={Boolean(charge.taxable)} onChange={(e) => update('additionalCharges', doc.additionalCharges.map((item) => item.id === charge.id ? { ...item, taxable: e.target.checked } : item))} /> Taxable charge</label>{charge.taxable && <Field label="Tax rate (%)" className="sm:col-span-3"><input className={inputClass} type="number" min="0" max="100" step="0.01" value={charge.taxRate ?? 0} onChange={(e) => update('additionalCharges', doc.additionalCharges.map((item) => item.id === charge.id ? { ...item, taxRate: Math.max(0, Math.min(100, Number(e.target.value) || 0)) } : item))} /></Field>}</div>)}</div>
          </div>
        </FormSection>}

        <FormSection title="Terms, notes & payment information" description="Optional content appears on the document only when entered.">
          <div className="space-y-3">
            <Field label="Introductory message"><textarea className={textareaClass} value={doc.intro || ''} onChange={(e) => update('intro', e.target.value)} /></Field>
            <Field label={doc.type === 'receipt' ? 'Payment description / notes' : 'Notes'}><textarea className={textareaClass} value={doc.notes || ''} onChange={(e) => update('notes', e.target.value)} /></Field>
            {doc.type !== 'receipt' && <><Field label="Payment instructions"><textarea className={textareaClass} value={doc.paymentInstructions || ''} onChange={(e) => update('paymentInstructions', e.target.value)} placeholder="Bank or other payment instructions (optional)" /></Field><Field label="Payment terms"><input className={inputClass} value={doc.paymentTerms || ''} onChange={(e) => update('paymentTerms', e.target.value)} placeholder="e.g. Payment due within 14 days" /></Field><Field label="Terms and conditions"><textarea className={textareaClass} value={doc.terms || ''} onChange={(e) => update('terms', e.target.value)} /></Field></>}
            <Field label="Thank-you message"><input className={inputClass} value={doc.thankYouMessage || ''} onChange={(e) => update('thankYouMessage', e.target.value)} /></Field>
            <Field label="Footer"><input className={inputClass} value={doc.footer || ''} onChange={(e) => update('footer', e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3 pt-1 text-xs text-slate-600 dark:text-slate-300">{[['showTaxDetails', 'Show tax breakdown'], ['showPaymentDetails', 'Show payment instructions'], ['showNotes', 'Show notes'], ['showTerms', 'Show terms'], ['showFooter', 'Show footer']].map(([key, label]) => <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={doc.appearance?.[key] !== false} onChange={(e) => updateNested(`appearance.${key}`, e.target.checked)} />{label}</label>)}</div>
          </div>
        </FormSection>

        <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95"><span className="min-w-0 text-xs text-slate-500">{saveState === 'Saved locally' ? '✓ Saved in this browser' : saveState}</span><div className="flex flex-wrap gap-2"><Button variant="secondary" size="sm" onClick={onClose}>Close</Button><Button size="sm" icon="Save" onClick={doSave}>Save document</Button></div></div>
      </div>

      <aside className="hidden min-w-0 xl:block xl:sticky xl:top-4">
        <div className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-bold text-slate-900 dark:text-white">Live document preview</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Updates as you edit · A4 page</p></div><Button size="sm" variant="ghost" icon="Maximize2" onClick={() => setTab('preview')}>Expand</Button></div>
        <div className="max-h-[calc(100vh-170px)] overflow-auto rounded-2xl border border-slate-200 bg-slate-100 p-3 dark:border-slate-800 dark:bg-slate-950"><DocumentPreview document={doc} payments={thisPayments} /></div>
        {doc.type === 'invoice' && <Panel className="mt-3" padding="p-4"><div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold text-slate-500">Calculated total</p><span className="text-[10px] text-slate-400">{doc.taxMode === 'inclusive' ? 'Tax inclusive' : 'Tax exclusive'}</span></div><p className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">{currencyAmount(totals.total)}</p><div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 dark:border-slate-800"><div><p className="text-[10px] text-slate-500">Recorded payments</p><p className="mt-1 text-sm font-bold text-emerald-600">{currencyAmount(paymentSummary.paid)}</p></div><div><p className="text-[10px] text-slate-500">Outstanding</p><p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{currencyAmount(paymentSummary.balance)}</p></div></div></Panel>}
        <p className="mt-3 text-[11px] leading-5 text-slate-400">Preview formatting may differ slightly from PDF pagination. PDF export uses selectable text and an embedded logo.</p>
      </aside>
      <div className="xl:hidden"><Panel><SectionTitle title="Live totals" description="Calculated from the current line items and tax settings." /><div className="flex items-center justify-between gap-4"><span className="text-sm text-slate-500">{totals.taxMode === 'inclusive' ? 'Total (tax included)' : 'Total'}</span><strong className="text-xl text-slate-900 dark:text-white">{currencyAmount(totals.total)}</strong></div><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="secondary" icon="Eye" onClick={() => setTab('preview')}>Open full preview</Button><Button size="sm" icon="Download" onClick={onDownload}>Download PDF</Button></div></Panel></div>
    </div>}
  </div>;
}
