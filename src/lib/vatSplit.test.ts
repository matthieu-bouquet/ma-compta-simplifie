// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, expect, it } from 'vitest'
import { eurosToCents } from '@/lib/money'
import { splitTtcToHtAndVatCents, splitTtcToHtAndVatEuros } from '@/lib/vatSplit'

describe('splitTtcToHtAndVatCents', () => {
  it('splits 120 EUR TTC at 20% into 100 HT and 20 VAT', () => {
    const ttc = eurosToCents(120)
    const { htCents, vatCents } = splitTtcToHtAndVatCents(ttc, 20)
    expect(htCents).toBe(10000)
    expect(vatCents).toBe(2000)
    expect(htCents + vatCents).toBe(ttc)
  })

  it('splits 100 EUR TTC at 10% into 90.91 HT and 9.09 VAT', () => {
    const ttc = eurosToCents(100)
    const { htCents, vatCents } = splitTtcToHtAndVatCents(ttc, 10)
    expect(htCents).toBe(9091)
    expect(vatCents).toBe(909)
    expect(htCents + vatCents).toBe(ttc)
  })

  it('keeps integer cents balanced for fractional totals', () => {
    const ttc = eurosToCents(10.01)
    const { htCents, vatCents } = splitTtcToHtAndVatCents(ttc, 20)
    expect(htCents + vatCents).toBe(ttc)
  })
})

describe('splitTtcToHtAndVatEuros', () => {
  it('returns euros consistent with cents split', () => {
    const { htEuros, vatEuros } = splitTtcToHtAndVatEuros(120, 20)
    expect(htEuros + vatEuros).toBeCloseTo(120, 2)
    expect(htEuros).toBeCloseTo(100, 2)
    expect(vatEuros).toBeCloseTo(20, 2)
  })
})
