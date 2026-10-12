# Invoice & Quotation Builder

A local-first React application for creating branded business documents. It is built with React, Vite, JavaScript, Tailwind CSS, IndexedDB, Lucide React, and jsPDF with AutoTable.

## Run locally

**Requirements:** Node.js 18 or later and npm.

```bash
npm install
npm run dev
```

Vite prints the local development URL in the terminal. To create and preview a production build:

```bash
npm run build
npm run preview
```

Run the automated unit/component test suite with:

```bash
npm test
```

Use `npm run test:watch` while developing. Tests are configured for Vitest, jsdom, React Testing Library, and `@testing-library/jest-dom`.

## Main features

- **Six document types:** invoices, quotations, estimates, receipts, pro forma invoices, and credit notes.
- **Local document workspace:** drafts, saved documents, automatic draft saves, editable status, search, filters, duplicate, PDF download, print, and document conversion workflows.
- **Business profiles:** reusable company details, contacts, optional registration/tax and bank details, default currency/tax settings, payment instructions, and saved logo.
- **Custom logo upload:** PNG/JPEG/WebP up to 5 MB, decoded and dimension-checked, normalized to PNG while preserving transparency, previewed, replaced or removed, saved with the business profile and copied into document branding snapshots. SVG and other formats are rejected.
- **Customer management:** customer records and snapshots on documents, search, edit, view, and reuse in new documents.
- **Product and service catalogue:** reusable names, descriptions, units, SKUs, prices, discounts, and configurable tax treatment. Document line items retain their own copied values.
- **Line-item editor:** add, edit, reorder, duplicate, and remove items; quantity, price, fixed/percentage line discounts, tax treatment and rate.
- **Calculations:** line and document discounts, tax-inclusive/exclusive prices, mixed tax rates, exempt/zero-rated labels, extra charges, currency-aware precision, recorded payments and linked credit balances.
- **Document numbering:** separate configurable number formats per type and business profile within the local browser workspace.
- **Four document templates:** Classic Professional, Modern Minimal, Corporate, and Bold Creative, with editable accent colour, font, logo sizing/alignment/fit and optional sections.
- **Live preview and output:** print-focused HTML preview and a PDF generated as selectable vector text and tables (not an image of the app UI). A4 is the default; Letter is selectable in settings.
- **Payment tracking:** manually record, edit, and delete payments, show outstanding balances, and generate a receipt from a saved payment. No payment is verified against a real banking service.
- **Backup and recovery:** export a versioned JSON workspace backup including local logo data; validate and merge or replace data during import; explicit clear-workspace confirmation.
- **Responsive layout and themes:** sidebar/drawer navigation, mobile line-item cards, light/dark/system appearance, empty states, inline validation and toast feedback.

## Where data is stored

Documents, customers, products, business profiles, settings, activity records, payments, and image data are stored in IndexedDB in the current browser origin. The core app has no required backend, login, analytics service, or external document upload. A browser reset, clearing site data, or a different browser/device may make those records unavailable. Export regular backups and keep them somewhere safe.

Changing currency does **not** perform foreign-exchange conversion. Tax rates and labels are user-configurable; the application does not determine which rates or tax treatments are legally correct. Review documents against the rules that apply to your business before issuing them. Numbering sequences are local to this browser workspace and are not globally unique.

## Project structure

```text
src/
  app/App.jsx                    App navigation, state and workflows
  calculations/documentTotals.js Central calculation engine
  components/                    Dashboard, document editor, preview and settings
  services/database.js           Versioned IndexedDB stores and backup routines
  services/pdfService.js          Client-side PDF generation
  utils/documentTypes.js          Document factories, numbering and status rules
  utils/format.js                 Currency and date formatting
  utils/logo.js                   Image validation and logo sizing
  styles/index.css                Responsive, document and print styles
  tests/                          Calculation, numbering, logo and preview tests
```

## Important implementation notes

- Saved documents carry snapshots of their business/customer details, line-item prices, currency, terms and branding. Editing a business profile or catalogue item does not silently rewrite previous documents.
- Autosave runs after a short pause while editing. Use the explicit **Save document** action when you need immediate confirmation. Storage failures are shown as errors; the interface must not be treated as a successful backup until export has completed.
- PDF export embeds the normalized PNG logo and uses structured PDF text/tables. The preview and PDF share the calculation engine, but complex pagination/font metrics can differ slightly between HTML and PDF renderers; review the generated file before sending it to a client.
- A receipt represents a payment that the user recorded. It does not verify that funds actually cleared.
- Credit notes remain separate records and reduce linked invoice balances only when they are not drafts or cancelled. Finalized documents should not be silently rewritten as an accounting audit trail.
- IndexedDB is browser-local persistence, not encrypted storage or a cloud backup. Avoid using a shared/public computer for confidential business records.

## Test coverage

The included tests cover key calculation scenarios (discounts, mixed tax rates, inclusive/exclusive taxation, additional charges, invalid numbers, currency precision and payment balances), local document-number generation, file-name sanitization, invoice status rules, logo upload validation, and document preview rendering. Browser-dependent IndexedDB persistence, actual downloaded-PDF inspection, and the full cross-screen Playwright workflow should also be verified in the target browser before production deployment.
