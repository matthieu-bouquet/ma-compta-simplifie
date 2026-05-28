// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { createPrismaClient } from '@/lib/createPrismaClient'
import { describe, expect, it } from 'vitest'
import {
  assertFiscalYearBelongsToCurrentAssociation,
  assertFiscalYearWritable,
} from '@/lib/accountingGuards'

describe('accountingGuards', () => {
  it('assertFiscalYearBelongsToCurrentAssociation rejects wrong association', async () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeTruthy()

    const prisma = createPrismaClient(dbUrl)

    try {
      const [a1, a2] = await Promise.all([
        prisma.association.create({ data: { name: 'Guard assoc A' } }),
        prisma.association.create({ data: { name: 'Guard assoc B' } }),
      ])

      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: a1.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
      })

      await expect(
        assertFiscalYearBelongsToCurrentAssociation({ fiscalYearId: fy.id, associationId: a2.id }),
      ).rejects.toThrow('Fiscal year not found.')
    } finally {
      await prisma.$disconnect()
    }
  })

  it('assertFiscalYearWritable rejects closed fiscal year', async () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeTruthy()

    const prisma = createPrismaClient(dbUrl)

    try {
      const assoc = await prisma.association.create({ data: { name: 'Guard closed FY' } })
      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: assoc.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'CLOSED',
        },
      })

      await expect(
        assertFiscalYearWritable({ fiscalYearId: fy.id, associationId: assoc.id }),
      ).rejects.toThrow('Cannot write: fiscal year is closed.')
    } finally {
      await prisma.$disconnect()
    }
  })

  it('assertFiscalYearWritable rejects closed association', async () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeTruthy()

    const prisma = createPrismaClient(dbUrl)

    try {
      const assoc = await prisma.association.create({
        data: { name: 'Guard closed assoc', isClosed: true },
      })
      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: assoc.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
      })

      await expect(
        assertFiscalYearWritable({ fiscalYearId: fy.id, associationId: assoc.id }),
      ).rejects.toThrow('Cannot write: association is closed.')
    } finally {
      await prisma.$disconnect()
    }
  })
})
