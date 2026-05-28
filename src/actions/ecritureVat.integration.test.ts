// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { createPrismaClient } from '@/lib/createPrismaClient'
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

import { createEntry } from '@/actions/ecritureActions'

describe('createEntry quick VAT', () => {
  beforeEach(() => {
    currentAssociationId = null
  })

  it('creates a 3-line settled expense with TVA déductible and treasury credit', async () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeTruthy()

    const prisma = createPrismaClient(dbUrl)

    try {
      const assoc = await prisma.association.create({
        data: { name: 'VAT entity', vatLiable: true },
      })
      currentAssociationId = assoc.id

      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: assoc.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
      })

      const charge = await prisma.account.create({
        data: { fiscalYearId: fy.id, number: '606', name: 'Achats' },
      })
      const bank = await prisma.account.create({
        data: { fiscalYearId: fy.id, number: '512', name: 'Banque' },
      })

      const journal = await prisma.journal.upsert({
        where: { code: 'AC' },
        update: {},
        create: { code: 'AC', name: 'Achats' },
      })

      await createEntry({
        date: '2026-01-02',
        description: 'Achat TTC',
        journalId: journal.id,
        fiscalYearId: fy.id,
        counterpartyId: null,
        lines: [],
        quickVat: {
          amountTtcEuros: 120,
          vatRatePercent: 20,
          flow: 'DEPENSE',
          settledImmediately: true,
          operationAccountId: charge.id,
          treasuryAccountId: bank.id,
          thirdPartyAccountId: null,
        },
      })

      const entry = await prisma.entry.findFirst({
        where: { fiscalYearId: fy.id },
        include: { lines: { orderBy: { id: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      })

      expect(entry?.lines.length).toBe(3)
      const byNum = Object.fromEntries(entry!.lines.map((l) => [l.accountNumber, l]))

      expect(byNum['606']?.debitCents).toBe(10000)
      expect(byNum['606']?.creditCents).toBe(0)
      expect(byNum['44566']?.debitCents).toBe(2000)
      expect(byNum['512']?.creditCents).toBe(12000)
    } finally {
      await prisma.$disconnect()
    }
  })

  it('rejects quick VAT when association is not vatLiable', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = createPrismaClient(dbUrl)

    try {
      const assoc = await prisma.association.create({
        data: { name: 'Non VAT', vatLiable: false },
      })
      currentAssociationId = assoc.id

      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: assoc.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
      })

      const charge = await prisma.account.create({
        data: { fiscalYearId: fy.id, number: '606', name: 'Achats' },
      })
      const bank = await prisma.account.create({
        data: { fiscalYearId: fy.id, number: '512', name: 'Banque' },
      })

      const journal = await prisma.journal.upsert({
        where: { code: 'AC' },
        update: {},
        create: { code: 'AC', name: 'Achats' },
      })

      await expect(
        createEntry({
          date: '2026-01-02',
          description: 'x',
          journalId: journal.id,
          fiscalYearId: fy.id,
          lines: [],
          quickVat: {
            amountTtcEuros: 100,
            vatRatePercent: 20,
            flow: 'DEPENSE',
            settledImmediately: true,
            operationAccountId: charge.id,
            treasuryAccountId: bank.id,
            thirdPartyAccountId: null,
          },
        }),
      ).rejects.toThrow(/assujettie/)
    } finally {
      await prisma.$disconnect()
    }
  })
})

describe('createEntry entry-level documents', () => {
  beforeEach(() => {
    currentAssociationId = null
  })

  it('links each entry document to every line', async () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeTruthy()

    const prisma = createPrismaClient(dbUrl)

    try {
      const assoc = await prisma.association.create({
        data: { name: 'Entry docs entity', vatLiable: false },
      })
      currentAssociationId = assoc.id

      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: assoc.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
      })

      const debitAcc = await prisma.account.create({
        data: { fiscalYearId: fy.id, number: '606', name: 'Achats' },
      })
      const creditAcc = await prisma.account.create({
        data: { fiscalYearId: fy.id, number: '512', name: 'Banque' },
      })

      const journal = await prisma.journal.upsert({
        where: { code: 'OD' },
        update: {},
        create: { code: 'OD', name: 'Opérations Diverses' },
      })

      const pdfA = new File([Buffer.from('%PDF-1.4\n')], 'doc-a.pdf', { type: 'application/pdf' })
      const pdfB = new File([Buffer.from('%PDF-1.4\n')], 'doc-b.pdf', { type: 'application/pdf' })

      await createEntry({
        date: '2026-03-12',
        description: 'Entry-level docs test',
        journalId: journal.id,
        fiscalYearId: fy.id,
        counterpartyId: null,
        lines: [
          { accountId: debitAcc.id, debit: 45, credit: 0 },
          { accountId: creditAcc.id, debit: 0, credit: 45 },
        ],
        entryDocuments: [pdfA, pdfB],
      })

      const entry = await prisma.entry.findFirst({
        where: { fiscalYearId: fy.id, description: 'Entry-level docs test' },
        include: { lines: { select: { id: true, accountNumber: true } } },
      })
      expect(entry?.lines.length).toBe(2)

      for (const line of entry!.lines) {
        const links = await prisma.documentEntryLine.findMany({
          where: { entryLineId: line.id },
          include: { document: { select: { originalName: true } } },
        })
        expect(links).toHaveLength(2)
        expect(new Set(links.map((l) => l.document.originalName))).toEqual(
          new Set(['doc-a.pdf', 'doc-b.pdf']),
        )
      }
    } finally {
      await prisma.$disconnect()
    }
  })
})
