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

import { createDonationWithTaxReceipt } from '@/actions/donationActions'

describe('donation tax receipt posting', () => {
  beforeEach(() => {
    currentAssociationId = null
  })

  it('posts 512/7541 and issues RF number', async () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeTruthy()
    const prisma = createPrismaClient(dbUrl!)

    try {
      const assoc = await prisma.association.create({
        data: {
          name: 'Don assoc',
          address: '1 rue des Dons',
          postalCode: '75001',
          city: 'Paris',
          rna: 'W751234567',
          receiptSignatoryName: 'Jean Trésor',
          receiptSignatoryRole: 'Trésorier',
          taxReceiptEligibilityAttested: true,
        },
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
      await prisma.$transaction([
        prisma.account.create({ data: { fiscalYearId: fy.id, number: '512', name: 'Banque' } }),
        prisma.account.create({ data: { fiscalYearId: fy.id, number: '7541', name: 'Dons manuels' } }),
      ])

      const result = await createDonationWithTaxReceipt({
        fiscalYearId: fy.id,
        donorName: 'Alice Donatrice',
        donorAddress: '2 avenue Test',
        donorPostalCode: '75002',
        donorCity: 'Paris',
        amountEuros: 100,
        date: '2026-04-10',
        paymentMethod: 'CHEQUE',
        treasuryAccountNumber: '512',
        eligibilityAttested: true,
      })

      expect(result.taxReceiptNumber).toBe('RF-2026-0001')
      const donation = await prisma.donation.findUnique({
        where: { id: result.donationId },
        include: { taxReceipt: true },
      })
      expect(donation?.entryId).toBeTruthy()
      const entry = await prisma.entry.findUnique({
        where: { id: donation!.entryId! },
        include: { lines: true },
      })
      expect(entry?.lines.find((l) => l.accountNumber === '512')?.debitCents).toBe(10000)
      expect(entry?.lines.find((l) => l.accountNumber === '7541')?.creditCents).toBe(10000)
      expect(donation?.taxReceipt?.pdfDocumentId).toBeTruthy()
    } finally {
      await prisma.$disconnect()
    }
  })
})
