// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { PrismaClient } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import {
  count401LinesWithoutCounterparty,
  count411LinesWithoutCounterparty,
  getCustomerReceivableBalanceCents,
  getSupplierPayableBalanceCents,
  listCustomer411Movements,
  listSupplier401Movements,
} from '@/lib/counterpartyBalance'

describe('counterpartyBalance', () => {
  it('computes supplier payable and customer receivable balances', async () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeTruthy()

    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })

    try {
      const assoc = await prisma.association.create({ data: { name: 'Balance test' } })
      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: assoc.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
      })
      const supplier = await prisma.counterparty.create({
        data: { associationId: assoc.id, kind: 'SUPPLIER', name: 'S1' },
      })
      const customer = await prisma.counterparty.create({
        data: { associationId: assoc.id, kind: 'CUSTOMER', name: 'C1' },
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
      const acc706 = await prisma.account.create({
        data: { fiscalYearId: fy.id, number: '706', name: 'Ventes' },
      })
      const acc411 = await prisma.account.create({
        data: { fiscalYearId: fy.id, number: '411', name: 'Clients' },
      })

      await prisma.entry.create({
        data: {
          fiscalYearId: fy.id,
          journalId: journal.id,
          date: new Date('2026-02-01'),
          description: 'Dette fournisseur',
          counterpartyId: supplier.id,
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
      })

      await prisma.entry.create({
        data: {
          fiscalYearId: fy.id,
          journalId: journal.id,
          date: new Date('2026-03-01'),
          description: 'Créance client',
          counterpartyId: customer.id,
          lines: {
            create: [
              {
                accountId: acc411.id,
                accountNumber: acc411.number,
                accountName: acc411.name,
                debitCents: 5000,
                creditCents: 0,
              },
              {
                accountId: acc706.id,
                accountNumber: acc706.number,
                accountName: acc706.name,
                debitCents: 0,
                creditCents: 5000,
              },
            ],
          },
        },
      })

      expect(await getSupplierPayableBalanceCents(fy.id, supplier.id, prisma)).toBe(10000)
      expect(await getCustomerReceivableBalanceCents(fy.id, customer.id, prisma)).toBe(5000)

      const supplierMoves = await listSupplier401Movements(fy.id, supplier.id, 10)
      expect(supplierMoves).toHaveLength(1)
      expect(supplierMoves[0]?.lineAmountSignedCents).toBe(10000)

      const customerMoves = await listCustomer411Movements(fy.id, customer.id, 10)
      expect(customerMoves).toHaveLength(1)
      expect(customerMoves[0]?.lineAmountSignedCents).toBe(5000)

      await prisma.entry.create({
        data: {
          fiscalYearId: fy.id,
          journalId: journal.id,
          date: new Date('2026-04-01'),
          description: '401 sans tiers',
          counterpartyId: null,
          lines: {
            create: [
              {
                accountId: acc401.id,
                accountNumber: acc401.number,
                accountName: acc401.name,
                debitCents: 0,
                creditCents: 100,
              },
            ],
          },
        },
      })

      expect(await count401LinesWithoutCounterparty(fy.id)).toBe(1)
      expect(await count411LinesWithoutCounterparty(fy.id)).toBe(0)
    } finally {
      await prisma.$disconnect()
    }
  })
})
