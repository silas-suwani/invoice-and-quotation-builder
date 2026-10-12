import React from 'react';
import { DEFAULT_NUMBERING, DOCUMENT_TYPES, NAV_ITEMS, createEmptyDocument, createEmptyLine, getDocumentStatus, reserveDocumentNumber, todayISO } from '../utils/documentTypes';
import { calculateDocument, calculatePayments } from '../calculations/documentTotals';
import { formatCurrency, formatDate } from '../utils/format';
import { addActivity, clearWorkspace as clearWorkspaceDatabase, exportWorkspace, getAll, getById, getSettings, importWorkspace, put, remove } from '../services/database';
import { generateDocumentPdf } from '../services/pdfService';
import { validateDocumentNumbers } from '../utils/validation';
import Dashboard from '../components/Dashboard';
import DocumentList from '../components/DocumentList';
import DocumentEditor from '../components/DocumentEditor';
import CreateDocumentPage from '../components/CreateDocumentPage';
import BusinessProfilePage from '../components/BusinessProfilePage';
import SettingsPage from '../components/SettingsPage';
import TemplatesPage from '../components/TemplatesPage';
import HelpPage from '../components/HelpPage';
import PaymentDialog from '../components/PaymentDialog';
import { CustomerManager, ProductManager } from '../components/ManageRecords';
import { Button, Icon, PageHeading, Panel, ToastRegion, inputClass } from '../components/common';

const DEFAULT_SETTINGS = {
    id: 'main', theme: 'system', locale: 'en-GB', defaultCurrency: 'USD', defaultTemplate: 'classic', paperSize: 'a4',
    defaultDueDays: 14, defaultQuotationValidity: 30, activeProfileId: 'profile-default', numbering: DEFAULT_NUMBERING,
};

