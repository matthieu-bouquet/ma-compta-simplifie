// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, it, expect } from 'vitest'
import { classifyAccount } from '@/lib/budgetClassification'

describe('classifyAccount', () => {
  it('classifies CVN before class 6 prefix overlap', () => {
    expect(classifyAccount('864')).toBe('CVN_EMPLOI')
    expect(classifyAccount('875')).toBe('CVN_CONTRIBUTION')
  })

  it('classifies charges and produits', () => {
    expect(classifyAccount('606')).toBe('CHARGE')
    expect(classifyAccount('740')).toBe('PRODUIT')
  })

  it('returns OTHER for non-budget accounts', () => {
    expect(classifyAccount('512')).toBe('OTHER')
  })
})
