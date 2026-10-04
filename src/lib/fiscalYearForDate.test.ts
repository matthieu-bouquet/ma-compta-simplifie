// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, expect, it } from 'vitest'
import { createPrismaClient } from '@/lib/createPrismaClient'
import { findFiscalYearCoveringCalendarDate } from './fiscalYearForDate'

describe('findFiscalYearCoveringCalendarDate', () => {
  it('returns the fiscal year that covers the calendar date', async () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeTruthy()
    const prisma = createPrismaClient(dbUrl!)

    try {
      const assoc = await prisma.association.create({ data: { name: 'Covering FY assoc' } })
      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: assoc.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
      })
      const found = await findFiscalYearCoveringCalendarDate(prisma, {
        associationId: assoc.id,
        calendarDate: '2026-03-02',
      })
      expect(found?.id).toBe(fy.id)
      const missing = await findFiscalYearCoveringCalendarDate(prisma, {
        associationId: assoc.id,
        calendarDate: '2024-01-01',
      })
      expect(missing).toBeNull()
    } finally {
      await prisma.$disconnect()
    }
  })
})
