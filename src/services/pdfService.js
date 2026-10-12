import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculateDocument, calculatePayments } from '../calculations/documentTotals';
import { DOCUMENT_TYPES, sanitizeFilename } from '../utils/documentTypes';
import { formatDate } from '../utils/format';
import { fitImageSize } from '../utils/logo';

function safeText(value) { return value == null ? '' : String(value).trim(); }
function rgb(hex) {
  const clean = String(hex || '#4F46E5').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return [79, 70, 229];
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}
function money(value, currency, digits) {
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(value) || 0); }
  catch { return `${currency} ${(Number(value) || 0).toFixed(digits)}`; }
}
async function cropLogoToRatio(dataUrl, ratio) {
  const image = await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('The uploaded logo image could not be loaded for PDF export.')); img.src = dataUrl; });
  const targetWidth = 1000;
  const targetHeight = Math.max(1, Math.round(targetWidth / ratio));
  const canvas = document.createElement('canvas'); canvas.width = targetWidth; canvas.height = targetHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser could not prepare the logo for PDF export.');
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  let sx = 0; let sy = 0; let sw = image.naturalWidth; let sh = image.naturalHeight;
  if (sourceRatio > ratio) { sw = image.naturalHeight * ratio; sx = (image.naturalWidth - sw) / 2; }
  else { sh = image.naturalWidth / ratio; sy = (image.naturalHeight - sh) / 2; }
  context.clearRect(0, 0, targetWidth, targetHeight);
  context.drawImage(image, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
  return canvas.toDataURL('image/png');
}


