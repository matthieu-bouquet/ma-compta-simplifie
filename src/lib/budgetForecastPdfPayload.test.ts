// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, expect, it } from 'vitest'
import { buildBudgetForecastPdfPayload } from '@/lib/budgetForecastPdfPayload'

describe('buildBudgetForecastPdfPayload', () => {
  it('splits charges, produits and CVN buckets', () => {
    const p = buildBudgetForecastPdfPayload(
      {
        name: 'Test budget',
        updatedAt: new Date('2026-06-01T12:00:00Z'),
        lines: [
          { accountNumber: '606', accountName: 'Achats', amountCents: 10_000 },
          { accountNumber: '740', accountName: 'Subvention', amountCents: 25_000 },
          { accountNumber: '8641', accountName: 'CVN emploi', amountCents: 1_000 },
          { accountNumber: '8751', accountName: 'CVN contrib', amountCents: 1_000 },
        ],
      },
      'Mon asso',
    )

    expect(p.associationName).toBe('Mon asso')
    expect(p.budgetName).toBe('Test budget')
    expect(p.comptesCharges).toHaveLength(1)
    expect(p.comptesCharges[0].numero).toBe('606')
    expect(p.comptesProduits).toHaveLength(1)
    expect(p.totalCharges).toBe(100)
    expect(p.totalProduits).toBe(250)
    expect(p.resultat).toBe(150)
    expect(p.cvnEmploisRows).toHaveLength(1)
    expect(p.cvnContributionRows).toHaveLength(1)
    expect(p.cvnIsBalanced).toBe(true)
  })
})
