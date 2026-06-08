'use server'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getCurrentAssociationId } from '@/lib/associationContext'
import { writeAuditEvent } from '@/lib/audit'
import {
  isQuickOperationType,
  validateTemplatePayload,
  type TemplatePayloadFromSaisie,
} from '@/lib/recurringExpenseTemplate'
import {
  getEntryTemplatePresetPack,
  listPresetPacksForEntityKind,
} from '@/lib/entryTemplatePresets'
import {
  entityKindForAssociation,
  importEntryTemplatePack,
  listImportedPackCodes,
} from '@/lib/entryTemplateImport'

export type RecurringExpenseTemplateDto = {
  id: string
  associationId: string
  title: string
  operationType: string
  amountCents: number | null
  counterpartyId: string | null
  operationAccountNumber: string
  treasuryAccountNumber: string | null
  packCode: string | null
  counterpartyName?: string | null
}

export type EntryTemplatePackSummaryDto = {
  code: string
  name: string
  description: string
  imported: boolean
}

async function resolveAssociationId(explicitId?: string | null): Promise<string> {
  const associationId = explicitId ?? (await getCurrentAssociationId())
  if (!associationId) throw new Error('Association non sélectionnée.')
  return associationId
}

async function assertCounterpartyInAssociation(
  counterpartyId: string | null | undefined,
  associationId: string,
) {
  if (!counterpartyId) return
  const cp = await prisma.counterparty.findFirst({
    where: { id: counterpartyId, associationId },
  })
  if (!cp) throw new Error('Tiers introuvable pour cette entité.')
}

function mapRow(row: {
  id: string
  associationId: string
  title: string
  operationType: string
  amountCents: number | null
  counterpartyId: string | null
  operationAccountNumber: string
  treasuryAccountNumber: string | null
  packCode: string | null
  counterparty?: { name: string } | null
}): RecurringExpenseTemplateDto {
  return {
    id: row.id,
    associationId: row.associationId,
    title: row.title,
    operationType: row.operationType,
    amountCents: row.amountCents,
    counterpartyId: row.counterpartyId,
    operationAccountNumber: row.operationAccountNumber,
    treasuryAccountNumber: row.treasuryAccountNumber,
    packCode: row.packCode,
    counterpartyName: row.counterparty?.name ?? null,
  }
}

export async function listRecurringExpenseTemplates(
  associationId?: string | null,
): Promise<RecurringExpenseTemplateDto[]> {
  const assocId = await resolveAssociationId(associationId)
  const rows = await prisma.recurringExpenseTemplate.findMany({
    where: { associationId: assocId },
    include: { counterparty: { select: { name: true } } },
    orderBy: [{ packCode: 'asc' }, { title: 'asc' }],
  })
  return rows.map(mapRow)
}

export async function listEntryTemplatePackSummaries(
  associationId?: string | null,
): Promise<EntryTemplatePackSummaryDto[]> {
  const assocId = await resolveAssociationId(associationId)
  const association = await prisma.association.findUnique({
    where: { id: assocId },
    select: { legalFormCode: true },
  })
  if (!association) throw new Error('Entité introuvable.')

  const entityKind = entityKindForAssociation(association.legalFormCode)
  const importedCodes = new Set(await listImportedPackCodes(prisma, assocId))

  return listPresetPacksForEntityKind(entityKind).map((pack) => ({
    code: pack.code,
    name: pack.name,
    description: pack.description,
    imported: importedCodes.has(pack.code),
  }))
}

export async function importEntryTemplatePackAction(
  packCode: string,
  associationId?: string | null,
) {
  const assocId = await resolveAssociationId(associationId)
  const pack = getEntryTemplatePresetPack(packCode)
  if (!pack) throw new Error('Pack de modèles introuvable.')

  const association = await prisma.association.findUnique({
    where: { id: assocId },
    select: { legalFormCode: true },
  })
  if (!association) throw new Error('Entité introuvable.')

  const entityKind = entityKindForAssociation(association.legalFormCode)
  if (!pack.entityKinds.includes(entityKind)) {
    throw new Error('Ce pack ne s’applique pas à ce type d’entité.')
  }

  const result = await importEntryTemplatePack(prisma, assocId, packCode)

  if (result.imported > 0) {
    await writeAuditEvent({
      associationId: assocId,
      fiscalYearId: null,
      actor: assocId,
      action: 'ENTRY_TEMPLATE_PACK_IMPORT',
      entityType: 'RecurringExpenseTemplate',
      entityId: packCode,
      data: {
        packCode,
        imported: result.imported,
        skipped: result.skipped,
      },
    })
  }

  revalidatePaths()
  return result
}

