// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { afterEach, describe, expect, it } from 'vitest'
import { isVatLiableFeatureEnabled } from '@/lib/featureFlags'

describe('isVatLiableFeatureEnabled', () => {
  const original = process.env.FEATURE_VAT_LIABLE

  afterEach(() => {
    if (original === undefined) {
      delete process.env.FEATURE_VAT_LIABLE
    } else {
      process.env.FEATURE_VAT_LIABLE = original
    }
  })

  it('returns false when unset', () => {
    delete process.env.FEATURE_VAT_LIABLE
    expect(isVatLiableFeatureEnabled()).toBe(false)
  })

  it('returns false for false-like values', () => {
    process.env.FEATURE_VAT_LIABLE = 'false'
    expect(isVatLiableFeatureEnabled()).toBe(false)
    process.env.FEATURE_VAT_LIABLE = ''
    expect(isVatLiableFeatureEnabled()).toBe(false)
  })

  it('returns true for true or 1', () => {
    process.env.FEATURE_VAT_LIABLE = 'true'
    expect(isVatLiableFeatureEnabled()).toBe(true)
    process.env.FEATURE_VAT_LIABLE = 'TRUE'
    expect(isVatLiableFeatureEnabled()).toBe(true)
    process.env.FEATURE_VAT_LIABLE = '1'
    expect(isVatLiableFeatureEnabled()).toBe(true)
  })
})
