'use server'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentAssociationId } from '@/lib/associationContext'
import { writeAuditEvent } from '@/lib/audit'
import { isDuesAccountNumber } from '@/lib/membership'
import {
  assertMembershipSeasonWritable,
  isMembershipSeasonClosed,
  loadWritableMembershipSeason,
  MEMBERSHIP_SEASON_STATUS_CLOSED,
  MEMBERSHIP_SEASON_STATUS_OPEN,
} from '@/lib/membershipSeasonStatus'
import { eurosToCents } from '@/lib/money'

function safeRevalidate(path: string) {
  try {
    revalidatePath(path)
  } catch {
    // tests / non-Next
  }
}

function revalidateMembershipPaths() {
  safeRevalidate('/adherents')
  safeRevalidate('/adhesions')
  safeRevalidate('/saisons')
}

async function requireAssociationId() {
  const associationId = await getCurrentAssociationId()
  if (!associationId) throw new Error('Association non sélectionnée.')
  return associationId
}

function parseCalendarDate(value: string, label: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} : format attendu AAAA-MM-JJ.`)
  }
  const date = new Date(`${value}T12:00:00`)
  if (!Number.isFinite(date.getTime())) throw new Error(`${label} invalide.`)
  return date
}

export async function listMembershipSeasons() {
  const associationId = await requireAssociationId()
  return prisma.membershipSeason.findMany({
    where: { associationId },
    include: { tariffs: { include: { category: true }, orderBy: { category: { name: 'asc' } } } },
    orderBy: { startDate: 'desc' },
  })
}

export async function getMembershipSeason(id: string) {
  const associationId = await requireAssociationId()
  return prisma.membershipSeason.findFirst({
    where: { id, associationId },
    include: { tariffs: { include: { category: true }, orderBy: { category: { name: 'asc' } } } },
  })
}

export async function createMembershipSeason(data: { name: string; startDate: string; endDate: string }) {
  const associationId = await requireAssociationId()
  const name = data.name.trim()
  if (!name) throw new Error('Le nom de la saison est requis.')
  const startDate = parseCalendarDate(data.startDate, 'Date de début')
  const endDate = parseCalendarDate(data.endDate, 'Date de fin')
  if (endDate.getTime() < startDate.getTime()) {
    throw new Error('La date de fin ne peut pas précéder la date de début.')
  }

  const created = await prisma.$transaction(async (tx) => {
    const season = await tx.membershipSeason.create({
      data: { associationId, name, startDate, endDate, status: MEMBERSHIP_SEASON_STATUS_OPEN },
    })
    await writeAuditEvent(
      {
        associationId,
        action: 'MEMBERSHIP_SEASON_CREATE',
        entityType: 'MembershipSeason',
        entityId: season.id,
        data: { name, startDate: data.startDate, endDate: data.endDate, tariffCount: 0 },
      },
      tx,
    )
    return season
  })
  revalidateMembershipPaths()
  return created
}

export async function updateMembershipSeason(data: {
  id: string
  name: string
  startDate: string
  endDate: string
}) {
  const associationId = await requireAssociationId()
  const existing = await prisma.membershipSeason.findFirst({ where: { id: data.id, associationId } })
  if (!existing) throw new Error('Saison introuvable.')
  assertMembershipSeasonWritable(existing)
  const name = data.name.trim()
  if (!name) throw new Error('Le nom de la saison est requis.')
  const startDate = parseCalendarDate(data.startDate, 'Date de début')
  const endDate = parseCalendarDate(data.endDate, 'Date de fin')
  if (endDate.getTime() < startDate.getTime()) {
    throw new Error('La date de fin ne peut pas précéder la date de début.')
  }
  await prisma.membershipSeason.update({
    where: { id: existing.id },
    data: { name, startDate, endDate },
  })
  await writeAuditEvent({
    associationId,
    action: 'MEMBERSHIP_SEASON_UPDATE',
    entityType: 'MembershipSeason',
    entityId: existing.id,
  })
  revalidateMembershipPaths()
}

export async function deleteMembershipSeason(id: string) {
  const associationId = await requireAssociationId()
  const existing = await prisma.membershipSeason.findFirst({
    where: { id, associationId },
    select: { id: true, status: true, _count: { select: { fees: true } } },
  })
  if (!existing) throw new Error('Saison introuvable.')
  if (isMembershipSeasonClosed(existing.status)) {
    throw new Error('Impossible de supprimer une saison clôturée.')
  }
  if (existing._count.fees > 0) {
    throw new Error('Impossible de supprimer une saison qui a déjà des adhésions.')
  }
  await prisma.membershipSeason.delete({ where: { id } })
  await writeAuditEvent({
    associationId,
    action: 'MEMBERSHIP_SEASON_DELETE',
    entityType: 'MembershipSeason',
    entityId: id,
  })
  revalidateMembershipPaths()
}

async function findOrCreateMembershipCategory(
  associationId: string,
  data: { name: string; amountCents: number; duesAccountNumber: string },
) {
  const name = data.name.trim()
  const existing = await prisma.membershipCategory.findFirst({
    where: { associationId, name },
  })
  if (existing) return existing
  return prisma.membershipCategory.create({
    data: { associationId, name, amountCents: data.amountCents, duesAccountNumber: data.duesAccountNumber },
  })
}

export async function upsertMembershipSeasonTariffByCategoryName(data: {
  seasonId: string
  categoryName: string
  amountEuros: number
  duesAccountNumber: string
}) {
  const associationId = await requireAssociationId()
  const categoryName = data.categoryName.trim()
  if (!categoryName) throw new Error('Le nom de la catégorie est requis.')
  if (!isDuesAccountNumber(data.duesAccountNumber)) {
    throw new Error('Choisissez 7561 (sans contrepartie) ou 7562 (avec contrepartie).')
  }
  const amountCents = eurosToCents(data.amountEuros)
  if (amountCents <= 0) throw new Error('Le tarif doit être strictement supérieur à 0.')

  const category = await findOrCreateMembershipCategory(associationId, {
    name: categoryName,
    amountCents,
    duesAccountNumber: data.duesAccountNumber,
  })
  return upsertMembershipSeasonTariff({
    seasonId: data.seasonId,
    categoryId: category.id,
    amountEuros: data.amountEuros,
    duesAccountNumber: data.duesAccountNumber,
  })
}

export async function closeMembershipSeason(id: string) {
  const associationId = await requireAssociationId()
  const existing = await prisma.membershipSeason.findFirst({ where: { id, associationId } })
  if (!existing) throw new Error('Saison introuvable.')
  if (isMembershipSeasonClosed(existing.status)) {
    throw new Error('Cette saison est déjà clôturée.')
  }
  await prisma.membershipSeason.update({
    where: { id: existing.id },
    data: { status: MEMBERSHIP_SEASON_STATUS_CLOSED, closedAt: new Date() },
  })
  await writeAuditEvent({
    associationId,
    action: 'MEMBERSHIP_SEASON_CLOSE',
    entityType: 'MembershipSeason',
    entityId: existing.id,
    data: { name: existing.name },
  })
  revalidateMembershipPaths()
}

export async function upsertMembershipSeasonTariff(data: {
  seasonId: string
  categoryId: string
  amountEuros: number
  duesAccountNumber: string
}) {
  const associationId = await requireAssociationId()
  await loadWritableMembershipSeason(prisma, { seasonId: data.seasonId, associationId })
  const season = await prisma.membershipSeason.findFirst({ where: { id: data.seasonId, associationId } })
  if (!season) throw new Error('Saison introuvable.')
  const category = await prisma.membershipCategory.findFirst({
    where: { id: data.categoryId, associationId },
  })
  if (!category) throw new Error('Catégorie introuvable.')
  if (!isDuesAccountNumber(data.duesAccountNumber)) {
    throw new Error('Choisissez 7561 (sans contrepartie) ou 7562 (avec contrepartie).')
  }
  const amountCents = eurosToCents(data.amountEuros)
  if (amountCents <= 0) throw new Error('Le tarif doit être strictement supérieur à 0.')

  const existing = await prisma.membershipSeasonTariff.findUnique({
    where: { seasonId_categoryId: { seasonId: season.id, categoryId: category.id } },
  })
  const paidOnTariff =
    existing &&
    (await prisma.membershipFee.findFirst({
      where: { tariffId: existing.id, OR: [{ status: 'PAID' }, { entryId: { not: null } }] },
      select: { id: true },
    }))
  if (paidOnTariff) {
    throw new Error('Impossible de modifier un tarif déjà utilisé par une adhésion comptabilisée.')
  }

  const tariff = await prisma.membershipSeasonTariff.upsert({
    where: { seasonId_categoryId: { seasonId: season.id, categoryId: category.id } },
    update: { amountCents, duesAccountNumber: data.duesAccountNumber },
    create: {
      seasonId: season.id,
      categoryId: category.id,
      amountCents,
      duesAccountNumber: data.duesAccountNumber,
    },
  })
  await prisma.membershipFee.updateMany({
    where: { tariffId: tariff.id, status: 'DUE', entryId: null },
    data: { amountCents, duesAccountNumber: data.duesAccountNumber, categoryId: category.id },
  })
  await writeAuditEvent({
    associationId,
    action: existing ? 'MEMBERSHIP_SEASON_TARIFF_UPDATE' : 'MEMBERSHIP_SEASON_TARIFF_CREATE',
    entityType: 'MembershipSeasonTariff',
    entityId: tariff.id,
    data: { seasonId: season.id, categoryId: category.id, amountCents },
  })
  revalidateMembershipPaths()
  return tariff
}

export async function deleteMembershipSeasonTariff(id: string) {
  const associationId = await requireAssociationId()
  const tariff = await prisma.membershipSeasonTariff.findFirst({
    where: { id, season: { associationId } },
    include: { season: { select: { status: true } }, _count: { select: { fees: true } } },
  })
  if (!tariff) throw new Error('Tarif introuvable.')
  assertMembershipSeasonWritable(tariff.season)
  if (tariff._count.fees > 0) {
    throw new Error('Impossible de supprimer un tarif déjà utilisé par une adhésion.')
  }
  await prisma.membershipSeasonTariff.delete({ where: { id } })
  await writeAuditEvent({
    associationId,
    action: 'MEMBERSHIP_SEASON_TARIFF_DELETE',
    entityType: 'MembershipSeasonTariff',
    entityId: id,
  })
  revalidateMembershipPaths()
}
