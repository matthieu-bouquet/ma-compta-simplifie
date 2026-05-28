'use server'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getCurrentAssociationId } from '@/lib/associationContext'
import { writeAuditEvent } from '@/lib/audit'
import { defaultAccountsForTemplate, type ChartTemplateCode } from '@/lib/planComptable'

async function auditChartTemplateChange(evt: {
  action: string
  entityId: string
  data: unknown
}) {
  const associationId = await getCurrentAssociationId()
  await writeAuditEvent({
    associationId: associationId ?? null,
    fiscalYearId: null,
    actor: associationId ?? null,
    action: evt.action,
    entityType: 'ChartTemplateAccount',
    entityId: evt.entityId,
    data: evt.data,
  })
}

export async function getChartTemplates() {
  return await prisma.chartTemplate.findMany({ orderBy: { code: 'asc' } })
}

async function getOrCreateTemplate(code: ChartTemplateCode) {
  const name = code === 'TPE' ? 'Entreprise / TPE (modèle)' : 'Association (modèle)'
  return await prisma.chartTemplate.upsert({
    where: { code },
    update: { name },
    create: { code, name },
  })
}

export async function getTemplateAccounts(templateId: string) {
  return await prisma.chartTemplateAccount.findMany({
    where: { chartTemplateId: templateId },
    orderBy: { number: 'asc' },
  })
}

export async function getTemplateAccountsForFiscalYearCreation(code: ChartTemplateCode) {
  const template = await getOrCreateTemplate(code)
  // Ensure the template has at least the default seed.
  await initializeTemplateAccounts(code)
  return await prisma.chartTemplateAccount.findMany({
    where: { chartTemplateId: template.id },
    select: { number: true, name: true },
    orderBy: { number: 'asc' },
  })
}

export async function initializeTemplateAccounts(code: ChartTemplateCode) {
  const template = await getOrCreateTemplate(code)
  const existingCount = await prisma.chartTemplateAccount.count({
    where: { chartTemplateId: template.id },
  })
  if (existingCount > 0) {
    return await getTemplateAccounts(template.id)
  }

  const defaults = defaultAccountsForTemplate(code)
  await prisma.chartTemplateAccount.createMany({
    data: defaults.map((c) => ({
      chartTemplateId: template.id,
      number: c.numero,
      name: c.libelle,
    })),
  })

  revalidatePath('/parametres/plan-comptable')
  return await getTemplateAccounts(template.id)
}

export async function syncTemplateWithDefault(code: ChartTemplateCode) {
  const template = await getOrCreateTemplate(code)
  const existing = await prisma.chartTemplateAccount.findMany({
    where: { chartTemplateId: template.id },
    select: { number: true },
  })
  const existingSet = new Set(existing.map((c) => c.number))
  const defaults = defaultAccountsForTemplate(code)
  const missing = defaults.filter((c) => !existingSet.has(c.numero))
  if (missing.length > 0) {
    await prisma.chartTemplateAccount.createMany({
      data: missing.map((c) => ({
        chartTemplateId: template.id,
        number: c.numero,
        name: c.libelle,
      })),
    })
    revalidatePath('/parametres/plan-comptable')
  }
  const rows = await getTemplateAccounts(template.id)
  return {
    data: rows.map(toLegacyAccountRow),
    addedCount: missing.length,
    template,
  }
}

export async function addAccountToTemplate(templateId: string, formData: FormData) {
  const number = formData.get('numero') as string
  const name = formData.get('libelle') as string

  if (!number || !name) {
    throw new Error('Account number and name are required.')
  }

  const existing = await prisma.chartTemplateAccount.findUnique({
    where: { chartTemplateId_number: { chartTemplateId: templateId, number } },
  })

  if (existing) {
    throw new Error('An account with this number already exists.')
  }

  const created = await prisma.chartTemplateAccount.create({
    data: { chartTemplateId: templateId, number, name },
  })

  await auditChartTemplateChange({
    action: 'CHART_TEMPLATE_ACCOUNT_CREATE',
    entityId: created.id,
    data: { chartTemplateId: templateId, number, name },
  })

  revalidatePath('/parametres/plan-comptable')
}

export async function updateAccountInTemplate(templateId: string, id: string, formData: FormData) {
  const number = formData.get('numero') as string
  const name = formData.get('libelle') as string

  if (!number || !name) {
    throw new Error('Account number and name are required.')
  }

  const existing = await prisma.chartTemplateAccount.findFirst({
    where: { 
      chartTemplateId: templateId,
      number: number,
      id: { not: id }
    }
  })

  if (existing) {
    throw new Error('An account with this number already exists.')
  }

  const updated = await prisma.chartTemplateAccount.update({
    where: { id },
    data: { number, name }
  })

  await auditChartTemplateChange({
    action: 'CHART_TEMPLATE_ACCOUNT_UPDATE',
    entityId: updated.id,
    data: { chartTemplateId: templateId, number: updated.number, name: updated.name },
  })

  revalidatePath('/parametres/plan-comptable')
}

export async function deleteAccountFromTemplate(id: string) {
  const existing = await prisma.chartTemplateAccount.findUnique({
    where: { id },
    select: { id: true, chartTemplateId: true, number: true, name: true },
  })
  if (!existing) throw new Error('Chart template account not found.')

  await prisma.chartTemplateAccount.delete({
    where: { id }
  })

  await auditChartTemplateChange({
    action: 'CHART_TEMPLATE_ACCOUNT_DELETE',
    entityId: id,
    data: {
      chartTemplateId: existing.chartTemplateId,
      number: existing.number,
      name: existing.name,
    },
  })

  revalidatePath('/parametres/plan-comptable')
}

export type LegacyPlanComptableAccount = { id: string; numero: string; libelle: string }

function toLegacyAccountRow(row: { id: string; number: string; name: string }): LegacyPlanComptableAccount {
  return { id: row.id, numero: row.number, libelle: row.name }
}

export async function getPlanComptableGlobal(templateCode: ChartTemplateCode): Promise<LegacyPlanComptableAccount[]> {
  const template = await getOrCreateTemplate(templateCode)
  const rows = await getTemplateAccounts(template.id)
  return rows.map(toLegacyAccountRow)
}

export async function syncPlanComptableGlobalWithDefault(templateCode: ChartTemplateCode): Promise<{
  data: LegacyPlanComptableAccount[]
  addedCount: number
}> {
  const res = await syncTemplateWithDefault(templateCode)
  return { addedCount: res.addedCount, data: res.data }
}

export async function initializePlanComptableGlobal(templateCode: ChartTemplateCode): Promise<LegacyPlanComptableAccount[]> {
  const rows = await initializeTemplateAccounts(templateCode)
  return rows.map(toLegacyAccountRow)
}
