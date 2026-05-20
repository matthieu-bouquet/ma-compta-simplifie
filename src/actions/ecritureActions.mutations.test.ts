// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { PrismaClient } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

let currentAssociationId: string | null = null

vi.mock('@/lib/associationContext', () => ({
  getCurrentAssociationId: async () => currentAssociationId,
}))

vi.mock('@/lib/audit', () => ({
  writeAuditEvent: vi.fn(),
}))

import {
  createEcriture,
  createEntry,
  deleteEntryByLineId,
  reverseEntryByLineId,
} from '@/actions/ecritureActions'

async function seedBalancedEntry(prisma: PrismaClient, fiscalYearId: string) {
  const journal = await prisma.journal.upsert({
    where: { code: 'OD' },
    update: { name: 'Opérations Diverses' },
    create: { code: 'OD', name: 'Opérations Diverses' },
  })

  const debit = await prisma.account.create({
    data: { fiscalYearId, number: '601', name: 'Achats' },
  })
  const credit = await prisma.account.create({
    data: { fiscalYearId, number: '512', name: 'Banque' },
  })

  const entry = await prisma.entry.create({
    data: {
      fiscalYearId,
      journalId: journal.id,
      date: new Date('2026-02-15'),
      description: 'Mutation test entry',
      referenceNumber: 'OD-MUT-001',
      referenceSequence: 1,
      lines: {
        create: [
          {
            accountId: debit.id,
            accountNumber: debit.number,
            accountName: debit.name,
            debitCents: 2500,
            creditCents: 0,
          },
          {
            accountId: credit.id,
            accountNumber: credit.number,
            accountName: credit.name,
            debitCents: 0,
            creditCents: 2500,
          },
        ],
      },
    },
    include: { lines: true },
  })

  return { entry, lineId: entry.lines[0]!.id }
}

describe('ecritureActions mutations', () => {
  beforeEach(() => {
    currentAssociationId = null
  })

  it('deleteEntryByLineId removes the whole entry', async () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeTruthy()

    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })

    try {
      const assoc = await prisma.association.create({ data: { name: 'Delete entry test' } })
      currentAssociationId = assoc.id

      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: assoc.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
      })

      const { entry, lineId } = await seedBalancedEntry(prisma, fy.id)

      await deleteEntryByLineId(lineId)

      const found = await prisma.entry.findUnique({ where: { id: entry.id } })
      expect(found).toBeNull()
    } finally {
      await prisma.$disconnect()
    }
  })

  it('reverseEntryByLineId creates a balancing reversal entry', async () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeTruthy()

    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })

    try {
      const assoc = await prisma.association.create({ data: { name: 'Reverse entry test' } })
      currentAssociationId = assoc.id

      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: assoc.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
      })

      const { entry, lineId } = await seedBalancedEntry(prisma, fy.id)

      await reverseEntryByLineId(lineId)

      const reversal = await prisma.entry.findFirst({
        where: { fiscalYearId: fy.id, description: 'REVERSAL: Mutation test entry' },
        include: { lines: true },
      })
      expect(reversal).toBeTruthy()
      expect(reversal!.lines).toHaveLength(2)

      const originalDebit = entry.lines.reduce((s, l) => s + l.debitCents, 0)
      const reversalCredit = reversal!.lines.reduce((s, l) => s + l.creditCents, 0)
      expect(reversalCredit).toBe(originalDebit)
    } finally {
      await prisma.$disconnect()
    }
  })

  it('createEntry rejects unbalanced lines', async () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeTruthy()

    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })

    try {
      const assoc = await prisma.association.create({ data: { name: 'Unbalanced entry test' } })
      currentAssociationId = assoc.id

      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: assoc.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
      })

      const journal = await prisma.journal.upsert({
        where: { code: 'OD' },
        update: {},
        create: { code: 'OD', name: 'OD' },
      })

      const a1 = await prisma.account.create({
        data: { fiscalYearId: fy.id, number: '601', name: 'Achats' },
      })
      const a2 = await prisma.account.create({
        data: { fiscalYearId: fy.id, number: '512', name: 'Banque' },
      })

      await expect(
        createEntry({
          date: '2026-03-01',
          description: 'Unbalanced',
          journalId: journal.id,
          fiscalYearId: fy.id,
          lines: [
            { accountId: a1.id, debit: 10, credit: 0 },
            { accountId: a2.id, debit: 0, credit: 5 },
          ],
        }),
      ).rejects.toThrow("L'écriture n'est pas équilibrée")
    } finally {
      await prisma.$disconnect()
    }
  })

  it('createEcriture delegates to createEntry with French field names', async () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeTruthy()

    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })

    try {
      const assoc = await prisma.association.create({ data: { name: 'createEcriture test' } })
      currentAssociationId = assoc.id

      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: assoc.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
      })

      const debit = await prisma.account.create({
        data: { fiscalYearId: fy.id, number: '606', name: 'Achats' },
      })
      const credit = await prisma.account.create({
        data: { fiscalYearId: fy.id, number: '512', name: 'Banque' },
      })

      await createEcriture({
        date: '2026-04-01',
        libelle: 'Legacy wrapper',
        exerciceId: fy.id,
        lignes: [
          { compteId: debit.id, debit: 15, credit: 0 },
          { compteId: credit.id, debit: 0, credit: 15 },
        ],
      })

      const entry = await prisma.entry.findFirst({
        where: { fiscalYearId: fy.id, description: 'Legacy wrapper' },
      })
      expect(entry).toBeTruthy()
    } finally {
      await prisma.$disconnect()
    }
  })
})
