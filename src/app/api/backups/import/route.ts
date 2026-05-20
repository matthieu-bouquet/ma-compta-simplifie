// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import path from 'node:path'
import fsp from 'node:fs/promises'
import crypto from 'node:crypto'
import JSZip from 'jszip'
import { toAbsolutePath } from '@/lib/documentsStorage'
import { writeAuditEvent } from '@/lib/audit'
import { Prisma } from '@prisma/client'
import type {
  BackupAccountJson,
  BackupAssociationJson,
  BackupBudgetJson,
  BackupBudgetLineJson,
  BackupCounterpartyJson,
  BackupCounterpartySettlementAllocationJson,
  BackupRecurringExpenseTemplateJson,
  BackupDocumentEntryLineJson,
  BackupDocumentJson,
  BackupEntryJson,
  BackupEntryLineJson,
  BackupFiscalYearJson,
  BackupInKindContributionJson,
  BackupJournalJson,
  BackupJournalSequenceJson,
} from '@/lib/backupSchema'

export const runtime = 'nodejs'

/** Loaded ZIP root (see `JSZip.loadAsync`). */
type JSZipInstance = Awaited<ReturnType<typeof JSZip.loadAsync>>

type BackupManifest = {
  version: number
  exportedAt: string
  selections?: {
    associationIds?: string[]
    fiscalYearIds?: string[]
    budgetIds?: string[]
  }
}

type ConflictAssociation = {
  kind: 'ASSOCIATION'
  backupAssociation: { id: string; name: string; siret: string | null; postalCode: string | null; city: string | null }
  existingAssociation: { id: string; name: string; siret: string | null; postalCode: string | null; city: string | null }
}

type ConflictFiscalYear = {
  kind: 'FISCAL_YEAR'
  backupFiscalYear: { id: string; associationId: string; startDate: string; endDate: string }
  existingFiscalYear: { id: string; associationId: string; startDate: string; endDate: string }
}

/** How a backup budget was matched to an existing row (for UX / support). */
type BudgetConflictMatchKind = 'SAME_ID' | 'SAME_ASSOCIATION_AND_NAME'

type ConflictBudget = {
  kind: 'BUDGET'
  matchKind: BudgetConflictMatchKind
  backupBudget: { id: string; associationId: string; name: string }
  existingBudget: { id: string; associationId: string; name: string }
}

type PreviewResponse = {
  token: string
  summary: {
    associations: number
    fiscalYears: number
    budgets: number
    documents: number
    counterparties: number
    recurringExpenseTemplates: number
  }
  conflicts: {
    associations: ConflictAssociation[]
    fiscalYears: ConflictFiscalYear[]
    budgets: ConflictBudget[]
  }
}

type ApplyBody = {
  overwriteAssociationIds: string[] // existing association IDs to delete/replace
  overwriteFiscalYearIds: string[] // existing fiscal year IDs to delete/replace
  overwriteBudgetIds: string[] // existing budget IDs to delete before restoring backup budgets/lines
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string')
}

function normalizeLower(v: string | null | undefined) {
  return (v || '').trim().toLowerCase()
}

async function ensureTmpBackupsDir() {
  const dir = path.join(process.cwd(), '.tmp', 'backups')
  await fsp.mkdir(dir, { recursive: true })
  return dir
}

async function readZipBuffer(file: File) {
  const ab = await file.arrayBuffer()
  return Buffer.from(ab)
}

async function openZipFromBuffer(buf: Buffer): Promise<JSZipInstance> {
  return await JSZip.loadAsync(buf)
}

async function getZipText(zip: JSZipInstance, entryPath: string) {
  const entry = zip.file(entryPath)
  if (!entry) throw new Error(`Fichier manquant dans la sauvegarde: ${entryPath}`)
  return await entry.async('string')
}

async function getZipJson<T>(zip: JSZipInstance, entryPath: string): Promise<T> {
  const txt = await getZipText(zip, entryPath)
  return JSON.parse(txt) as T
}

