// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { nodeStreamToWeb, createReadStreamForRelativePath } from '@/lib/documentsStorage'
import { writeAuditEvent } from '@/lib/audit'
import archiver from 'archiver'
import { PassThrough } from 'stream'
import type { Prisma } from '@prisma/client'

export const runtime = 'nodejs'

type ExportRequestBody = {
  fiscalYearIds: string[]
  budgetIds: string[]
}

function jsonFile(name: string, value: unknown) {
  return {
    name,
    contents: JSON.stringify(value, null, 2),
  }
}

/** Calendar date in UTC as `YYYYMMDD` (e.g. `20260503`). */
function dateYyyyMmDdForFilename(d: Date) {
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

export async function POST(req: Request) {
  let body: ExportRequestBody
  try {
    body = (await req.json()) as ExportRequestBody
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }

  const fiscalYearIds = Array.from(new Set((body.fiscalYearIds || []).filter(Boolean)))
  const budgetIds = Array.from(new Set((body.budgetIds || []).filter(Boolean)))

  if (fiscalYearIds.length === 0 && budgetIds.length === 0) {
    return NextResponse.json(
      { error: 'Sélectionnez au moins un exercice ou un prévisionnel.' },
      { status: 400 }
    )
  }

  const associationSelect = {
    id: true,
    name: true,
    siret: true,
    address: true,
    postalCode: true,
    city: true,
    email: true,
    phone: true,
    legalFormCode: true,
    legalFormOther: true,
    vatLiable: true,
    chartTemplateId: true,
    isClosed: true,
    createdAt: true,
    updatedAt: true,
  } satisfies Prisma.AssociationSelect

  type AssociationForBackup = Prisma.AssociationGetPayload<{ select: typeof associationSelect }>

  const fiscalYears =
    fiscalYearIds.length > 0
      ? await prisma.fiscalYear.findMany({
          where: { id: { in: fiscalYearIds } },
          select: {
            id: true,
            startDate: true,
            endDate: true,
            status: true,
            associationId: true,
            association: { select: associationSelect },
          },
          orderBy: [{ associationId: 'asc' as const }, { startDate: 'desc' as const }],
        })
      : []

  if (fiscalYearIds.length > 0 && fiscalYears.length === 0) {
    return NextResponse.json({ error: 'Exercices introuvables.' }, { status: 404 })
  }

  const budgetsWithLines =
    budgetIds.length > 0
      ? await prisma.budget.findMany({
          where: { id: { in: budgetIds } },
          include: {
            lines: true,
          },
        })
      : []

  if (budgetIds.length > 0 && budgetsWithLines.length !== budgetIds.length) {
    return NextResponse.json({ error: 'Un ou plusieurs prévisionnels sont introuvables.' }, { status: 404 })
  }

  const selectedAssociationMap = new Map<string, AssociationForBackup>()
  const fiscalYearToAssociationId = new Map<string, string>()
  for (const fy of fiscalYears) {
    selectedAssociationMap.set(fy.association.id, fy.association)
    fiscalYearToAssociationId.set(fy.id, fy.associationId)
  }

  const budgetAssociationIds = Array.from(new Set(budgetsWithLines.map((b) => b.associationId)))
  const missingBudgetAssociationIds = budgetAssociationIds.filter((id) => !selectedAssociationMap.has(id))
  if (missingBudgetAssociationIds.length > 0) {
    const extraAssociations = await prisma.association.findMany({
      where: { id: { in: missingBudgetAssociationIds } },
      select: associationSelect,
    })
    for (const a of extraAssociations) {
      selectedAssociationMap.set(a.id, a)
    }
  }

  const associationIds = Array.from(selectedAssociationMap.keys())

  const journals = await prisma.journal.findMany({ orderBy: { code: 'asc' } })

  const counterparties =
    associationIds.length > 0
      ? await prisma.counterparty.findMany({
          where: { associationId: { in: associationIds } },
        })
      : []

  let accounts: Awaited<ReturnType<typeof prisma.account.findMany>> = []
  let journalSequences: Awaited<ReturnType<typeof prisma.journalSequence.findMany>> = []
  let entries: Awaited<ReturnType<typeof prisma.entry.findMany>> = []
  let entryLines: Awaited<ReturnType<typeof prisma.entryLine.findMany>> = []
  let documents: Awaited<ReturnType<typeof prisma.document.findMany>> = []
  let documentEntryLines: Awaited<ReturnType<typeof prisma.documentEntryLine.findMany>> = []
  let inKindContributions: Awaited<ReturnType<typeof prisma.inKindContribution.findMany>> = []
  let counterpartySettlementAllocations: Awaited<
    ReturnType<typeof prisma.counterpartySettlementAllocation.findMany>
  > = []

  if (fiscalYearIds.length > 0) {
    ;[
      accounts,
      journalSequences,
      entries,
      entryLines,
      documents,
      documentEntryLines,
      inKindContributions,
      counterpartySettlementAllocations,
    ] = await Promise.all([
      prisma.account.findMany({ where: { fiscalYearId: { in: fiscalYearIds } } }),
      prisma.journalSequence.findMany({ where: { fiscalYearId: { in: fiscalYearIds } } }),
      prisma.entry.findMany({ where: { fiscalYearId: { in: fiscalYearIds } } }),
      prisma.entryLine.findMany({
        where: { entry: { fiscalYearId: { in: fiscalYearIds } } },
      }),
      prisma.document.findMany({ where: { fiscalYearId: { in: fiscalYearIds } } }),
      prisma.documentEntryLine.findMany({
        where: { document: { fiscalYearId: { in: fiscalYearIds } } },
      }),
      prisma.inKindContribution.findMany({ where: { fiscalYearId: { in: fiscalYearIds } } }),
      prisma.counterpartySettlementAllocation.findMany({
        where: {
          OR: [
            { payableLine: { entry: { fiscalYearId: { in: fiscalYearIds } } } },
            { settlementLine: { entry: { fiscalYearId: { in: fiscalYearIds } } } },
          ],
        },
      }),
    ])
  }

  const budgetsPayload = budgetsWithLines.map(({ lines, ...b }) => {
    void lines
    return b
  })
  const budgetLinesPayload = budgetsWithLines.flatMap((b) => b.lines)

  const manifest = {
    version: 1,
    exportedAt: new Date().toISOString(),
    selections: {
      associationIds,
      fiscalYearIds,
      budgetIds,
    },
  }

  const associations = Array.from(selectedAssociationMap.values())

  const files = [
    jsonFile('manifest.json', manifest),
    jsonFile('data/associations.json', associations),
    jsonFile(
      'data/fiscalYears.json',
      fiscalYears.map((fy) => ({
        id: fy.id,
        startDate: fy.startDate.toISOString(),
        endDate: fy.endDate.toISOString(),
        status: fy.status,
        associationId: fy.associationId,
      }))
    ),
    jsonFile('data/budgets.json', budgetsPayload),
    jsonFile('data/budgetLines.json', budgetLinesPayload),
    jsonFile('data/journals.json', journals),
    jsonFile('data/accounts.json', accounts),
    jsonFile('data/journalSequences.json', journalSequences),
    jsonFile('data/entries.json', entries),
    jsonFile('data/entryLines.json', entryLines),
    jsonFile('data/documents.json', documents),
    jsonFile('data/documentEntryLines.json', documentEntryLines),
    jsonFile('data/inKindContributions.json', inKindContributions),
    jsonFile('data/counterparties.json', counterparties),
    jsonFile('data/counterpartySettlementAllocations.json', counterpartySettlementAllocations),
  ]

  await writeAuditEvent({
    actor: 'system',
    action: 'BACKUP_EXPORT',
    entityType: 'Backup',
    data: {
      associationIds,
      fiscalYearIds,
      budgetIds,
      documentCount: documents.length,
      counterpartyCount: counterparties.length,
      counterpartySettlementAllocationCount: counterpartySettlementAllocations.length,
    },
  })

  const pass = new PassThrough()
  const archive = archiver('zip', { zlib: { level: 9 } })

  archive.on('error', (err) => {
    pass.destroy(err)
  })

  archive.pipe(pass)

  for (const f of files) {
    archive.append(f.contents, { name: f.name })
  }

  for (const d of documents) {
    const associationId = fiscalYearToAssociationId.get(d.fiscalYearId)
    if (!associationId) continue
    const zipPath = `files/${associationId}/${d.fiscalYearId}/${d.storedName}`
    archive.append(createReadStreamForRelativePath(d.relativePath), { name: zipPath })
  }

  void archive.finalize()

  const fileName = `sauvegarde_${dateYyyyMmDdForFilename(new Date())}.zip`
  return new Response(nodeStreamToWeb(pass), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      'Cache-Control': 'no-store',
    },
  })
}

