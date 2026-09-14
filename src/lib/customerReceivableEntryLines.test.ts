// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, expect, it } from 'vitest'
import { mergeProductLinesByAccount } from '@/lib/customerReceivableEntryLines'

describe('mergeProductLinesByAccount', () => {
  it('sums amounts for the same product account', () => {
    const merged = mergeProductLinesByAccount([
      { accountId: 'a1', accountNumber: '706', accountName: 'Prestations', amountCents: 5000 },
      { accountId: 'a1', accountNumber: '706', accountName: 'Prestations', amountCents: 7000 },
      { accountId: 'a2', accountNumber: '754', accountName: 'Subventions', amountCents: 1000 },
    ])
    expect(merged).toHaveLength(2)
    expect(merged.find((l) => l.accountId === 'a1')?.amountCents).toBe(12000)
    expect(merged.find((l) => l.accountId === 'a2')?.amountCents).toBe(1000)
  })
})
