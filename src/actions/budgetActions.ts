'use server'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentAssociationId } from '@/lib/associationContext'
import { writeAuditEvent } from '@/lib/audit'
import {
  budgetLinesFromFiscalYearTotals,
  getNetAccountTotalsForFiscalYear,
} from '@/lib/accountTotals'
import { classifyAccount } from '@/lib/budgetClassification'
import { buildBudgetForecastPdfPayload, type BudgetForecastPdfPayload } from '@/lib/budgetForecastPdfPayload'
import { eurosToCents } from '@/lib/money'

async function assertAssociationWritableForBudget(associationId: string) {
  const a = await prisma.association.findUnique({
    where: { id: associationId },
    select: { isClosed: true },
  })
  if (!a) throw new Error('Association introuvable.')
  if (a.isClosed) throw new Error("Modification impossible : l'association est clôturée.")
}

function parseCoefficientPercent(raw: unknown): number {
  if (raw === null || raw === undefined || raw === '') return 100
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 1000) {
    throw new Error('Coefficient invalide (entier entre 1 et 1000, ex. 110 pour +10 %).')
  }
  return n
}

async function loadBudgetForCurrentAssociation(budgetId: string) {
  const associationId = await getCurrentAssociationId()
  if (!associationId) throw new Error('Association non sélectionnée.')

  const budget = await prisma.budget.findFirst({
    where: { id: budgetId, associationId },
    include: { lines: true },
  })
  if (!budget) throw new Error('Prévisionnel introuvable.')

  return { associationId, budget }
}

export async function getBudgetsForCurrentAssociation() {
  const associationId = await getCurrentAssociationId()
  if (!associationId) return []

  return prisma.budget.findMany({
    where: { associationId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      sourceFiscalYearId: true,
      sourceCoefficientPercent: true,
    },
  })
}

export async function getBudgetDetail(budgetId: string) {
  const associationId = await getCurrentAssociationId()
  if (!associationId) return null

  return prisma.budget.findFirst({
    where: { id: budgetId, associationId },
    include: {
      lines: { orderBy: { accountNumber: 'asc' } },
    },
  })
}

export type { BudgetForecastPdfPayload } from '@/lib/budgetForecastPdfPayload'

/** Read-only payload for PDF export (same layout as bilan compte de résultat). */
export async function getBudgetForecastPdfPayload(budgetId: string): Promise<BudgetForecastPdfPayload | null> {
  const associationId = await getCurrentAssociationId()
  if (!associationId) return null

  const [budget, association] = await Promise.all([
    prisma.budget.findFirst({
      where: { id: budgetId, associationId },
      include: { lines: { orderBy: { accountNumber: 'asc' } } },
    }),
    prisma.association.findUnique({
      where: { id: associationId },
      select: { name: true },
    }),
  ])

  if (!budget) return null

  return buildBudgetForecastPdfPayload(budget, association?.name ?? 'Association')
}

export async function createBudget(formData: FormData) {
  const associationId = await getCurrentAssociationId()
  if (!associationId) throw new Error('Association non sélectionnée.')

  await assertAssociationWritableForBudget(associationId)

  const name = String(formData.get('name') ?? '').trim()
  if (!name) throw new Error('Le nom du prévisionnel est requis.')

  const notesRaw = formData.get('notes')
  const notes =
    notesRaw === null || notesRaw === undefined || String(notesRaw).trim() === ''
      ? null
      : String(notesRaw).trim()

  const sourceFiscalYearIdRaw = formData.get('sourceFiscalYearId')
  const sourceFiscalYearId =
    sourceFiscalYearIdRaw && String(sourceFiscalYearIdRaw).trim() !== ''
      ? String(sourceFiscalYearIdRaw).trim()
      : null

  const coefficientPercent = parseCoefficientPercent(formData.get('coefficientPercent'))

  if (sourceFiscalYearId) {
    const fy = await prisma.fiscalYear.findFirst({
      where: { id: sourceFiscalYearId, associationId },
      select: { id: true },
    })
    if (!fy) throw new Error('Exercice source introuvable pour cette association.')
  }

  await prisma.$transaction(async (tx) => {
    const budget = await tx.budget.create({
      data: {
        associationId,
        name,
        notes,
        sourceFiscalYearId,
        sourceCoefficientPercent: sourceFiscalYearId ? coefficientPercent : null,
      },
    })

    if (sourceFiscalYearId) {
      const totals = await getNetAccountTotalsForFiscalYear(sourceFiscalYearId, tx)
      const lineRows = budgetLinesFromFiscalYearTotals(totals, coefficientPercent)
      if (lineRows.length > 0) {
        await tx.budgetLine.createMany({
          data: lineRows.map((l) => ({
            budgetId: budget.id,
            accountNumber: l.accountNumber,
            accountName: l.accountName,
            amountCents: l.amountCents,
          })),
        })
      }
    }

    await writeAuditEvent(
      {
        associationId,
        actor: associationId,
        action: 'BUDGET_CREATE',
        entityType: 'Budget',
        entityId: budget.id,
        data: { name, sourceFiscalYearId, coefficientPercent },
      },
      tx,
    )
  })

  revalidatePath('/previsionnel')
  redirect('/previsionnel')
}

