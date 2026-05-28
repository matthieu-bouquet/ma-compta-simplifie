// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { createPrismaClient } from '@/lib/createPrismaClient'
import { beforeEach, describe, expect, it } from 'vitest'
import { buildEntryLinesFromQuickVat } from '@/lib/vatQuickEntry'

describe('buildEntryLinesFromQuickVat', () => {
  let associationId: string
  let fiscalYearId: string
  let chargeId: string
  let bankId: string
  let supplier401Id: string
  let productId: string
  let customer411Id: string

  beforeEach(async () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeTruthy()
    const prisma = createPrismaClient(dbUrl)

    const assoc = await prisma.association.create({ data: { name: 'Quick VAT lib', vatLiable: true } })
    associationId = assoc.id
    const fy = await prisma.fiscalYear.create({
      data: {
        associationId: assoc.id,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        status: 'OPEN',
      },
    })
    fiscalYearId = fy.id

    const charge = await prisma.account.create({
      data: { fiscalYearId: fy.id, number: '606', name: 'Achats' },
    })
    const bank = await prisma.account.create({
      data: { fiscalYearId: fy.id, number: '512', name: 'Banque' },
    })
    const supplier = await prisma.account.create({
      data: { fiscalYearId: fy.id, number: '401', name: 'Fournisseurs' },
    })
    const product = await prisma.account.create({
      data: { fiscalYearId: fy.id, number: '706', name: 'Ventes' },
    })
    const customer = await prisma.account.create({
      data: { fiscalYearId: fy.id, number: '411', name: 'Clients' },
    })

    chargeId = charge.id
    bankId = bank.id
    supplier401Id = supplier.id
    productId = product.id
    customer411Id = customer.id

    await prisma.$disconnect()
  })

  it('rejects invalid VAT rate and conflicting settlement accounts', async () => {
    const prisma = createPrismaClient(process.env.DATABASE_URL)
    try {
      await expect(
        buildEntryLinesFromQuickVat(prisma, {
          fiscalYearId,
          associationId,
          input: {
            amountTtcEuros: 100,
            vatRatePercent: 0,
            flow: 'DEPENSE',
            settledImmediately: true,
            operationAccountId: chargeId,
            treasuryAccountId: bankId,
            thirdPartyAccountId: null,
          },
        }),
      ).rejects.toThrow('Taux de TVA invalide')

      await expect(
        buildEntryLinesFromQuickVat(prisma, {
          fiscalYearId,
          associationId,
          input: {
            amountTtcEuros: 100,
            vatRatePercent: 20,
            flow: 'DEPENSE',
            settledImmediately: true,
            operationAccountId: chargeId,
            treasuryAccountId: bankId,
            thirdPartyAccountId: supplier401Id,
          },
        }),
      ).rejects.toThrow('ne pas renseigner de compte tiers')
    } finally {
      await prisma.$disconnect()
    }
  })

  it('builds credit expense on supplier account', async () => {
    const prisma = createPrismaClient(process.env.DATABASE_URL)
    try {
      const lines = await buildEntryLinesFromQuickVat(prisma, {
        fiscalYearId,
        associationId,
        input: {
          amountTtcEuros: 120,
          vatRatePercent: 20,
          flow: 'DEPENSE',
          settledImmediately: false,
          operationAccountId: chargeId,
          treasuryAccountId: null,
          thirdPartyAccountId: supplier401Id,
        },
      })

      expect(lines).toHaveLength(3)
      expect(lines[2]).toMatchObject({ accountId: supplier401Id, debit: 0, credit: 120 })
    } finally {
      await prisma.$disconnect()
    }
  })

  it('builds settled revenue with treasury debit', async () => {
    const prisma = createPrismaClient(process.env.DATABASE_URL)
    try {
      const lines = await buildEntryLinesFromQuickVat(prisma, {
        fiscalYearId,
        associationId,
        input: {
          amountTtcEuros: 120,
          vatRatePercent: 20,
          flow: 'RECETTE',
          settledImmediately: true,
          operationAccountId: productId,
          treasuryAccountId: bankId,
          thirdPartyAccountId: null,
        },
      })

      expect(lines[0]).toMatchObject({ accountId: bankId, debit: 120, credit: 0 })
      expect(lines[1]).toMatchObject({ accountId: productId, debit: 0, credit: 100 })
    } finally {
      await prisma.$disconnect()
    }
  })

  it('builds credit revenue on customer account', async () => {
    const prisma = createPrismaClient(process.env.DATABASE_URL)
    try {
      const lines = await buildEntryLinesFromQuickVat(prisma, {
        fiscalYearId,
        associationId,
        input: {
          amountTtcEuros: 60,
          vatRatePercent: 20,
          flow: 'RECETTE',
          settledImmediately: false,
          operationAccountId: productId,
          treasuryAccountId: null,
          thirdPartyAccountId: customer411Id,
        },
      })

      expect(lines[0]).toMatchObject({ accountId: customer411Id, debit: 60, credit: 0 })
    } finally {
      await prisma.$disconnect()
    }
  })

  it('rejects wrong third-party account class for flow', async () => {
    const prisma = createPrismaClient(process.env.DATABASE_URL)
    try {
      await expect(
        buildEntryLinesFromQuickVat(prisma, {
          fiscalYearId,
          associationId,
          input: {
            amountTtcEuros: 50,
            vatRatePercent: 20,
            flow: 'DEPENSE',
            settledImmediately: false,
            operationAccountId: chargeId,
            treasuryAccountId: null,
            thirdPartyAccountId: customer411Id,
          },
        }),
      ).rejects.toThrow('compte fournisseur')
    } finally {
      await prisma.$disconnect()
    }
  })
})
