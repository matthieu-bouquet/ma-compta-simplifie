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

import {
  createCustomerReceipt,
  createSupplierSettlement,
  listOpenCustomerReceivables,
  listOpenSupplierPayables,
} from '@/actions/treasuryActions'

describe('treasuryActions allocations', () => {
  beforeEach(() => {
    currentAssociationId = null
  })

  it('rejects settlement when allocation sum differs from payment amount', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = createPrismaClient(dbUrl)

    try {
      const assoc = await prisma.association.create({ data: { name: 'Treasury sum guard' } })
      currentAssociationId = assoc.id
      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: assoc.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
      })
      const supplier = await prisma.counterparty.create({
        data: { associationId: assoc.id, kind: 'SUPPLIER', name: 'S' },
      })
      const journal = await prisma.journal.upsert({
        where: { code: 'AC' },
        update: {},
        create: { code: 'AC', name: 'Achats' },
      })
      const acc601 = await prisma.account.create({
        data: { fiscalYearId: fy.id, number: '601', name: 'Achats' },
      })
      const acc401 = await prisma.account.create({
        data: { fiscalYearId: fy.id, number: '401', name: 'Fournisseurs' },
      })
      const bank = await prisma.account.create({
        data: { fiscalYearId: fy.id, number: '512', name: 'Banque' },
      })
      const expense = await prisma.entry.create({
        data: {
          fiscalYearId: fy.id,
          journalId: journal.id,
          date: new Date('2026-02-01'),
          description: 'Dette',
          counterpartyId: supplier.id,
          lines: {
            create: [
              {
                accountId: acc601.id,
                accountNumber: '601',
                accountName: 'Achats',
                debitCents: 5000,
                creditCents: 0,
              },
              {
                accountId: acc401.id,
                accountNumber: '401',
                accountName: 'Fournisseurs',
                debitCents: 0,
                creditCents: 5000,
              },
            ],
          },
        },
        include: { lines: true },
      })
      const payableLine = expense.lines.find((l) => l.accountNumber.startsWith('401'))!

      await expect(
        createSupplierSettlement({
          fiscalYearId: fy.id,
          date: '2026-03-01',
          counterpartyId: supplier.id,
          treasuryAccountId: bank.id,
          description: 'Mismatch sum',
          amountEuros: 50,
          allocations: [{ payableLineId: payableLine.id, amountEuros: 30 }],
        }),
      ).rejects.toThrow('somme des affectations')
    } finally {
      await prisma.$disconnect()
    }
  })

  it('tracks supplier payable remaining via allocations (partial then full)', async () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeTruthy()

    const prisma = createPrismaClient(dbUrl)

    try {
      const assoc = await prisma.association.create({ data: { name: 'Treasury supplier test' } })
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

      const supplier = await prisma.counterparty.create({
        data: { associationId: assoc.id, kind: 'SUPPLIER', name: 'Supplier A' },
        select: { id: true },
      })

      const journalAC = await prisma.journal.upsert({
        where: { code: 'AC' },
        update: { name: 'Achats' },
        create: { code: 'AC', name: 'Achats' },
        select: { id: true },
      })

      const acc601 = await prisma.account.create({ data: { fiscalYearId: fy.id, number: '601', name: 'Achats' } })
      const acc401 = await prisma.account.create({ data: { fiscalYearId: fy.id, number: '401', name: 'Fournisseurs' } })
      const bank = await prisma.account.create({ data: { fiscalYearId: fy.id, number: '512', name: 'Banque' } })

      const expense = await prisma.entry.create({
        data: {
          fiscalYearId: fy.id,
          journalId: journalAC.id,
          date: new Date('2026-02-10'),
          description: 'Facture fournisseur #1',
          counterpartyId: supplier.id,
          referenceNumber: 'AC-000001',
          referenceSequence: 1,
          lines: {
            create: [
              {
                accountId: acc601.id,
                accountNumber: acc601.number,
                accountName: acc601.name,
                debitCents: 10000,
                creditCents: 0,
              },
              {
                accountId: acc401.id,
                accountNumber: acc401.number,
                accountName: acc401.name,
                debitCents: 0,
                creditCents: 10000,
              },
            ],
          },
        },
        include: { lines: true },
      })

      const payableLine = expense.lines.find((l) => l.accountNumber.startsWith('401'))!
      expect(payableLine.creditCents).toBe(10000)

      const open0 = await listOpenSupplierPayables({ fiscalYearId: fy.id, counterpartyId: supplier.id })
      expect(open0).toHaveLength(1)
      expect(open0[0]?.remainingCents).toBe(10000)

      await createSupplierSettlement({
        fiscalYearId: fy.id,
        date: '2026-02-15',
        counterpartyId: supplier.id,
        treasuryAccountId: bank.id,
        description: 'Règlement partiel',
        amountEuros: 60,
        allocations: [{ payableLineId: payableLine.id, amountEuros: 60 }],
      })

      const open1 = await listOpenSupplierPayables({ fiscalYearId: fy.id, counterpartyId: supplier.id })
      expect(open1).toHaveLength(1)
      expect(open1[0]?.remainingCents).toBe(4000)

      await createSupplierSettlement({
        fiscalYearId: fy.id,
        date: '2026-02-20',
        counterpartyId: supplier.id,
        treasuryAccountId: bank.id,
        description: 'Solde facture',
        amountEuros: 40,
        allocations: [{ payableLineId: payableLine.id, amountEuros: 40 }],
      })

      const open2 = await listOpenSupplierPayables({ fiscalYearId: fy.id, counterpartyId: supplier.id })
      expect(open2).toHaveLength(0)
    } finally {
      await prisma.$disconnect()
    }
  })

  it('rejects supplier settlement when allocation exceeds remaining', async () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeTruthy()

    const prisma = createPrismaClient(dbUrl)

    try {
      const assoc = await prisma.association.create({ data: { name: 'Treasury supplier guard test' } })
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

      const supplier = await prisma.counterparty.create({
        data: { associationId: assoc.id, kind: 'SUPPLIER', name: 'Supplier B' },
        select: { id: true },
      })

      const journalAC = await prisma.journal.upsert({
        where: { code: 'AC' },
        update: { name: 'Achats' },
        create: { code: 'AC', name: 'Achats' },
        select: { id: true },
      })

      const acc601 = await prisma.account.create({ data: { fiscalYearId: fy.id, number: '601', name: 'Achats' } })
      const acc401 = await prisma.account.create({ data: { fiscalYearId: fy.id, number: '401', name: 'Fournisseurs' } })
      const bank = await prisma.account.create({ data: { fiscalYearId: fy.id, number: '512', name: 'Banque' } })

      const expense = await prisma.entry.create({
        data: {
          fiscalYearId: fy.id,
          journalId: journalAC.id,
          date: new Date('2026-03-01'),
          description: 'Facture fournisseur #2',
          counterpartyId: supplier.id,
          referenceNumber: 'AC-000002',
          referenceSequence: 2,
          lines: {
            create: [
              {
                accountId: acc601.id,
                accountNumber: acc601.number,
                accountName: acc601.name,
                debitCents: 10000,
                creditCents: 0,
              },
              {
                accountId: acc401.id,
                accountNumber: acc401.number,
                accountName: acc401.name,
                debitCents: 0,
                creditCents: 10000,
              },
            ],
          },
        },
        include: { lines: true },
      })

      const payableLine = expense.lines.find((l) => l.accountNumber.startsWith('401'))!

      await expect(
        createSupplierSettlement({
          fiscalYearId: fy.id,
          date: '2026-03-02',
          counterpartyId: supplier.id,
          treasuryAccountId: bank.id,
          description: 'Règlement trop élevé',
          amountEuros: 120,
          allocations: [{ payableLineId: payableLine.id, amountEuros: 120 }],
        })
      ).rejects.toThrow('Affectation invalide')
    } finally {
      await prisma.$disconnect()
    }
  })

  it('tracks customer receivable remaining via allocations', async () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeTruthy()

    const prisma = createPrismaClient(dbUrl)

    try {
      const assoc = await prisma.association.create({ data: { name: 'Treasury customer test' } })
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

      const customer = await prisma.counterparty.create({
        data: { associationId: assoc.id, kind: 'CUSTOMER', name: 'Customer A' },
        select: { id: true },
      })

      const journalVE = await prisma.journal.upsert({
        where: { code: 'VE' },
        update: { name: 'Ventes' },
        create: { code: 'VE', name: 'Ventes' },
        select: { id: true },
      })

      const acc411 = await prisma.account.create({ data: { fiscalYearId: fy.id, number: '411', name: 'Clients' } })
      const acc706 = await prisma.account.create({ data: { fiscalYearId: fy.id, number: '706', name: 'Prestations' } })
      const bank = await prisma.account.create({ data: { fiscalYearId: fy.id, number: '512', name: 'Banque' } })

      const invoice = await prisma.entry.create({
        data: {
          fiscalYearId: fy.id,
          journalId: journalVE.id,
          date: new Date('2026-04-01'),
          description: 'Facture client #1',
          counterpartyId: customer.id,
          referenceNumber: 'VE-000001',
          referenceSequence: 1,
          lines: {
            create: [
              {
                accountId: acc411.id,
                accountNumber: acc411.number,
                accountName: acc411.name,
                debitCents: 12000,
                creditCents: 0,
              },
              {
                accountId: acc706.id,
                accountNumber: acc706.number,
                accountName: acc706.name,
                debitCents: 0,
                creditCents: 12000,
              },
            ],
          },
        },
        include: { lines: true },
      })

      const receivableLine = invoice.lines.find((l) => l.accountNumber.startsWith('411'))!

      const open0 = await listOpenCustomerReceivables({ fiscalYearId: fy.id, counterpartyId: customer.id })
      expect(open0).toHaveLength(1)
      expect(open0[0]?.remainingCents).toBe(12000)

      await createCustomerReceipt({
        fiscalYearId: fy.id,
        date: '2026-04-10',
        counterpartyId: customer.id,
        treasuryAccountId: bank.id,
        description: 'Encaissement partiel',
        amountEuros: 50,
        allocations: [{ payableLineId: receivableLine.id, amountEuros: 50 }],
      })

      const open1 = await listOpenCustomerReceivables({ fiscalYearId: fy.id, counterpartyId: customer.id })
      expect(open1).toHaveLength(1)
      expect(open1[0]?.remainingCents).toBe(7000)
    } finally {
      await prisma.$disconnect()
    }
  })
})

