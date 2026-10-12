import React from 'react';
import { calculateDocument, calculatePayments } from '../calculations/documentTotals';
import { DOCUMENT_TYPES } from '../utils/documentTypes';
import { formatCurrency, formatDate } from '../utils/format';

function CleanLine({ children }) { return children ? <div className="mt-1 break-words">{children}</div> : null; }
function PersonDetails({ title, person, accent }) {
  const name = person?.name || person?.businessName || '';
  const rows = [person?.contactPerson, person?.email, person?.phone, [person?.streetAddress || person?.address, person?.city, person?.province, person?.postalCode, person?.country].filter(Boolean).join(', '), person?.taxNumber ? `Tax ID: ${person.taxNumber}` : ''].filter(Boolean);
  if (!name && rows.length === 0) return null;
  return <div className="min-w-0"><p className="mb-2 text-[9px] font-bold uppercase tracking-[.16em]" style={{ color: accent }}>{title}</p>{name && <p className="break-words text-[13px] font-bold text-slate-900">{name}</p>}{rows.map((row, index) => <CleanLine key={`${index}-${row}`}><span className="text-[10px] leading-4 text-slate-500">{row}</span></CleanLine>)}</div>;
}

export default function DocumentPreview({ document, payments = [], previewMode = false }) {
  const doc = document || {};
  const business = doc.business || {};
  const customer = doc.customer || {};
  const appearance = doc.appearance || {};
  const currency = doc.currency || 'USD';
  const totals = calculateDocument(doc);
  const amount = (value) => formatCurrency(value, currency, 'en-US', totals.currencyDigits);
  const title = doc.type === 'proforma' ? 'PRO FORMA INVOICE' : (DOCUMENT_TYPES[doc.type]?.label || 'Document').toUpperCase();
  const logo = appearance.showLogo === false ? '' : (business.logoDataUrl || doc.logoDataUrl || '');
  const logoStyle = {
    width: `${Math.max(52, Math.min(appearance.logoWidth || 160, 220))}px`,
    maxHeight: `${Math.max(32, Math.min(appearance.logoMaxHeight || 72, 120))}px`,
    objectFit: appearance.logoFit || 'contain',
    height: appearance.logoFit === 'cover' ? `${Math.max(32, Math.min(appearance.logoMaxHeight || 72, 120))}px` : 'auto',
    background: appearance.logoBackground && appearance.logoBackground !== 'transparent' ? appearance.logoBackground : 'transparent',
    marginTop: `${Number(appearance.logoSpacing || 0)}px`,
    marginBottom: `${Number(appearance.logoSpacing || 0)}px`,
  };
  const logoPosition = appearance.logoPosition || 'left';
  const posClass = logoPosition === 'center' ? 'justify-center text-center' : logoPosition === 'right' ? 'justify-end text-right' : 'justify-start text-left';
  const headerLayout = logoPosition === 'center' ? 'flex-col items-center text-center' : logoPosition === 'right' ? 'flex-row-reverse items-start justify-between' : 'flex-row items-start justify-between';
  const template = doc.template || 'classic';
  const isCreative = template === 'creative';
  const isCorporate = template === 'corporate';
  const isMinimal = template === 'modern';
  const balance = calculatePayments(payments, totals.total, Number(doc.appliedCredits || 0), totals.currencyDigits);
  const businessAddress = [business.streetAddress, business.city, business.province, business.postalCode, business.country].filter(Boolean).join(', ');
  const itemRows = totals.lines;
  const isReceipt = doc.type === 'receipt';

  return <article id="document-print-root" className={`document-paper template-${template} mx-auto w-full overflow-hidden bg-white text-slate-800 ${previewMode ? 'document-paper-expanded' : ''}`} style={{ '--doc-accent': appearance.accentColor || business.accentColor || '#4F46E5', fontFamily: appearance.fontFamily || 'Inter, ui-sans-serif, system-ui, sans-serif', fontSize: `${Math.max(9, Math.min(appearance.fontSize || 10, 12))}px` }}>
    <div className={`document-header flex gap-5 ${headerLayout} ${isCorporate ? 'border-b-4 pb-5' : ''}`} style={{ borderColor: 'var(--doc-accent)' }}>
      {logo && <div className={`flex shrink-0 ${posClass} ${logoPosition === 'center' ? 'w-full' : 'max-w-[44%]'}`}><img src={logo} alt={`${business.name || 'Business'} logo`} style={logoStyle} className="block max-w-full" /></div>}
      <div className={`min-w-0 ${logoPosition === 'center' ? 'w-full' : 'flex-1'}`}>
        {(business.name || business.businessName) && <h2 className={`break-words text-[16px] font-extrabold tracking-tight ${isCreative ? 'text-[19px]' : ''}`} style={{ color: '#0f172a' }}>{business.name || business.businessName}</h2>}
        {business.legalName && business.legalName !== business.name && <p className="mt-1 text-[10px] text-slate-500">{business.legalName}</p>}
        <div className="mt-2 space-y-0.5 text-[10px] leading-4 text-slate-500">
          {businessAddress && <p>{businessAddress}</p>}
          {business.email && <p>{business.email}</p>}
          {business.phone && <p>{business.phone}</p>}
          {business.website && <p>{business.website}</p>}
          {business.taxNumber && <p>Tax ID: {business.taxNumber}</p>}
          {business.registrationNumber && <p>Registration: {business.registrationNumber}</p>}
        </div>
      </div>
    </div>

    <div className={`document-titlebar mt-7 flex flex-wrap items-end justify-between gap-4 ${isCreative ? 'rounded-xl px-4 py-4' : isCorporate ? 'border-b pb-3' : isMinimal ? 'border-b border-slate-200 pb-4' : 'border-t border-slate-200 pt-4'}`} style={isCreative ? { background: 'var(--doc-accent)', color: '#fff' } : { borderColor: isCorporate ? 'var(--doc-accent)' : undefined }}>
      <div><p className={`text-[9px] font-bold uppercase tracking-[.2em] ${isCreative ? 'text-white/75' : 'text-slate-500'}`}>{doc.status || 'Draft'}</p><h1 className={`mt-1 text-[23px] font-black leading-none tracking-tight ${isCreative ? 'text-white' : 'text-slate-900'}`}>{title}</h1>{doc.number && <p className={`mt-2 text-[11px] font-semibold ${isCreative ? 'text-white' : 'text-slate-600'}`}>{doc.number}</p>}</div>
      <div className={`grid grid-cols-2 gap-x-7 gap-y-2 text-left sm:text-right ${isCreative ? 'text-white' : ''}`}>
        <div><p className={`text-[9px] uppercase tracking-wide ${isCreative ? 'text-white/70' : 'text-slate-400'}`}>{isReceipt ? 'Payment date' : 'Issue date'}</p><p className="mt-1 text-[10px] font-semibold">{formatDate(isReceipt ? doc.paymentDate : doc.issueDate)}</p></div>
        {(doc.dueDate || doc.validUntil) && <div><p className={`text-[9px] uppercase tracking-wide ${isCreative ? 'text-white/70' : 'text-slate-400'}`}>{doc.type === 'invoice' ? 'Due date' : 'Valid until'}</p><p className="mt-1 text-[10px] font-semibold">{formatDate(doc.type === 'invoice' ? doc.dueDate : doc.validUntil)}</p></div>}
      </div>
    </div>

    <div className="mt-7 grid grid-cols-2 gap-5 sm:gap-8">
      <PersonDetails title={isReceipt ? 'Received from' : doc.type === 'creditnote' ? 'Credit issued to' : 'Bill to'} person={customer} accent="var(--doc-accent)" />
      <div className="min-w-0"><p className="mb-2 text-[9px] font-bold uppercase tracking-[.16em]" style={{ color: 'var(--doc-accent)' }}>{isReceipt ? 'Payment details' : 'Document details'}</p>
        <div className="space-y-1.5 text-[10px]">
          {doc.originalInvoiceNumber && <p><span className="text-slate-500">Original invoice</span><br /><span className="font-semibold">{doc.originalInvoiceNumber}</span></p>}
          {doc.relatedInvoiceNumber && <p><span className="text-slate-500">Related invoice</span><br /><span className="font-semibold">{doc.relatedInvoiceNumber}</span></p>}
          {isReceipt && doc.paymentMethod && <p><span className="text-slate-500">Payment method</span><br /><span className="font-semibold">{doc.paymentMethod}</span></p>}
          {isReceipt && doc.paymentReference && <p><span className="text-slate-500">Payment reference</span><br /><span className="font-semibold">{doc.paymentReference}</span></p>}
          {doc.paymentTerms && <p><span className="text-slate-500">Payment terms</span><br /><span className="font-semibold">{doc.paymentTerms}</span></p>}
          {doc.projectDescription && <p><span className="text-slate-500">Project</span><br /><span className="font-semibold">{doc.projectDescription}</span></p>}
        </div>
      </div>
    </div>

    {doc.intro && <p className="mt-6 whitespace-pre-wrap text-[10px] leading-5 text-slate-600">{doc.intro}</p>}

    {isReceipt ? <div className="mt-7 overflow-hidden rounded-xl border border-slate-200">
      <div className="px-4 py-3 text-[9px] font-bold uppercase tracking-wide text-white" style={{ background: 'var(--doc-accent)' }}>Payment receipt</div>
      <div className="grid grid-cols-[1fr_auto] gap-4 px-4 py-4"><div><p className="text-[11px] font-semibold">{doc.paymentDescription || (doc.relatedInvoiceNumber ? `Payment received for invoice ${doc.relatedInvoiceNumber}` : 'Payment received')}</p><p className="mt-1 text-[10px] text-slate-500">{formatDate(doc.paymentDate)}{doc.paymentMethod ? ` · ${doc.paymentMethod}` : ''}</p></div><p className="text-[14px] font-extrabold" style={{ color: 'var(--doc-accent)' }}>{amount(doc.amountReceived || 0)}</p></div>
    </div> : <div className="mt-7">
      <div className={`overflow-hidden ${isMinimal ? '' : 'rounded-lg border border-slate-200'}`}>
        <table className="w-full border-collapse text-left text-[9px]">
          <thead><tr style={{ background: isCreative ? 'var(--doc-accent)' : isCorporate ? '#f1f5f9' : '#f8fafc', color: isCreative ? 'white' : '#475569' }}>
            <th className="px-2 py-2.5 font-bold">Item / service</th><th className="px-2 py-2.5 text-right font-bold">Qty</th><th className="hidden px-2 py-2.5 text-right font-bold sm:table-cell">Unit price</th><th className="px-2 py-2.5 text-right font-bold">Line total</th>
          </tr></thead>
          <tbody>{itemRows.length ? itemRows.map((line, index) => <tr key={line.id || index} className="border-t border-slate-100 align-top" style={{ borderColor: '#e2e8f0' }}>
            <td className="px-2 py-3"><p className="break-words font-bold text-slate-800">{line.name || line.description || `Item ${index + 1}`}</p>{line.description && line.name && <p className="mt-1 whitespace-pre-wrap break-words text-[9px] leading-4 text-slate-500">{line.description}</p>}{line.lineDiscount > 0 && <p className="mt-1 text-[8px] text-slate-400">Discount: {amount(line.lineDiscount)}</p>}</td>
            <td className="px-2 py-3 text-right tabular-nums">{line.quantity} <span className="text-slate-400">{line.unit || ''}</span></td>
            <td className="hidden px-2 py-3 text-right tabular-nums sm:table-cell">{amount(line.unitPrice)}</td>
            <td className="px-2 py-3 text-right font-bold tabular-nums">{amount(line.total)}</td>
          </tr>) : <tr><td colSpan="4" className="screen-only px-3 py-7 text-center text-slate-400">Add line items in the editor to build this document.</td></tr>}</tbody>
        </table>
      </div>
      <div className="mt-5 flex justify-end">
        <div className="w-full max-w-[270px] space-y-2 text-[10px]">
          <div className="flex justify-between gap-4 text-slate-500"><span>Subtotal</span><span className="tabular-nums">{amount(totals.subtotal)}</span></div>
          {totals.lineDiscountTotal > 0 && <div className="flex justify-between gap-4 text-slate-500"><span>Line discounts</span><span>−{amount(totals.lineDiscountTotal)}</span></div>}
          {totals.documentDiscount > 0 && <div className="flex justify-between gap-4 text-slate-500"><span>Document discount</span><span>−{amount(totals.documentDiscount)}</span></div>}
          {totals.charges.map((charge, index) => <div className="flex justify-between gap-4 text-slate-500" key={`${charge.label}-${index}`}><span>{charge.label || 'Additional charge'}</span><span>{amount(totals.taxMode === 'inclusive' ? charge.total : charge.amount)}</span></div>)}
          {appearance.showTaxDetails !== false && totals.taxBreakdown.map((tax, index) => <div className="flex justify-between gap-4 text-slate-500" key={`${tax.label}-${tax.rate}-${index}`}><span>{tax.label}{tax.rate ? ` (${tax.rate}%)` : tax.treatment === 'exempt' ? ' — exempt' : ' — zero rated'}{totals.taxMode === 'inclusive' && tax.amount > 0 ? ' included' : ''}</span><span>{amount(tax.amount)}</span></div>)}
          <div className="mt-3 flex items-center justify-between gap-4 border-t-2 pt-3 text-[12px] font-extrabold text-slate-900" style={{ borderColor: 'var(--doc-accent)' }}><span>{doc.type === 'estimate' ? 'Estimated total' : doc.type === 'quotation' ? 'Quote total' : doc.type === 'creditnote' ? 'Credit total' : 'Total due'}</span><span className="tabular-nums">{amount(totals.total)}</span></div>
          {doc.type === 'invoice' && <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-100"><div className="flex justify-between gap-3 text-slate-500"><span>Recorded payments</span><span>{amount(balance.paid)}</span></div><div className="mt-1.5 flex justify-between gap-3 font-bold text-slate-800"><span>Balance outstanding</span><span>{amount(balance.balance)}</span></div></div>}
        </div>
      </div>
    </div>}

    {doc.scopeOfWork && <section className="mt-7"><h3 className="text-[10px] font-bold" style={{ color: 'var(--doc-accent)' }}>Scope of work</h3><p className="mt-2 whitespace-pre-wrap text-[10px] leading-5 text-slate-600">{doc.scopeOfWork}</p></section>}
    {doc.deliveryDetails && <section className="mt-5"><h3 className="text-[10px] font-bold" style={{ color: 'var(--doc-accent)' }}>Delivery details</h3><p className="mt-2 whitespace-pre-wrap text-[10px] leading-5 text-slate-600">{doc.deliveryDetails}</p></section>}
    {appearance.showPaymentDetails !== false && (doc.paymentInstructions || business.paymentInstructions || business.bankName || business.accountName || business.accountNumber || business.branch || business.swift) && <section className="mt-7 rounded-lg bg-slate-50 p-3.5"><h3 className="text-[10px] font-bold text-slate-800">Payment instructions</h3>{(doc.paymentInstructions || business.paymentInstructions) && <p className="mt-1.5 whitespace-pre-wrap text-[9px] leading-4 text-slate-600">{doc.paymentInstructions || business.paymentInstructions}</p>}{(business.bankName || business.accountName || business.accountNumber || business.branch || business.swift) && <p className="mt-2 text-[9px] leading-4 text-slate-600">{[business.bankName ? `Bank: ${business.bankName}` : '', business.accountName ? `Account name: ${business.accountName}` : '', business.accountNumber ? `Account no.: ${business.accountNumber}` : '', business.branch ? `Branch: ${business.branch}` : '', business.swift ? `SWIFT/BIC: ${business.swift}` : ''].filter(Boolean).join(' · ')}</p>}</section>}
    {appearance.showNotes !== false && doc.notes && <section className="mt-5"><h3 className="text-[10px] font-bold" style={{ color: 'var(--doc-accent)' }}>Notes</h3><p className="mt-1.5 whitespace-pre-wrap text-[9px] leading-4 text-slate-500">{doc.notes}</p></section>}
    {appearance.showTerms !== false && doc.terms && <section className="mt-5"><h3 className="text-[10px] font-bold" style={{ color: 'var(--doc-accent)' }}>Terms & conditions</h3><p className="mt-1.5 whitespace-pre-wrap text-[9px] leading-4 text-slate-500">{doc.terms}</p></section>}
    {doc.creditReason && <section className="mt-5"><h3 className="text-[10px] font-bold" style={{ color: 'var(--doc-accent)' }}>Reason for credit</h3><p className="mt-1.5 whitespace-pre-wrap text-[9px] leading-4 text-slate-500">{doc.creditReason}</p></section>}
    {(doc.thankYouMessage || (appearance.showFooter !== false && (doc.footer || business.footer))) && <footer className="mt-8 border-t border-slate-200 pt-4 text-center text-[9px] leading-4 text-slate-400">{doc.thankYouMessage && <p className="font-semibold text-slate-600">{doc.thankYouMessage}</p>}{appearance.showFooter !== false && (doc.footer || business.footer) && <p className="mt-1">{doc.footer || business.footer}</p>}</footer>}
    {!previewMode && <div className="document-preview-footer mt-8 flex items-center justify-between border-t border-slate-100 pt-3 text-[8px] text-slate-300"><span>{business.name || 'Business document'}</span><span>{doc.number || 'Draft preview'} · {currency}</span></div>}
  </article>;
}
