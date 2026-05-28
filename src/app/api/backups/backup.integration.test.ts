// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { PrismaClient } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import JSZip from 'jszip'

const writeAuditEvent = vi.fn().mockResolvedValue(undefined)

vi.mock('@/lib/audit', () => ({
  writeAuditEvent: (...args: unknown[]) => writeAuditEvent(...args),
}))

import { POST as exportBackup } from '@/app/api/backups/export/route'
import { POST as importBackup } from '@/app/api/backups/import/route'

const CHART_TEMPLATE_ASSOCIATION_ID = '00000000-0000-0000-0000-000000000001'

describe('backup export/import counterparties and settlement allocations', () => {
  it('round-trips counterparties, entry.counterpartyId, and CounterpartySettlementAllocation', async () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeTruthy()

    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })

    try {
      const assoc = await prisma.association.create({
        data: {
          name: 'Backup tier test',
          vatLiable: true,
          chartTemplateId: CHART_TEMPLATE_ASSOCIATION_ID,
        },
      })

      const supplier = await prisma.counterparty.create({
        data: { associationId: assoc.id, kind: 'SUPPLIER', name: 'Fournisseur backup' },
      })

      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: assoc.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
      })

      const journalAC = await prisma.journal.upsert({
        where: { code: 'AC' },
        update: { name: 'Achats' },
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
          journalId: journalAC.id,
          date: new Date('2026-02-10'),
          description: 'Facture backup',
          counterpartyId: supplier.id,
          referenceNumber: 'AC-000099',
          referenceSequence: 99,
          lines: {
            create: [
              {
                accountId: acc601.id,
                accountNumber: acc601.number,
                accountName: acc601.name,
                debitCents: 5000,
                creditCents: 0,
              },
              {
                accountId: acc401.id,
                accountNumber: acc401.number,
                accountName: acc401.name,
                debitCents: 0,
                creditCents: 5000,
              },
            ],
          },
        },
        include: { lines: true },
      })

      const payableLine = expense.lines.find((l) => l.accountNumber.startsWith('401'))!

      const settlement = await prisma.entry.create({
        data: {
          fiscalYearId: fy.id,
          journalId: journalAC.id,
          date: new Date('2026-02-12'),
          description: 'Règlement backup',
          counterpartyId: supplier.id,
          lines: {
            create: [
              {
                accountId: acc401.id,
                accountNumber: acc401.number,
                accountName: acc401.name,
                debitCents: 5000,
                creditCents: 0,
              },
              {
                accountId: bank.id,
                accountNumber: bank.number,
                accountName: bank.name,
                debitCents: 0,
                creditCents: 5000,
              },
            ],
          },
        },
        include: { lines: true },
      })

      const settlementDebit401 = settlement.lines.find((l) => l.accountNumber.startsWith('401'))!

      await prisma.counterpartySettlementAllocation.create({
        data: {
          payableLineId: payableLine.id,
          settlementLineId: settlementDebit401.id,
          amountCents: 5000,
        },
      })

      const exportRes = await exportBackup(
        new Request('http://localhost/api/backups/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fiscalYearIds: [fy.id], budgetIds: [] }),
        })
      )
      expect(exportRes.ok).toBe(true)
      const zipBuf = Buffer.from(await exportRes.arrayBuffer())

      const zipRead = await JSZip.loadAsync(zipBuf)
      const counterpartiesJson = JSON.parse(
        await zipRead.file('data/counterparties.json')!.async('string')
      ) as { id: string; name: string; kind: string }[]
      expect(counterpartiesJson).toHaveLength(1)
      expect(counterpartiesJson[0]!.name).toBe('Fournisseur backup')

      const entriesJson = JSON.parse(await zipRead.file('data/entries.json')!.async('string')) as {
        counterpartyId: string | null
      }[]
      expect(entriesJson.every((e) => e.counterpartyId === supplier.id)).toBe(true)

      const allocJson = JSON.parse(
        await zipRead.file('data/counterpartySettlementAllocations.json')!.async('string')
      ) as { payableLineId: string; settlementLineId: string; amountCents: number }[]
      expect(allocJson).toHaveLength(1)
      expect(allocJson[0]!.amountCents).toBe(5000)

      const assocJson = JSON.parse(await zipRead.file('data/associations.json')!.async('string')) as {
        vatLiable: boolean
        chartTemplateId: string | null
      }[]
      expect(assocJson[0]!.vatLiable).toBe(true)
      expect(assocJson[0]!.chartTemplateId).toBe(CHART_TEMPLATE_ASSOCIATION_ID)

      await prisma.association.deleteMany({ where: { id: assoc.id } })

      const previewForm = new FormData()
      previewForm.append('phase', 'preview')
      previewForm.append('file', new File([zipBuf], 'backup.zip', { type: 'application/zip' }))

      const previewRes = await importBackup(
        new Request('http://localhost/api/backups/import', { method: 'POST', body: previewForm })
      )
      expect(previewRes.ok).toBe(true)
      const previewBody = (await previewRes.json()) as { token: string; summary: { counterparties: number } }
      expect(previewBody.summary.counterparties).toBe(1)

      const applyForm = new FormData()
      applyForm.append('phase', 'apply')
      applyForm.append('token', previewBody.token)
      applyForm.append(
        'decisions',
        JSON.stringify({
          overwriteAssociationIds: [],
          overwriteFiscalYearIds: [],
          overwriteBudgetIds: [],
        })
      )

      const applyRes = await importBackup(
        new Request('http://localhost/api/backups/import', { method: 'POST', body: applyForm })
      )
      expect(applyRes.ok).toBe(true)

      expect(writeAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'BACKUP_EXPORT', entityType: 'Backup' }),
      )
      expect(writeAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'BACKUP_IMPORT', entityType: 'Backup' }),
      )

      const assocRestored = await prisma.association.findFirst({ where: { id: assoc.id } })
      expect(assocRestored?.vatLiable).toBe(true)
      expect(assocRestored?.chartTemplateId).toBe(CHART_TEMPLATE_ASSOCIATION_ID)

      const cpRestored = await prisma.counterparty.findFirst({ where: { id: supplier.id } })
      expect(cpRestored?.name).toBe('Fournisseur backup')

      const entriesRestored = await prisma.entry.findMany({
        where: { fiscalYearId: fy.id },
        orderBy: { date: 'asc' },
      })
      expect(entriesRestored).toHaveLength(2)
      expect(entriesRestored.every((e) => e.counterpartyId === supplier.id)).toBe(true)

      const allocRestored = await prisma.counterpartySettlementAllocation.findMany({
        where: { payableLineId: payableLine.id },
      })
      expect(allocRestored).toHaveLength(1)
      expect(allocRestored[0]!.amountCents).toBe(5000)
    } finally {
      await prisma.$disconnect()
    }
  })
})