function createDefaultProfile(id = 'profile-default') {
    return {
        id, name: '', legalName: '', contactPerson: '', email: '', phone: '', alternatePhone: '', website: '', streetAddress: '', city: '', province: '', postalCode: '', country: '', taxNumber: '', registrationNumber: '', currency: 'USD', defaultTaxRate: 0, defaultTaxLabel: 'VAT', taxMode: 'exclusive', bankName: '', accountName: '', accountNumber: '', branch: '', swift: '', paymentInstructions: '', paymentTerms: 'Payment due within 14 days', defaultInvoiceNotes: '', defaultTerms: '', accentColor: '#4F46E5', logoDataUrl: '', logoMeta: null, logoPosition: 'left', logoWidth: 160, logoMaxHeight: 72, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
}


async function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; anchor.style.display = 'none';
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function getCreditsForInvoice(invoiceId, documents) {
    return documents.filter((doc) => doc.type === 'creditnote' && doc.relatedInvoiceId === invoiceId && !['Draft', 'Cancelled'].includes(doc.status)).reduce((sum, doc) => sum + calculateDocument(doc).total, 0);
}

function App() {
    const [loading, setLoading] = React.useState(true);
    const [loadError, setLoadError] = React.useState('');
    const [view, setView] = React.useState('dashboard');
    const [documents, setDocuments] = React.useState([]);
    const [customers, setCustomers] = React.useState([]);
    const [products, setProducts] = React.useState([]);
    const [profiles, setProfiles] = React.useState([]);
    const [payments, setPayments] = React.useState([]);
    const [activity, setActivity] = React.useState([]);
    const [settings, setSettings] = React.useState(DEFAULT_SETTINGS);
    const [activeDoc, setActiveDoc] = React.useState(null);
    const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
    const [searchText, setSearchText] = React.useState('');
    const [searchOpen, setSearchOpen] = React.useState(false);
    const [toasts, setToasts] = React.useState([]);
    const [paymentDialog, setPaymentDialog] = React.useState(null);
    const docsRef = React.useRef(documents);
    const paymentsRef = React.useRef(payments);
    const settingsRef = React.useRef(settings);
    const profilesRef = React.useRef(profiles);
    const numberReservationsRef = React.useRef([]);

    React.useEffect(() => { docsRef.current = documents; }, [documents]);
    React.useEffect(() => { paymentsRef.current = payments; }, [payments]);
    React.useEffect(() => { settingsRef.current = settings; }, [settings]);
    React.useEffect(() => { profilesRef.current = profiles; }, [profiles]);

    const notify = React.useCallback(({ kind = 'info', title, message = '' }) => {
        const id = crypto.randomUUID();
        setToasts((prev) => [...prev, { id, kind, title, message }].slice(-5));
        window.setTimeout(() => setToasts((prev) => prev.filter((item) => item.id !== id)), 5500);
    }, []);

    const loadWorkspace = React.useCallback(async () => {
        try {
            let loadedProfiles = await getAll('profiles');
            if (!loadedProfiles.length) {
                const profile = createDefaultProfile();
                await put('profiles', profile);
                loadedProfiles = [profile];
            }
            let loadedSettings = await getSettings();
            if (!loadedSettings) {
                loadedSettings = { ...DEFAULT_SETTINGS, numbering: structuredClone(DEFAULT_NUMBERING), activeProfileId: loadedProfiles[0]?.id || 'profile-default' };
                await put('settings', loadedSettings);
            }
            if (!loadedProfiles.some((profile) => profile.id === loadedSettings.activeProfileId)) {
                loadedSettings = { ...loadedSettings, activeProfileId: loadedProfiles[0].id };
                await put('settings', loadedSettings);
            }
            loadedSettings = { ...DEFAULT_SETTINGS, ...loadedSettings, numbering: { ...DEFAULT_NUMBERING, ...(loadedSettings.numbering || {}) } };
            const [loadedDocs, loadedCustomers, loadedProducts, loadedPayments, loadedActivity] = await Promise.all([
                getAll('documents'), getAll('customers'), getAll('products'), getAll('payments'), getAll('activity'),
            ]);
            setProfiles(loadedProfiles);
            setSettings(loadedSettings);
            setDocuments(loadedDocs);
            setCustomers(loadedCustomers);
            setProducts(loadedProducts);
            setPayments(loadedPayments);
            setActivity(loadedActivity);
            setLoadError('');
        } catch (error) {
            console.error('Workspace could not be loaded', error);
            setLoadError(error?.message || 'The local workspace could not be opened. Check browser storage permissions and reload.');
        } finally { setLoading(false); }
    }, []);

    React.useEffect(() => { loadWorkspace(); }, [loadWorkspace]);
    React.useEffect(() => {
        const mode = settings.theme || 'system';
        const media = window.matchMedia?.('(prefers-color-scheme: dark)');
        const apply = () => {
            const dark = mode === 'dark' || (mode === 'system' && Boolean(media?.matches));
            document.documentElement.classList.toggle('dark', dark);
            document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
        };
        apply();
        if (mode !== 'system' || !media) return undefined;
        media.addEventListener?.('change', apply);
        return () => media.removeEventListener?.('change', apply);
    }, [settings.theme]);

    const activeProfile = profiles.find((profile) => profile.id === settings.activeProfileId) || profiles[0] || null;
    const currentEditorCredits = activeDoc?.type === 'invoice' ? getCreditsForInvoice(activeDoc.id, documents) : 0;
    const currentEditorDoc = React.useMemo(() => {
        if (!activeDoc) return null;
        return activeDoc.type === 'invoice' ? { ...activeDoc, appliedCredits: currentEditorCredits } : activeDoc;
    }, [activeDoc, currentEditorCredits]);

    const displayDocuments = React.useMemo(() => documents.map((doc) => {
        if (doc.type !== 'invoice') return { ...doc, status: getDocumentStatus(doc) };
        const invoicePayments = payments.filter((payment) => payment.invoiceId === doc.id && payment.status !== 'void');
        const credits = getCreditsForInvoice(doc.id, documents);
        return { ...doc, appliedCredits: credits, status: getDocumentStatus(doc, invoicePayments, credits) };
    }), [documents, payments]);

    const persistSettings = React.useCallback(async (nextSettings) => {
        const merged = { ...settingsRef.current, ...nextSettings, id: 'main', updatedAt: new Date().toISOString() };
        await put('settings', merged);
        settingsRef.current = merged;
        setSettings(merged);
        return merged;
    }, []);

    const persistProfile = React.useCallback(async (profile) => {
        const next = { ...profile, id: profile.id || crypto.randomUUID(), updatedAt: new Date().toISOString() };
        await put('profiles', next);
        setProfiles((prev) => prev.some((item) => item.id === next.id) ? prev.map((item) => item.id === next.id ? next : item) : [...prev, next]);
        profilesRef.current = profilesRef.current.some((item) => item.id === next.id) ? profilesRef.current.map((item) => item.id === next.id ? next : item) : [...profilesRef.current, next];
        if (!settingsRef.current.activeProfileId) await persistSettings({ activeProfileId: next.id });
        await addActivity('profile-saved', `Saved business profile${next.name ? `: ${next.name}` : ''}`);
        setActivity((prev) => [{ id: crypto.randomUUID(), action: 'profile-saved', description: `Saved business profile${next.name ? `: ${next.name}` : ''}`, date: new Date().toISOString() }, ...prev]);
        notify({ kind: 'success', title: 'Business profile saved', message: 'New documents will use the saved details when this profile is active.' });
        return next;
    }, [notify, persistSettings]);

    const activateProfile = React.useCallback(async (profileId) => {
        await persistSettings({ activeProfileId: profileId });
        notify({ kind: 'success', title: 'Active business profile changed', message: 'New documents will use this profile. Existing documents keep their snapshots.' });
    }, [persistSettings, notify]);

    const saveDocument = React.useCallback(async (document, options = {}) => {
        if (!document?.id) throw new Error('The document is missing an ID and could not be saved.');
        const number = String(document.number || '').trim();
        if (!number) throw new Error('A document number is required before this document can be saved.');
        const numericErrors = validateDocumentNumbers(document);
        if (numericErrors.length) throw new Error(numericErrors[0]);
        const existing = docsRef.current.find((item) => item.id !== document.id && item.type === document.type && item.businessProfileId === document.businessProfileId && String(item.number).toLowerCase() === number.toLowerCase());
        if (existing) throw new Error(`The document number ${number} is already in use for this type and business profile.`);
        const next = { ...document, number, updatedAt: new Date().toISOString(), createdAt: document.createdAt || new Date().toISOString() };
        await put('documents', next);
        const updated = docsRef.current.some((item) => item.id === next.id) ? docsRef.current.map((item) => item.id === next.id ? next : item) : [next, ...docsRef.current];
        docsRef.current = updated;
        setDocuments(updated);
        if (!options.silent) {
            await addActivity('document-saved', `Saved ${DOCUMENT_TYPES[next.type]?.label.toLowerCase() || 'document'} ${next.number}`, next.id);
            setActivity((prev) => [{ id: crypto.randomUUID(), action: 'document-saved', description: `Saved ${DOCUMENT_TYPES[next.type]?.label.toLowerCase() || 'document'} ${next.number}`, documentId: next.id, date: new Date().toISOString() }, ...prev].slice(0, 200));
            notify({ kind: 'success', title: 'Document saved locally', message: `${next.number} is saved in this browser.` });
        }
        return next;
    }, [notify]);

    const allocateNumber = React.useCallback((type, profileId, extraDocs = []) => {
        const numberedRecords = [...docsRef.current, ...numberReservationsRef.current, ...extraDocs];
        const number = reserveDocumentNumber(type, profileId, settingsRef.current, numberedRecords);
        numberReservationsRef.current = [...numberReservationsRef.current, { type, businessProfileId: profileId, number }];
        return number;
    }, []);

    const goTo = React.useCallback(async (destination) => {
        if (view === 'editor' && activeDoc) {
            try {
                await saveDocument(activeDoc, { silent: true });
            } catch (error) {
                notify({ kind: 'error', title: 'Document not saved', message: `Your changes were kept in the editor. ${error?.message || 'Try saving again before leaving.'}` });
                return;
            }
        }
        setView(destination);
        setActiveDoc(null);
        setMobileMenuOpen(false);
        setSearchOpen(false);
    }, [activeDoc, view, saveDocument, notify]);

    const openDocument = React.useCallback(async (document) => {
        if (view === 'editor' && activeDoc && activeDoc.id !== document.id) {
            try {
                await saveDocument(activeDoc, { silent: true });
            } catch (error) {
                notify({ kind: 'error', title: 'Document not saved', message: `Your changes were kept in the editor. ${error?.message || 'Try saving again before opening another document.'}` });
                return;
            }
        }
        let current = { ...document };
        if (document.type === 'invoice') current.appliedCredits = getCreditsForInvoice(document.id, docsRef.current);
        setActiveDoc(current);
        setView('editor');
        setMobileMenuOpen(false);
    }, [activeDoc, view, saveDocument, notify]);

    const createDocument = React.useCallback(async (type = 'invoice', source = null) => {
        if (view === 'editor' && activeDoc) {
            try {
                await saveDocument(activeDoc, { silent: true });
            } catch (error) {
                notify({ kind: 'error', title: 'Current document not saved', message: `Save or correct the current document before starting another one. ${error?.message || ''}` });
                return null;
            }
        }
        const profile = source?.business || activeProfile || createDefaultProfile();
        const profileId = source?.businessProfileId || activeProfile?.id || profile.id || 'profile-default';
        const unsavedActive = activeDoc && !docsRef.current.some((item) => item.id === activeDoc.id) ? [activeDoc] : [];
        const number = allocateNumber(type, profileId, unsavedActive);
        let doc = createEmptyDocument(type, profile, settingsRef.current, number);
        doc.businessProfileId = profileId;
        doc.business = structuredClone(profile);
        doc.currency = source?.currency || profile.currency || settingsRef.current.defaultCurrency || 'USD';
        doc.taxMode = source?.taxMode || profile.taxMode || 'exclusive';
        doc.paperSize = source?.paperSize || settingsRef.current.paperSize || 'a4';
        doc.template = source?.template || settingsRef.current.defaultTemplate || 'classic';
        doc.appearance = {
            ...doc.appearance,
            accentColor: source?.appearance?.accentColor || profile.accentColor || '#4F46E5',
            logoPosition: source?.appearance?.logoPosition || profile.logoPosition || 'left',
            logoWidth: source?.appearance?.logoWidth || profile.logoWidth || 160,
            logoMaxHeight: source?.appearance?.logoMaxHeight || profile.logoMaxHeight || 72,
            logoSize: source?.appearance?.logoSize || 'medium',
            showLogo: source?.appearance?.showLogo !== false,
            ...(source?.appearance ? structuredClone(source.appearance) : {}),
        };
        if (source) {
            doc.customerId = source.customerId || '';
            doc.customer = structuredClone(source.customer || {});
            doc.lines = (source.lines || []).map((line) => ({ ...structuredClone(line), id: crypto.randomUUID() }));
            doc.documentDiscount = structuredClone(source.documentDiscount || { mode: 'none', value: 0 });
            doc.additionalCharges = structuredClone(source.additionalCharges || []);
            for (const key of ['terms', 'notes', 'intro', 'scopeOfWork', 'deliveryDetails', 'paymentInstructions', 'paymentTerms', 'footer', 'thankYouMessage']) doc[key] = source[key] || '';
        }
        setActiveDoc(doc);
        setView('editor');
        setSearchOpen(false);
        setMobileMenuOpen(false);
        return doc;
    }, [activeProfile, activeDoc, view, saveDocument, notify, allocateNumber]);

    const duplicateDocument = React.useCallback(async (source) => {
        const unsavedActive = activeDoc && !docsRef.current.some((item) => item.id === activeDoc.id) ? [activeDoc] : [];
        const number = allocateNumber(source.type, source.businessProfileId, unsavedActive);
        const duplicate = { ...structuredClone(source), id: crypto.randomUUID(), number, status: source.type === 'receipt' ? 'Recorded' : 'Draft', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), convertedFromId: '', convertedToInvoiceId: '', paymentId: '', amountReceived: source.type === 'receipt' ? 0 : source.amountReceived, payments: undefined };
        delete duplicate.appliedCredits;
        setActiveDoc(duplicate);
        setView('editor');
        notify({ kind: 'info', title: 'Document duplicated', message: `A new draft copy uses number ${number}. Payment history was not copied.` });
    }, [activeDoc, allocateNumber, notify]);

    const convertToInvoice = React.useCallback(async (source) => {
        if (!source || !['quotation', 'estimate'].includes(source.type)) return;
        const invoice = await createDocument('invoice', source);
        if (!invoice) return;
        const newInvoice = { ...invoice, convertedFromId: source.id, status: 'Draft' };
        await saveDocument(newInvoice, { silent: true });
        await saveDocument({ ...source, status: 'Converted to Invoice', convertedToInvoiceId: newInvoice.id, updatedAt: new Date().toISOString() }, { silent: true });
        setActiveDoc(newInvoice);
        notify({ kind: 'success', title: 'Converted to invoice', message: `${source.number} remains saved and ${newInvoice.number} was created.` });
    }, [createDocument, saveDocument, notify]);

    const deleteDocument = React.useCallback(async (id, silent = false) => {
        const target = docsRef.current.find((doc) => doc.id === id);
        if (!target) return;
        await remove('documents', id);
        if (target.type === 'invoice') {
            const relatedPayments = paymentsRef.current.filter((payment) => payment.invoiceId === id);
            for (const payment of relatedPayments) {
                await remove('payments', payment.id);
                if (payment.receiptId) {
                    const receipt = docsRef.current.find((doc) => doc.id === payment.receiptId);
                    if (receipt) await put('documents', { ...receipt, status: 'Cancelled', notes: [receipt.notes, 'Cancelled because the source payment was deleted.'].filter(Boolean).join('\n'), updatedAt: new Date().toISOString() });
                }
            }
            const nextPayments = paymentsRef.current.filter((payment) => payment.invoiceId !== id);
            paymentsRef.current = nextPayments; setPayments(nextPayments);
        }
        const nextDocs = docsRef.current.filter((doc) => doc.id !== id);
        docsRef.current = nextDocs; setDocuments(nextDocs);
        if (activeDoc?.id === id) { setActiveDoc(null); setView('dashboard'); }
        if (!silent) notify({ kind: 'success', title: 'Document deleted', message: 'The document was removed from local storage.' });
    }, [activeDoc, notify]);

    const downloadDocument = React.useCallback(async (doc) => {
        try {
            const invoicePayments = doc.type === 'invoice' ? paymentsRef.current.filter((payment) => payment.invoiceId === doc.id && payment.status !== 'void') : [];
            const { filename } = await generateDocumentPdf(doc, invoicePayments, { download: true });
            notify({ kind: 'success', title: 'PDF ready', message: `${filename} was generated and downloaded.` });
        } catch (error) {
            console.error('PDF export failed', error);
            notify({ kind: 'error', title: 'PDF export failed', message: error?.message || 'The PDF could not be generated. Your document is still available to retry.' });
        }
    }, [notify]);

    const saveCustomer = React.useCallback(async (customer) => {
        if (!customer.name?.trim()) throw new Error('A customer name is required.');
        const duplicateEmail = customers.find((row) => row.id !== customer.id && row.email && customer.email && row.email.toLowerCase() === customer.email.toLowerCase());
        if (duplicateEmail && !window.confirm(`A customer with email ${customer.email} already exists. Save another record anyway?`)) return;
        const next = { ...customer, id: customer.id || crypto.randomUUID(), name: customer.name.trim(), updatedAt: new Date().toISOString(), createdAt: customer.createdAt || new Date().toISOString() };
        await put('customers', next);
        setCustomers((prev) => prev.some((row) => row.id === next.id) ? prev.map((row) => row.id === next.id ? next : row) : [next, ...prev]);
        await addActivity('customer-saved', `Saved customer ${next.name}`);
        setActivity((prev) => [{ id: crypto.randomUUID(), action: 'customer-saved', description: `Saved customer ${next.name}`, date: new Date().toISOString() }, ...prev].slice(0, 200));
        notify({ kind: 'success', title: 'Customer saved', message: `${next.name} is available for future documents.` });
    }, [customers, notify]);

    const deleteCustomer = React.useCallback(async (id) => {
        await remove('customers', id);
        setCustomers((prev) => prev.filter((row) => row.id !== id));
        notify({ kind: 'success', title: 'Customer deleted', message: 'Historical document snapshots remain unchanged.' });
    }, [notify]);

    const saveProduct = React.useCallback(async (product) => {
        if (!product.name?.trim()) throw new Error('An item name is required.');
        if (!Number.isFinite(Number(product.unitPrice)) || Number(product.unitPrice) < 0) throw new Error('Unit price must be a valid non-negative amount.');
        const next = { ...product, id: product.id || crypto.randomUUID(), name: product.name.trim(), updatedAt: new Date().toISOString(), createdAt: product.createdAt || new Date().toISOString() };
        await put('products', next);
        setProducts((prev) => prev.some((row) => row.id === next.id) ? prev.map((row) => row.id === next.id ? next : row) : [next, ...prev]);
        notify({ kind: 'success', title: 'Catalogue item saved', message: `${next.name} is available for new line items.` });
    }, [notify]);

    const deleteProduct = React.useCallback(async (id) => { await remove('products', id); setProducts((prev) => prev.filter((row) => row.id !== id)); notify({ kind: 'success', title: 'Catalogue item deleted' }); }, [notify]);

    const createProfile = React.useCallback(async (profile) => {
        await put('profiles', profile);
        setProfiles((prev) => [...prev.filter((item) => item.id !== profile.id), profile]);
        profilesRef.current = [...profilesRef.current.filter((item) => item.id !== profile.id), profile];
        await persistSettings({ activeProfileId: profile.id });
    }, [persistSettings]);

    const deleteProfile = React.useCallback(async (id) => {
        if (docsRef.current.some((doc) => doc.businessProfileId === id)) { notify({ kind: 'error', title: 'Profile is in use', message: 'A profile with saved documents cannot be deleted.' }); return; }
        await remove('profiles', id);
        const next = profilesRef.current.filter((profile) => profile.id !== id);
        if (!next.length) { const profile = createDefaultProfile(); await put('profiles', profile); next.push(profile); }
        profilesRef.current = next; setProfiles(next);
        if (settingsRef.current.activeProfileId === id) await persistSettings({ activeProfileId: next[0].id });
        notify({ kind: 'success', title: 'Business profile deleted' });
    }, [notify, persistSettings]);

    const openPaymentDialog = React.useCallback(async (invoice, payment = null) => {
        try { await saveDocument(invoice, { silent: true }); } catch (error) { notify({ kind: 'error', title: 'Save invoice before payment', message: error.message }); return; }
        const total = calculateDocument(invoice).total;
        const paymentRows = paymentsRef.current.filter((row) => row.invoiceId === invoice.id && row.status !== 'void');
        const paid = paymentRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
        const credits = getCreditsForInvoice(invoice.id, docsRef.current);
        const priorPayment = payment ? Number(payment.amount || 0) : 0;
        setPaymentDialog({ invoice, payment, total, balance: total - paid - credits + priorPayment });
    }, [saveDocument, notify]);

    const savePayment = React.useCallback(async (paymentDraft) => {
        const invoice = docsRef.current.find((doc) => doc.id === paymentDraft.invoiceId);
        if (!invoice) throw new Error('The related invoice could not be found.');
        const current = paymentsRef.current.filter((payment) => payment.invoiceId === invoice.id && payment.status !== 'void' && payment.id !== paymentDraft.id).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
        const credit = getCreditsForInvoice(invoice.id, docsRef.current);
        const total = calculateDocument(invoice).total;
        if (Number(paymentDraft.amount) > total - current - credit + 0.000001 && !window.confirm('This payment is higher than the remaining invoice balance. Record the overpayment anyway?')) return;
        const nextPayment = { ...paymentDraft, id: paymentDraft.id || crypto.randomUUID(), invoiceId: invoice.id, amount: Number(paymentDraft.amount), status: 'recorded', updatedAt: new Date().toISOString(), createdAt: paymentDraft.createdAt || new Date().toISOString() };
        await put('payments', nextPayment);
        const nextPayments = paymentsRef.current.some((row) => row.id === nextPayment.id) ? paymentsRef.current.map((row) => row.id === nextPayment.id ? nextPayment : row) : [...paymentsRef.current, nextPayment];
        paymentsRef.current = nextPayments; setPayments(nextPayments);
        // Keep an already-generated receipt aligned with an edited source payment.
        if (nextPayment.receiptId) {
            const receipt = docsRef.current.find((doc) => doc.id === nextPayment.receiptId);
            if (receipt) {
                const nextReceipt = { ...receipt, amountReceived: nextPayment.amount, paymentDate: nextPayment.date, paymentMethod: nextPayment.method, paymentReference: nextPayment.reference, notes: nextPayment.notes || receipt.notes, updatedAt: new Date().toISOString() };
                await put('documents', nextReceipt);
                const nextDocs = docsRef.current.map((doc) => doc.id === nextReceipt.id ? nextReceipt : doc);
                docsRef.current = nextDocs; setDocuments(nextDocs);
                if (activeDoc?.id === nextReceipt.id) setActiveDoc(nextReceipt);
            }
        }
        await addActivity('payment-recorded', `${nextPayment.id === paymentDraft.id ? 'Updated' : 'Recorded'} payment for ${invoice.number}`, invoice.id);
        setActivity((prev) => [{ id: crypto.randomUUID(), action: 'payment-recorded', description: `Recorded payment for ${invoice.number}`, documentId: invoice.id, date: new Date().toISOString() }, ...prev].slice(0, 200));
        setPaymentDialog(null);
        notify({ kind: 'success', title: paymentDraft.id ? 'Payment updated' : 'Payment recorded', message: 'Invoice balance has been recalculated.' });
    }, [activeDoc, notify]);

    const deletePayment = React.useCallback(async (payment) => {
        if (!window.confirm(`Delete this recorded payment of ${formatCurrency(payment.amount, activeDoc?.currency || 'USD')}? The invoice balance will update.`)) return;
        await remove('payments', payment.id);
        const nextPayments = paymentsRef.current.filter((row) => row.id !== payment.id);
        paymentsRef.current = nextPayments; setPayments(nextPayments);
        if (payment.receiptId) {
            const receipt = docsRef.current.find((doc) => doc.id === payment.receiptId);
            if (receipt) {
                const nextReceipt = { ...receipt, status: 'Cancelled', notes: [receipt.notes, 'Source payment deleted; this receipt is no longer valid.'].filter(Boolean).join('\n'), updatedAt: new Date().toISOString() };
                await put('documents', nextReceipt);
                const nextDocs = docsRef.current.map((doc) => doc.id === nextReceipt.id ? nextReceipt : doc);
                docsRef.current = nextDocs; setDocuments(nextDocs);
            }
        }
        notify({ kind: 'success', title: 'Payment deleted', message: 'The invoice balance and related receipt status have been updated.' });
    }, [activeDoc, notify]);

    const generateReceipt = React.useCallback(async (invoice, payment) => {
        if (payment.receiptId) {
            const existing = docsRef.current.find((doc) => doc.id === payment.receiptId);
            if (existing) { openDocument(existing); return; }
        }
        const unsavedActive = activeDoc && !docsRef.current.some((item) => item.id === activeDoc.id) ? [activeDoc] : [];
        const number = allocateNumber('receipt', invoice.businessProfileId, unsavedActive);
        const profileSnapshot = invoice.business || activeProfile || createDefaultProfile();
        const receipt = createEmptyDocument('receipt', profileSnapshot, settingsRef.current, number);
        Object.assign(receipt, {
            businessProfileId: invoice.businessProfileId, business: structuredClone(profileSnapshot), customerId: invoice.customerId || '', customer: structuredClone(invoice.customer || {}),
            status: 'Recorded', issueDate: payment.date || todayISO(), paymentDate: payment.date || todayISO(), currency: invoice.currency || 'USD', amountReceived: Number(payment.amount || 0),
            paymentMethod: payment.method || 'Other', paymentReference: payment.reference || '', paymentDescription: `Payment received for invoice ${invoice.number}`,
            relatedInvoiceId: invoice.id, relatedInvoiceNumber: invoice.number, paymentId: payment.id, notes: payment.notes || '', terms: '',
            template: invoice.template || 'classic', appearance: structuredClone(invoice.appearance || receipt.appearance),
        });
        await saveDocument(receipt, { silent: true });
        const linkedPayment = { ...payment, receiptId: receipt.id, updatedAt: new Date().toISOString() };
        await put('payments', linkedPayment);
        const nextPayments = paymentsRef.current.map((row) => row.id === payment.id ? linkedPayment : row);
        paymentsRef.current = nextPayments; setPayments(nextPayments);
        notify({ kind: 'success', title: 'Receipt created', message: `${receipt.number} records the payment of ${formatCurrency(payment.amount, invoice.currency || 'USD')}.` });
        openDocument(receipt);
    }, [activeProfile, activeDoc, allocateNumber, openDocument, saveDocument, notify]);

    const exportBackup = React.useCallback(async () => {
        try {
            const backup = await exportWorkspace();
            await downloadBlob(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }), `invoice-builder-backup-${todayISO()}.json`);
            notify({ kind: 'success', title: 'Workspace backup exported', message: 'Keep this file somewhere safe. It includes the locally stored logo images.' });
        } catch (error) { notify({ kind: 'error', title: 'Backup export failed', message: error.message }); }
    }, [notify]);

    const importBackup = React.useCallback(async (backup, mode) => {
        if (mode === 'replace' && !window.confirm('Replace the current workspace with this backup? Existing local records will be deleted.')) return;
        try {
            await importWorkspace(backup, mode);
            if (mode === 'replace') numberReservationsRef.current = [];
            setLoading(true);
            await loadWorkspace();
            setActiveDoc(null); setView('dashboard');
            notify({ kind: 'success', title: 'Workspace restored', message: mode === 'replace' ? 'The selected backup replaced the local workspace.' : 'Backup records were merged into the local workspace.' });
        } catch (error) { notify({ kind: 'error', title: 'Restore failed', message: error.message }); throw error; }
    }, [loadWorkspace, notify]);

    const clearWorkspace = React.useCallback(async () => {
        try {
            await clearWorkspaceDatabase();
            numberReservationsRef.current = [];
            await loadWorkspace();
            setActiveDoc(null); setView('dashboard'); setPaymentDialog(null);
            notify({ kind: 'success', title: 'Workspace cleared', message: 'A fresh, empty local workspace is ready.' });
        } catch (error) { notify({ kind: 'error', title: 'Could not clear workspace', message: error.message }); }
    }, [loadWorkspace, notify]);

    const exportSelected = React.useCallback(async (docs) => {
        try {
            const payload = { application: 'Invoice & Quotation Builder', exportType: 'selected-documents', schemaVersion: 1, exportedAt: new Date().toISOString(), documents: docs };
            await downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), `selected-documents-${todayISO()}.json`);
            notify({ kind: 'success', title: 'Document data exported', message: `${docs.length} document record(s) exported as JSON.` });
        } catch (error) { notify({ kind: 'error', title: 'Export failed', message: error.message }); }
    }, [notify]);

    const navCurrent = NAV_ITEMS.find((item) => item.id === view);
    const title = view === 'editor' ? (activeDoc?.number || 'Document editor') : view === 'create' ? 'Create document' : navCurrent?.label || 'Dashboard';
    const searchResults = searchText.trim() ? [
        ...displayDocuments.filter((doc) => [doc.number, doc.customer?.name, doc.customer?.email, doc.business?.name].filter(Boolean).join(' ').toLowerCase().includes(searchText.toLowerCase())).slice(0, 5).map((doc) => ({ kind: 'document', id: doc.id, title: doc.number || 'Draft document', sub: `${DOCUMENT_TYPES[doc.type]?.label} · ${doc.customer?.name || 'No customer'}`, action: () => openDocument(doc) })),
        ...customers.filter((customer) => [customer.name, customer.email, customer.phone].filter(Boolean).join(' ').toLowerCase().includes(searchText.toLowerCase())).slice(0, 3).map((customer) => ({ kind: 'customer', id: customer.id, title: customer.name, sub: customer.email || 'Customer record', action: () => { goTo('customers'); setSearchText(customer.name); } })),
        ...products.filter((product) => [product.name, product.sku, product.category].filter(Boolean).join(' ').toLowerCase().includes(searchText.toLowerCase())).slice(0, 3).map((product) => ({ kind: 'product', id: product.id, title: product.name, sub: 'Product or service', action: () => goTo('products') })),
    ].slice(0, 9) : [];

    const sidebarContent = (mobile = false) => <>
        <div className={`flex h-[72px] items-center gap-3 border-b border-slate-100 px-5 dark:border-slate-800 ${sidebarCollapsed && !mobile ? 'justify-center px-3' : ''}`}><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm"><Icon name="FileText" size={22} /></div>{(!sidebarCollapsed || mobile) && <div className="min-w-0"><p className="truncate text-sm font-extrabold tracking-tight text-slate-900 dark:text-white">Invoice Builder</p><p className="mt-0.5 text-[10px] text-slate-400">Business documents, simplified</p></div>}{mobile && <button className="ml-auto rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setMobileMenuOpen(false)} aria-label="Close navigation"><Icon name="X" size={18} /></button>}</div>
        <div className="flex-1 overflow-y-auto px-3 py-4"><p className={`mb-2 px-3 text-[9px] font-bold uppercase tracking-[.16em] text-slate-400 ${sidebarCollapsed && !mobile ? 'sr-only' : ''}`}>Workspace</p><nav aria-label="Main navigation" className="space-y-1">{NAV_ITEMS.map((item, index) => {
            const active = view === item.id || (view === 'editor' && item.id === 'create') || (item.type && navCurrent?.type === item.type);
            if (index === 8) return <React.Fragment key={item.id}><div className={`pb-1 pt-4 ${sidebarCollapsed && !mobile ? 'px-1' : 'px-3'}`}><div className="h-px bg-slate-100 dark:bg-slate-800" /><p className={`mt-4 text-[9px] font-bold uppercase tracking-[.16em] text-slate-400 ${sidebarCollapsed && !mobile ? 'sr-only' : ''}`}>Manage</p></div><button key={item.id} title={sidebarCollapsed && !mobile ? item.label : undefined} onClick={() => goTo(item.id)} className={`sidebar-nav-item ${active ? 'sidebar-nav-item-active' : ''} ${sidebarCollapsed && !mobile ? 'justify-center px-0' : ''}`}><Icon name={item.icon} size={18} />{(!sidebarCollapsed || mobile) && <span>{item.label}</span>}{(!sidebarCollapsed || mobile) && active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}</button></React.Fragment>;
            return <button key={item.id} title={sidebarCollapsed && !mobile ? item.label : undefined} onClick={() => goTo(item.id)} className={`sidebar-nav-item ${active ? 'sidebar-nav-item-active' : ''} ${sidebarCollapsed && !mobile ? 'justify-center px-0' : ''}`}><Icon name={item.icon} size={18} />{(!sidebarCollapsed || mobile) && <span>{item.label}</span>}{(!sidebarCollapsed || mobile) && active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}</button>;
        })}</nav></div>
        {(!sidebarCollapsed || mobile) && <div className="border-t border-slate-100 p-4 dark:border-slate-800"><div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><Icon name="HardDrive" size={14} /></span><p className="text-xs font-bold text-slate-700 dark:text-slate-200">Saved locally</p></div><p className="mt-2 text-[10px] leading-4 text-slate-500 dark:text-slate-400">Your records stay in this browser. Export a backup regularly.</p><button onClick={() => goTo('settings')} className="mt-2 text-[10px] font-bold text-primary hover:underline">Manage backups <span aria-hidden="true">→</span></button></div></div>}
        {!mobile && <button onClick={() => setSidebarCollapsed((prev) => !prev)} className="hidden h-12 items-center justify-center border-t border-slate-100 text-slate-400 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-800 dark:hover:bg-slate-800 lg:flex" aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}><Icon name={sidebarCollapsed ? 'PanelLeftOpen' : 'PanelLeftClose'} size={17} /></button>}
    </>;

    if (loading) return <div className="flex min-h-screen items-center justify-center bg-canvas px-6 dark:bg-slate-950"><div className="text-center"><div className="mx-auto flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl bg-primary text-white"><Icon name="FileText" size={23} /></div><p className="mt-4 text-sm font-bold text-slate-800 dark:text-white">Opening your workspace…</p><p className="mt-1 text-xs text-slate-500">Loading locally saved business records</p></div></div>;
    if (loadError) return <div className="flex min-h-screen items-center justify-center bg-canvas p-6 dark:bg-slate-950"><Panel className="max-w-lg"><div className="flex items-start gap-3"><Icon name="AlertTriangle" size={24} className="text-red-500" /><div><h1 className="text-lg font-bold text-slate-900 dark:text-white">Workspace unavailable</h1><p className="mt-2 text-sm leading-6 text-slate-500">{loadError}</p><p className="mt-2 text-xs leading-5 text-slate-400">Your browser may have blocked local storage or reached a storage limit. No data was reported as saved successfully.</p><Button className="mt-4" onClick={() => { setLoading(true); loadWorkspace(); }} icon="RefreshCw">Try again</Button></div></div></Panel></div>;

    const viewContent = () => {
        if (view === 'dashboard') return <Dashboard documents={displayDocuments} customers={customers} payments={payments} activity={activity} profile={activeProfile} profiles={profiles} onCreate={createDocument} onOpen={openDocument} onView={goTo} />;
        if (view === 'create') return <CreateDocumentPage onCreate={createDocument} onView={goTo} />;
        const navItem = NAV_ITEMS.find((item) => item.id === view);
        if (navItem?.type) return <DocumentList type={navItem.type} documents={displayDocuments} customers={customers} onCreate={createDocument} onOpen={openDocument} onDuplicate={duplicateDocument} onDelete={deleteDocument} onDownload={downloadDocument} onConvert={convertToInvoice} onBulkExport={exportSelected} />;
        if (view === 'customers') return <CustomerManager customers={customers} documents={documents} onSave={saveCustomer} onDelete={deleteCustomer} onToast={notify} />;
        if (view === 'products') return <ProductManager products={products} documents={documents} onSave={saveProduct} onDelete={deleteProduct} onToast={notify} />;
        if (view === 'business') return <BusinessProfilePage profiles={profiles} activeProfile={activeProfile} activeProfileId={settings.activeProfileId} documents={documents} onSave={persistProfile} onCreate={createProfile} onActivate={activateProfile} onDelete={deleteProfile} onToast={notify} />;
        if (view === 'templates') return <TemplatesPage settings={settings} onSave={persistSettings} onToast={notify} onCreate={createDocument} />;
        if (view === 'settings') return <SettingsPage settings={settings} onSave={persistSettings} onThemeChange={(theme) => setSettings((prev) => ({ ...prev, theme }))} onExportBackup={exportBackup} onImportBackup={importBackup} onClearWorkspace={clearWorkspace} onToast={notify} profiles={profiles} />;
        if (view === 'help') return <HelpPage onCreate={createDocument} onView={goTo} />;
        if (view === 'editor' && activeDoc) {
            const current = currentEditorDoc || activeDoc;
            return <DocumentEditor document={current} profiles={profiles} activeProfile={activeProfile} customers={customers} products={products} payments={payments} allDocuments={displayDocuments} settings={settings} onDocumentChange={(doc) => setActiveDoc(doc)} onSave={saveDocument} onClose={() => goTo(activeDoc?.type ? `${activeDoc.type === 'proforma' ? 'proforma' : activeDoc.type === 'creditnote' ? 'creditnotes' : `${activeDoc.type}s`}` : 'dashboard')} onDownload={() => downloadDocument(current)} onPrint={() => window.print()} onRecordPayment={(invoice) => openPaymentDialog(invoice)} onEditPayment={(invoice, payment) => openPaymentDialog(invoice, payment)} onDeletePayment={deletePayment} onGenerateReceipt={generateReceipt} onToast={notify} onConvert={convertToInvoice} />;
        }
        return <Dashboard documents={displayDocuments} customers={customers} payments={payments} activity={activity} profile={activeProfile} profiles={profiles} onCreate={createDocument} onOpen={openDocument} onView={goTo} />;
    };

    const searchableViews = view === 'editor';
    return <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <div className="flex min-h-screen">
            <aside className={`relative z-30 hidden shrink-0 flex-col border-r border-slate-200 bg-white transition-all duration-200 dark:border-slate-800 dark:bg-slate-900 lg:flex ${sidebarCollapsed ? 'w-[76px]' : 'w-[252px]'}`}>{sidebarContent(false)}</aside>
            {mobileMenuOpen && <div className="fixed inset-0 z-50 flex lg:hidden"><button aria-label="Close navigation overlay" className="absolute inset-0 bg-slate-950/45" onClick={() => setMobileMenuOpen(false)} /><aside className="relative z-10 flex w-[min(86vw,320px)] flex-col bg-white shadow-2xl dark:bg-slate-900">{sidebarContent(true)}</aside></div>}

            <div className="flex min-w-0 flex-1 flex-col">
                <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90 sm:px-6 lg:px-8">
                    <div className="flex min-w-0 items-center gap-3"><button className="rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden" onClick={() => setMobileMenuOpen(true)} aria-label="Open navigation"><Icon name="Menu" size={19} /></button><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-400">Workspace</p><h1 className="truncate text-sm font-bold text-slate-900 dark:text-white sm:text-base">{title}</h1></div></div>
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className={`relative hidden sm:block ${searchOpen ? 'w-60' : 'w-52'}`}><Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={searchText} onChange={(e) => { setSearchText(e.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} onKeyDown={(e) => { if (e.key === 'Escape') setSearchOpen(false); if (e.key === 'Enter' && searchResults[0]) searchResults[0].action(); }} placeholder="Search workspace…" className={`${inputClass} h-10 bg-slate-50 pl-9 pr-3 text-xs dark:bg-slate-950`} aria-label="Search documents, customers and products" />{searchOpen && searchText && <div className="absolute right-0 top-12 z-40 w-[min(360px,90vw)] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">{searchResults.length ? searchResults.map((result) => <button key={`${result.kind}-${result.id}`} onClick={() => { result.action(); setSearchOpen(false); }} className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800"><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon name={result.kind === 'document' ? 'FileText' : result.kind === 'customer' ? 'UserRound' : 'Package'} size={15} /></span><span className="min-w-0"><span className="block truncate text-xs font-bold text-slate-800 dark:text-slate-100">{result.title}</span><span className="mt-1 block truncate text-[10px] text-slate-500">{result.sub}</span></span></button>) : <p className="px-3 py-5 text-center text-xs text-slate-500">No matching records found.</p>}{searchResults.length > 0 && <button onClick={() => { setSearchOpen(false); goTo('invoices'); }} className="mt-1 w-full border-t border-slate-100 px-3 py-2 text-left text-[10px] font-bold text-primary dark:border-slate-800">Open document lists</button>}</div>}{searchOpen && !searchText && <button aria-label="Close search" className="fixed inset-0 z-[-1] cursor-default" onClick={() => setSearchOpen(false)} />}</div>
                        <div className="hidden items-center gap-1.5 rounded-xl bg-emerald-50 px-2.5 py-2 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 md:flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Local workspace</div>
                        <button onClick={() => { const current = settings.theme || 'system'; const next = current === 'dark' ? 'light' : current === 'light' ? 'system' : 'dark'; persistSettings({ theme: next }); }} title={`Theme: ${settings.theme || 'system'}`} aria-label="Switch application theme" className="rounded-xl border border-slate-200 p-2.5 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"> <Icon name={(settings.theme || 'system') === 'dark' ? 'Moon' : (settings.theme || 'system') === 'light' ? 'Sun' : 'Laptop'} size={17} /> </button>
                        <Button icon="Plus" size="sm" onClick={() => createDocument('invoice')} className="hidden sm:inline-flex">New document</Button>
                        <button onClick={() => goTo('settings')} aria-label="Open settings" className="rounded-xl border border-slate-200 p-2.5 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><Icon name="Settings" size={17} /></button>
                    </div>
                </header>
                <main className={`min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-8 ${view === 'editor' ? 'max-w-none' : 'mx-auto w-full max-w-[1600px]'}`} onClick={() => { if (searchOpen && !searchText) setSearchOpen(false); }}>
                    {viewContent()}
                </main>
                <footer className="border-t border-slate-200 px-4 py-4 text-center text-[10px] text-slate-400 dark:border-slate-800"><p>Invoice & Quotation Builder <span className="mx-1">·</span> Local-first business documents <span className="mx-1">·</span> Your data stays in this browser</p></footer>
            </div>
        </div>
        <PaymentDialog state={paymentDialog} onClose={() => setPaymentDialog(null)} onSave={savePayment} />
        <ToastRegion toasts={toasts} dismiss={(id) => setToasts((prev) => prev.filter((toast) => toast.id !== id))} />
    </div>;
}

export default App;