export async function createRecurringExpenseTemplate(
  data: TemplatePayloadFromSaisie,
  options?: { associationId?: string | null },
) {
  const associationId = await resolveAssociationId(options?.associationId)
  const payload = normalizePayload(data)
  const validationError = validateTemplatePayload(payload)
  if (validationError) throw new Error(validationError)

  await assertCounterpartyInAssociation(payload.counterpartyId, associationId)
  await assertNoDuplicate(associationId, payload.title, payload.operationType)

  const created = await prisma.recurringExpenseTemplate.create({
    data: {
      associationId,
      title: payload.title,
      operationType: payload.operationType,
      amountCents: payload.amountCents,
      counterpartyId: payload.counterpartyId,
      operationAccountNumber: payload.operationAccountNumber,
      treasuryAccountNumber: payload.treasuryAccountNumber,
      packCode: payload.packCode ?? null,
    },
    include: { counterparty: { select: { name: true } } },
  })

  await writeAuditEvent({
    associationId,
    fiscalYearId: null,
    actor: associationId,
    action: 'RECURRING_EXPENSE_TEMPLATE_CREATE',
    entityType: 'RecurringExpenseTemplate',
    entityId: created.id,
    data: { title: created.title, operationType: created.operationType },
  })

  revalidatePaths()
  return mapRow(created)
}

export async function updateRecurringExpenseTemplate(data: {
  id: string
  payload: TemplatePayloadFromSaisie
  associationId?: string | null
}) {
  const associationId = await resolveAssociationId(data.associationId)
  const existing = await prisma.recurringExpenseTemplate.findFirst({
    where: { id: data.id, associationId },
  })
  if (!existing) throw new Error('Modèle introuvable.')

  const payload = normalizePayload(data.payload)
  const validationError = validateTemplatePayload(payload)
  if (validationError) throw new Error(validationError)

  await assertCounterpartyInAssociation(payload.counterpartyId, associationId)
  if (
    existing.title !== payload.title ||
    existing.operationType !== payload.operationType
  ) {
    await assertNoDuplicate(associationId, payload.title, payload.operationType, data.id)
  }

  const updated = await prisma.recurringExpenseTemplate.update({
    where: { id: data.id },
    data: {
      title: payload.title,
      operationType: payload.operationType,
      amountCents: payload.amountCents,
      counterpartyId: payload.counterpartyId,
      operationAccountNumber: payload.operationAccountNumber,
      treasuryAccountNumber: payload.treasuryAccountNumber,
      packCode: existing.packCode,
    },
    include: { counterparty: { select: { name: true } } },
  })

  await writeAuditEvent({
    associationId,
    fiscalYearId: null,
    actor: associationId,
    action: 'RECURRING_EXPENSE_TEMPLATE_UPDATE',
    entityType: 'RecurringExpenseTemplate',
    entityId: updated.id,
    data: { title: updated.title, operationType: updated.operationType },
  })

  revalidatePaths()
  return mapRow(updated)
}

export async function deleteRecurringExpenseTemplate(id: string, associationId?: string | null) {
  const assocId = await resolveAssociationId(associationId)
  const existing = await prisma.recurringExpenseTemplate.findFirst({
    where: { id, associationId: assocId },
  })
  if (!existing) throw new Error('Modèle introuvable.')

  await prisma.recurringExpenseTemplate.delete({ where: { id } })

  await writeAuditEvent({
    associationId: assocId,
    fiscalYearId: null,
    actor: assocId,
    action: 'RECURRING_EXPENSE_TEMPLATE_DELETE',
    entityType: 'RecurringExpenseTemplate',
    entityId: id,
    data: { title: existing.title },
  })

  revalidatePaths()
}

function normalizePayload(data: TemplatePayloadFromSaisie): TemplatePayloadFromSaisie {
  if (!isQuickOperationType(data.operationType)) {
    throw new Error("Type d'opération invalide.")
  }
  return {
    ...data,
    title: data.title.trim(),
    operationAccountNumber: data.operationAccountNumber.trim(),
    treasuryAccountNumber: data.treasuryAccountNumber?.trim() || null,
    packCode: data.packCode ?? null,
  }
}

async function assertNoDuplicate(
  associationId: string,
  title: string,
  operationType: string,
  excludeId?: string,
) {
  const dup = await prisma.recurringExpenseTemplate.findFirst({
    where: {
      associationId,
      title,
      operationType,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  })
  if (dup) {
    throw new Error('Un modèle avec ce titre et ce type existe déjà pour cette entité.')
  }
}

function revalidatePaths() {
  revalidatePath('/saisie')
  revalidatePath('/parametres/depenses-recurrentes')
}
