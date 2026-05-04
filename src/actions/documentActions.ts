'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getCurrentAssociationId } from '@/lib/associationContext'
import { saveUploadedFile, deleteStoredFile } from '@/lib/documentsStorage'
import { assertFiscalYearWritable } from '@/lib/accountingGuards'
import { writeAuditEvent } from '@/lib/audit'

export async function uploadDocument(data: { fiscalYearId: string; file: File }) {
  const associationId = await getCurrentAssociationId()
  if (!associationId) throw new Error('Association non sélectionnée.')
  if (!data.fiscalYearId) throw new Error('Exercice manquant.')
  if (!data.file) throw new Error('Fichier manquant.')

  await assertFiscalYearWritable({ fiscalYearId: data.fiscalYearId, associationId })

  const stored = await saveUploadedFile({
    file: data.file,
    associationId,
    exerciceId: data.fiscalYearId,
  })

  const doc = await prisma.document.create({
    data: {
      fiscalYearId: data.fiscalYearId,
      originalName: data.file.name,
      storedName: stored.storedName,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
      sha256: stored.sha256,
      relativePath: stored.relativePath,
      uploadedAt: new Date(),
    },
    select: { id: true },
  })

  revalidatePath('/documents')
  await writeAuditEvent({
    associationId,
    fiscalYearId: data.fiscalYearId,
    actor: associationId,
    action: 'DOCUMENT_UPLOAD',
    entityType: 'Document',
    entityId: doc.id,
    data: { originalName: data.file.name, storedName: stored.storedName },
  })
  return { success: true, documentId: doc.id }
}

export async function linkDocumentToLignes(data: { documentId: string; ligneIds: string[] }) {
  const associationId = await getCurrentAssociationId()
  if (!associationId) throw new Error('Association non sélectionnée.')
  if (!data.documentId) throw new Error('Document manquant.')

  const doc = await prisma.document.findUnique({
    where: { id: data.documentId },
    select: { id: true, fiscalYearId: true, fiscalYear: { select: { associationId: true } } },
  })
  if (!doc || doc.fiscalYear.associationId !== associationId) throw new Error('Document introuvable.')
  await assertFiscalYearWritable({ fiscalYearId: doc.fiscalYearId, associationId })

  const ligneIds = Array.from(new Set((data.ligneIds || []).filter(Boolean)))
  if (ligneIds.length === 0) return { success: true }

  const lines = await prisma.entryLine.findMany({
    where: { id: { in: ligneIds }, entry: { fiscalYearId: doc.fiscalYearId } },
    select: { id: true },
  })
  const validIds = lines.map((l) => l.id)

  if (validIds.length === 0) return { success: true }

  const existing = await prisma.documentEntryLine.findMany({
    where: { documentId: doc.id, entryLineId: { in: validIds } },
    select: { entryLineId: true },
  })
  const existingSet = new Set(existing.map((e) => e.entryLineId))
  const toCreate = validIds.filter((id) => !existingSet.has(id))

  if (toCreate.length > 0) {
    await prisma.documentEntryLine.createMany({
      data: toCreate.map((entryLineId) => ({ documentId: doc.id, entryLineId })),
    })
  }

  revalidatePath('/documents')
  revalidatePath('/saisie')
  revalidatePath('/ecritures')
  await writeAuditEvent({
    associationId,
    fiscalYearId: doc.fiscalYearId,
    actor: associationId,
    action: 'DOCUMENT_LINK',
    entityType: 'Document',
    entityId: doc.id,
    data: { ligneCount: validIds.length },
  })
  return { success: true }
}

