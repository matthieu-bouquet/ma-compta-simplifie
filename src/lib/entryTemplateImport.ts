// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import type { PrismaClient } from '@/lib/db'
import { writeAuditEvent } from '@/lib/audit'
import {
  getEntryTemplatePresetPack,
  inferEntityKindFromLegalForm,
  listAutoSeedPacksForEntityKind,
  type EntryTemplateEntityKind,
} from '@/lib/entryTemplatePresets'

export type ImportEntryTemplatePackResult = {
  imported: number
  skipped: number
  packCode: string
}

export async function importEntryTemplatePack(
  db: Pick<PrismaClient, 'recurringExpenseTemplate'>,
  associationId: string,
  packCode: string,
): Promise<ImportEntryTemplatePackResult> {
  const pack = getEntryTemplatePresetPack(packCode)
  if (!pack) {
    throw new Error('Pack de modèles introuvable.')
  }

  let imported = 0
  let skipped = 0

  for (const line of pack.templates) {
    const existing = await db.recurringExpenseTemplate.findFirst({
      where: {
        associationId,
        title: line.title,
        operationType: line.operationType,
      },
      select: { id: true },
    })
    if (existing) {
      skipped += 1
      continue
    }

    await db.recurringExpenseTemplate.create({
      data: {
        associationId,
        title: line.title,
        operationType: line.operationType,
        amountCents: null,
        counterpartyId: null,
        operationAccountNumber: line.operationAccountNumber,
        treasuryAccountNumber: line.treasuryAccountNumber ?? null,
        packCode: pack.code,
      },
    })
    imported += 1
  }

  return { imported, skipped, packCode }
}

export async function importAutoSeedEntryTemplatePacks(
  db: Pick<PrismaClient, 'recurringExpenseTemplate' | 'association'>,
  associationId: string,
): Promise<ImportEntryTemplatePackResult[]> {
  const association = await db.association.findUnique({
    where: { id: associationId },
    select: { legalFormCode: true },
  })
  if (!association) return []

  const entityKind = inferEntityKindFromLegalForm(association.legalFormCode)
  const packs = listAutoSeedPacksForEntityKind(entityKind)
  const results: ImportEntryTemplatePackResult[] = []

  for (const pack of packs) {
    const result = await importEntryTemplatePack(db, associationId, pack.code)
    if (result.imported > 0 || result.skipped > 0) {
      results.push(result)
      if (result.imported > 0) {
        await writeAuditEvent({
          associationId,
          fiscalYearId: null,
          actor: associationId,
          action: 'ENTRY_TEMPLATE_PACK_IMPORT',
          entityType: 'RecurringExpenseTemplate',
          entityId: pack.code,
          data: { packCode: pack.code, imported: result.imported, skipped: result.skipped },
        })
      }
    }
  }

  return results
}

export async function listImportedPackCodes(
  db: Pick<PrismaClient, 'recurringExpenseTemplate'>,
  associationId: string,
): Promise<string[]> {
  const rows = await db.recurringExpenseTemplate.findMany({
    where: { associationId, packCode: { not: null } },
    select: { packCode: true },
    distinct: ['packCode'],
  })
  return rows.map((r) => r.packCode!).filter(Boolean)
}

export function entityKindForAssociation(
  legalFormCode: string | null | undefined,
): EntryTemplateEntityKind {
  return inferEntityKindFromLegalForm(legalFormCode)
}
