'use server'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getCurrentAssociationId } from '@/lib/associationContext'
import { writeAuditEvent } from '@/lib/audit'
import {
  COUNTERPARTY_KIND_CUSTOMER,
  COUNTERPARTY_KIND_SUPPLIER,
  type CounterpartyKind,
} from '@/lib/counterparty'
import {
  count401LinesWithoutCounterparty,
  count411LinesWithoutCounterparty,
  getCustomerReceivableBalanceCents,
  getSupplierPayableBalanceCents,
  listCustomer411Movements,
  listSupplier401Movements,
} from '@/lib/counterpartyBalance'

export async function listCounterparties(kind?: CounterpartyKind) {
  const associationId = await getCurrentAssociationId()
  if (!associationId) return []

  return prisma.counterparty.findMany({
    where: {
      associationId,
      ...(kind ? { kind } : {}),
    },
    orderBy: { name: 'asc' },
  })
}

export async function createCounterparty(data: { name: string; kind: CounterpartyKind }) {
  const associationId = await getCurrentAssociationId()
  if (!associationId) throw new Error('Association non sélectionnée.')

  const name = data.name.trim()
  if (!name) throw new Error('Le nom du tiers est requis.')
  if (data.kind !== COUNTERPARTY_KIND_SUPPLIER && data.kind !== COUNTERPARTY_KIND_CUSTOMER) {
    throw new Error('Type de tiers invalide.')
  }

  const created = await prisma.counterparty.create({
    data: {
      associationId,
      kind: data.kind,
      name,
    },
  })

  await writeAuditEvent({
    associationId,
    fiscalYearId: null,
    actor: associationId,
    action: 'COUNTERPARTY_CREATE',
    entityType: 'Counterparty',
    entityId: created.id,
    data: { name: created.name, kind: created.kind },
  })

  revalidatePath('/parametres/tiers')
  revalidatePath('/saisie')
  return created
}

export async function updateCounterparty(data: { id: string; name: string }) {
  const associationId = await getCurrentAssociationId()
  if (!associationId) throw new Error('Association non sélectionnée.')

  const name = data.name.trim()
  if (!name) throw new Error('Le nom du tiers est requis.')

  const existing = await prisma.counterparty.findFirst({
    where: { id: data.id, associationId },
  })
  if (!existing) throw new Error('Tiers introuvable.')

  const updated = await prisma.counterparty.update({
    where: { id: data.id },
    data: { name },
  })

  await writeAuditEvent({
    associationId,
    fiscalYearId: null,
    actor: associationId,
    action: 'COUNTERPARTY_UPDATE',
    entityType: 'Counterparty',
    entityId: updated.id,
    data: { name: updated.name },
  })

  revalidatePath('/parametres/tiers')
  revalidatePath('/saisie')
  return updated
}

export async function deleteCounterparty(id: string) {
  const associationId = await getCurrentAssociationId()
  if (!associationId) throw new Error('Association non sélectionnée.')

  const existing = await prisma.counterparty.findFirst({
    where: { id, associationId },
    include: { _count: { select: { entries: true } } },
  })
  if (!existing) throw new Error('Tiers introuvable.')
  if (existing._count.entries > 0) {
    throw new Error('Impossible de supprimer ce tiers : des écritures y sont liées.')
  }

  await prisma.counterparty.delete({ where: { id } })

  await writeAuditEvent({
    associationId,
    fiscalYearId: null,
    actor: associationId,
    action: 'COUNTERPARTY_DELETE',
    entityType: 'Counterparty',
    entityId: id,
    data: { name: existing.name },
  })

  revalidatePath('/parametres/tiers')
  revalidatePath('/saisie')
}

export async function getSupplier401Preview(fiscalYearId: string, counterpartyId: string) {
  const associationId = await getCurrentAssociationId()
  if (!associationId) throw new Error('Association non sélectionnée.')

  const fy = await prisma.fiscalYear.findFirst({
    where: { id: fiscalYearId, associationId },
    select: { id: true },
  })
  if (!fy) throw new Error('Exercice introuvable.')

  const cp = await prisma.counterparty.findFirst({
    where: { id: counterpartyId, associationId },
  })
  if (!cp) throw new Error('Tiers introuvable.')

  const [balanceCents, movements, orphan401Lines] = await Promise.all([
    getSupplierPayableBalanceCents(fiscalYearId, counterpartyId),
    listSupplier401Movements(fiscalYearId, counterpartyId, 50),
    count401LinesWithoutCounterparty(fiscalYearId),
  ])

  return {
    balanceCents,
    movements,
    orphan401Lines,
  }
}

export async function getCustomer411Preview(fiscalYearId: string, counterpartyId: string) {
  const associationId = await getCurrentAssociationId()
  if (!associationId) throw new Error('Association non sélectionnée.')

  const fy = await prisma.fiscalYear.findFirst({
    where: { id: fiscalYearId, associationId },
    select: { id: true },
  })
  if (!fy) throw new Error('Exercice introuvable.')

  const cp = await prisma.counterparty.findFirst({
    where: { id: counterpartyId, associationId },
  })
  if (!cp) throw new Error('Tiers introuvable.')

  const [balanceCents, movements, orphan411Lines] = await Promise.all([
    getCustomerReceivableBalanceCents(fiscalYearId, counterpartyId),
    listCustomer411Movements(fiscalYearId, counterpartyId, 50),
    count411LinesWithoutCounterparty(fiscalYearId),
  ])

  return {
    balanceCents,
    movements,
    orphan411Lines,
  }
}

export async function getCustomer411BalanceCents(fiscalYearId: string, counterpartyId: string) {
  const associationId = await getCurrentAssociationId()
  if (!associationId) throw new Error('Association non sélectionnée.')

  const fy = await prisma.fiscalYear.findFirst({
    where: { id: fiscalYearId, associationId },
    select: { id: true },
  })
  if (!fy) throw new Error('Exercice introuvable.')

  const cp = await prisma.counterparty.findFirst({
    where: { id: counterpartyId, associationId },
  })
  if (!cp) throw new Error('Tiers introuvable.')

  return getCustomerReceivableBalanceCents(fiscalYearId, counterpartyId)
}
