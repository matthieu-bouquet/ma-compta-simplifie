'use server'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { prisma } from '@/lib/prisma'
import { getCurrentAssociationId } from '@/lib/associationContext'
import { assertFiscalYearWritable } from '@/lib/accountingGuards'
import { writeAuditEvent } from '@/lib/audit'
import { eurosToCents } from '@/lib/money'
import { getOrCreateJournalByCode } from '@/lib/journals'
import { allocateEntryReferenceNumber } from '@/lib/journalNumbering'
import { saveUploadedFile } from '@/lib/documentsStorage'
import { revalidatePath } from 'next/cache'
import { assertEntryDateNotAfterToday } from '@/lib/entryDateValidation'
import { reverseEntryInTransaction } from '@/lib/reverseEntryInTransaction'

const IN_KIND_KIND_VOLUNTEERING = 'VOLUNTEERING'
const IN_KIND_UNIT_HOUR = 'HOUR'

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path)
  } catch {
    // In unit tests / non-Next runtimes, revalidatePath has no static generation store.
  }
}

function hoursToMilliUnits(hours: number) {
  if (!Number.isFinite(hours)) throw new Error('Quantité invalide.')
  return Math.round(hours * 1000)
}

export async function createVolunteeringContribution(data: {
  fiscalYearId: string
  date: string // YYYY-MM-DD
  description: string
  contributorName?: string | null
  hours: number
  hourlyRate: number // EUR
  valuationMethod: string
  meetsAnc2112Essential: boolean
  meetsAnc2112Measurable: boolean
  isRecorded: boolean
  documentFile?: File | null
}) {
  const associationId = await getCurrentAssociationId()
  if (!associationId) throw new Error('Association non sélectionnée.')
  await assertFiscalYearWritable({ fiscalYearId: data.fiscalYearId, associationId })

  if (!data.description?.trim()) throw new Error('Libellé requis.')
  if (!data.valuationMethod?.trim()) throw new Error('Méthode de valorisation requise.')
  if (!data.date) throw new Error('Date requise.')

  const date = new Date(data.date)
  if (Number.isNaN(date.getTime())) throw new Error('Date invalide.')
  assertEntryDateNotAfterToday(data.date)

  if (data.hours <= 0) throw new Error('Le nombre d’heures doit être strictement supérieur à 0.')
  if (!Number.isFinite(data.hourlyRate) || data.hourlyRate <= 0) {
    throw new Error('Le taux horaire doit être strictement supérieur à 0.')
  }

  const quantityMilliUnits = hoursToMilliUnits(data.hours)
  const unitValueCents = eurosToCents(data.hourlyRate)
  const totalValueCents = Math.round((quantityMilliUnits * unitValueCents) / 1000)
  if (totalValueCents <= 0) throw new Error('La valorisation totale doit être strictement supérieure à 0.')

  const created = await prisma.$transaction(async (tx) => {
    let documentId: string | null = null

    if (data.documentFile) {
      const stored = await saveUploadedFile({
        file: data.documentFile,
        associationId,
        exerciceId: data.fiscalYearId,
      })
      const doc = await tx.document.create({
        data: {
          fiscalYearId: data.fiscalYearId,
          originalName: data.documentFile.name,
          storedName: stored.storedName,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          sha256: stored.sha256,
          relativePath: stored.relativePath,
          uploadedAt: new Date(),
        },
        select: { id: true },
      })
      documentId = doc.id
    }

    let entryId: string | null = null

    if (data.isRecorded) {
      const [debitAccount, creditAccount] = await Promise.all([
        tx.account.findFirst({ where: { fiscalYearId: data.fiscalYearId, number: '864' } }),
        tx.account.findFirst({ where: { fiscalYearId: data.fiscalYearId, number: '875' } }),
      ])

      if (!debitAccount || !creditAccount) {
        throw new Error('Comptes requis introuvables dans cet exercice (864/875).')
      }

      const journalOD = await getOrCreateJournalByCode(tx, { code: 'OD', name: 'Opérations Diverses' })
      const { referenceNumber, referenceSequence } = await allocateEntryReferenceNumber(tx, {
        fiscalYearId: data.fiscalYearId,
        journalId: journalOD.id,
      })

      const entry = await tx.entry.create({
        data: {
          date,
          description: data.description,
          journalId: journalOD.id,
          fiscalYearId: data.fiscalYearId,
          referenceNumber,
          referenceSequence,
          lines: {
            create: [
              {
                accountId: debitAccount.id,
                accountNumber: debitAccount.number,
                accountName: debitAccount.name,
                debitCents: totalValueCents,
                creditCents: 0,
              },
              {
                accountId: creditAccount.id,
                accountNumber: creditAccount.number,
                accountName: creditAccount.name,
                debitCents: 0,
                creditCents: totalValueCents,
              },
            ],
          },
        },
        select: { id: true, referenceNumber: true, lines: { select: { id: true } } },
      })

      entryId = entry.id

      if (documentId) {
        await tx.documentEntryLine.createMany({
          data: entry.lines.map((l) => ({ documentId, entryLineId: l.id })),
        })
      }

      await writeAuditEvent(
        {
          associationId,
          fiscalYearId: data.fiscalYearId,
          actor: associationId,
          action: 'ENTRY_CREATE',
          entityType: 'Entry',
          entityId: entry.id,
          data: { description: data.description, date: data.date, journalCode: 'OD', referenceNumber: entry.referenceNumber },
        },
        tx
      )
    }

    const contribution = await tx.inKindContribution.create({
      data: {
        associationId,
        fiscalYearId: data.fiscalYearId,
        kind: IN_KIND_KIND_VOLUNTEERING,
        date,
        description: data.description,
        contributorName: data.contributorName?.trim() || null,
        quantityMilliUnits,
        unit: IN_KIND_UNIT_HOUR,
        unitValueCents,
        totalValueCents,
        valuationMethod: data.valuationMethod,
        meetsAnc2112Essential: data.meetsAnc2112Essential,
        meetsAnc2112Measurable: data.meetsAnc2112Measurable,
        isRecorded: data.isRecorded,
        entryId,
        documentId,
      },
      select: { id: true, fiscalYearId: true },
    })

    await writeAuditEvent(
      {
        associationId,
        fiscalYearId: data.fiscalYearId,
        actor: associationId,
        action: 'IN_KIND_CONTRIBUTION_CREATE',
        entityType: 'InKindContribution',
        entityId: contribution.id,
        data: {
          kind: IN_KIND_KIND_VOLUNTEERING,
          date: data.date,
          hours: data.hours,
          hourlyRate: data.hourlyRate,
          totalValueCents,
          isRecorded: data.isRecorded,
        },
      },
      tx
    )

    return contribution
  })

  safeRevalidatePath('/benevolat')
  safeRevalidatePath('/ecritures')
  safeRevalidatePath('/bilan')
  safeRevalidatePath('/documents')
  return { success: true, id: created.id }
}

