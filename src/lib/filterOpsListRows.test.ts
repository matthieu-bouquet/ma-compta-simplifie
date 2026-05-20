// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, expect, it } from 'vitest'
import { filterOpsListRows, type OpsListRow } from '@/lib/filterOpsListRows'

const rows: OpsListRow[] = [
  {
    id: '1',
    dateIso: '2026-03-15',
    libelle: 'Achat fournitures',
    accountNumber: '606',
    accountName: 'Achats',
    paymentAccountId: 'pay-512',
    paymentAccountLabel: '512 - Banque',
    statusLabel: 'Payé',
    debitEuros: 50,
    creditEuros: null,
    hasDocument: false,
    documentId: null,
    documentMimeType: null,
    documentOriginalName: null,
    ligneSummary: 'summary-1',
  },
  {
    id: '2',
    dateIso: '2026-02-01',
    libelle: 'Cotisation annuelle',
    accountNumber: '706',
    accountName: 'Cotisations',
    paymentAccountId: 'pay-53',
    paymentAccountLabel: '53 - Caisse',
    statusLabel: 'Perçu',
    debitEuros: null,
    creditEuros: 120,
    hasDocument: true,
    documentId: 'doc-2',
    documentMimeType: 'image/png',
    documentOriginalName: 'recu.png',
    ligneSummary: 'summary-2',
  },
]

describe('filterOpsListRows', () => {
  it('returns all rows when filters are empty', () => {
    expect(
      filterOpsListRows(rows, {
        paymentAccountId: null,
        dateFrom: null,
        dateTo: null,
        libelle: '',
      }),
    ).toHaveLength(2)
  })

  it('filters by payment account id', () => {
    const filtered = filterOpsListRows(rows, {
      paymentAccountId: 'pay-53',
      dateFrom: null,
      dateTo: null,
      libelle: '',
    })
    expect(filtered.map((r) => r.id)).toEqual(['2'])
  })

  it('filters by inclusive date range', () => {
    const filtered = filterOpsListRows(rows, {
      paymentAccountId: null,
      dateFrom: new Date(2026, 2, 1),
      dateTo: new Date(2026, 2, 31),
      libelle: '',
    })
    expect(filtered.map((r) => r.id)).toEqual(['1'])
  })

  it('filters by libellé substring case-insensitively', () => {
    const filtered = filterOpsListRows(rows, {
      paymentAccountId: null,
      dateFrom: null,
      dateTo: null,
      libelle: 'COTISATION',
    })
    expect(filtered.map((r) => r.id)).toEqual(['2'])
  })
})
