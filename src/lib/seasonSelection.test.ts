// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, expect, it } from 'vitest'
import { membershipSeasonLabel, resolveSelectedSeasonId } from './seasonSelection'

describe('resolveSelectedSeasonId', () => {
  const seasons = [{ id: 's-old' }, { id: 's-new' }]

  it('prefers URL param when valid', () => {
    expect(resolveSelectedSeasonId(seasons, { urlSeasonId: 's-new', cookieSeasonId: 's-old' })).toBe('s-new')
  })

  it('falls back to cookie then first season', () => {
    expect(resolveSelectedSeasonId(seasons, { cookieSeasonId: 's-old' })).toBe('s-old')
    expect(resolveSelectedSeasonId(seasons, { urlSeasonId: 'unknown', cookieSeasonId: 's-old' })).toBe('s-old')
    expect(resolveSelectedSeasonId(seasons, {})).toBe('s-old')
    expect(resolveSelectedSeasonId([], {})).toBeNull()
  })
})

describe('membershipSeasonLabel', () => {
  it('includes the season name and localized dates', () => {
    const label = membershipSeasonLabel({
      name: '2026-2027',
      startDate: new Date('2026-09-01T12:00:00'),
      endDate: new Date('2027-08-31T12:00:00'),
    })
    expect(label).toContain('2026-2027')
    expect(label).toMatch(/2026/)
    expect(label).toMatch(/2027/)
  })
})
