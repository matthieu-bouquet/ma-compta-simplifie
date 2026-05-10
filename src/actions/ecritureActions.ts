'use server'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { saveUploadedFile } from '@/lib/documentsStorage'
import { getCurrentAssociationId } from '@/lib/associationContext'
import { assertFiscalYearWritable } from '@/lib/accountingGuards'
import { writeAuditEvent } from '@/lib/audit'
import { eurosToCents } from '@/lib/money'
import { allocateEntryReferenceNumber } from '@/lib/journalNumbering'
import { getOrCreateJournalByCode } from '@/lib/journals'
import { assertEntryDateNotAfterToday, assertEntryDateWithinFiscalYear } from '@/lib/entryDateValidation'
import { reverseEntryInTransaction } from '@/lib/reverseEntryInTransaction'

export async function createEntry(data: {
  date: string,
  description: string,
  journalId?: string | null,
  fiscalYearId: string,
  counterpartyId?: string | null,
  lines: { accountId: string, debit: number, credit: number, documents?: File[] }[],
  documentFile?: File | null
}) {
  if (!data.fiscalYearId) {
    throw new Error('Fiscal year is required.')
  }

  const associationId = await getCurrentAssociationId()
  if (!associationId) throw new Error('Association non sélectionnée.')
  await assertFiscalYearWritable({ fiscalYearId: data.fiscalYearId, associationId })

  const fiscalYear = await prisma.fiscalYear.findUnique({
    where: { id: data.fiscalYearId },
    include: { association: true },
  })

  if (!fiscalYear) throw new Error('Fiscal year not found.')

  const counterpartyId: string | null = data.counterpartyId ?? null
  let descriptionFinal = data.description.trim()
  if (counterpartyId) {
    const cp = await prisma.counterparty.findUnique({
      where: { id: counterpartyId },
      select: { associationId: true, name: true },
    })
    if (!cp) throw new Error('Tiers introuvable.')
    if (cp.associationId !== fiscalYear.associationId) {
      throw new Error('Ce tiers ne correspond pas à cette entité.')
    }
    if (!descriptionFinal.includes(cp.name)) {
      descriptionFinal = `${descriptionFinal} — ${cp.name}`
    }
  }

  assertEntryDateNotAfterToday(data.date)
  assertEntryDateWithinFiscalYear(data.date, fiscalYear.startDate, fiscalYear.endDate)

  const totalDebitCents = data.lines.reduce((sum, l) => sum + eurosToCents(l.debit), 0)
  const totalCreditCents = data.lines.reduce((sum, l) => sum + eurosToCents(l.credit), 0)
  if (totalDebitCents !== totalCreditCents) {
    throw new Error("L'écriture n'est pas équilibrée (Total Débit ≠ Total Crédit)")
  }

  const accountIds = data.lines.map((l) => l.accountId)
  const accountsDb = await prisma.account.findMany({
    where: { id: { in: accountIds }, fiscalYearId: data.fiscalYearId }
  })

  const linesWithSnapshot = data.lines.map((l) => {
    const accountInfo = accountsDb.find((a) => a.id === l.accountId)
    if (!accountInfo) throw new Error(`Account not found: ${l.accountId}`)
    return {
      accountId: l.accountId,
      accountNumber: accountInfo.number,
      accountName: accountInfo.name,
      debitCents: eurosToCents(l.debit),
      creditCents: eurosToCents(l.credit)
    }
  })

  const journalId =
    data.journalId || (await getOrCreateJournalByCode(prisma, { code: 'OD', name: 'Opérations Diverses' })).id

  const storedDoc =
    data.documentFile
      ? await saveUploadedFile({
          file: data.documentFile,
          associationId: fiscalYear.associationId,
          exerciceId: data.fiscalYearId,
        })
      : null

  const storedLineDocuments = await Promise.all(
    data.lines.map(async (line) => {
      const docs = (line.documents ?? []).filter(Boolean)
      if (docs.length === 0) return []
      return await Promise.all(
        docs.map(async (file) => {
          const stored = await saveUploadedFile({
            file,
            associationId: fiscalYear.associationId,
            exerciceId: data.fiscalYearId,
          })
          return { file, stored }
        })
      )
    })
  )

  const created = await prisma.$transaction(async (tx) => {
    const { referenceNumber, referenceSequence } = await allocateEntryReferenceNumber(tx, {
      fiscalYearId: data.fiscalYearId,
      journalId,
    })

    const createdEntry = await tx.entry.create({
      data: {
        date: new Date(data.date),
        description: descriptionFinal,
        journalId,
        fiscalYearId: data.fiscalYearId,
        counterpartyId,
        referenceNumber,
        referenceSequence,
        lines: {
          create: linesWithSnapshot,
        },
      },
      select: { id: true, fiscalYearId: true, referenceNumber: true, lines: { select: { id: true } } },
    })

    if (data.documentFile && storedDoc) {
      const doc = await tx.document.create({
        data: {
          fiscalYearId: data.fiscalYearId,
          originalName: data.documentFile.name,
          storedName: storedDoc.storedName,
          mimeType: storedDoc.mimeType,
          sizeBytes: storedDoc.sizeBytes,
          sha256: storedDoc.sha256,
          relativePath: storedDoc.relativePath,
          uploadedAt: new Date(),
        },
        select: { id: true },
      })

      if (createdEntry.lines.length > 0) {
        await tx.documentEntryLine.createMany({
          data: createdEntry.lines.map((l) => ({ documentId: doc.id, entryLineId: l.id })),
        })
      }
    }

    const createdDocs: { id: string; entryLineId: string; originalName: string }[] = []
    for (let lineIndex = 0; lineIndex < storedLineDocuments.length; lineIndex++) {
      const entryLineId = createdEntry.lines[lineIndex]?.id
      if (!entryLineId) continue

      for (const docInfo of storedLineDocuments[lineIndex] ?? []) {
        const doc = await tx.document.create({
          data: {
            fiscalYearId: data.fiscalYearId,
            originalName: docInfo.file.name,
            storedName: docInfo.stored.storedName,
            mimeType: docInfo.stored.mimeType,
            sizeBytes: docInfo.stored.sizeBytes,
            sha256: docInfo.stored.sha256,
            relativePath: docInfo.stored.relativePath,
            uploadedAt: new Date(),
          },
          select: { id: true },
        })

        await tx.documentEntryLine.create({
          data: { documentId: doc.id, entryLineId },
        })

        createdDocs.push({ id: doc.id, entryLineId, originalName: docInfo.file.name })
      }
    }

    return { entry: createdEntry, createdDocs }
  })

  await writeAuditEvent({
    associationId,
    fiscalYearId: data.fiscalYearId,
    actor: associationId,
    action: 'ENTRY_CREATE',
    entityType: 'Entry',
    entityId: created.entry.id,
    data: {
      description: descriptionFinal,
      date: data.date,
      journalId,
      referenceNumber: created.entry.referenceNumber,
      counterpartyId,
    },
  })

  if (data.documentFile && storedDoc) {
    await writeAuditEvent({
      associationId,
      fiscalYearId: data.fiscalYearId,
      actor: associationId,
      action: 'DOCUMENT_UPLOAD_FROM_SAISIE',
      entityType: 'Document',
      entityId: null,
      data: { originalName: data.documentFile.name, entryId: created.entry.id },
    })
  }

  for (const doc of created.createdDocs) {
    await writeAuditEvent({
      associationId,
      fiscalYearId: data.fiscalYearId,
      actor: associationId,
      action: 'DOCUMENT_UPLOAD_FROM_SAISIE_LINE',
      entityType: 'Document',
      entityId: doc.id,
      data: { originalName: doc.originalName, entryId: created.entry.id, entryLineId: doc.entryLineId },
    })
  }

  revalidatePath('/saisie')
  revalidatePath('/')
  revalidatePath('/documents')
  revalidatePath('/parametres/tiers')
  return { success: true }
}

