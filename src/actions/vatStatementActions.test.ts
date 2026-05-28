// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { createPrismaClient } from '@/lib/createPrismaClient'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let currentAssociationId: string | null = null

vi.mock('@/lib/associationContext', () => ({
  getCurrentAssociationId: async () => currentAssociationId,
}))

import { getVatStatementPdfPayload } from '@/actions/vatStatementActions'

describe('vatStatementActions', () => {
  beforeEach(() => {
    currentAssociationId = null
  })

  it('returns null without association context', async () => {
    expect(
      await getVatStatementPdfPayload('fy', '2026-01-01', '2026-12-31'),
    ).toBeNull()
  })

  it('builds payload for vat-liable association', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = createPrismaClient(dbUrl)

    try {
      const assoc = await prisma.association.create({
        data: { name: 'VAT statement', vatLiable: true },
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

      const journal = await prisma.journal.upsert({
        where: { code: 'AC' },
        update: {},
        create: { code: 'AC', name: 'Achats' },
      })
      const charge = await prisma.account.create({
        data: { fiscalYearId: fy.id, number: '606', name: 'Achats' },
      })
      const vatDed = await prisma.account.create({
        data: { fiscalYearId: fy.id, number: '44566', name: 'TVA déductible' },
      })
      const bank = await prisma.account.create({
        data: { fiscalYearId: fy.id, number: '512', name: 'Banque' },
      })

      await prisma.entry.create({
        data: {
          fiscalYearId: fy.id,
          journalId: journal.id,
          date: new Date('2026-02-15'),
          description: 'Achat TVA',
          lines: {
            create: [
              {
                accountId: charge.id,
                accountNumber: '606',
                accountName: 'Achats',
                debitCents: 10000,
                creditCents: 0,
              },
              {
                accountId: vatDed.id,
                accountNumber: '44566',
                accountName: 'TVA déductible',
                debitCents: 2000,
                creditCents: 0,
              },
              {
                accountId: bank.id,
                accountNumber: '512',
                accountName: 'Banque',
                debitCents: 0,
                creditCents: 12000,
              },
            ],
          },
        },
      })

      const payload = await getVatStatementPdfPayload(fy.id, '2026-01-01', '2026-12-31')
      expect(payload).toBeTruthy()
      expect(payload?.associationName).toBe('VAT statement')
      expect(payload?.netDeductibleEuros).toBeGreaterThan(0)
    } finally {
      await prisma.$disconnect()
    }
  })

  it('rejects non vat-liable association', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = createPrismaClient(dbUrl)

    try {
      const assoc = await prisma.association.create({
        data: { name: 'No VAT', vatLiable: false },
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

      await expect(
        getVatStatementPdfPayload(fy.id, '2026-01-01', '2026-12-31'),
      ).rejects.toThrow('assujetties')
    } finally {
      await prisma.$disconnect()
    }
  })
})