describe('backup export/import recurring expense templates', () => {
  it('round-trips recurringExpenseTemplates linked to counterparties', async () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeTruthy()

    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })

    try {
      const assoc = await prisma.association.create({
        data: {
          name: 'Backup template test',
          chartTemplateId: CHART_TEMPLATE_ASSOCIATION_ID,
        },
      })

      const supplier = await prisma.counterparty.create({
        data: { associationId: assoc.id, kind: 'SUPPLIER', name: 'Fournisseur template' },
      })

      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: assoc.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
      })

      const template = await prisma.recurringExpenseTemplate.create({
        data: {
          associationId: assoc.id,
          title: 'Loyer backup',
          operationType: 'DEPENSE',
          amountCents: 75000,
          counterpartyId: supplier.id,
          operationAccountNumber: '601',
          treasuryAccountNumber: '512',
        },
      })

      const exportRes = await exportBackup(
        new Request('http://localhost/api/backups/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fiscalYearIds: [fy.id], budgetIds: [] }),
        }),
      )
      expect(exportRes.ok).toBe(true)
      const zipBuf = Buffer.from(await exportRes.arrayBuffer())

      const zipRead = await JSZip.loadAsync(zipBuf)
      const templatesJson = JSON.parse(
        await zipRead.file('data/recurringExpenseTemplates.json')!.async('string'),
      ) as {
        id: string
        title: string
        operationType: string
        amountCents: number
        counterpartyId: string | null
        operationAccountNumber: string
        treasuryAccountNumber: string | null
      }[]
      expect(templatesJson).toHaveLength(1)
      expect(templatesJson[0]!.title).toBe('Loyer backup')
      expect(templatesJson[0]!.counterpartyId).toBe(supplier.id)

      await prisma.association.deleteMany({ where: { id: assoc.id } })

      const previewForm = new FormData()
      previewForm.append('phase', 'preview')
      previewForm.append('file', new File([zipBuf], 'backup.zip', { type: 'application/zip' }))

      const previewRes = await importBackup(
        new Request('http://localhost/api/backups/import', { method: 'POST', body: previewForm }),
      )
      expect(previewRes.ok).toBe(true)
      const previewBody = (await previewRes.json()) as {
        token: string
        summary: { recurringExpenseTemplates: number }
      }
      expect(previewBody.summary.recurringExpenseTemplates).toBe(1)

      const applyForm = new FormData()
      applyForm.append('phase', 'apply')
      applyForm.append('token', previewBody.token)
      applyForm.append(
        'decisions',
        JSON.stringify({
          overwriteAssociationIds: [],
          overwriteFiscalYearIds: [],
          overwriteBudgetIds: [],
        }),
      )

      const applyRes = await importBackup(
        new Request('http://localhost/api/backups/import', { method: 'POST', body: applyForm }),
      )
      expect(applyRes.ok).toBe(true)

      const restored = await prisma.recurringExpenseTemplate.findUnique({ where: { id: template.id } })
      expect(restored?.title).toBe('Loyer backup')
      expect(restored?.operationType).toBe('DEPENSE')
      expect(restored?.amountCents).toBe(75000)
      expect(restored?.operationAccountNumber).toBe('601')
      expect(restored?.treasuryAccountNumber).toBe('512')
      expect(restored?.counterpartyId).toBe(supplier.id)
    } finally {
      await prisma.$disconnect()
    }
  })
})
