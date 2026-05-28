'use server'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getCurrentAssociationId } from '@/lib/associationContext'
import { assertFiscalYearWritable } from '@/lib/accountingGuards'
import { writeAuditEvent } from '@/lib/audit'

export async function createCompteForExercice(formData: FormData) {
  const fiscalYearId = formData.get('exerciceId') as string
  const number = formData.get('numero') as string
  const name = formData.get('libelle') as string

  if (!fiscalYearId) throw new Error('Exercice manquant.')
  if (!number || !name) throw new Error('Le numéro et le libellé sont requis.')

  const associationId = await getCurrentAssociationId()
  if (!associationId) throw new Error('Association non sélectionnée.')
  await assertFiscalYearWritable({ fiscalYearId, associationId })

  const existing = await prisma.account.findFirst({
    where: { number, fiscalYearId },
  })
  if (existing) {
    throw new Error(`Le compte ${number} existe déjà pour cet exercice.`)
  }

  const created = await prisma.account.create({
    data: { number, name, fiscalYearId },
  })

  await writeAuditEvent({
    associationId,
    fiscalYearId,
    actor: associationId,
    action: 'ACCOUNT_CREATE',
    entityType: 'Account',
    entityId: created.id,
    data: { number, name },
  })

  revalidatePath(`/exercices/${fiscalYearId}`)
}

export async function updateCompteForExercice(exerciceId: string, id: string, numero: string, libelle: string) {
  if (!exerciceId) throw new Error('Exercice manquant.')
  if (!numero || !libelle) throw new Error('Numéro et libellé requis')

  const associationId = await getCurrentAssociationId()
  if (!associationId) throw new Error('Association non sélectionnée.')
  await assertFiscalYearWritable({ fiscalYearId: exerciceId, associationId })

  const updated = await prisma.account.update({
    where: { id },
    data: { number: numero, name: libelle },
  })

  await writeAuditEvent({
    associationId,
    fiscalYearId: exerciceId,
    actor: associationId,
    action: 'ACCOUNT_UPDATE',
    entityType: 'Account',
    entityId: updated.id,
    data: { number: updated.number, name: updated.name },
  })

  revalidatePath(`/exercices/${exerciceId}`)
}

export async function deleteCompteForExercice(exerciceId: string, id: string) {
  if (!exerciceId) throw new Error('Exercice manquant.')

  const associationId = await getCurrentAssociationId()
  if (!associationId) throw new Error('Association non sélectionnée.')
  await assertFiscalYearWritable({ fiscalYearId: exerciceId, associationId })

  const existing = await prisma.account.findFirst({
    where: { id, fiscalYearId: exerciceId },
    select: { id: true, number: true, name: true },
  })
  if (!existing) throw new Error('Account not found.')

  await prisma.account.delete({ where: { id } })

  await writeAuditEvent({
    associationId,
    fiscalYearId: exerciceId,
    actor: associationId,
    action: 'ACCOUNT_DELETE',
    entityType: 'Account',
    entityId: id,
    data: { number: existing.number, name: existing.name },
  })

  revalidatePath(`/exercices/${exerciceId}`)
}
