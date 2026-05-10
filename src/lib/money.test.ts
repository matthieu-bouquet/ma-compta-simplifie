// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, expect, it } from 'vitest'
import { normalizeEurosAmount, eurosToCents } from '@/lib/money'
import { splitTtcToHtAndVatCents } from '@/lib/vatSplit'

describe('normalizeEurosAmount', () => {
  it('prevents floating glitches around integer cents', () => {
    expect(normalizeEurosAmount(4.999999)).toBe(5)
    expect(normalizeEurosAmount(5.000001)).toBe(5)
  })
})

describe('VAT regression: 5.00 TTC stays 5.00 on third-party line', () => {
  it('keeps TTC cents at 500 so 401/512 line is 5.00', () => {
    const ttcEuros = normalizeEurosAmount(4.999999)
    const ttcCents = eurosToCents(ttcEuros)
    expect(ttcCents).toBe(500)

    const { htCents, vatCents } = splitTtcToHtAndVatCents(ttcCents, 20)
    expect(htCents).toBe(417)
    expect(vatCents).toBe(83)
    expect(htCents + vatCents).toBe(500)
  })
})

