// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { createPrismaClient } from '@/lib/createPrismaClient'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  writeAuditEvent: vi.fn(),
}))

let docSeq = 0
vi.mock('@/lib/documentsStorage', () => ({
  saveUploadedFile: vi.fn(async (opts: { file: File }) => {
    docSeq += 1
    const storedName = `doc_${docSeq}.pdf`
    return {
      storedName,
      mimeType: opts.file.type || 'application/pdf',
      sizeBytes: 10,
      sha256: `hash-${docSeq}`,
      relativePath: `a/fy/${storedName}`,
    }
  }),
}))

let currentAssociationId: string | null = null

vi.mock('@/lib/associationContext', () => ({
  getCurrentAssociationId: async () => currentAssociationId,
}))

import { createEntry, deleteEntryByLineId } from '@/actions/ecritureActions'

describe('createEntry business guards', () => {
  beforeEach(() => {
    currentAssociationId = null
    docSeq = 0
  })

  async function seedOpenFiscalYear(prisma: PrismaClient) {
    const assoc = await prisma.association.create({ data: { name: 'Entry guards' } })
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
    const debit = await prisma.account.create({
      data: { fiscalYearId: fy.id, number: '606', name: 'Achats' },
    })
    const credit = await prisma.account.create({
      data: { fiscalYearId: fy.id, number: '512', name: 'Banque' },
    })
    return { assoc, fy, journal, debit, credit }
  }

  it('rejects counterparty from another association', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = createPrismaClient(dbUrl)
    try {
      const other = await prisma.association.create({ data: { name: 'Other entity' } })
      const supplier = await prisma.counterparty.create({
        data: { associationId: other.id, kind: 'SUPPLIER', name: 'Fournisseur X' },
      })
      const { fy, journal, debit, credit } = await seedOpenFiscalYear(prisma)

      await expect(
        createEntry({
          date: '2026-03-01',
          description: 'Achat',
          journalId: journal.id,
          fiscalYearId: fy.id,
          counterpartyId: supplier.id,
          lines: [
            { accountId: debit.id, debit: 10, credit: 0 },
            { accountId: credit.id, debit: 0, credit: 10 },
          ],
        }),
      ).rejects.toThrow('ne correspond pas')
    } finally {
      await prisma.$disconnect()
    }
  })

  it('appends counterparty name to description when missing', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = createPrismaClient(dbUrl)
    try {
      const { assoc, fy, journal, debit, credit } = await seedOpenFiscalYear(prisma)
      const supplier = await prisma.counterparty.create({
        data: { associationId: assoc.id, kind: 'SUPPLIER', name: 'Fournisseur Dupont' },
      })

      await createEntry({
        date: '2026-03-01',
        description: 'Facture mars',
        journalId: journal.id,
        fiscalYearId: fy.id,
        counterpartyId: supplier.id,
        lines: [
          { accountId: debit.id, debit: 10, credit: 0 },
          { accountId: credit.id, debit: 0, credit: 10 },
        ],
      })

      const entry = await prisma.entry.findFirst({
        where: { fiscalYearId: fy.id, description: { contains: 'Fournisseur Dupont' } },
      })
      expect(entry?.description).toContain('Facture mars')
      expect(entry?.description).toContain('Fournisseur Dupont')
    } finally {
      await prisma.$disconnect()
    }
  })

  it('rejects future date and date outside fiscal year', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = createPrismaClient(dbUrl)
    try {
      const { fy, journal, debit, credit } = await seedOpenFiscalYear(prisma)
      const base = {
        description: 'Test date',
        journalId: journal.id,
        fiscalYearId: fy.id,
        counterpartyId: null,
        lines: [
          { accountId: debit.id, debit: 5, credit: 0 },
          { accountId: credit.id, debit: 0, credit: 5 },
        ],
      }

      await expect(createEntry({ ...base, date: '2099-01-01' })).rejects.toThrow('futur')
      await expect(createEntry({ ...base, date: '2025-12-31' })).rejects.toThrow('exercice')
    } finally {
      await prisma.$disconnect()
    }
  })

  it('rejects account outside fiscal year', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = createPrismaClient(dbUrl)
    try {
      const { fy, journal } = await seedOpenFiscalYear(prisma)
      const otherFy = await prisma.fiscalYear.create({
        data: {
          associationId: currentAssociationId!,
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-12-31'),
          status: 'OPEN',
        },
      })
      const foreign = await prisma.account.create({
        data: { fiscalYearId: otherFy.id, number: '512', name: 'Banque N-1' },
      })
      const local = await prisma.account.findFirst({ where: { fiscalYearId: fy.id, number: '606' } })

      await expect(
        createEntry({
          date: '2026-03-01',
          description: 'Wrong account FY',
          journalId: journal.id,
          fiscalYearId: fy.id,
          lines: [
            { accountId: local!.id, debit: 5, credit: 0 },
            { accountId: foreign.id, debit: 0, credit: 5 },
          ],
        }),
      ).rejects.toThrow(/Account not found/)
    } finally {
      await prisma.$disconnect()
    }
  })

  it('attaches entry-level and per-line documents', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = createPrismaClient(dbUrl)
    try {
      const { fy, journal, debit, credit } = await seedOpenFiscalYear(prisma)
      const pdf = new File([Buffer.from('%PDF')], 'entry.pdf', { type: 'application/pdf' })
      const linePdf = new File([Buffer.from('%PDF')], 'line.pdf', { type: 'application/pdf' })

      await createEntry({
        date: '2026-03-10',
        description: 'With docs',
        journalId: journal.id,
        fiscalYearId: fy.id,
        documentFile: pdf,
        lines: [
          { accountId: debit.id, debit: 20, credit: 0, documents: [linePdf] },
          { accountId: credit.id, debit: 0, credit: 20 },
        ],
      })

      const entry = await prisma.entry.findFirst({
        where: { fiscalYearId: fy.id, description: 'With docs' },
        include: { lines: { include: { documents: true } } },
      })
      expect(entry?.lines).toHaveLength(2)
      const debitLine = entry!.lines.find((l) => l.accountNumber === '606')!
      expect(debitLine.documents.length).toBeGreaterThanOrEqual(1)
      const creditLine = entry!.lines.find((l) => l.accountNumber === '512')!
      expect(creditLine.documents.length).toBeGreaterThanOrEqual(1)
    } finally {
      await prisma.$disconnect()
    }
  })
})

describe('deleteEntryByLineId idempotence', () => {
  beforeEach(() => {
    currentAssociationId = null
  })

  it('returns success when line id is unknown', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = createPrismaClient(dbUrl)
    try {
      const assoc = await prisma.association.create({ data: { name: 'Delete noop' } })
      currentAssociationId = assoc.id
      await expect(deleteEntryByLineId('00000000-0000-0000-0000-000000000099')).resolves.toEqual({
        success: true,
      })
    } finally {
      await prisma.$disconnect()
    }
  })
})
