// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { PrismaClient } from '@prisma/client'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createVolunteeringContribution, deleteInKindContribution } from '@/actions/inKindContributionActions'

let currentAssociationId: string | null = null

vi.mock('@/lib/associationContext', () => ({
  getCurrentAssociationId: async () => currentAssociationId,
}))

describe('createVolunteeringContribution', () => {
  beforeEach(() => {
    currentAssociationId = null
  })

  it('creates an in-kind contribution and (optionally) a balanced class-8 entry (864/875)', async () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeTruthy()

    const prisma = new PrismaClient({
      datasources: { db: { url: dbUrl } },
    })

    try {
      const assoc = await prisma.association.create({ data: { name: 'Test Association CVN' } })
      currentAssociationId = assoc.id

      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: assoc.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
          accounts: {
            create: [
              { number: '864', name: 'Personnel bénévole' },
              { number: '875', name: 'Bénévolat' },
            ],
          },
        },
        select: { id: true },
      })

      const created = await createVolunteeringContribution({
        fiscalYearId: fy.id,
        date: '2026-02-10',
        description: 'Encadrement',
        contributorName: 'Alice',
        hours: 1.5,
        hourlyRate: 20,
        valuationMethod: 'Taux interne documenté',
        meetsAnc2112Essential: true,
        meetsAnc2112Measurable: true,
        isRecorded: true,
      })

      expect(created.success).toBe(true)

      const row = await prisma.inKindContribution.findFirst({
        where: { fiscalYearId: fy.id, kind: 'VOLUNTEERING' },
      })
      expect(row).toBeTruthy()
      expect(row?.quantityMilliUnits).toBe(1500)
      expect(row?.unit).toBe('HOUR')
      expect(row?.totalValueCents).toBe(3000)
      expect(row?.unitValueCents).toBe(2000)
      expect(row?.isRecorded).toBe(true)
      expect(row?.entryId).toBeTruthy()

      const entry = await prisma.entry.findUnique({
        where: { id: row!.entryId! },
        include: { lines: true },
      })
      expect(entry).toBeTruthy()
      expect(entry?.lines).toHaveLength(2)

      const sumDebit = entry!.lines.reduce((s, l) => s + l.debitCents, 0)
      const sumCredit = entry!.lines.reduce((s, l) => s + l.creditCents, 0)
      expect(sumDebit).toBe(sumCredit)

      const numbers = entry!.lines.map((l) => l.accountNumber).sort()
      expect(numbers).toEqual(['864', '875'])
    } finally {
      await prisma.$disconnect()
    }
  })

  it('stores the contribution for annex even when not recorded (no entry)', async () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeTruthy()

    const prisma = new PrismaClient({
      datasources: { db: { url: dbUrl } },
    })

    try {
      const assoc = await prisma.association.create({ data: { name: 'Test Association CVN 2' } })
      currentAssociationId = assoc.id

      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: assoc.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
        select: { id: true },
      })

      await createVolunteeringContribution({
        fiscalYearId: fy.id,
        date: '2026-03-01',
        description: 'Buvette',
        hours: 2,
        hourlyRate: 20,
        valuationMethod: 'Valorisation documentée',
        meetsAnc2112Essential: false,
        meetsAnc2112Measurable: false,
        isRecorded: false,
      })

      const row = await prisma.inKindContribution.findFirst({
        where: { fiscalYearId: fy.id, kind: 'VOLUNTEERING' },
      })
      expect(row).toBeTruthy()
      expect(row?.entryId).toBeNull()
      expect(row?.isRecorded).toBe(false)
    } finally {
      await prisma.$disconnect()
    }
  })

  it('deleting a recorded contribution reverses the class-8 entry instead of deleting it', async () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeTruthy()

    const prisma = new PrismaClient({
      datasources: { db: { url: dbUrl } },
    })

    try {
      const assoc = await prisma.association.create({ data: { name: 'Test Association CVN delete' } })
      currentAssociationId = assoc.id

      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: assoc.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
          accounts: {
            create: [
              { number: '864', name: 'Personnel bénévole' },
              { number: '875', name: 'Bénévolat' },
            ],
          },
        },
        select: { id: true },
      })

      await createVolunteeringContribution({
        fiscalYearId: fy.id,
        date: '2026-02-15',
        description: 'À supprimer',
        hours: 1,
        hourlyRate: 10,
        valuationMethod: 'Test',
        meetsAnc2112Essential: true,
        meetsAnc2112Measurable: true,
        isRecorded: true,
      })

      const row = await prisma.inKindContribution.findFirst({
        where: { fiscalYearId: fy.id, kind: 'VOLUNTEERING', description: 'À supprimer' },
      })
      expect(row?.entryId).toBeTruthy()
      const originalEntryId = row!.entryId!

      await deleteInKindContribution(row!.id)

      const deleted = await prisma.inKindContribution.findUnique({ where: { id: row!.id } })
      expect(deleted).toBeNull()

      const original = await prisma.entry.findUnique({
        where: { id: originalEntryId },
        include: { lines: true },
      })
      expect(original).toBeTruthy()
      expect(original!.lines).toHaveLength(2)

      const entries = await prisma.entry.findMany({
        where: { fiscalYearId: fy.id, description: { contains: 'À supprimer' } },
        orderBy: { createdAt: 'asc' },
        include: { lines: true },
      })
      const reversal = entries.find((e) => e.description.startsWith('REVERSAL:'))
      expect(reversal).toBeTruthy()
      expect(reversal!.lines).toHaveLength(2)

      const revDebit864 = reversal!.lines.find((l) => l.accountNumber === '864')
      const origDebit864 = original!.lines.find((l) => l.accountNumber === '864')
      expect(revDebit864!.debitCents).toBe(origDebit864!.creditCents)
      expect(revDebit864!.creditCents).toBe(origDebit864!.debitCents)
    } finally {
      await prisma.$disconnect()
    }
  })
})

