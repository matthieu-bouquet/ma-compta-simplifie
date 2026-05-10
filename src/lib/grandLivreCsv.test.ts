// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, expect, it } from 'vitest'
import { buildGrandLivreCsv } from '@/lib/grandLivreCsv'
import { isVatAccountNumber } from '@/lib/vatAccounts'

describe('buildGrandLivreCsv', () => {
  it('outputs header and rows', () => {
    const csv = buildGrandLivreCsv([
      {
        date: new Date('2026-03-15T12:00:00'),
        journal: { code: 'OD' },
        referenceNumber: 'OD-1',
        description: 'Test',
        lines: [
          {
            accountNumber: '601',
            accountName: 'Achats',
            debitCents: 100,
            creditCents: 0,
          },
          {
            accountNumber: '512',
            accountName: 'Banque',
            debitCents: 0,
            creditCents: 100,
          },
        ],
      },
    ])
    expect(csv.split('\n')).toHaveLength(3)
    expect(csv).toContain('601')
    expect(csv).toContain('512')
  })

  it('filters VAT lines when predicate is set', () => {
    const csv = buildGrandLivreCsv(
      [
        {
          date: new Date('2026-03-15'),
          journal: { code: 'OD' },
          referenceNumber: null,
          description: 'x',
          lines: [
            {
              accountNumber: '44566',
              accountName: 'TVA déductible',
              debitCents: 20,
              creditCents: 0,
            },
            {
              accountNumber: '606',
              accountName: 'Charges',
              debitCents: 100,
              creditCents: 0,
            },
          ],
        },
      ],
      (line) => isVatAccountNumber(line.accountNumber),
    )
    const lines = csv.split('\n')
    expect(lines).toHaveLength(2)
    expect(csv).toContain('44566')
    expect(csv).not.toContain('606')
  })
})
