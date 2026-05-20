// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { PrismaClient } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  writeAuditEvent: vi.fn(),
}))

let currentAssociationId: string | null = null

vi.mock('@/lib/associationContext', () => ({
  getCurrentAssociationId: async () => currentAssociationId,
}))

import {
  createCounterparty,
  deleteCounterparty,
  getCustomer411BalanceCents,
  getCustomer411Preview,
  getSupplier401Preview,
  listCounterparties,
  updateCounterparty,
} from '@/actions/counterpartyActions'

describe('counterpartyActions', () => {
  beforeEach(() => {
    currentAssociationId = null
  })

  it('creates, lists, updates and deletes a counterparty', async () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeTruthy()

    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })

    try {
      const assoc = await prisma.association.create({ data: { name: 'CP actions test' } })
      currentAssociationId = assoc.id

      const created = await createCounterparty({ name: '  Fournisseur A  ', kind: 'SUPPLIER' })
      expect(created.name).toBe('Fournisseur A')

      const listed = await listCounterparties('SUPPLIER')
      expect(listed.some((c) => c.id === created.id)).toBe(true)

      const updated = await updateCounterparty({ id: created.id, name: 'Fournisseur B' })
      expect(updated.name).toBe('Fournisseur B')

      await deleteCounterparty(created.id)
      const gone = await prisma.counterparty.findUnique({ where: { id: created.id } })
      expect(gone).toBeNull()
    } finally {
      await prisma.$disconnect()
    }
  })

  it('getSupplier401Preview returns balance for linked entries', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })

    try {
      const assoc = await prisma.association.create({ data: { name: 'CP preview test' } })
      currentAssociationId = assoc.id

      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: assoc.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
      })
      const supplier = await createCounterparty({ name: 'S preview', kind: 'SUPPLIER' })

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

      await prisma.entry.create({
        data: {
          fiscalYearId: fy.id,
          journalId: journal.id,
          date: new Date('2026-02-01'),
          description: 'Preview debt',
          counterpartyId: supplier.id,
          lines: {
            create: [
              {
                accountId: acc601.id,
                accountNumber: '601',
                accountName: 'Achats',
                debitCents: 3000,
                creditCents: 0,
              },
              {
                accountId: acc401.id,
                accountNumber: '401',
                accountName: 'Fournisseurs',
                debitCents: 0,
                creditCents: 3000,
              },
            ],
          },
        },
      })

      const preview = await getSupplier401Preview(fy.id, supplier.id)
      expect(preview.balanceCents).toBe(3000)
      expect(preview.movements).toHaveLength(1)
    } finally {
      await prisma.$disconnect()
    }
  })

  it('getCustomer411Preview and balance reflect receivable', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })

    try {
      const assoc = await prisma.association.create({ data: { name: 'CP customer preview' } })
      currentAssociationId = assoc.id
      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: assoc.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
      })
      const customer = await createCounterparty({ name: 'Client A', kind: 'CUSTOMER' })
      const journal = await prisma.journal.upsert({
        where: { code: 'VT' },
        update: {},
        create: { code: 'VT', name: 'Ventes' },
      })
      const acc706 = await prisma.account.create({
        data: { fiscalYearId: fy.id, number: '706', name: 'Cotisations' },
      })
      const acc411 = await prisma.account.create({
        data: { fiscalYearId: fy.id, number: '411', name: 'Clients' },
      })

      await prisma.entry.create({
        data: {
          fiscalYearId: fy.id,
          journalId: journal.id,
          date: new Date('2026-03-01'),
          description: 'Facture client',
          counterpartyId: customer.id,
          lines: {
            create: [
              {
                accountId: acc411.id,
                accountNumber: '411',
                accountName: 'Clients',
                debitCents: 8000,
                creditCents: 0,
              },
              {
                accountId: acc706.id,
                accountNumber: '706',
                accountName: 'Cotisations',
                debitCents: 0,
                creditCents: 8000,
              },
            ],
          },
        },
      })

      const preview = await getCustomer411Preview(fy.id, customer.id)
      expect(preview.balanceCents).toBe(8000)
      expect(await getCustomer411BalanceCents(fy.id, customer.id)).toBe(8000)
    } finally {
      await prisma.$disconnect()
    }
  })

  it('rejects delete when entries are linked', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })

    try {
      const assoc = await prisma.association.create({ data: { name: 'CP delete guard' } })
      currentAssociationId = assoc.id
      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: assoc.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
      })
      const supplier = await createCounterparty({ name: 'Linked', kind: 'SUPPLIER' })
      const journal = await prisma.journal.upsert({
        where: { code: 'OD' },
        update: {},
        create: { code: 'OD', name: 'OD' },
      })

      await prisma.entry.create({
        data: {
          fiscalYearId: fy.id,
          journalId: journal.id,
          date: new Date('2026-02-01'),
          description: 'x',
          counterpartyId: supplier.id,
        },
      })

      await expect(deleteCounterparty(supplier.id)).rejects.toThrow('écritures')
    } finally {
      await prisma.$disconnect()
    }
  })
})