export async function deleteEntryByLineId(lineId: string) {
  if (!lineId) throw new Error('Invalid line id.')

  const associationId = await getCurrentAssociationId()
  if (!associationId) throw new Error('Association non sélectionnée.')

  const line = await prisma.entryLine.findUnique({
    where: { id: lineId },
    select: { entryId: true, entry: { select: { fiscalYearId: true } } },
  })

  if (!line) {
    revalidatePath('/saisie')
    return { success: true }
  }

  await assertFiscalYearWritable({ fiscalYearId: line.entry.fiscalYearId, associationId })
  await prisma.entry.delete({ where: { id: line.entryId } })

  revalidatePath('/saisie')
  revalidatePath('/')
  return { success: true }
}

export async function reverseEntryByLineId(lineId: string) {
  if (!lineId) throw new Error('Invalid line id.')

  const associationId = await getCurrentAssociationId()
  if (!associationId) throw new Error('Association non sélectionnée.')

  const line = await prisma.entryLine.findUnique({
    where: { id: lineId },
    select: { entryId: true },
  })
  if (!line) throw new Error('Line not found.')

  const { fiscalYearId } =
    (await prisma.entry.findUnique({
      where: { id: line.entryId },
      select: { fiscalYearId: true },
    })) ?? {}
  if (!fiscalYearId) throw new Error('Entry not found.')

  await assertFiscalYearWritable({ fiscalYearId, associationId })

  await prisma.$transaction(async (tx) => {
    await reverseEntryInTransaction(tx, { entryId: line.entryId, associationId })
  })

  revalidatePath('/saisie')
  revalidatePath('/ecritures')
  revalidatePath('/')
  return { success: true }
}

// Backward-compatible exports (UI still uses FR names / payload shape).
// TODO: migrate UI to English and remove.
export async function createEcriture(data: {
  date: string
  libelle: string
  journalId?: string | null
  exerciceId: string
  counterpartyId?: string | null
  lignes: { compteId: string; debit: number; credit: number }[]
  documentFile?: File | null
  documentsByLine?: File[][] | undefined
}) {
  return await createEntry({
    date: data.date,
    description: data.libelle,
    journalId: data.journalId,
    fiscalYearId: data.exerciceId,
    counterpartyId: data.counterpartyId ?? null,
    lines: data.lignes.map((l, idx) => ({
      accountId: l.compteId,
      debit: l.debit,
      credit: l.credit,
      documents: data.documentsByLine?.[idx] ?? [],
    })),
    documentFile: data.documentFile,
  })
}

export const deleteEcritureByLigneId = deleteEntryByLineId
export const annulerEcritureByLigneId = reverseEntryByLineId