async function getZipJsonOptional<T>(zip: JSZipInstance, entryPath: string, fallback: T): Promise<T> {
  const entry = zip.file(entryPath)
  if (!entry) return fallback
  const txt = await entry.async('string')
  return JSON.parse(txt) as T
}

async function writeZipToDisk(buf: Buffer) {
  const dir = await ensureTmpBackupsDir()
  const token = crypto.randomUUID()
  const filePath = path.join(dir, `${token}.zip`)
  await fsp.writeFile(filePath, buf)
  return { token, filePath }
}

async function readZipFromToken(token: string) {
  const dir = await ensureTmpBackupsDir()
  const filePath = path.join(dir, `${token}.zip`)
  const buf = await fsp.readFile(filePath)
  return { filePath, buf }
}

function isValidPhase(phase: string | null) {
  return phase === 'preview' || phase === 'apply'
}

function isUniqueConstraintError(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
}

export async function POST(req: Request) {
  const form = await req.formData()
  const phase = String(form.get('phase') || '')
  if (!isValidPhase(phase)) {
    return NextResponse.json({ error: 'Phase invalide.' }, { status: 400 })
  }

  if (phase === 'preview') {
    const zipFile = form.get('file')
    if (!(zipFile instanceof File)) {
      return NextResponse.json({ error: 'Fichier ZIP manquant.' }, { status: 400 })
    }

    const buf = await readZipBuffer(zipFile)
    const zip = await openZipFromBuffer(buf)

    const manifest = await getZipJson<BackupManifest>(zip, 'manifest.json')
    if (manifest.version !== 1) {
      return NextResponse.json({ error: 'Version de sauvegarde non supportée.' }, { status: 400 })
    }

    const backupAssociations = await getZipJson<BackupAssociationJson[]>(zip, 'data/associations.json')
    const backupFiscalYears = await getZipJson<BackupFiscalYearJson[]>(zip, 'data/fiscalYears.json')
    const backupBudgets = await getZipJsonOptional<BackupBudgetJson[]>(zip, 'data/budgets.json', [])
    const backupCounterparties = await getZipJsonOptional<BackupCounterpartyJson[]>(
      zip,
      'data/counterparties.json',
      []
    )
    const backupRecurringExpenseTemplates = await getZipJsonOptional<
      BackupRecurringExpenseTemplateJson[]
    >(zip, 'data/recurringExpenseTemplates.json', [])
    const backupDocuments = await getZipJson<BackupDocumentJson[]>(zip, 'data/documents.json')

    // Conflicts: associations
    const existingAssociations = await prisma.association.findMany({
      select: { id: true, name: true, siret: true, postalCode: true, city: true },
    })

    const associationConflicts: ConflictAssociation[] = []
    for (const a of backupAssociations) {
      const backup = {
        id: String(a.id),
        name: String(a.name),
        siret: a.siret ? String(a.siret) : null,
        postalCode: a.postalCode ? String(a.postalCode) : null,
        city: a.city ? String(a.city) : null,
      }

      let existing =
        backup.siret
          ? existingAssociations.find((e) => e.siret && e.siret === backup.siret)
          : undefined

      if (!existing) {
        const bName = normalizeLower(backup.name)
        const bPostal = normalizeLower(backup.postalCode)
        const bCity = normalizeLower(backup.city)
        existing = existingAssociations.find((e) => {
          return (
            normalizeLower(e.name) === bName &&
            normalizeLower(e.postalCode) === bPostal &&
            normalizeLower(e.city) === bCity
          )
        })
      }

      if (existing) {
        associationConflicts.push({
          kind: 'ASSOCIATION',
          backupAssociation: backup,
          existingAssociation: existing,
        })
      }
    }

    // Conflicts: fiscal years (same associationId + exact same dates)
    const fyConflicts: ConflictFiscalYear[] = []
    const existingFiscalYears = await prisma.fiscalYear.findMany({
      select: { id: true, associationId: true, startDate: true, endDate: true },
    })
    const existingFyByKey = new Map<string, (typeof existingFiscalYears)[number][]>()
    for (const fy of existingFiscalYears) {
      const key = `${fy.associationId}__${fy.startDate.toISOString().slice(0, 10)}__${fy.endDate.toISOString().slice(0, 10)}`
      const arr = existingFyByKey.get(key) || []
      arr.push(fy)
      existingFyByKey.set(key, arr)
    }

    for (const fy of backupFiscalYears) {
      const backup = {
        id: String(fy.id),
        associationId: String(fy.associationId),
        startDate: String(fy.startDate),
        endDate: String(fy.endDate),
      }
      const key = `${backup.associationId}__${backup.startDate.slice(0, 10)}__${backup.endDate.slice(0, 10)}`
      const existing = (existingFyByKey.get(key) || [])[0]
      if (existing) {
        fyConflicts.push({
          kind: 'FISCAL_YEAR',
          backupFiscalYear: backup,
          existingFiscalYear: {
            id: existing.id,
            associationId: existing.associationId,
            startDate: existing.startDate.toISOString(),
            endDate: existing.endDate.toISOString(),
          },
        })
      }
    }

    // Conflicts: budgets — same UUID as in DB, OR same association + same name (trim, case-insensitive) with different id
    const budgetConflicts: ConflictBudget[] = []
    const existingBudgets = await prisma.budget.findMany({
      select: { id: true, associationId: true, name: true },
    })
    const existingBudgetById = new Map(existingBudgets.map((b) => [b.id, b]))
    const existingBudgetsByAssocName = new Map<string, (typeof existingBudgets)[number][]>()
    for (const eb of existingBudgets) {
      const nameKey = `${eb.associationId}__${normalizeLower(eb.name)}`
      const arr = existingBudgetsByAssocName.get(nameKey) || []
      arr.push(eb)
      existingBudgetsByAssocName.set(nameKey, arr)
    }

    for (const raw of backupBudgets) {
      const backupBudget = {
        id: String(raw.id),
        associationId: String(raw.associationId),
        name: String(raw.name),
      }
      const byId = existingBudgetById.get(backupBudget.id)
      if (byId) {
        budgetConflicts.push({
          kind: 'BUDGET',
          matchKind: 'SAME_ID',
          backupBudget,
          existingBudget: { id: byId.id, associationId: byId.associationId, name: byId.name },
        })
        continue
      }
      const nameKey = `${backupBudget.associationId}__${normalizeLower(backupBudget.name)}`
      const nameMatches = existingBudgetsByAssocName.get(nameKey) || []
      const byName = nameMatches.find((eb) => eb.id !== backupBudget.id)
      if (byName) {
        budgetConflicts.push({
          kind: 'BUDGET',
          matchKind: 'SAME_ASSOCIATION_AND_NAME',
          backupBudget,
          existingBudget: { id: byName.id, associationId: byName.associationId, name: byName.name },
        })
      }
    }

    const { token } = await writeZipToDisk(buf)
    const resp: PreviewResponse = {
      token,
      summary: {
        associations: backupAssociations.length,
        fiscalYears: backupFiscalYears.length,
        budgets: backupBudgets.length,
        documents: backupDocuments.length,
        counterparties: backupCounterparties.length,
        recurringExpenseTemplates: backupRecurringExpenseTemplates.length,
      },
      conflicts: {
        associations: associationConflicts,
        fiscalYears: fyConflicts,
        budgets: budgetConflicts,
      },
    }
    return NextResponse.json(resp, { status: 200 })
  }

  // apply
  const token = String(form.get('token') || '')
  if (!token) {
    return NextResponse.json({ error: 'Token manquant.' }, { status: 400 })
  }
  const decisionsRaw = form.get('decisions')
  if (typeof decisionsRaw !== 'string') {
    return NextResponse.json({ error: 'Décisions manquantes.' }, { status: 400 })
  }

  let decisions: ApplyBody
  try {
    decisions = JSON.parse(decisionsRaw) as ApplyBody
  } catch {
    return NextResponse.json({ error: 'Décisions invalides.' }, { status: 400 })
  }

  const overwriteAssociationIds = isStringArray(decisions.overwriteAssociationIds)
    ? Array.from(new Set(decisions.overwriteAssociationIds.filter(Boolean)))
    : []
  const overwriteFiscalYearIds = isStringArray(decisions.overwriteFiscalYearIds)
    ? Array.from(new Set(decisions.overwriteFiscalYearIds.filter(Boolean)))
    : []
  const overwriteBudgetIds = isStringArray(decisions.overwriteBudgetIds)
    ? Array.from(new Set(decisions.overwriteBudgetIds.filter(Boolean)))
    : []

  const { buf } = await readZipFromToken(token)
  const zip = await openZipFromBuffer(buf)

  const manifest = await getZipJson<BackupManifest>(zip, 'manifest.json')
  if (manifest.version !== 1) {
    return NextResponse.json({ error: 'Version de sauvegarde non supportée.' }, { status: 400 })
  }

  const associations = await getZipJson<BackupAssociationJson[]>(zip, 'data/associations.json')
  const fiscalYears = await getZipJson<BackupFiscalYearJson[]>(zip, 'data/fiscalYears.json')
  const journals = await getZipJson<BackupJournalJson[]>(zip, 'data/journals.json')
  const accounts = await getZipJson<BackupAccountJson[]>(zip, 'data/accounts.json')
  const journalSequences = await getZipJson<BackupJournalSequenceJson[]>(zip, 'data/journalSequences.json')
  const entries = await getZipJson<BackupEntryJson[]>(zip, 'data/entries.json')
  const entryLines = await getZipJson<BackupEntryLineJson[]>(zip, 'data/entryLines.json')
  const documents = await getZipJson<BackupDocumentJson[]>(zip, 'data/documents.json')
  const documentEntryLines = await getZipJson<BackupDocumentEntryLineJson[]>(zip, 'data/documentEntryLines.json')
  const inKindContributions = await getZipJson<BackupInKindContributionJson[]>(zip, 'data/inKindContributions.json')
  const budgets = await getZipJsonOptional<BackupBudgetJson[]>(zip, 'data/budgets.json', [])
  const budgetLines = await getZipJsonOptional<BackupBudgetLineJson[]>(zip, 'data/budgetLines.json', [])
  const counterparties = await getZipJsonOptional<BackupCounterpartyJson[]>(zip, 'data/counterparties.json', [])
  const recurringExpenseTemplates = await getZipJsonOptional<BackupRecurringExpenseTemplateJson[]>(
    zip,
    'data/recurringExpenseTemplates.json',
    [],
  )
  const counterpartySettlementAllocations = await getZipJsonOptional<
    BackupCounterpartySettlementAllocationJson[]
  >(zip, 'data/counterpartySettlementAllocations.json', [])

  // Upsert journals by code, and map backup journal IDs -> existing IDs
  const journalIdMap = new Map<string, string>()
  for (const j of journals) {
    const code = String(j.code)
    const existing = await prisma.journal.upsert({
      where: { code },
      update: { name: String(j.name) },
      create: { code, name: String(j.name) },
      select: { id: true },
    })
    journalIdMap.set(String(j.id), existing.id)
  }

  // Apply overwrites
  await prisma.$transaction(async (tx) => {
    if (overwriteFiscalYearIds.length > 0) {
      await tx.fiscalYear.deleteMany({ where: { id: { in: overwriteFiscalYearIds } } })
    }
    if (overwriteAssociationIds.length > 0) {
      await tx.association.deleteMany({ where: { id: { in: overwriteAssociationIds } } })
    }
    if (overwriteBudgetIds.length > 0) {
      await tx.budget.deleteMany({ where: { id: { in: overwriteBudgetIds } } })
    }

    // Insert associations (skip duplicates: if user didn't overwrite, we don't want to crash)
    if (associations.length > 0) {
      for (const a of associations) {
        try {
          await tx.association.create({
            data: {
              id: String(a.id),
              name: String(a.name),
              siret: a.siret ? String(a.siret) : null,
              address: a.address ? String(a.address) : null,
              postalCode: a.postalCode ? String(a.postalCode) : null,
              city: a.city ? String(a.city) : null,
              email: a.email ? String(a.email) : null,
              phone: a.phone ? String(a.phone) : null,
              legalFormCode: a.legalFormCode ? String(a.legalFormCode) : null,
              legalFormOther: a.legalFormOther ? String(a.legalFormOther) : null,
              vatLiable: a.vatLiable === undefined ? false : Boolean(a.vatLiable),
              chartTemplateId:
                a.chartTemplateId === null || a.chartTemplateId === undefined
                  ? null
                  : String(a.chartTemplateId),
              isClosed: Boolean(a.isClosed),
              createdAt: a.createdAt ? new Date(String(a.createdAt)) : undefined,
              updatedAt: a.updatedAt ? new Date(String(a.updatedAt)) : undefined,
            },
          })
        } catch (e) {
          if (!isUniqueConstraintError(e)) throw e
        }
      }
    }

    if (counterparties.length > 0) {
      for (const c of counterparties) {
        try {
          await tx.counterparty.create({
            data: {
              id: String(c.id),
              associationId: String(c.associationId),
              kind: String(c.kind),
              name: String(c.name),
              createdAt: c.createdAt ? new Date(String(c.createdAt)) : undefined,
              updatedAt: c.updatedAt ? new Date(String(c.updatedAt)) : undefined,
            },
          })
        } catch (e) {
          if (!isUniqueConstraintError(e)) throw e
        }
      }
    }

    if (recurringExpenseTemplates.length > 0) {
      const counterpartyIds = new Set(counterparties.map((c) => String(c.id)))
      for (const t of recurringExpenseTemplates) {
        let counterpartyId =
          t.counterpartyId === null || t.counterpartyId === undefined
            ? null
            : String(t.counterpartyId)
        if (counterpartyId && !counterpartyIds.has(counterpartyId)) {
          const exists = await tx.counterparty.findUnique({
            where: { id: counterpartyId },
            select: { id: true },
          })
          if (!exists) counterpartyId = null
        }
        try {
          await tx.recurringExpenseTemplate.create({
            data: {
              id: String(t.id),
              associationId: String(t.associationId),
              title: String(t.title),
              operationType: String(t.operationType),
              amountCents: Number(t.amountCents),
              counterpartyId,
              operationAccountNumber: String(t.operationAccountNumber),
              treasuryAccountNumber:
                t.treasuryAccountNumber === null || t.treasuryAccountNumber === undefined
                  ? null
                  : String(t.treasuryAccountNumber),
              createdAt: t.createdAt ? new Date(String(t.createdAt)) : undefined,
              updatedAt: t.updatedAt ? new Date(String(t.updatedAt)) : undefined,
            },
          })
        } catch (e) {
          if (!isUniqueConstraintError(e)) throw e
        }
      }
    }

    // Insert fiscal years
    if (fiscalYears.length > 0) {
      for (const fy of fiscalYears) {
        try {
          await tx.fiscalYear.create({
            data: {
              id: String(fy.id),
              associationId: String(fy.associationId),
              startDate: new Date(String(fy.startDate)),
              endDate: new Date(String(fy.endDate)),
              status: String(fy.status),
            },
          })
        } catch (e) {
          if (!isUniqueConstraintError(e)) throw e
        }
      }
    }

    if (budgets.length > 0) {
      for (const b of budgets) {
        try {
          await tx.budget.create({
            data: {
              id: String(b.id),
              associationId: String(b.associationId),
              name: String(b.name),
              notes: b.notes === null || b.notes === undefined ? null : String(b.notes),
              sourceFiscalYearId:
                b.sourceFiscalYearId === null || b.sourceFiscalYearId === undefined
                  ? null
                  : String(b.sourceFiscalYearId),
              sourceCoefficientPercent:
                b.sourceCoefficientPercent === null || b.sourceCoefficientPercent === undefined
                  ? null
                  : Number(b.sourceCoefficientPercent),
              createdAt: b.createdAt ? new Date(String(b.createdAt)) : undefined,
              updatedAt: b.updatedAt ? new Date(String(b.updatedAt)) : undefined,
            },
          })
        } catch (e) {
          if (!isUniqueConstraintError(e)) throw e
        }
      }
    }

    if (budgetLines.length > 0) {
      for (const line of budgetLines) {
        try {
          await tx.budgetLine.create({
            data: {
              id: String(line.id),
              budgetId: String(line.budgetId),
              accountNumber: String(line.accountNumber),
              accountName: String(line.accountName),
              amountCents: Number(line.amountCents),
              createdAt: line.createdAt ? new Date(String(line.createdAt)) : undefined,
              updatedAt: line.updatedAt ? new Date(String(line.updatedAt)) : undefined,
            },
          })
        } catch (e) {
          if (!isUniqueConstraintError(e)) throw e
        }
      }
    }

    if (accounts.length > 0) {
      for (const a of accounts) {
        try {
          await tx.account.create({
            data: {
              id: String(a.id),
              number: String(a.number),
              name: String(a.name),
              fiscalYearId: String(a.fiscalYearId),
            },
          })
        } catch (e) {
          if (!isUniqueConstraintError(e)) throw e
        }
      }
    }

    if (journalSequences.length > 0) {
      for (const s of journalSequences) {
        try {
          await tx.journalSequence.create({
            data: {
              id: String(s.id),
              fiscalYearId: String(s.fiscalYearId),
              journalId: journalIdMap.get(String(s.journalId)) || String(s.journalId),
              nextNumber: Number(s.nextNumber),
              createdAt: s.createdAt ? new Date(String(s.createdAt)) : undefined,
              updatedAt: s.updatedAt ? new Date(String(s.updatedAt)) : undefined,
            },
          })
        } catch (e) {
          if (!isUniqueConstraintError(e)) throw e
        }
      }
    }

    if (entries.length > 0) {
      for (const e of entries) {
        try {
          await tx.entry.create({
            data: {
              id: String(e.id),
              date: new Date(String(e.date)),
              description: String(e.description),
              journalId: journalIdMap.get(String(e.journalId)) || String(e.journalId),
              fiscalYearId: String(e.fiscalYearId),
              counterpartyId:
                e.counterpartyId === null || e.counterpartyId === undefined ? null : String(e.counterpartyId),
              referenceNumber: e.referenceNumber ? String(e.referenceNumber) : null,
              referenceSequence:
                e.referenceSequence === null || e.referenceSequence === undefined ? null : Number(e.referenceSequence),
              createdAt: e.createdAt ? new Date(String(e.createdAt)) : undefined,
              updatedAt: e.updatedAt ? new Date(String(e.updatedAt)) : undefined,
            },
          })
        } catch (err) {
          if (!isUniqueConstraintError(err)) throw err
        }
      }
    }

    if (entryLines.length > 0) {
      for (const l of entryLines) {
        try {
          await tx.entryLine.create({
            data: {
              id: String(l.id),
              entryId: String(l.entryId),
              accountId: l.accountId ? String(l.accountId) : null,
              accountNumber: String(l.accountNumber),
              accountName: String(l.accountName),
              debitCents: Number(l.debitCents),
              creditCents: Number(l.creditCents),
              createdAt: l.createdAt ? new Date(String(l.createdAt)) : undefined,
              updatedAt: l.updatedAt ? new Date(String(l.updatedAt)) : undefined,
            },
          })
        } catch (e) {
          if (!isUniqueConstraintError(e)) throw e
        }
      }
    }

    if (counterpartySettlementAllocations.length > 0) {
      for (const row of counterpartySettlementAllocations) {
        try {
          await tx.counterpartySettlementAllocation.create({
            data: {
              id: String(row.id),
              payableLineId: String(row.payableLineId),
              settlementLineId: String(row.settlementLineId),
              amountCents: Number(row.amountCents),
              createdAt: row.createdAt ? new Date(String(row.createdAt)) : undefined,
            },
          })
        } catch (e) {
          if (!isUniqueConstraintError(e)) throw e
        }
      }
    }

    if (documents.length > 0) {
      for (const d of documents) {
        try {
          await tx.document.create({
            data: {
              id: String(d.id),
              fiscalYearId: String(d.fiscalYearId),
              originalName: String(d.originalName),
              storedName: String(d.storedName),
              mimeType: String(d.mimeType),
              sizeBytes: Number(d.sizeBytes),
              sha256: d.sha256 ? String(d.sha256) : null,
              relativePath: String(d.relativePath),
              uploadedAt: d.uploadedAt ? new Date(String(d.uploadedAt)) : undefined,
              createdAt: d.createdAt ? new Date(String(d.createdAt)) : undefined,
              updatedAt: d.updatedAt ? new Date(String(d.updatedAt)) : undefined,
            },
          })
        } catch (e) {
          if (!isUniqueConstraintError(e)) throw e
        }
      }
    }

    if (documentEntryLines.length > 0) {
      for (const x of documentEntryLines) {
        try {
          await tx.documentEntryLine.create({
            data: {
              id: String(x.id),
              documentId: String(x.documentId),
              entryLineId: String(x.entryLineId),
              createdAt: x.createdAt ? new Date(String(x.createdAt)) : undefined,
            },
          })
        } catch (e) {
          if (!isUniqueConstraintError(e)) throw e
        }
      }
    }

    if (inKindContributions.length > 0) {
      for (const c of inKindContributions) {
        try {
          await tx.inKindContribution.create({
            data: {
              id: String(c.id),
              associationId: String(c.associationId),
              fiscalYearId: String(c.fiscalYearId),
              kind: String(c.kind),
              date: new Date(String(c.date)),
              description: String(c.description),
              contributorName: c.contributorName ? String(c.contributorName) : null,
              quantityMilliUnits: Number(c.quantityMilliUnits),
              unit: String(c.unit),
              unitValueCents:
                c.unitValueCents === null || c.unitValueCents === undefined ? null : Number(c.unitValueCents),
              totalValueCents: Number(c.totalValueCents),
              valuationMethod: String(c.valuationMethod),
              meetsAnc2112Essential: Boolean(c.meetsAnc2112Essential),
              meetsAnc2112Measurable: Boolean(c.meetsAnc2112Measurable),
              isRecorded: Boolean(c.isRecorded),
              entryId: c.entryId ? String(c.entryId) : null,
              documentId: c.documentId ? String(c.documentId) : null,
              createdAt: c.createdAt ? new Date(String(c.createdAt)) : undefined,
              updatedAt: c.updatedAt ? new Date(String(c.updatedAt)) : undefined,
            },
          })
        } catch (e) {
          if (!isUniqueConstraintError(e)) throw e
        }
      }
    }
  })

  // Restore files after DB is in place.
  const allFiles: string[] = []
  zip.forEach((relativePath: string, file: JSZip.JSZipObject) => {
    if (!file.dir) allFiles.push(relativePath)
  })

  for (const zipPath of allFiles.filter((p) => p.startsWith('files/'))) {
    const parts = String(zipPath).split('/')
    // files/<associationId>/<fiscalYearId>/<storedName>
    if (parts.length < 4) continue
    const associationId = parts[1]
    const fiscalYearId = parts[2]
    const storedName = parts.slice(3).join('/')
    const relativePath = path.posix.join('uploads', associationId, fiscalYearId, storedName)
    const absolutePath = toAbsolutePath(relativePath)
    await fsp.mkdir(path.dirname(absolutePath), { recursive: true })
    const b = await zip.file(zipPath)!.async('nodebuffer')
    await fsp.writeFile(absolutePath, b)
  }

  await writeAuditEvent({
    actor: 'system',
    action: 'BACKUP_IMPORT',
    entityType: 'Backup',
    data: {
      backupExportedAt: manifest.exportedAt,
      backupVersion: manifest.version,
      associationCount: associations.length,
      fiscalYearCount: fiscalYears.length,
      budgetCount: budgets.length,
      documentCount: documents.length,
      counterpartyCount: counterparties.length,
      counterpartySettlementAllocationCount: counterpartySettlementAllocations.length,
      recurringExpenseTemplateCount: recurringExpenseTemplates.length,
      overwriteAssociationIds,
      overwriteFiscalYearIds,
      overwriteBudgetIds,
    },
  })

  return NextResponse.json({ success: true }, { status: 200 })
}

