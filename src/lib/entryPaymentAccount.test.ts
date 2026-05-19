// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, expect, it } from 'vitest'
import { paymentAccountLabel, resolveEntryPaymentAccount } from '@/lib/entryPaymentAccount'

describe('resolveEntryPaymentAccount', () => {
  it('returns class-5 line on the same entry when paid immediately', () => {
    const result = resolveEntryPaymentAccount([
      { accountId: 'op-1', accountNumber: '606', accountName: 'Achats', debitCents: 10000, creditCents: 0 },
      { accountId: 'pay-512', accountNumber: '512', accountName: 'Banque', debitCents: 0, creditCents: 10000 },
    ])
    expect(result).toEqual({
      accountId: 'pay-512',
      accountNumber: '512',
      accountName: 'Banque',
    })
    expect(paymentAccountLabel(result)).toBe('512 - Banque')
  })

  it('returns null for credit expense without settlement', () => {
    const result = resolveEntryPaymentAccount([
      { accountId: 'op-1', accountNumber: '606', accountName: 'Achats', debitCents: 12000, creditCents: 0 },
      {
        accountId: '401-1',
        accountNumber: '401',
        accountName: 'Fournisseurs',
        debitCents: 0,
        creditCents: 12000,
        payableAllocations: [],
      },
    ])
    expect(result).toBeNull()
  })

  it('returns treasury account from settlement entry when payable is allocated', () => {
    const result = resolveEntryPaymentAccount([
      { accountId: 'op-1', accountNumber: '606', accountName: 'Achats', debitCents: 12000, creditCents: 0 },
      {
        accountId: '401-1',
        accountNumber: '401',
        accountName: 'Fournisseurs',
        debitCents: 0,
        creditCents: 12000,
        payableAllocations: [
          {
            settlementLine: {
              entry: {
                lines: [
                  { accountId: 'pay-512', accountNumber: '512', accountName: 'Banque' },
                  { accountId: '401-1', accountNumber: '401', accountName: 'Fournisseurs' },
                ],
              },
            },
          },
        ],
      },
    ])
    expect(result?.accountNumber).toBe('512')
    expect(paymentAccountLabel(result)).toBe('512 - Banque')
  })
})
