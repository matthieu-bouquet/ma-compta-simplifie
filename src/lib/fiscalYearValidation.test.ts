// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, expect, it } from 'vitest'
import { parseFiscalYearId } from '@/lib/fiscalYearValidation'

describe('parseFiscalYearId', () => {
  it('accepts non-empty id', () => {
    expect(parseFiscalYearId('fy-abc')).toBe('fy-abc')
  })

  it('rejects empty id', () => {
    expect(() => parseFiscalYearId('')).toThrow(/required/i)
  })
})
