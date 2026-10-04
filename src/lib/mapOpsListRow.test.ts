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
            accountName: 'Achats',
            debitCents: 10000,
            creditCents: 0,
            payableAllocations: [],
          },
          {
            accountNumber: '401',
            accountName: 'Fournisseurs',
            debitCents: 0,
            creditCents: 12000,
            payableAllocations: [{ amountCents: 5000 }],
          },
          {
            accountNumber: '512',
            accountName: 'Banque',
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
    expect(row.documents).toEqual([
      { id: 'doc-1', mimeType: 'application/pdf', originalName: 'facture.pdf' },
    ])
    expect(row.ligneSummary).toContain('Facture fournisseur')
    expect(row.ligneSummary).toContain('606')
  })

  it('keeps every document linked to the line', () => {
    const row = mapOpsEntryLineToRow({
      id: 'line-6185',
      accountNumber: '6185',
      accountName: 'Frais de colloques',
      debitCents: 8000,
      creditCents: 0,
      documents: [
        { document: { id: 'doc-1', mimeType: 'application/pdf', originalName: 'justif-1.pdf' } },
        { document: { id: 'doc-2', mimeType: 'image/png', originalName: 'justif-2.png' } },
      ],
      entry: {
        date: new Date('2026-03-12T12:00:00.000Z'),
        description: 'Formation encadrant',
        lines: [
          {
            accountNumber: '6185',
            accountName: 'Frais de colloques',
            debitCents: 8000,
            creditCents: 0,
          },
          {
            accountNumber: '512',
            accountName: 'Banque',
            debitCents: 0,
            creditCents: 8000,
          },
        ],
      },
    })

    expect(row.hasDocument).toBe(true)
    expect(row.documents).toEqual([
      { id: 'doc-1', mimeType: 'application/pdf', originalName: 'justif-1.pdf' },
      { id: 'doc-2', mimeType: 'image/png', originalName: 'justif-2.png' },
    ])
  })

  it('maps a line without documents to an empty list', () => {
    const row = mapOpsEntryLineToRow({
      id: 'line-706',
      accountNumber: '706',
      accountName: 'Prestations',
      debitCents: 0,
      creditCents: 3000,
      documents: [],
      entry: {
        date: new Date('2026-04-01T12:00:00.000Z'),
        description: 'Cotisation',
        lines: [
          {
            accountNumber: '706',
            accountName: 'Prestations',
            debitCents: 0,
            creditCents: 3000,
          },
        ],
      },
    })

    expect(row.hasDocument).toBe(false)
    expect(row.documents).toEqual([])
  })
})