export async function updateBudgetMeta(formData: FormData) {
  const budgetId = String(formData.get('budgetId') ?? '').trim()
  if (!budgetId) throw new Error('Identifiant manquant.')

  const { associationId, budget } = await loadBudgetForCurrentAssociation(budgetId)
  await assertAssociationWritableForBudget(associationId)

  const name = String(formData.get('name') ?? '').trim()
  if (!name) throw new Error('Le nom du prévisionnel est requis.')

  const notesRaw = formData.get('notes')
  const notes =
    notesRaw === null || notesRaw === undefined || String(notesRaw).trim() === ''
      ? null
      : String(notesRaw).trim()

  await prisma.budget.update({
    where: { id: budget.id },
    data: { name, notes },
  })

  await writeAuditEvent({
    associationId,
    actor: associationId,
    action: 'BUDGET_UPDATE_META',
    entityType: 'Budget',
    entityId: budget.id,
    data: { name },
  })

  revalidatePath('/previsionnel')
  revalidatePath(`/previsionnel/${budget.id}`)
}

export async function upsertBudgetLine(formData: FormData) {
  const budgetId = String(formData.get('budgetId') ?? '').trim()
  if (!budgetId) throw new Error('Identifiant manquant.')

  const { associationId, budget } = await loadBudgetForCurrentAssociation(budgetId)
  await assertAssociationWritableForBudget(associationId)

  const accountNumber = String(formData.get('accountNumber') ?? '').trim()
  if (!accountNumber) throw new Error('Compte manquant.')

  const kind = classifyAccount(accountNumber)
  if (kind === 'OTHER') {
    throw new Error('Ce numéro de compte ne peut pas être utilisé dans un prévisionnel (classes 6, 7, 86 ou 87 uniquement).')
  }

  let accountName = String(formData.get('accountName') ?? '').trim()
  if (!accountName) {
    const association = await prisma.association.findUnique({
      where: { id: associationId },
      select: { chartTemplateId: true, legalFormCode: true },
    })
    const templateCode =
      association?.legalFormCode && association.legalFormCode !== 'ASSOCIATION' ? 'TPE' : 'ASSOCIATION'

    const template =
      association?.chartTemplateId
        ? await prisma.chartTemplate.findUnique({ where: { id: association.chartTemplateId } })
        : await prisma.chartTemplate.upsert({
            where: { code: templateCode },
            update: { name: templateCode === 'TPE' ? 'Entreprise / TPE (modèle)' : 'Association (modèle)' },
            create: { code: templateCode, name: templateCode === 'TPE' ? 'Entreprise / TPE (modèle)' : 'Association (modèle)' },
          })
    if (!template) throw new Error('Plan comptable modèle introuvable.')

    const tmplAcc = await prisma.chartTemplateAccount.findUnique({
      where: { chartTemplateId_number: { chartTemplateId: template.id, number: accountNumber } },
      select: { name: true },
    })
    if (!tmplAcc) throw new Error('Compte inconnu dans le plan comptable modèle.')
    accountName = tmplAcc.name
  }

  const amountEuros = Number.parseFloat(String(formData.get('amountEuros') ?? '0'))
  if (!Number.isFinite(amountEuros) || amountEuros < 0) {
    throw new Error('Montant invalide.')
  }
  const amountCents = eurosToCents(amountEuros)
  if (amountCents < 0) throw new Error('Montant invalide.')

  await prisma.$transaction(async (tx) => {
    await tx.budgetLine.upsert({
      where: {
        budgetId_accountNumber: { budgetId: budget.id, accountNumber },
      },
      create: {
        budgetId: budget.id,
        accountNumber,
        accountName,
        amountCents,
      },
      update: {
        accountName,
        amountCents,
      },
    })

    await writeAuditEvent(
      {
        associationId,
        actor: associationId,
        action: 'BUDGET_LINE_UPSERT',
        entityType: 'BudgetLine',
        entityId: budget.id,
        data: { accountNumber, amountCents },
      },
      tx,
    )
  })

  revalidatePath(`/previsionnel/${budget.id}`)
}