export async function generateDocumentPdf(document, payments = [], { download = true } = {}) {
  if (!document || !document.type || !DOCUMENT_TYPES[document.type]) throw new Error('This document is missing its type or document details.');
  const currency = document.currency || 'USD';
  const totals = calculateDocument(document);
  const digits = totals.currencyDigits;
  const profile = document.business || {};
  const customer = document.customer || {};
  const appearance = document.appearance || {};
  const accent = rgb(appearance.accentColor || profile.accentColor);
  const pdfFont = appearance.fontFamily === 'Georgia' ? 'times' : appearance.fontFamily === 'Courier New' ? 'courier' : 'helvetica';
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: document.paperSize || 'a4', compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const usableWidth = pageWidth - margin * 2;
  let y = margin;

  // Branding is embedded into the actual PDF, not captured as a screenshot.
  const logoData = appearance.showLogo === false ? '' : safeText(profile.logoDataUrl || document.logoDataUrl);
  const logoPosition = appearance.logoPosition || 'left';
  let actualLogoWidth = 0;
  let actualLogoHeight = 0;
  if (logoData) {
    try {
      const meta = profile.logoMeta || document.logoMeta || {};
      const width = Math.max(18, Math.min(Number(appearance.logoWidth || 160) / 4, 58));
      const height = Math.max(10, Math.min(Number(appearance.logoMaxHeight || 72) / 3, 28));
      const size = appearance.logoFit === 'cover' ? { width, height } : fitImageSize(Number(meta.width) || width, Number(meta.height) || height, width, height);
      let x = margin;
      if (logoPosition === 'center') x = (pageWidth - size.width) / 2;
      if (logoPosition === 'right') x = pageWidth - margin - size.width;
      const imageData = appearance.logoFit === 'cover' ? await cropLogoToRatio(logoData, size.width / size.height) : logoData;
      pdf.addImage(imageData, 'PNG', x, y, size.width, size.height, undefined, 'FAST');
      actualLogoWidth = size.width;
      actualLogoHeight = size.height;
    } catch (error) {
      if (error?.message?.toLowerCase().includes('logo')) throw error;
      throw new Error('The logo could not be embedded in the PDF. Try uploading the logo again, then retry export.');
    }
  }

  const centeredLogo = Boolean(logoData && logoPosition === 'center');
  const businessX = logoData && logoPosition === 'left' ? margin + 65 : margin;
  const businessWidth = logoData && ['left', 'right'].includes(logoPosition) ? usableWidth - 65 : usableWidth;
  const businessTextX = centeredLogo ? pageWidth / 2 : businessX;
  const textAlign = centeredLogo ? { align: 'center' } : undefined;
  const businessName = safeText(profile.name || profile.businessName);
  const businessNameLines = businessName ? pdf.splitTextToSize(businessName, businessWidth) : [];
  let businessY = y + (centeredLogo ? actualLogoHeight + 7 : 4);
  if (businessNameLines.length) {
    pdf.setFont(pdfFont, 'bold'); pdf.setFontSize(12); pdf.setTextColor(15, 23, 42);
    pdf.text(businessNameLines, businessTextX, businessY, textAlign);
    businessY += businessNameLines.length * 4.5 + 1;
  }
  pdf.setFont(pdfFont, 'normal'); pdf.setFontSize(8); pdf.setTextColor(71, 85, 105);
  const address = [profile.streetAddress, profile.city, profile.province, profile.postalCode, profile.country].filter(Boolean).join(', ');
  const contactLines = [address, profile.email, profile.phone, profile.website, profile.taxNumber ? `Tax ID: ${profile.taxNumber}` : '', profile.registrationNumber ? `Registration: ${profile.registrationNumber}` : ''].filter(Boolean);
  contactLines.forEach((line) => {
    const lines = pdf.splitTextToSize(String(line), businessWidth);
    pdf.text(lines, businessTextX, businessY, textAlign);
    businessY += lines.length * 3.8;
  });
  y = Math.max(businessY, y + (logoData ? actualLogoHeight : 0) + 8, y + 16) + 7;

  const typeLabel = DOCUMENT_TYPES[document.type].label.toUpperCase();
  pdf.setFillColor(...accent); pdf.roundedRect(margin, y, usableWidth, 17, 1.5, 1.5, 'F');
  pdf.setTextColor(255, 255, 255); pdf.setFont(pdfFont, 'bold'); pdf.setFontSize(15);
  pdf.text(document.type === 'proforma' ? 'PRO FORMA INVOICE' : typeLabel, margin + 5, y + 7);
  pdf.setFontSize(9); pdf.text(safeText(document.number) || 'Draft', pageWidth - margin - 5, y + 7, { align: 'right' });
  pdf.setFont(pdfFont, 'normal'); pdf.setFontSize(8);
  pdf.text(`Issue date: ${formatDate(document.issueDate)}`, margin + 5, y + 12.5);
  const rightDateLabel = document.type === 'invoice' ? 'Due date' : ['quotation', 'estimate', 'proforma'].includes(document.type) ? 'Valid until' : document.type === 'receipt' ? 'Payment date' : '';
  const rightDate = document.type === 'receipt' ? document.paymentDate : document.dueDate || document.validUntil;
  if (rightDateLabel && rightDate) pdf.text(`${rightDateLabel}: ${formatDate(rightDate)}`, pageWidth - margin - 5, y + 12.5, { align: 'right' });
  y += 24;

  const leftX = margin;
  const rightX = pageWidth / 2 + 2;
  pdf.setFont(pdfFont, 'bold'); pdf.setFontSize(8); pdf.setTextColor(...accent);
  pdf.text(document.type === 'receipt' ? 'RECEIVED FROM' : document.type === 'creditnote' ? 'CREDIT ISSUED TO' : 'BILL TO', leftX, y);
  pdf.text('DOCUMENT DETAILS', rightX, y);
  y += 5;
  const customerName = safeText(customer.name || customer.businessName);
  if (customerName) {
    pdf.setFont(pdfFont, 'bold'); pdf.setFontSize(10); pdf.setTextColor(15, 23, 42);
    pdf.text(pdf.splitTextToSize(customerName, usableWidth / 2 - 5), leftX, y);
  }
  const recipientLines = [customer.contactPerson, customer.email, customer.phone, [customer.address, customer.city, customer.province, customer.postalCode, customer.country].filter(Boolean).join(', '), customer.taxNumber ? `Tax ID: ${customer.taxNumber}` : ''].filter(Boolean);
  pdf.setFont(pdfFont, 'normal'); pdf.setFontSize(8); pdf.setTextColor(71, 85, 105);
  let recipientY = y + (customerName ? 5 : 0);
  recipientLines.forEach((line) => {
    const wrapped = pdf.splitTextToSize(String(line), usableWidth / 2 - 5);
    pdf.text(wrapped, leftX, recipientY); recipientY += wrapped.length * 3.8;
  });
  let detailsY = y;
  const details = [
    ['Status', document.status],
    ...(document.type === 'invoice' ? [['Currency', currency]] : [['Currency', currency]]),
    ...(document.originalInvoiceNumber ? [['Original invoice', document.originalInvoiceNumber] ] : []),
    ...(document.relatedInvoiceNumber ? [['Related invoice', document.relatedInvoiceNumber]] : []),
    ...(document.paymentMethod && document.type === 'receipt' ? [['Method', document.paymentMethod]] : []),
    ...(document.paymentReference && document.type === 'receipt' ? [['Reference', document.paymentReference]] : []),
  ];
  details.forEach(([label, value]) => {
    if (!value) return;
    pdf.setFont(pdfFont, 'bold'); pdf.setTextColor(100, 116, 139); pdf.text(`${label}:`, rightX, detailsY);
    pdf.setFont(pdfFont, 'normal'); pdf.setTextColor(15, 23, 42); pdf.text(pdf.splitTextToSize(String(value), usableWidth / 2 - 28), rightX + 25, detailsY);
    detailsY += 5;
  });
  y = Math.max(recipientY, detailsY) + 6;
  if (document.intro) {
    pdf.setFont(pdfFont, 'normal'); pdf.setTextColor(71, 85, 105); pdf.setFontSize(9);
    const introLines = pdf.splitTextToSize(document.intro, usableWidth);
    pdf.text(introLines, margin, y); y += introLines.length * 4 + 4;
  }

  if (document.type === 'receipt') {
    const amount = Number(document.amountReceived || 0);
    autoTable(pdf, {
      startY: y,
      head: [['Payment description', 'Payment date', 'Method', 'Reference', 'Amount received']],
      body: [[document.paymentDescription || (document.relatedInvoiceNumber ? `Payment received for invoice ${document.relatedInvoiceNumber}` : 'Payment received'), formatDate(document.paymentDate), document.paymentMethod || '', document.paymentReference || '', money(amount, currency, digits)]],
      theme: 'grid', styles: { font: pdfFont, fontSize: 8, cellPadding: 3, textColor: [15, 23, 42], lineColor: [226, 232, 240] },
      headStyles: { fillColor: accent, textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: { 4: { halign: 'right' } }, margin: { left: margin, right: margin },
    });
    y = pdf.lastAutoTable.finalY + 7;
    pdf.setFont(pdfFont, 'bold'); pdf.setFontSize(12); pdf.setTextColor(...accent);
    pdf.text(`Amount received: ${money(amount, currency, digits)}`, pageWidth - margin, y, { align: 'right' });
  } else {
    const body = totals.lines.map((line) => [
      safeText(line.name || line.description || 'Item'),
      safeText(line.description),
      String(line.quantity),
      safeText(line.unit || 'Each'),
      money(line.unitPrice, currency, digits),
      line.lineDiscount > 0 ? money(line.lineDiscount, currency, digits) : '—',
      money(line.total, currency, digits),
    ]);
    autoTable(pdf, {
      startY: y,
      head: [['Item', 'Description', 'Qty', 'Unit', 'Unit price', 'Discount', 'Line total']],
      body,
      theme: document.template === 'creative' ? 'grid' : 'striped',
      styles: { font: pdfFont, fontSize: 7.5, cellPadding: appearance.compactTable ? 1.5 : 2.5, overflow: 'linebreak', textColor: [15, 23, 42], lineColor: [226, 232, 240], valign: 'top' },
      headStyles: { fillColor: accent, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 'auto' }, 2: { halign: 'right', cellWidth: 12 }, 3: { cellWidth: 15 }, 4: { halign: 'right', cellWidth: 24 }, 5: { halign: 'right', cellWidth: 22 }, 6: { halign: 'right', cellWidth: 25, fontStyle: 'bold' } },
      margin: { left: margin, right: margin, bottom: 18 },
      didDrawPage: () => {},
    });
    y = pdf.lastAutoTable.finalY + 6;

    const summaryRows = [[{ content: 'Subtotal', styles: { fontStyle: 'normal' } }, money(totals.subtotal, currency, digits)]];
    if (totals.lineDiscountTotal > 0) summaryRows.push(['Line discounts', `−${money(totals.lineDiscountTotal, currency, digits)}`]);
    if (totals.documentDiscount > 0) summaryRows.push(['Document discount', `−${money(totals.documentDiscount, currency, digits)}`]);
    if (appearance.showTaxDetails !== false && totals.taxMode === 'exclusive') totals.taxBreakdown.forEach((row) => summaryRows.push([row.rate > 0 ? `${row.label} (${row.rate}%)` : row.label, money(row.amount, currency, digits)]));
    if (totals.charges.length) totals.charges.forEach((charge) => summaryRows.push([charge.label || 'Additional charge', money(totals.taxMode === 'inclusive' ? charge.total : charge.amount, currency, digits)]));
    if (appearance.showTaxDetails !== false && totals.taxMode === 'inclusive' && totals.taxTotal > 0) summaryRows.push(['Tax included (informational)', `(${money(totals.taxTotal, currency, digits)})`]);
    const summaryWidth = 86;
    if (y + 40 > pageHeight - 25) { pdf.addPage(); y = margin; }
    autoTable(pdf, {
      startY: y,
      body: summaryRows,
      theme: 'plain', styles: { font: pdfFont, fontSize: 8, cellPadding: 1.8, textColor: [71, 85, 105] },
      columnStyles: { 0: { cellWidth: summaryWidth - 30 }, 1: { cellWidth: 30, halign: 'right', textColor: [15, 23, 42] } },
      margin: { left: pageWidth - margin - summaryWidth, right: margin },
    });
    y = pdf.lastAutoTable.finalY + 2;
    pdf.setFillColor(...accent); pdf.roundedRect(pageWidth - margin - summaryWidth, y, summaryWidth, 12, 1, 1, 'F');
    pdf.setTextColor(255, 255, 255); pdf.setFont(pdfFont, 'bold'); pdf.setFontSize(9);
    pdf.text('TOTAL', pageWidth - margin - summaryWidth + 4, y + 7.5);
    pdf.text(money(totals.total, currency, digits), pageWidth - margin - 4, y + 7.5, { align: 'right' });
    y += 17;

    if (document.type === 'invoice') {
      const balance = calculatePayments(payments, totals.total, Number(document.appliedCredits || 0), digits);
      pdf.setTextColor(15, 23, 42); pdf.setFontSize(8); pdf.setFont(pdfFont, 'normal');
      pdf.text(`Recorded payments: ${money(balance.paid, currency, digits)}`, pageWidth - margin, y, { align: 'right' }); y += 4.5;
      pdf.setFont(pdfFont, 'bold');
      pdf.text(`Outstanding balance: ${money(balance.balance, currency, digits)}`, pageWidth - margin, y, { align: 'right' }); y += 7;
    }
  }

  const bankDetails = [profile.bankName ? `Bank: ${profile.bankName}` : '', profile.accountName ? `Account name: ${profile.accountName}` : '', profile.accountNumber ? `Account number: ${profile.accountNumber}` : '', profile.branch ? `Branch: ${profile.branch}` : '', profile.swift ? `SWIFT/BIC: ${profile.swift}` : ''].filter(Boolean).join(' · ');
  const paymentDetails = [document.paymentInstructions || profile.paymentInstructions || '', bankDetails].filter(Boolean).join('\n');
  const extraSections = [
    ['Scope of work', document.scopeOfWork], ['Project description', document.projectDescription], ['Delivery details', document.deliveryDetails],
    ['Payment instructions', appearance.showPaymentDetails === false ? '' : paymentDetails],
    ['Payment terms', document.paymentTerms], ['Credit reason', document.creditReason], ['Notes', appearance.showNotes === false ? '' : document.notes],
    ['Terms and conditions', appearance.showTerms === false ? '' : document.terms],
  ];
  for (const [heading, content] of extraSections) {
    if (!safeText(content)) continue;
    if (y > pageHeight - 28) { pdf.addPage(); y = margin; }
    pdf.setFont(pdfFont, 'bold'); pdf.setTextColor(...accent); pdf.setFontSize(8.5); pdf.text(heading, margin, y); y += 4;
    pdf.setFont(pdfFont, 'normal'); pdf.setTextColor(51, 65, 85); pdf.setFontSize(8);
    const lines = pdf.splitTextToSize(String(content), usableWidth);
    for (const line of lines) {
      if (y > pageHeight - 18) { pdf.addPage(); y = margin; }
      pdf.text(line, margin, y); y += 4;
    }
    y += 3;
  }
  const footer = [document.thankYouMessage, appearance.showFooter === false ? '' : (document.footer || profile.footer)].filter(Boolean).join('  •  ');
  if (footer) {
    if (y > pageHeight - 20) { pdf.addPage(); y = margin; }
    pdf.setDrawColor(226, 232, 240); pdf.line(margin, y, pageWidth - margin, y); y += 5;
    pdf.setFont(pdfFont, 'normal'); pdf.setTextColor(100, 116, 139); pdf.setFontSize(7.5);
    pdf.text(pdf.splitTextToSize(footer, usableWidth), margin, y);
  }

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page); pdf.setFont(pdfFont, 'normal'); pdf.setTextColor(148, 163, 184); pdf.setFontSize(7);
    pdf.text(`${safeText(document.number) || 'Draft'} • Page ${page} of ${pages}`, pageWidth / 2, pageHeight - 6, { align: 'center' });
  }

  const clientName = customer.name || customer.businessName || 'Client';
  const filename = sanitizeFilename(`${document.number || DOCUMENT_TYPES[document.type].prefix}-${clientName}`) + '.pdf';
  if (download) pdf.save(filename);
  return { pdf, filename, blob: pdf.output('blob') };
}
