import React from 'react';
import { calculateDocument } from '../calculations/documentTotals';
import { DOCUMENT_TYPES } from '../utils/documentTypes';
import { formatCurrency, formatDate } from '../utils/format';
import { Button, EmptyState, Field, Icon, Panel, PageHeading, StatusBadge, inputClass, selectClass } from './common';

export default function DocumentList({ type, documents = [], customers = [], onCreate, onOpen, onDuplicate, onDelete, onDownload, onConvert, onChangeStatus, onBulkExport }) {
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState('all');
  const [currency, setCurrency] = React.useState('all');
  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');
  const [sortBy, setSortBy] = React.useState('updatedAt');
  const [sortOrder, setSortOrder] = React.useState('desc');
  const [selected, setSelected] = React.useState([]);
  const list = documents.filter((doc) => doc.type === type);
  const currencies = [...new Set(list.map((doc) => doc.currency || 'USD'))].sort();
  const statuses = [...new Set(list.map((doc) => doc.status || 'Draft'))].sort();
  const filtered = list.filter((doc) => {
    const q = search.trim().toLowerCase();
    const haystack = [doc.number, doc.customer?.name, doc.customer?.email, doc.business?.name, doc.notes, doc.intro].filter(Boolean).join(' ').toLowerCase();
    return (!q || haystack.includes(q)) && (status === 'all' || (doc.status || 'Draft') === status) && (currency === 'all' || (doc.currency || 'USD') === currency) && (!fromDate || (doc.issueDate || '') >= fromDate) && (!toDate || (doc.issueDate || '') <= toDate);
  }).sort((a, b) => {
    let av; let bv;
    if (sortBy === 'total') { av = calculateDocument(a).total; bv = calculateDocument(b).total; }
    else if (sortBy === 'customer') { av = a.customer?.name || ''; bv = b.customer?.name || ''; }
    else { av = a[sortBy] || ''; bv = b[sortBy] || ''; }
    const compare = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
    return sortOrder === 'asc' ? compare : -compare;
  });
  React.useEffect(() => setSelected((prev) => prev.filter((id) => filtered.some((doc) => doc.id === id))), [type, search, status, currency, fromDate, toDate]);
  const allVisibleSelected = filtered.length > 0 && filtered.every((doc) => selected.includes(doc.id));
  const toggleAll = () => setSelected(allVisibleSelected ? selected.filter((id) => !filtered.some((doc) => doc.id === id)) : [...new Set([...selected, ...filtered.map((doc) => doc.id)])]);
  const title = DOCUMENT_TYPES[type]?.plural || 'Documents';
  const canConvert = ['quotation', 'estimate'].includes(type);

  return <div>
    <PageHeading eyebrow="Document management" title={title} description={`Search, filter, review and manage your saved ${title.toLowerCase()}. Records are stored in your local browser workspace.`} actions={<Button icon="Plus" onClick={() => onCreate(type)}>Create {DOCUMENT_TYPES[type]?.label.toLowerCase()}</Button>} />
    <Panel padding="p-4" className="mb-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Field label="Search documents" className="md:col-span-2 xl:col-span-2"><div className="relative"><Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input className={`${inputClass} pl-9`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Number, customer, email, notes…" /></div></Field>
        <Field label="Status"><select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All statuses</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select></Field>
        <Field label="Currency"><select className={selectClass} value={currency} onChange={(e) => setCurrency(e.target.value)}><option value="all">All currencies</option>{currencies.map((value) => <option key={value}>{value}</option>)}</select></Field>
        <Field label="Sort by"><select className={selectClass} value={sortBy} onChange={(e) => setSortBy(e.target.value)}><option value="updatedAt">Last updated</option><option value="issueDate">Issue date</option><option value="number">Document number</option><option value="customer">Customer</option><option value="total">Total amount</option></select></Field>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3"><Field label="From issue date"><input type="date" className={inputClass} value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></Field><Field label="To issue date"><input type="date" className={inputClass} value={toDate} onChange={(e) => setToDate(e.target.value)} /></Field><Button variant="secondary" size="sm" icon="ArrowDownUp" onClick={() => setSortOrder((value) => value === 'asc' ? 'desc' : 'asc')}>{sortOrder === 'asc' ? 'Oldest / lowest first' : 'Newest / highest first'}</Button><Button variant="ghost" size="sm" onClick={() => { setSearch(''); setStatus('all'); setCurrency('all'); setFromDate(''); setToDate(''); setSortBy('updatedAt'); setSortOrder('desc'); }}>Clear filters</Button></div>
    </Panel>
    {selected.length > 0 && <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3"><p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{selected.length} document{selected.length > 1 ? 's' : ''} selected</p><div className="flex gap-2"><Button size="sm" variant="secondary" icon="FileJson" onClick={() => onBulkExport?.(documents.filter((doc) => selected.includes(doc.id)))}>Export selected data</Button>{selected.every((id) => documents.find((doc) => doc.id === id)?.status === 'Draft') && <Button size="sm" variant="danger" icon="Trash2" onClick={() => { if (window.confirm(`Delete ${selected.length} draft document(s)? This cannot be undone.`)) { selected.forEach((id) => onDelete(id, true)); setSelected([]); } }}>Delete drafts</Button>}</div></div>}
    <Panel padding="p-0" className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800"><div><h2 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{filtered.length} result{filtered.length === 1 ? '' : 's'} · {list.length} saved total</p></div><Button size="sm" variant="secondary" icon="Download" onClick={() => onBulkExport?.(filtered)} disabled={!filtered.length}>Export data</Button></div>
      {filtered.length ? <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead><tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-950"><th className="w-10 px-4 py-3"><input aria-label="Select all visible documents" type="checkbox" checked={allVisibleSelected} onChange={toggleAll} /></th><th className="px-3 py-3">Document</th><th className="px-3 py-3">Customer</th><th className="px-3 py-3">Issue / due</th><th className="px-3 py-3">Total</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Updated</th><th className="px-3 py-3 text-right">Actions</th></tr></thead>
        <tbody>{filtered.map((doc) => <tr key={doc.id} className="border-t border-slate-100 hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-800/30"><td className="px-4 py-3"><input aria-label={`Select ${doc.number}`} type="checkbox" checked={selected.includes(doc.id)} onChange={() => setSelected((prev) => prev.includes(doc.id) ? prev.filter((id) => id !== doc.id) : [...prev, doc.id])} /></td><td className="px-3 py-3"><button className="text-left" onClick={() => onOpen(doc)}><p className="text-xs font-bold text-slate-900 hover:text-primary dark:text-white">{doc.number || 'Draft'}</p><p className="mt-1 text-[10px] text-slate-400">{DOCUMENT_TYPES[doc.type]?.label}</p></button></td><td className="px-3 py-3"><p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{doc.customer?.name || '—'}</p><p className="mt-1 text-[10px] text-slate-400">{doc.customer?.email || ''}</p></td><td className="px-3 py-3"><p className="text-xs text-slate-600 dark:text-slate-300">{formatDate(doc.issueDate)}</p><p className="mt-1 text-[10px] text-slate-400">{doc.type === 'invoice' ? `Due ${formatDate(doc.dueDate)}` : ['quotation', 'estimate', 'proforma'].includes(doc.type) ? `Valid ${formatDate(doc.validUntil)}` : ''}</p></td><td className="px-3 py-3 text-xs font-bold text-slate-900 dark:text-white">{formatCurrency(doc.type === 'receipt' ? Number(doc.amountReceived || 0) : calculateDocument(doc).total, doc.currency || 'USD')}</td><td className="px-3 py-3"><StatusBadge status={doc.status || 'Draft'} /></td><td className="px-3 py-3 text-xs text-slate-500">{formatDate(doc.updatedAt || doc.createdAt)}</td><td className="px-3 py-3"><div className="flex justify-end gap-1"><button title="Edit document" aria-label={`Edit ${doc.number}`} onClick={() => onOpen(doc)} className="rounded-lg p-2 text-slate-500 hover:bg-primary/10 hover:text-primary"><Icon name="Pencil" size={15} /></button><button title="Download PDF" aria-label={`Download ${doc.number} PDF`} onClick={() => onDownload(doc)} className="rounded-lg p-2 text-slate-500 hover:bg-primary/10 hover:text-primary"><Icon name="Download" size={15} /></button><button title="Duplicate" aria-label={`Duplicate ${doc.number}`} onClick={() => onDuplicate(doc)} className="rounded-lg p-2 text-slate-500 hover:bg-primary/10 hover:text-primary"><Icon name="Copy" size={15} /></button>{canConvert && ['Draft', 'Sent', 'Accepted'].includes(doc.status) && <button title="Convert to invoice" aria-label={`Convert ${doc.number} to invoice`} onClick={() => onConvert(doc)} className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"><Icon name="ArrowRightLeft" size={15} /></button>}<button title="Delete document" aria-label={`Delete ${doc.number}`} onClick={() => { if (window.confirm(`Delete ${doc.number || 'this document'}? This action cannot be undone.`)) onDelete(doc.id); }} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"><Icon name="Trash2" size={15} /></button></div></td></tr>)}</tbody>
        </table></div> : <div className="p-5"><EmptyState icon="SearchX" title={list.length ? 'No documents match these filters' : `No ${title.toLowerCase()} yet`} description={list.length ? 'Try a different search phrase or clear the filters.' : `Create a ${DOCUMENT_TYPES[type]?.label.toLowerCase()} to start keeping your business records organized.`} action={list.length ? <Button variant="secondary" size="sm" onClick={() => { setSearch(''); setStatus('all'); setCurrency('all'); setFromDate(''); setToDate(''); }}>Clear filters</Button> : <Button size="sm" icon="Plus" onClick={() => onCreate(type)}>Create {DOCUMENT_TYPES[type]?.label.toLowerCase()}</Button>} /></div>}
    </Panel>
    <p className="mt-4 text-[11px] leading-5 text-slate-400">Documents are numbered within this browser workspace and business profile. Export a workspace backup to preserve records outside this browser.</p>
  </div>;
}
