'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { PLAN_COMPTABLE_ASSOCIATIF } from '@/lib/planComptable'

export async function getGlobalChartOfAccounts() {
  return await prisma.globalChartAccount.findMany({
    orderBy: { number: 'asc' }
  })
}

export async function syncGlobalChartWithDefault() {
  const existing = await prisma.globalChartAccount.findMany({
    select: { number: true },
  })
  const existingSet = new Set(existing.map((c) => c.number))

  const missing = PLAN_COMPTABLE_ASSOCIATIF.filter((c) => !existingSet.has(c.numero))

  if (missing.length > 0) {
    await prisma.globalChartAccount.createMany({
      data: missing.map((c) => ({ number: c.numero, name: c.libelle })),
    })
    revalidatePath('/parametres/plan-comptable')
  }

  return { data: await getGlobalChartOfAccounts(), addedCount: missing.length }
}

export async function initializeGlobalChartOfAccounts() {
  const existingCount = await prisma.globalChartAccount.count()
  
  if (existingCount > 0) {
    return await getGlobalChartOfAccounts()
  }

  await prisma.globalChartAccount.createMany({
    data: PLAN_COMPTABLE_ASSOCIATIF.map(c => ({
      number: c.numero,
      name: c.libelle
    }))
  })

  revalidatePath('/parametres/plan-comptable')
  return await getGlobalChartOfAccounts()
}

export async function addAccountToGlobalChart(formData: FormData) {
  const number = formData.get('numero') as string
  const name = formData.get('libelle') as string

  if (!number || !name) {
    throw new Error('Account number and name are required.')
  }

  const existing = await prisma.globalChartAccount.findUnique({
    where: { number }
  })

  if (existing) {
    throw new Error('An account with this number already exists.')
  }

  await prisma.globalChartAccount.create({
    data: { number, name }
  })

  revalidatePath('/parametres/plan-comptable')
}

export async function updateAccountInGlobalChart(id: string, formData: FormData) {
  const number = formData.get('numero') as string
  const name = formData.get('libelle') as string

  if (!number || !name) {
    throw new Error('Account number and name are required.')
  }

  const existing = await prisma.globalChartAccount.findFirst({
    where: { 
      number,
      id: { not: id }
    }
  })

  if (existing) {
    throw new Error('An account with this number already exists.')
  }

  await prisma.globalChartAccount.update({
    where: { id },
    data: { number, name }
  })

  revalidatePath('/parametres/plan-comptable')
}

export async function deleteAccountFromGlobalChart(id: string) {
  await prisma.globalChartAccount.delete({
    where: { id }
  })

  revalidatePath('/parametres/plan-comptable')
}

export async function getGlobalChartForFiscalYearCreation() {
  return await initializeGlobalChartOfAccounts()
}

// Backward-compatible exports (UI still uses FR names).
// TODO: migrate UI imports to English and remove.
type LegacyPlanComptableAccount = { id: string; numero: string; libelle: string }

function toLegacyAccountRow(row: { id: string; number: string; name: string }): LegacyPlanComptableAccount {
  return { id: row.id, numero: row.number, libelle: row.name }
}

export async function getPlanComptableGlobal(): Promise<LegacyPlanComptableAccount[]> {
  const rows = await getGlobalChartOfAccounts()
  return rows.map(toLegacyAccountRow)
}

export async function syncPlanComptableGlobalWithDefault(): Promise<{
  data: LegacyPlanComptableAccount[]
  addedCount: number
}> {
  const res = await syncGlobalChartWithDefault()
  return { addedCount: res.addedCount, data: res.data.map(toLegacyAccountRow) }
}

export async function initializePlanComptableGlobal(): Promise<LegacyPlanComptableAccount[]> {
  const rows = await initializeGlobalChartOfAccounts()
  return rows.map(toLegacyAccountRow)
}

export const addCompteToPlanGlobal = addAccountToGlobalChart
export const updateCompteInPlanGlobal = updateAccountInGlobalChart
export const deleteCompteFromPlanGlobal = deleteAccountFromGlobalChart
export const getPlanComptableForExerciceCreation = getGlobalChartForFiscalYearCreation