export async function deleteBudgetLine(formData: FormData) {
  const lineId = String(formData.get('lineId') ?? '').trim()
  if (!lineId) throw new Error('Identifiant manquant.')

  const associationId = await getCurrentAssociationId()
  if (!associationId) throw new Error('Association non sélectionnée.')
  await assertAssociationWritableForBudget(associationId)

  const line = await prisma.budgetLine.findUnique({
    where: { id: lineId },
    include: { budget: true },
  })
  if (!line || line.budget.associationId !== associationId) {
    throw new Error('Ligne introuvable.')
  }

  await prisma.$transaction(async (tx) => {
    await tx.budgetLine.delete({ where: { id: line.id } })
    await writeAuditEvent(
      {
        associationId,
        actor: associationId,
        action: 'BUDGET_LINE_DELETE',
        entityType: 'BudgetLine',
        entityId: line.budgetId,
        data: { lineId: line.id, accountNumber: line.accountNumber },
      },
      tx,
    )
  })

  revalidatePath(`/previsionnel/${line.budgetId}`)
}

export async function prefillBudgetFromFiscalYear(formData: FormData) {
  const budgetId = String(formData.get('budgetId') ?? '').trim()
  if (!budgetId) throw new Error('Identifiant manquant.')

  const { associationId, budget } = await loadBudgetForCurrentAssociation(budgetId)
  await assertAssociationWritableForBudget(associationId)

  const sourceFiscalYearId = String(formData.get('sourceFiscalYearId') ?? '').trim()
  if (!sourceFiscalYearId) throw new Error('Exercice source requis.')

  const fy = await prisma.fiscalYear.findFirst({
    where: { id: sourceFiscalYearId, associationId },
    select: { id: true },
  })
  if (!fy) throw new Error('Exercice source introuvable pour cette association.')

  const coefficientPercent = parseCoefficientPercent(formData.get('coefficientPercent'))

  const totals = await getNetAccountTotalsForFiscalYear(sourceFiscalYearId)
  const lineRows = budgetLinesFromFiscalYearTotals(totals, coefficientPercent)

  await prisma.$transaction(async (tx) => {
    await tx.budgetLine.deleteMany({ where: { budgetId: budget.id } })
    if (lineRows.length > 0) {
      await tx.budgetLine.createMany({
        data: lineRows.map((l) => ({
          budgetId: budget.id,
          accountNumber: l.accountNumber,
          accountName: l.accountName,
          amountCents: l.amountCents,
        })),
      })
    }

    await tx.budget.update({
      where: { id: budget.id },
      data: {
        sourceFiscalYearId,
        sourceCoefficientPercent: coefficientPercent,
      },
    })

    await writeAuditEvent(
      {
        associationId,
        actor: associationId,
        action: 'BUDGET_PREFILL',
        entityType: 'Budget',
        entityId: budget.id,
        data: { sourceFiscalYearId, coefficientPercent, lineCount: lineRows.length },
      },
      tx,
    )
  })

  revalidatePath(`/previsionnel/${budget.id}`)
  revalidatePath('/previsionnel')
}

export async function deleteBudget(formData: FormData) {
  const budgetId = String(formData.get('budgetId') ?? '').trim()
  if (!budgetId) throw new Error('Identifiant manquant.')

  const { associationId, budget } = await loadBudgetForCurrentAssociation(budgetId)
  await assertAssociationWritableForBudget(associationId)

  await prisma.$transaction(async (tx) => {
    await tx.budget.delete({ where: { id: budget.id } })
    await writeAuditEvent(
      {
        associationId,
        actor: associationId,
        action: 'BUDGET_DELETE',
        entityType: 'Budget',
        entityId: budget.id,
        data: { name: budget.name },
      },
      tx,
    )
  })

  revalidatePath('/previsionnel')
}
