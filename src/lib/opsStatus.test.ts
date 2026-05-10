// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, expect, it } from 'vitest'
import { getOpsLineStatusLabel } from '@/lib/opsStatus'

describe('getOpsLineStatusLabel', () => {
  it('marks charges as À payer when 401 credit remains', () => {
    const label = getOpsLineStatusLabel({
      accountNumber: '606',
      entryLines: [
        { accountNumber: '606', debitCents: 10000, creditCents: 0 },
        { accountNumber: '401', debitCents: 0, creditCents: 10000, payableAllocations: [{ amountCents: 0 }] },
      ],
    })
    expect(label).toBe('À payer')
  })

  it('marks charges as Payé when 401 credit is fully allocated', () => {
    const label = getOpsLineStatusLabel({
      accountNumber: '606',
      entryLines: [
        { accountNumber: '606', debitCents: 10000, creditCents: 0 },
        { accountNumber: '401', debitCents: 0, creditCents: 10000, payableAllocations: [{ amountCents: 6000 }, { amountCents: 4000 }] },
      ],
    })
    expect(label).toBe('Payé')
  })

  it('marks products as À percevoir when 411 debit remains', () => {
    const label = getOpsLineStatusLabel({
      accountNumber: '706',
      entryLines: [
        { accountNumber: '411', debitCents: 12000, creditCents: 0, payableAllocations: [{ amountCents: 5000 }] },
        { accountNumber: '706', debitCents: 0, creditCents: 12000 },
      ],
    })
    expect(label).toBe('À percevoir')
  })

  it('marks products as Perçu when 411 debit fully allocated', () => {
    const label = getOpsLineStatusLabel({
      accountNumber: '706',
      entryLines: [
        { accountNumber: '411', debitCents: 12000, creditCents: 0, payableAllocations: [{ amountCents: 12000 }] },
        { accountNumber: '706', debitCents: 0, creditCents: 12000 },
      ],
    })
    expect(label).toBe('Perçu')
  })
})

