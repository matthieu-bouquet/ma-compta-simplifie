'use server'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getGlobalChartForFiscalYearCreation } from '@/actions/planComptableActions'
import { getCurrentAssociationId } from '@/lib/associationContext'
import {
  assertFiscalYearBelongsToCurrentAssociation,
  assertFiscalYearWritable,
} from '@/lib/accountingGuards'
import { writeAuditEvent } from '@/lib/audit'
import { eurosToCents } from '@/lib/money'
import { getOrCreateJournalByCode } from '@/lib/journals'

export async function getFiscalYears(associationId?: string | null) {
  return await prisma.fiscalYear.findMany({
    ...(associationId ? { where: { associationId } } : {}),
    include: {
      association: true
    },
    orderBy: { startDate: 'desc' }
  })
}

export async function createFiscalYear(formData: FormData) {
  const startDateStr = formData.get('dateDebut') as string
  const endDateStr = formData.get('dateFin') as string
  const associationId = formData.get('associationId') as string

  if (!startDateStr || !endDateStr || !associationId) {
    throw new Error('Start/end dates and association are required.')
  }

  const startDate = new Date(startDateStr)
  const endDate = new Date(endDateStr)

  const existing = await prisma.fiscalYear.findFirst({
    where: {
      associationId,
      startDate,
      endDate
    }
  })
  
  if (existing) {
    throw new Error('A fiscal year already exists for this association with the exact same dates.')
  }

  const association = await prisma.association.findUnique({
    where: { id: associationId }
  })
  
  if (!association) {
    throw new Error('Association not found.')
  }
  if (association.isClosed) {
    throw new Error('Cannot create fiscal year: association is closed.')
  }

  const globalChart = await getGlobalChartForFiscalYearCreation()
  
  if (globalChart.length === 0) {
    throw new Error('Global chart of accounts is empty. Please configure it first.')
  }

  await prisma.fiscalYear.create({
    data: {
      startDate,
      endDate,
      status: 'OPEN',
      associationId,
      accounts: {
        create: globalChart.map((a: { number: string; name: string }) => ({
          number: a.number,
          name: a.name,
        }))
      }
    }
  })

  revalidatePath('/exercices')
}

export async function closeFiscalYear(id: string) {
  const associationId = await getCurrentAssociationId()
  if (!associationId) throw new Error('Association non sélectionnée.')
  await assertFiscalYearBelongsToCurrentAssociation({ fiscalYearId: id, associationId })

  await prisma.fiscalYear.update({
    where: { id },
    data: { status: 'CLOSED' }
  })
  revalidatePath('/exercices')
  revalidatePath(`/exercices/${id}`)

  await writeAuditEvent({
    associationId,
    fiscalYearId: id,
    actor: associationId,
    action: 'FISCAL_YEAR_CLOSE',
    entityType: 'FiscalYear',
    entityId: id,
  })
}

export async function deleteFiscalYear(id: string) {
  const associationId = await getCurrentAssociationId()
  if (!associationId) throw new Error('Association non sélectionnée.')
  await assertFiscalYearWritable({ fiscalYearId: id, associationId })

  const fiscalYear = await prisma.fiscalYear.findUnique({ where: { id } })
  if (!fiscalYear || fiscalYear.status !== 'OPEN') {
    throw new Error("Cannot delete: fiscal year is already closed or doesn't exist.")
  }

  await prisma.fiscalYear.delete({ where: { id } })
  revalidatePath('/exercices')
}

