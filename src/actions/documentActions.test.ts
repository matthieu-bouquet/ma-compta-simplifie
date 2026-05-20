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

vi.mock('@/lib/documentsStorage', () => ({
  saveUploadedFile: vi.fn(async () => ({
    storedName: '20260101_test__abc.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 42,
    sha256: 'deadbeef',
    relativePath: 'assoc/fy/20260101_test__abc.pdf',
  })),
  deleteStoredFile: vi.fn(async () => undefined),
}))

let currentAssociationId: string | null = null

vi.mock('@/lib/associationContext', () => ({
  getCurrentAssociationId: async () => currentAssociationId,
}))

import {
  deleteDocument,
  linkDocumentToLignes,
  unlinkDocumentFromLigne,
  uploadDocument,
  uploadDocumentForLine,
} from '@/actions/documentActions'

describe('documentActions', () => {
  beforeEach(() => {
    currentAssociationId = null
  })

  async function seedFyWithLine(prisma: PrismaClient) {
    const assoc = await prisma.association.create({ data: { name: 'Doc actions' } })
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
    const entry = await prisma.entry.create({
      data: {
        fiscalYearId: fy.id,
        journalId: journal.id,
        date: new Date('2026-02-01'),
        description: 'Doc line',
        lines: {
          create: [
            {
              accountId: debit.id,
              accountNumber: debit.number,
              accountName: debit.name,
              debitCents: 1000,
              creditCents: 0,
            },
            {
              accountId: credit.id,
              accountNumber: credit.number,
              accountName: credit.name,
              debitCents: 0,
              creditCents: 1000,
            },
          ],
        },
      },
      include: { lines: true },
    })
    return { assoc, fy, lineId: entry.lines[0]!.id }
  }

  it('uploads, links, unlinks and deletes a document', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })

    try {
      const { fy, lineId: entryLineId } = await seedFyWithLine(prisma)
      const file = new File([Buffer.from('%PDF-1.4\n')], 'facture.pdf', { type: 'application/pdf' })

      const uploaded = await uploadDocument({ fiscalYearId: fy.id, file })
      expect(uploaded.documentId).toBeTruthy()

      await linkDocumentToLignes({ documentId: uploaded.documentId, ligneIds: [entryLineId] })
      const links = await prisma.documentEntryLine.findMany({
        where: { documentId: uploaded.documentId, entryLineId },
      })
      expect(links).toHaveLength(1)

      await unlinkDocumentFromLigne({ documentId: uploaded.documentId, ligneId: entryLineId })
      expect(
        await prisma.documentEntryLine.count({
          where: { documentId: uploaded.documentId },
        }),
      ).toBe(0)

      await deleteDocument({ documentId: uploaded.documentId })
      expect(await prisma.document.findUnique({ where: { id: uploaded.documentId } })).toBeNull()
    } finally {
      await prisma.$disconnect()
    }
  })

  it('uploadDocumentForLine attaches document to line', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })

    try {
      const { lineId } = await seedFyWithLine(prisma)
      const file = new File([Buffer.from('%PDF-1.4\n')], 'line.pdf', { type: 'application/pdf' })

      const res = await uploadDocumentForLine({ entryLineId: lineId, file })
      const link = await prisma.documentEntryLine.findFirst({
        where: { entryLineId: lineId, documentId: res.documentId },
      })
      expect(link).toBeTruthy()
    } finally {
      await prisma.$disconnect()
    }
  })
})