export async function unlinkDocumentFromLigne(data: { documentId: string; ligneId: string }) {
  const associationId = await getCurrentAssociationId()
  if (!associationId) throw new Error('Association non sélectionnée.')
  if (!data.documentId || !data.ligneId) throw new Error('Paramètres manquants.')

  const doc = await prisma.document.findUnique({
    where: { id: data.documentId },
    select: { id: true, fiscalYearId: true, fiscalYear: { select: { associationId: true } } },
  })
  if (!doc || doc.fiscalYear.associationId !== associationId) throw new Error('Document introuvable.')
  await assertFiscalYearWritable({ fiscalYearId: doc.fiscalYearId, associationId })

  await prisma.documentEntryLine.deleteMany({
    where: { documentId: doc.id, entryLineId: data.ligneId },
  })

  revalidatePath('/documents')
  revalidatePath('/saisie')
  revalidatePath('/ecritures')
  await writeAuditEvent({
    associationId,
    fiscalYearId: doc.fiscalYearId,
    actor: associationId,
    action: 'DOCUMENT_UNLINK',
    entityType: 'Document',
    entityId: doc.id,
    data: { ligneId: data.ligneId },
  })
  return { success: true }
}

export async function deleteDocument(data: { documentId: string }) {
  const associationId = await getCurrentAssociationId()
  if (!associationId) throw new Error('Association non sélectionnée.')
  if (!data.documentId) throw new Error('Document manquant.')

  const doc = await prisma.document.findUnique({
    where: { id: data.documentId },
    select: { id: true, relativePath: true, fiscalYearId: true, fiscalYear: { select: { associationId: true } } },
  })
  if (!doc || doc.fiscalYear.associationId !== associationId) throw new Error('Document introuvable.')
  await assertFiscalYearWritable({ fiscalYearId: doc.fiscalYearId, associationId })

  await prisma.$transaction(async (tx) => {
    await tx.documentEntryLine.deleteMany({ where: { documentId: doc.id } })
    await tx.document.delete({ where: { id: doc.id } })
  })

  await deleteStoredFile(doc.relativePath)

  revalidatePath('/documents')
  revalidatePath('/saisie')
  revalidatePath('/ecritures')
  await writeAuditEvent({
    associationId,
    fiscalYearId: doc.fiscalYearId,
    actor: associationId,
    action: 'DOCUMENT_DELETE',
    entityType: 'Document',
    entityId: doc.id,
  })
  return { success: true }
}

// Backward-compatible export (UI uses old payload shape).
// TODO: migrate UI to use fiscalYearId.
export async function uploadDocumentLegacy(data: { exerciceId: string; file: File }) {
  return await uploadDocument({ fiscalYearId: data.exerciceId, file: data.file })
}

export async function uploadDocumentForLine(data: { entryLineId: string; file: File }) {
  const associationId = await getCurrentAssociationId()
  if (!associationId) throw new Error('Association non sélectionnée.')
  if (!data.entryLineId) throw new Error('Ligne manquante.')
  if (!data.file) throw new Error('Fichier manquant.')

  const line = await prisma.entryLine.findUnique({
    where: { id: data.entryLineId },
    select: {
      id: true,
      entry: {
        select: {
          fiscalYearId: true,
          fiscalYear: { select: { associationId: true } },
        },
      },
    },
  })

  if (!line || line.entry.fiscalYear.associationId !== associationId) {
    throw new Error('Ligne introuvable.')
  }

  const fiscalYearId = line.entry.fiscalYearId
  await assertFiscalYearWritable({ fiscalYearId, associationId })

  const stored = await saveUploadedFile({
    file: data.file,
    associationId,
    exerciceId: fiscalYearId,
  })

  const doc = await prisma.$transaction(async (tx) => {
    const created = await tx.document.create({
      data: {
        fiscalYearId,
        originalName: data.file.name,
        storedName: stored.storedName,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        sha256: stored.sha256,
        relativePath: stored.relativePath,
        uploadedAt: new Date(),
      },
      select: { id: true },
    })

    await tx.documentEntryLine.create({
      data: { documentId: created.id, entryLineId: line.id },
    })

    return created
  })

  revalidatePath('/saisie')
  revalidatePath('/documents')
  revalidatePath('/ecritures')
  await writeAuditEvent({
    associationId,
    fiscalYearId,
    actor: associationId,
    action: 'DOCUMENT_UPLOAD_FROM_LINE',
    entityType: 'Document',
    entityId: doc.id,
    data: {
      originalName: data.file.name,
      storedName: stored.storedName,
      entryLineId: line.id,
    },
  })

  return { success: true, documentId: doc.id }
}