export async function addPaymentAccount(formData: FormData) {
  const fiscalYearId = formData.get('exerciceId') as string
  const number = formData.get('numero') as string
  const name = formData.get('libelle') as string
  const openingBalanceStr = formData.get('soldeInitial') as string
  
  if (!fiscalYearId || !number || !name) throw new Error('Required fields are missing.')
  const associationId = await getCurrentAssociationId()
  if (!associationId) throw new Error('Association non sélectionnée.')
  await assertFiscalYearWritable({ fiscalYearId, associationId })
  
  const openingBalance = parseFloat(openingBalanceStr) || 0
  const openingBalanceCents = eurosToCents(openingBalance)

  await prisma.$transaction(async (tx) => {
    const account = await tx.account.create({
      data: {
        number,
        name,
        fiscalYearId
      }
    })

    if (openingBalanceCents > 0) {
      let openingBalanceAccount = await tx.account.findFirst({
        where: { fiscalYearId, number: '890' }
      })
      if (!openingBalanceAccount) {
        openingBalanceAccount = await tx.account.create({
          data: { number: '890', name: "Opening balance", fiscalYearId }
        })
      }

      const journalOD = await getOrCreateJournalByCode(tx, { code: 'OD', name: 'Opérations Diverses' })

      await tx.entry.create({
        data: {
          date: new Date(),
          description: `Opening balance: ${name}`,
          journalId: journalOD.id,
          fiscalYearId,
          lines: {
            create: [
              {
                accountId: account.id,
                accountNumber: account.number,
                accountName: account.name,
                debitCents: openingBalanceCents,
                creditCents: 0
              },
              {
                accountId: openingBalanceAccount.id,
                accountNumber: openingBalanceAccount.number,
                accountName: openingBalanceAccount.name,
                debitCents: 0,
                creditCents: openingBalanceCents
              }
            ]
          }
        }
      })
    }
  })

  revalidatePath(`/exercices/${fiscalYearId}`)
}

export async function updateOpeningBalance(formData: FormData) {
  const fiscalYearId = formData.get('exerciceId') as string
  const accountId = formData.get('compteId') as string
  const openingBalance = parseFloat(formData.get('soldeInitial') as string) || 0
  const openingBalanceCents = eurosToCents(openingBalance)
  const associationId = await getCurrentAssociationId()
  if (!associationId) throw new Error('Association non sélectionnée.')
  await assertFiscalYearWritable({ fiscalYearId, associationId })

  await prisma.$transaction(async (tx) => {
    let openingBalanceAccount = await tx.account.findFirst({ where: { fiscalYearId, number: '890' } })
    if (!openingBalanceAccount) {
      openingBalanceAccount = await tx.account.create({
        data: { number: '890', name: 'Opening balance', fiscalYearId },
      })
    }

    const cashAccount = await tx.account.findUnique({ where: { id: accountId } })
    if (!cashAccount) return

    const openingEntries = await tx.entry.findMany({
      where: { fiscalYearId, lines: { some: { accountId: openingBalanceAccount.id } } },
      include: { lines: true }
    })

    const openingEntry = openingEntries.find((e) => e.lines.some((l) => l.accountId === accountId))

    if (openingEntry) {
       if (openingBalanceCents === 0) {
          await tx.entry.delete({ where: { id: openingEntry.id } })
       } else {
          const cashLine = openingEntry.lines.find((l) => l.accountId === accountId)!
          await tx.entryLine.update({
            where: { id: cashLine.id },
            data: { debitCents: openingBalanceCents, creditCents: 0 },
          })
          
          const obLine = openingEntry.lines.find((l) => l.accountId === openingBalanceAccount.id)!
          await tx.entryLine.update({
            where: { id: obLine.id },
            data: { debitCents: 0, creditCents: openingBalanceCents },
          })
       }
    } else if (openingBalanceCents > 0) {
       const journalOD = await getOrCreateJournalByCode(tx, { code: 'OD', name: 'Opérations Diverses' })
       
       await tx.entry.create({
         data: {
           date: new Date(), 
           description: `Opening balance: ${cashAccount.name}`,
           journalId: journalOD.id,
           fiscalYearId,
           lines: {
             create: [
               { accountId: cashAccount.id, accountNumber: cashAccount.number, accountName: cashAccount.name, debitCents: openingBalanceCents, creditCents: 0 },
               { accountId: openingBalanceAccount.id, accountNumber: openingBalanceAccount.number, accountName: openingBalanceAccount.name, debitCents: 0, creditCents: openingBalanceCents }
             ]
           }
         }
       })
    }
  })

  revalidatePath(`/exercices/${fiscalYearId}`)
}

// Backward-compatible exports (UI still uses FR names).
// TODO: migrate UI imports to English and remove.
export const getExercices = getFiscalYears
export const createExercice = createFiscalYear
export const cloturerExercice = closeFiscalYear
export const deleteExercice = deleteFiscalYear
export const addComptePaiement = addPaymentAccount
export const updateSoldeInitial = updateOpeningBalance