export async function deleteInKindContribution(id: string) {
  if (!id) throw new Error('Invalid id.')

  const associationId = await getCurrentAssociationId()
  if (!associationId) throw new Error('Association non sélectionnée.')

  const row = await prisma.inKindContribution.findUnique({
    where: { id },
    select: { id: true, associationId: true, fiscalYearId: true, entryId: true },
  })
  if (!row || row.associationId !== associationId) {
    safeRevalidatePath('/benevolat')
    return { success: true }
  }

  await assertFiscalYearWritable({ fiscalYearId: row.fiscalYearId, associationId })

  await prisma.$transaction(async (tx) => {
    if (row.entryId) {
      await reverseEntryInTransaction(tx, { entryId: row.entryId, associationId })
    }
    await tx.inKindContribution.delete({ where: { id: row.id } })
    await writeAuditEvent(
      {
        associationId,
        fiscalYearId: row.fiscalYearId,
        actor: associationId,
        action: 'IN_KIND_CONTRIBUTION_DELETE',
        entityType: 'InKindContribution',
        entityId: row.id,
        data: {
          hadAccountingEntry: Boolean(row.entryId),
          reversalWhenRecorded: Boolean(row.entryId),
        },
      },
      tx
    )
  })

  safeRevalidatePath('/benevolat')
  safeRevalidatePath('/ecritures')
  safeRevalidatePath('/bilan')
  return { success: true }
}

