// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, it, expect } from 'vitest'
import {
  calendarDateInTimeZone,
  assertEntryDateNotAfterToday,
  assertEntryDateWithinFiscalYear,
  isEntryDateAfterToday,
  ENTRY_DATE_TIMEZONE,
} from '@/lib/entryDateValidation'

describe('entryDateValidation', () => {
  it('calendarDateInTimeZone returns YYYY-MM-DD', () => {
    const s = calendarDateInTimeZone(new Date('2026-05-02T12:00:00Z'), ENTRY_DATE_TIMEZONE)
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('assertEntryDateNotAfterToday rejects a date strictly after Paris calendar today', () => {
    const now = new Date('2026-06-15T12:00:00Z')
    expect(() => assertEntryDateNotAfterToday('2030-01-01', now)).toThrow(
      "La date d'écriture ne peut pas être dans le futur."
    )
  })

  it('assertEntryDateNotAfterToday allows Paris today', () => {
    const now = new Date('2026-06-15T12:00:00Z')
    const todayParis = calendarDateInTimeZone(now, ENTRY_DATE_TIMEZONE)
    expect(() => assertEntryDateNotAfterToday(todayParis, now)).not.toThrow()
  })

  it('assertEntryDateNotAfterToday allows a past date', () => {
    const now = new Date('2026-06-15T12:00:00Z')
    expect(() => assertEntryDateNotAfterToday('2026-01-01', now)).not.toThrow()
  })

  it('isEntryDateAfterToday is false for today and past', () => {
    const now = new Date('2026-06-15T12:00:00Z')
    const todayParis = calendarDateInTimeZone(now, ENTRY_DATE_TIMEZONE)
    expect(isEntryDateAfterToday(todayParis, now)).toBe(false)
    expect(isEntryDateAfterToday('2026-01-01', now)).toBe(false)
  })

  it('isEntryDateAfterToday is true for a future calendar date', () => {
    const now = new Date('2026-06-15T12:00:00Z')
    expect(isEntryDateAfterToday('2099-12-31', now)).toBe(true)
  })

  it('assertEntryDateWithinFiscalYear rejects before start and after end (Paris calendar days)', () => {
    // Use mid-day instants to avoid timezone rollover when formatting to Paris calendar days.
    const start = new Date('2026-01-01T12:00:00Z')
    const end = new Date('2026-12-31T12:00:00Z')
    expect(() => assertEntryDateWithinFiscalYear('2025-12-31', start, end)).toThrow(
      "La date d'écriture doit être comprise dans l'exercice."
    )
    expect(() => assertEntryDateWithinFiscalYear('2027-01-01', start, end)).toThrow(
      "La date d'écriture doit être comprise dans l'exercice."
    )
  })

  it('assertEntryDateWithinFiscalYear allows boundary dates', () => {
    const start = new Date('2026-01-01T12:00:00Z')
    const end = new Date('2026-12-31T12:00:00Z')
    expect(() => assertEntryDateWithinFiscalYear('2026-01-01', start, end)).not.toThrow()
    expect(() => assertEntryDateWithinFiscalYear('2026-12-31', start, end)).not.toThrow()
  })
})
