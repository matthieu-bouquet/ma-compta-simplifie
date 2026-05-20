// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, expect, it } from 'vitest'
import { mapOpsEntryLineToRow } from '@/lib/mapOpsListRow'

describe('mapOpsEntryLineToRow', () => {
  it('maps DB line to ops list row with payment and status', () => {
    const row = mapOpsEntryLineToRow({
      id: 'line-606',
      accountNumber: '606',
      accountName: 'Achats',
      debitCents: 10000,
      creditCents: 0,
      documents: [
        { document: { id: 'doc-1', mimeType: 'application/pdf', originalName: 'facture.pdf' } },
      ],
      entry: {
        date: new Date('2026-02-10T12:00:00.000Z'),
        description: 'Facture fournisseur',
        lines: [
          {
            accountNumber: '606',
            debitCents: 10000,
            creditCents: 0,
            payableAllocations: [],
          },
          {
            accountNumber: '401',
            debitCents: 0,
            creditCents: 12000,
            payableAllocations: [{ amountCents: 5000 }],
          },
          {
            accountNumber: '512',
            debitCents: 0,
            creditCents: 0,
            payableAllocations: [],
          },
        ],
      },
    })

    expect(row.id).toBe('line-606')
    expect(row.libelle).toBe('Facture fournisseur')
    expect(row.dateIso).toBe('2026-02-10')
    expect(row.paymentAccountLabel).toContain('512')
    expect(row.statusLabel).toBe('À payer')
    expect(row.debitEuros).toBe(100)
    expect(row.creditEuros).toBeNull()
    expect(row.hasDocument).toBe(true)
    expect(row.documentId).toBe('doc-1')
    expect(row.documentMimeType).toBe('application/pdf')
    expect(row.documentOriginalName).toBe('facture.pdf')
    expect(row.ligneSummary).toContain('Facture fournisseur')
    expect(row.ligneSummary).toContain('606')
  })
})
