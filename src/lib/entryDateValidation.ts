// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

/** IANA timezone used for entry calendar-day rules (French accounting context). */
export const ENTRY_DATE_TIMEZONE = 'Europe/Paris'

/** Calendar date YYYY-MM-DD for an instant in a given IANA timezone. */
export function calendarDateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  const d = parts.find((p) => p.type === 'day')?.value
  if (!y || !m || !d) throw new Error('Invalid date')
  return `${y}-${m}-${d}`
}

export function isEntryDateAfterToday(entryYYYYMMDD: string, now = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entryYYYYMMDD)) return false
  const today = calendarDateInTimeZone(now, ENTRY_DATE_TIMEZONE)
  return entryYYYYMMDD > today
}

export function assertEntryDateNotAfterToday(entryYYYYMMDD: string, now = new Date()): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entryYYYYMMDD)) {
    throw new Error('Invalid entry date format.')
  }
  const today = calendarDateInTimeZone(now, ENTRY_DATE_TIMEZONE)
  if (entryYYYYMMDD > today) {
    throw new Error("La date d'écriture ne peut pas être dans le futur.")
  }
}
