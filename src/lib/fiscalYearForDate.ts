// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import type { Prisma } from '@/lib/db'
import { prisma } from '@/lib/prisma'
import { calendarDateInTimeZone, ENTRY_DATE_TIMEZONE } from '@/lib/entryDateValidation'

type FiscalYearDb = Prisma.TransactionClient | typeof prisma

export async function findFiscalYearCoveringCalendarDate(
  db: FiscalYearDb,
  opts: { associationId: string; calendarDate: string },
) {
  const years = await db.fiscalYear.findMany({
    where: { associationId: opts.associationId },
    orderBy: { startDate: 'desc' },
  })
  const covering = years.filter((fy) => {
    const start = calendarDateInTimeZone(fy.startDate, ENTRY_DATE_TIMEZONE)
    const end = calendarDateInTimeZone(fy.endDate, ENTRY_DATE_TIMEZONE)
    return opts.calendarDate >= start && opts.calendarDate <= end
  })
  if (covering.length === 0) return null
  return covering.find((fy) => fy.status === 'OPEN') ?? covering[0]
}
