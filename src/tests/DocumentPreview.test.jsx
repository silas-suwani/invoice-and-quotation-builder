import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import DocumentPreview from '../components/DocumentPreview';

describe('DocumentPreview', () => {
  it('renders saved document details and calculates total from live data', () => {
    render(<DocumentPreview document={{
      id: 'doc-1', type: 'invoice', number: 'INV-2026-0001', status: 'Draft', issueDate: '2026-10-10', currency: 'USD', taxMode: 'exclusive',
      business: { name: 'Example Studio', email: 'hello@example.test' }, customer: { name: 'Client Company' },
      lines: [{ id: 'line-1', name: 'Design service', quantity: 1, unitPrice: 100, taxRate: 10, taxTreatment: 'taxable', taxLabel: 'VAT' }],
      appearance: { accentColor: '#4F46E5', showLogo: true, showNotes: true, showTerms: true, showFooter: true },
    }} />);
    expect(screen.getByText('Example Studio')).toBeInTheDocument();
    expect(screen.getByText('Client Company')).toBeInTheDocument();
    expect(screen.getByText('Design service')).toBeInTheDocument();
    expect(screen.getByText('$110.00')).toBeInTheDocument();
  });
});
