// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, expect, it } from 'vitest'
import { pickNearestDateRangeItem } from './dateRangeSelection'

describe('pickNearestDateRangeItem', () => {
  it('returns the range that contains now', () => {
    const items = [
      { id: 'past', startDate: new Date('2024-09-01'), endDate: new Date('2025-08-31') },
      { id: 'current', startDate: new Date('2025-09-01'), endDate: new Date('2026-08-31') },
      { id: 'future', startDate: new Date('2026-09-01'), endDate: new Date('2027-08-31') },
    ]
    expect(pickNearestDateRangeItem(items, new Date('2026-03-15T12:00:00')).id).toBe('current')
  })

  it('picks the closest range when now is outside all of them', () => {
    const items = [
      { id: 'a', startDate: new Date('2024-01-01'), endDate: new Date('2024-12-31') },
      { id: 'b', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') },
    ]
    expect(pickNearestDateRangeItem(items, new Date('2027-06-01T12:00:00'))!.id).toBe('b')
    expect(pickNearestDateRangeItem([], new Date())).toBeNull()
  })
})
