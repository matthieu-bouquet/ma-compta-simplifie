// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, expect, it } from 'vitest'
import type { FiscalYearNetTotals } from '@/lib/accountTotals'
import { forecastVsRealizedKind } from '@/lib/budgetCompareVariance'

function totalsWithCharge(number: string, netCents: number): FiscalYearNetTotals {
  return {
    charges: [{ number, name: 'Test', netCents }],
    produits: [],
    cvnEmplois: [],
    cvnContributions: [],
  }
}

describe('forecastVsRealizedKind', () => {
  it('returns equal when amounts match within 1 cent', () => {
    const t = totalsWithCharge('606', 10_000)
    expect(forecastVsRealizedKind(10_000, t, '606')).toBe('equal')
    expect(forecastVsRealizedKind(10_001, t, '606')).toBe('equal')
    expect(forecastVsRealizedKind(9_999, t, '606')).toBe('equal')
  })

  it('returns up when forecast exceeds absolute realized', () => {
    const t = totalsWithCharge('606', 10_000)
    expect(forecastVsRealizedKind(12_000, t, '606')).toBe('up')
  })

  it('returns down when forecast is below absolute realized', () => {
    const t = totalsWithCharge('606', 10_000)
    expect(forecastVsRealizedKind(5_000, t, '606')).toBe('down')
  })

  it('uses absolute value of signed realized net', () => {
    const t = totalsWithCharge('606', -10_000)
    expect(forecastVsRealizedKind(10_000, t, '606')).toBe('equal')
    expect(forecastVsRealizedKind(15_000, t, '606')).toBe('up')
  })

  it('returns null when account is absent from totals', () => {
    const t = totalsWithCharge('606', 100)
    expect(forecastVsRealizedKind(100, t, '999')).toBe(null)
  })
})
