// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPrismaClient } from '@/lib/createPrismaClient'

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

import { createInvoice } from '@/actions/invoiceActions'

describe('createInvoice', () => {
  beforeEach(() => {
    currentAssociationId = null
  })

  it('creates invoice with accounting entry (411 receivable)', async () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeTruthy()
    const prisma = createPrismaClient(dbUrl!)

    try {
      const assoc = await prisma.association.create({ data: { name: 'Invoice test assoc' } })
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
        where: { code: 'VE' },
        update: { name: 'Ventes' },
        create: { code: 'VE', name: 'Ventes' },
      })

      const account706 = (
        await prisma.$transaction([
          prisma.account.create({ data: { fiscalYearId: fy.id, number: '411', name: 'Clients' } }),
          prisma.account.create({ data: { fiscalYearId: fy.id, number: '706', name: 'Prestations' } }),
        ])
      )[1]!

      const customer = await prisma.counterparty.create({
        data: { associationId: assoc.id, kind: 'CUSTOMER', name: 'Client stage' },
      })

      const result = await createInvoice({
        fiscalYearId: fy.id,
        issueDate: '2026-02-10',
        recipientName: 'Client stage',
        counterpartyId: customer.id,
        postToAccounting: true,
        lines: [
          {
            description: 'Stage week-end',
            amountCents: 15000,
            accountId: account706.id,
          },
        ],
      })

      expect(result.number).toBe('2026-0001')

      const invoice = await prisma.invoice.findUnique({
        where: { id: result.id },
        include: { lines: true },
      })
      expect(invoice?.totalCents).toBe(15000)
      expect(invoice?.entryId).toBeTruthy()
      expect(invoice?.pdfDocumentId).toBeTruthy()

      const entry = await prisma.entry.findUnique({
        where: { id: invoice!.entryId! },
        include: { lines: true },
      })
      expect(entry?.journalId).toBe(journal.id)
      expect(entry?.counterpartyId).toBe(customer.id)

      const line411 = entry!.lines.find((l) => l.accountNumber.startsWith('411'))
      expect(line411?.debitCents).toBe(15000)
      const line706 = entry!.lines.find((l) => l.accountNumber === '706')
      expect(line706?.creditCents).toBe(15000)
    } finally {
      await prisma.$disconnect()
    }
  })
})
