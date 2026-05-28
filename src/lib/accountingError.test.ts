// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, expect, it } from 'vitest'
import { AccountingError, isAccountingError } from '@/lib/accountingError'

describe('AccountingError', () => {
  it('carries stable code', () => {
    const err = new AccountingError('FISCAL_YEAR_NOT_WRITABLE', 'Cannot write: fiscal year is closed.')
    expect(err.code).toBe('FISCAL_YEAR_NOT_WRITABLE')
    expect(isAccountingError(err)).toBe(true)
  })

  it('isAccountingError returns false for generic Error', () => {
    expect(isAccountingError(new Error('x'))).toBe(false)
  })
})
