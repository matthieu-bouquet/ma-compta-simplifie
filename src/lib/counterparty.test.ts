// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, expect, it } from 'vitest'
import { isCustomerAccountNumber, isSupplierAccountNumber } from '@/lib/counterparty'

describe('counterparty account helpers', () => {
  it('detects supplier collective and subdivisions', () => {
    expect(isSupplierAccountNumber('401')).toBe(true)
    expect(isSupplierAccountNumber('4011')).toBe(true)
    expect(isSupplierAccountNumber('512')).toBe(false)
  })

  it('detects customer collective and subdivisions', () => {
    expect(isCustomerAccountNumber('411')).toBe(true)
    expect(isCustomerAccountNumber('4110')).toBe(true)
    expect(isCustomerAccountNumber('401')).toBe(false)
  })
})
