'use server'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentAssociationId } from '@/lib/associationContext'
import { assertFiscalYearWritable } from '@/lib/accountingGuards'
import { writeAuditEvent } from '@/lib/audit'
import { COUNTERPARTY_KIND_CUSTOMER } from '@/lib/counterparty'
import { createCashIncomeEntryInTransaction } from '@/lib/cashIncomeAccountingPost'
import { reverseEntryInTransaction } from '@/lib/reverseEntryInTransaction'
import { parseMembersCsv } from '@/lib/membersCsv'
import {
  isDuesAccountNumber,
  MEMBERSHIP_FEE_STATUS_DUE,
  MEMBERSHIP_FEE_STATUS_PAID,
  memberDisplayName,
  membershipSnapshotFromIdentity,
  normalizeMembershipOptions,
  type MembershipSeasonOptions,
} from '@/lib/membership'
import { findFiscalYearCoveringCalendarDate } from '@/lib/fiscalYearForDate'
import { membershipSeasonLabel } from '@/lib/seasonSelection'
import { assertMembershipSeasonWritable, isMembershipSeasonClosed } from '@/lib/membershipSeasonStatus'
import { assertEntryDateNotAfterToday, assertEntryDateWithinFiscalYear } from '@/lib/entryDateValidation'
import { eurosToCents } from '@/lib/money'

function safeRevalidate(path: string) {
  try {
    revalidatePath(path)
  } catch {
    // tests / non-Next
  }
}

function revalidateMemberSurfaces(memberId?: string) {
  safeRevalidate('/')
  safeRevalidate('/adherents')
  safeRevalidate('/adhesions')
  if (memberId) safeRevalidate(`/adherents/${memberId}`)
}

async function requireAssociationId() {
  const associationId = await getCurrentAssociationId()
  if (!associationId) throw new Error('Association non sélectionnée.')
  return associationId
}

async function upsertMemberCounterparty(
  db: typeof prisma,
  opts: { associationId: string; name: string; existingId?: string | null },
) {
  if (opts.existingId) {
    const existing = await db.counterparty.findFirst({
      where: { id: opts.existingId, associationId: opts.associationId },
    })
    if (existing) {
      await db.counterparty.update({ where: { id: existing.id }, data: { name: opts.name } })
      return existing.id
    }
  }
  const byName = await db.counterparty.findFirst({
    where: { associationId: opts.associationId, kind: COUNTERPARTY_KIND_CUSTOMER, name: opts.name },
    select: { id: true },
  })
  if (byName) return byName.id
  const created = await db.counterparty.create({
    data: { associationId: opts.associationId, kind: COUNTERPARTY_KIND_CUSTOMER, name: opts.name },
  })
  return created.id
}

export async function listMembershipCategories() {
  const associationId = await requireAssociationId()
  return prisma.membershipCategory.findMany({
    where: { associationId },
    orderBy: { name: 'asc' },
  })
}

export async function createMembershipCategory(data: {
  name: string
  amountEuros: number
  duesAccountNumber: string
}) {
  const associationId = await requireAssociationId()
  const name = data.name.trim()
  if (!name) throw new Error('Le nom de la catégorie est requis.')
  if (!isDuesAccountNumber(data.duesAccountNumber)) {
    throw new Error('Choisissez 7561 (sans contrepartie) ou 7562 (avec contrepartie).')
  }
  const amountCents = eurosToCents(data.amountEuros)
  if (amountCents <= 0) throw new Error('Le tarif doit être strictement supérieur à 0.')

  const created = await prisma.membershipCategory.create({
    data: { associationId, name, amountCents, duesAccountNumber: data.duesAccountNumber },
  })
  await writeAuditEvent({
    associationId,
    action: 'MEMBERSHIP_CATEGORY_CREATE',
    entityType: 'MembershipCategory',
    entityId: created.id,
    data: { name, amountCents, duesAccountNumber: data.duesAccountNumber },
  })
  revalidateMemberSurfaces()
  safeRevalidate('/saisons')
  return created
}

export async function deleteMembershipCategory(id: string) {
  const associationId = await requireAssociationId()
  const existing = await prisma.membershipCategory.findFirst({
    where: { id, associationId },
    include: { _count: { select: { seasonTariffs: true, fees: true } } },
  })
  if (!existing) throw new Error('Catégorie introuvable.')
  if (existing._count.seasonTariffs > 0 || existing._count.fees > 0) {
    throw new Error('Impossible de supprimer une catégorie utilisée par une saison ou une adhésion.')
  }
  await prisma.membershipCategory.delete({ where: { id } })
  await writeAuditEvent({
    associationId,
    action: 'MEMBERSHIP_CATEGORY_DELETE',
    entityType: 'MembershipCategory',
    entityId: id,
  })
  revalidateMemberSurfaces()
  safeRevalidate('/saisons')
}

export type MemberInput = {
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  address?: string | null
  postalCode?: string | null
  city?: string | null
  licenseNumber?: string | null
  birthDate?: string | null
  notes?: string | null
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
  emergencyContactRelation?: string | null
  categoryId?: string | null
  seasonId?: string | null
  tariffId?: string | null
  imageRightsConsent?: boolean
  internalRulesAccepted?: boolean
  emailCommunicationsConsent?: boolean
}

function parseOptionalBirthDate(value: string | null | undefined): Date | null {
  if (value == null || !value.trim()) return null
  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error('Date de naissance : format attendu AAAA-MM-JJ.')
  }
  const date = new Date(`${trimmed}T12:00:00`)
  if (!Number.isFinite(date.getTime())) throw new Error('Date de naissance invalide.')
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  if (date.getTime() > today.getTime()) {
    throw new Error('La date de naissance ne peut pas être dans le futur.')
  }
  return date
}

function normalizeMemberInput(data: MemberInput) {
  const firstName = data.firstName.trim()
  const lastName = data.lastName.trim()
  if (!firstName || !lastName) throw new Error('Nom et prénom sont requis.')
  const base = {
    firstName,
    lastName,
    email: data.email?.trim() || null,
    phone: data.phone?.trim() || null,
    address: data.address?.trim() || null,
    postalCode: data.postalCode?.trim() || null,
    city: data.city?.trim() || null,
    licenseNumber: data.licenseNumber?.trim() || null,
    birthDate: parseOptionalBirthDate(data.birthDate),
    notes: data.notes?.trim() || null,
    emergencyContactName: data.emergencyContactName?.trim() || null,
    emergencyContactPhone: data.emergencyContactPhone?.trim() || null,
    emergencyContactRelation: data.emergencyContactRelation?.trim() || null,
  }
  if (data.categoryId === undefined) return base
  return { ...base, categoryId: data.categoryId?.trim() || null }
}

async function createAdhesionIfNeeded(
  db: typeof prisma,
  opts: {
    associationId: string
    memberId: string
    identity: {
      firstName: string
      lastName: string
      email: string | null
      phone: string | null
      address: string | null
      postalCode: string | null
      city: string | null
      licenseNumber: string | null
    }
    seasonId: string | null
    tariffId: string | null
    options?: Partial<MembershipSeasonOptions> | null
  },
) {
  if (!opts.seasonId || !opts.tariffId) return null
  const season = await db.membershipSeason.findFirst({
    where: { id: opts.seasonId, associationId: opts.associationId },
    select: { status: true },
  })
  assertMembershipSeasonWritable(season)
  const tariff = await db.membershipSeasonTariff.findFirst({
    where: { id: opts.tariffId, seasonId: opts.seasonId, season: { associationId: opts.associationId } },
  })
  if (!tariff) return null
  const existing = await db.membershipFee.findUnique({
    where: { memberId_seasonId: { memberId: opts.memberId, seasonId: opts.seasonId } },
  })
  if (existing) return existing

  let options = normalizeMembershipOptions(opts.options)
  if (opts.options == null) {
    const previous = await db.membershipFee.findFirst({
      where: { memberId: opts.memberId },
      orderBy: { createdAt: 'desc' },
    })
    if (previous) {
      options = {
        imageRightsConsent: previous.imageRightsConsent,
        internalRulesAccepted: previous.internalRulesAccepted,
        emailCommunicationsConsent: previous.emailCommunicationsConsent,
      }
    }
  }

  return db.membershipFee.create({
    data: {
      associationId: opts.associationId,
      memberId: opts.memberId,
      seasonId: opts.seasonId,
      tariffId: tariff.id,
      categoryId: tariff.categoryId,
      amountCents: tariff.amountCents,
      duesAccountNumber: tariff.duesAccountNumber,
      status: MEMBERSHIP_FEE_STATUS_DUE,
      ...membershipSnapshotFromIdentity(opts.identity),
      ...options,
    },
  })
}

export async function createMember(data: MemberInput) {
  const associationId = await requireAssociationId()
  const input = normalizeMemberInput(data)
  const displayName = memberDisplayName(input)

  const created = await prisma.$transaction(async (tx) => {
    const counterpartyId = await upsertMemberCounterparty(tx as unknown as typeof prisma, {
      associationId,
      name: displayName,
    })
    const member = await tx.member.create({
      data: { associationId, ...input, counterpartyId },
    })
    await createAdhesionIfNeeded(tx as unknown as typeof prisma, {
      associationId,
      memberId: member.id,
      identity: input,
      seasonId: data.seasonId ?? null,
      tariffId: data.tariffId ?? null,
      options: {
        imageRightsConsent: data.imageRightsConsent,
        internalRulesAccepted: data.internalRulesAccepted,
        emailCommunicationsConsent: data.emailCommunicationsConsent,
      },
    })
    await writeAuditEvent(
      {
        associationId,
        action: 'MEMBER_CREATE',
        entityType: 'Member',
        entityId: member.id,
        data: { name: displayName },
      },
      tx,
    )
    return member
  })

  revalidateMemberSurfaces(created.id)
  return created
}

export async function updateMember(id: string, data: MemberInput) {
  const associationId = await requireAssociationId()
  const existing = await prisma.member.findFirst({ where: { id, associationId } })
  if (!existing) throw new Error('Adhérent introuvable.')
  const input = normalizeMemberInput(data)
  const displayName = memberDisplayName(input)

  await prisma.$transaction(async (tx) => {
    const counterpartyId = await upsertMemberCounterparty(tx as unknown as typeof prisma, {
      associationId,
      name: displayName,
      existingId: existing.counterpartyId,
    })
    await tx.member.update({
      where: { id },
      data: { ...input, counterpartyId },
    })
    await writeAuditEvent(
      {
        associationId,
        action: 'MEMBER_UPDATE',
        entityType: 'Member',
        entityId: id,
        data: { name: displayName },
      },
      tx,
    )
  })
  revalidateMemberSurfaces(id)
}

export async function deleteMember(id: string) {
  const associationId = await requireAssociationId()
  const existing = await prisma.member.findFirst({
    where: { id, associationId },
    include: {
      fees: { select: { status: true, entryId: true, season: { select: { status: true } } } },
    },
  })
  if (!existing) throw new Error('Adhérent introuvable.')
  if (existing.fees.some((f) => isMembershipSeasonClosed(f.season.status))) {
    throw new Error('Impossible de supprimer un adhérent lié à une saison clôturée.')
  }
  if (existing.fees.some((f) => f.status === MEMBERSHIP_FEE_STATUS_PAID || f.entryId)) {
    throw new Error('Impossible de supprimer un adhérent ayant une adhésion déjà comptabilisée.')
  }
  await prisma.member.delete({ where: { id } })
  await writeAuditEvent({
    associationId,
    action: 'MEMBER_DELETE',
    entityType: 'Member',
    entityId: id,
  })
  revalidateMemberSurfaces()
}

export async function markMembershipFeePaid(data: {
  feeId: string
  paidOn: string
  treasuryAccountNumber: string
}) {
  const associationId = await requireAssociationId()
  const fee = await prisma.membershipFee.findFirst({
    where: { id: data.feeId, associationId },
    include: { member: true, season: true },
  })
  if (!fee) throw new Error('Adhésion introuvable.')
  assertMembershipSeasonWritable(fee.season)
  if (fee.status === MEMBERSHIP_FEE_STATUS_PAID || fee.entryId) {
    throw new Error('Cette cotisation est déjà encaissée.')
  }
  if (!data.paidOn) throw new Error('Date de paiement requise.')
  assertEntryDateNotAfterToday(data.paidOn)
  const fiscalYear = await findFiscalYearCoveringCalendarDate(prisma, {
    associationId,
    calendarDate: data.paidOn,
  })
  if (!fiscalYear) {
    throw new Error('Aucun exercice comptable ne couvre cette date de paiement.')
  }
  await assertFiscalYearWritable({ fiscalYearId: fiscalYear.id, associationId })
  assertEntryDateWithinFiscalYear(data.paidOn, fiscalYear.startDate, fiscalYear.endDate)
  const treasury = data.treasuryAccountNumber.trim()
  if (!treasury) throw new Error('Compte de trésorerie requis.')

  const paidAt = new Date(`${data.paidOn}T12:00:00`)
  const description = `Cotisation ${fee.season.name} — ${memberDisplayName({
    firstName: fee.snapshotFirstName || fee.member.firstName,
    lastName: fee.snapshotLastName || fee.member.lastName,
  })}`

  await prisma.$transaction(async (tx) => {
    const posted = await createCashIncomeEntryInTransaction(tx, {
      associationId,
      fiscalYearId: fiscalYear.id,
      date: paidAt,
      description,
      amountCents: fee.amountCents,
      treasuryAccountNumber: treasury,
      incomeAccountNumber: fee.duesAccountNumber,
      counterpartyId: fee.member.counterpartyId,
    })
    await tx.membershipFee.update({
      where: { id: fee.id },
      data: {
        status: MEMBERSHIP_FEE_STATUS_PAID,
        paidAt,
        treasuryAccountNumber: posted.treasuryNumber,
        entryId: posted.entryId,
      },
    })
    await writeAuditEvent(
      {
        associationId,
        fiscalYearId: fiscalYear.id,
        action: 'MEMBERSHIP_FEE_PAY',
        entityType: 'MembershipFee',
        entityId: fee.id,
        data: { entryId: posted.entryId, seasonId: fee.seasonId },
      },
      tx,
    )
  })
  revalidateMemberSurfaces(fee.memberId)
  safeRevalidate('/ecritures')
}

export async function reverseMembershipFeePayment(feeId: string) {
  const associationId = await requireAssociationId()
  const fee = await prisma.membershipFee.findFirst({
    where: { id: feeId, associationId },
    include: { season: { select: { status: true } } },
  })
  if (!fee) throw new Error('Adhésion introuvable.')
  assertMembershipSeasonWritable(fee.season)
  if (!fee.entryId) throw new Error('Aucune écriture à contrepasser.')
  const entry = await prisma.entry.findFirst({
    where: { id: fee.entryId, fiscalYear: { associationId } },
    select: { fiscalYearId: true },
  })
  if (!entry) throw new Error('Écriture introuvable.')
  await assertFiscalYearWritable({ fiscalYearId: entry.fiscalYearId, associationId })

  await prisma.$transaction(async (tx) => {
    await reverseEntryInTransaction(tx, { entryId: fee.entryId!, associationId })
    await tx.membershipFee.update({
      where: { id: fee.id },
      data: {
        status: MEMBERSHIP_FEE_STATUS_DUE,
        paidAt: null,
        treasuryAccountNumber: null,
        entryId: null,
      },
    })
    await writeAuditEvent(
      {
        associationId,
        fiscalYearId: entry.fiscalYearId,
        action: 'MEMBERSHIP_FEE_REVERSE',
        entityType: 'MembershipFee',
        entityId: fee.id,
      },
      tx,
    )
  })
  revalidateMemberSurfaces(fee.memberId)
  safeRevalidate('/ecritures')
}

export async function createMembershipForSeason(data: {
  memberId: string
  seasonId: string
  tariffId: string
  imageRightsConsent?: boolean
  internalRulesAccepted?: boolean
  emailCommunicationsConsent?: boolean
}) {
  const associationId = await requireAssociationId()
  const member = await prisma.member.findFirst({
    where: { id: data.memberId, associationId },
  })
  if (!member) throw new Error('Adhérent introuvable.')
  const season = await prisma.membershipSeason.findFirst({
    where: { id: data.seasonId, associationId },
  })
  if (!season) throw new Error('Saison introuvable.')
  assertMembershipSeasonWritable(season)
  const existing = await prisma.membershipFee.findFirst({
    where: { memberId: member.id, seasonId: season.id },
  })
  if (existing) throw new Error('Une adhésion existe déjà pour cette saison.')

  await prisma.$transaction(async (tx) => {
    const created = await createAdhesionIfNeeded(tx as unknown as typeof prisma, {
      associationId,
      memberId: member.id,
      identity: member,
      seasonId: season.id,
      tariffId: data.tariffId,
      options: {
        imageRightsConsent: data.imageRightsConsent,
        internalRulesAccepted: data.internalRulesAccepted,
        emailCommunicationsConsent: data.emailCommunicationsConsent,
      },
    })
    if (!created) throw new Error('Tarif introuvable pour cette saison.')
    const tariff = await tx.membershipSeasonTariff.findUnique({ where: { id: created.tariffId } })
    if (tariff && member.categoryId !== tariff.categoryId) {
      await tx.member.update({ where: { id: member.id }, data: { categoryId: tariff.categoryId } })
    }
    await writeAuditEvent(
      {
        associationId,
        action: 'MEMBERSHIP_CREATE',
        entityType: 'MembershipFee',
        entityId: created.id,
        data: { seasonId: season.id, tariffId: created.tariffId },
      },
      tx,
    )
  })
  revalidateMemberSurfaces(member.id)
}

export async function createMemberAndMembershipForSeason(data: {
  seasonId: string
  tariffId: string
  memberId?: string
  member?: Omit<
    MemberInput,
    'seasonId' | 'tariffId' | 'categoryId' | 'imageRightsConsent' | 'internalRulesAccepted' | 'emailCommunicationsConsent'
  >
  imageRightsConsent?: boolean
  internalRulesAccepted?: boolean
  emailCommunicationsConsent?: boolean
}) {
  if (data.memberId && data.member) {
    throw new Error('Indiquez soit un adhérent existant, soit les informations d’un nouvel adhérent.')
  }
  if (!data.memberId && !data.member) {
    throw new Error('Choisissez un adhérent ou renseignez un nouvel adhérent.')
  }
  if (data.memberId) {
    await createMembershipForSeason({
      memberId: data.memberId,
      seasonId: data.seasonId,
      tariffId: data.tariffId,
      imageRightsConsent: data.imageRightsConsent,
      internalRulesAccepted: data.internalRulesAccepted,
      emailCommunicationsConsent: data.emailCommunicationsConsent,
    })
    return { memberId: data.memberId }
  }

  const associationId = await requireAssociationId()
  const input = normalizeMemberInput(data.member!)
  const displayName = memberDisplayName(input)
  const season = await prisma.membershipSeason.findFirst({
    where: { id: data.seasonId, associationId },
  })
  if (!season) throw new Error('Saison introuvable.')
  assertMembershipSeasonWritable(season)

  const created = await prisma.$transaction(async (tx) => {
    const counterpartyId = await upsertMemberCounterparty(tx as unknown as typeof prisma, {
      associationId,
      name: displayName,
    })
    const member = await tx.member.create({
      data: { associationId, ...input, counterpartyId },
    })
    const fee = await createAdhesionIfNeeded(tx as unknown as typeof prisma, {
      associationId,
      memberId: member.id,
      identity: input,
      seasonId: season.id,
      tariffId: data.tariffId,
      options: {
        imageRightsConsent: data.imageRightsConsent,
        internalRulesAccepted: data.internalRulesAccepted,
        emailCommunicationsConsent: data.emailCommunicationsConsent,
      },
    })
    if (!fee) throw new Error('Tarif introuvable pour cette saison.')
    const tariff = await tx.membershipSeasonTariff.findUnique({ where: { id: fee.tariffId } })
    if (tariff && member.categoryId !== tariff.categoryId) {
      await tx.member.update({ where: { id: member.id }, data: { categoryId: tariff.categoryId } })
    }
    await writeAuditEvent(
      {
        associationId,
        action: 'MEMBER_CREATE',
        entityType: 'Member',
        entityId: member.id,
        data: { name: displayName },
      },
      tx,
    )
    await writeAuditEvent(
      {
        associationId,
        action: 'MEMBERSHIP_CREATE',
        entityType: 'MembershipFee',
        entityId: fee.id,
        data: { seasonId: season.id, tariffId: fee.tariffId },
      },
      tx,
    )
    return member
  })

  revalidateMemberSurfaces(created.id)
  return { memberId: created.id }
}

export async function updateMembership(data: {
  membershipId: string
  snapshotFirstName: string
  snapshotLastName: string
  snapshotEmail?: string | null
  snapshotPhone?: string | null
  snapshotAddress?: string | null
  snapshotPostalCode?: string | null
  snapshotCity?: string | null
  snapshotLicenseNumber?: string | null
  tariffId?: string | null
  imageRightsConsent?: boolean
  internalRulesAccepted?: boolean
  emailCommunicationsConsent?: boolean
}) {
  const associationId = await requireAssociationId()
  const fee = await prisma.membershipFee.findFirst({
    where: { id: data.membershipId, associationId },
    include: { season: { select: { status: true } } },
  })
  if (!fee) throw new Error('Adhésion introuvable.')
  assertMembershipSeasonWritable(fee.season)

  const firstName = data.snapshotFirstName.trim()
  const lastName = data.snapshotLastName.trim()
  if (!firstName || !lastName) throw new Error('Nom et prénom de l’adhésion sont requis.')

  const options = normalizeMembershipOptions(data)
  const snapshot = membershipSnapshotFromIdentity({
    firstName,
    lastName,
    email: data.snapshotEmail?.trim() || null,
    phone: data.snapshotPhone?.trim() || null,
    address: data.snapshotAddress?.trim() || null,
    postalCode: data.snapshotPostalCode?.trim() || null,
    city: data.snapshotCity?.trim() || null,
    licenseNumber: data.snapshotLicenseNumber?.trim() || null,
  })

  let tariffId = fee.tariffId
  let categoryId = fee.categoryId
  let amountCents = fee.amountCents
  let duesAccountNumber = fee.duesAccountNumber
  const nextTariffId = data.tariffId?.trim() || null
  if (nextTariffId && nextTariffId !== fee.tariffId) {
    if (fee.status === MEMBERSHIP_FEE_STATUS_PAID || fee.entryId) {
      throw new Error('Impossible de changer le tarif d’une adhésion déjà comptabilisée.')
    }
    const tariff = await prisma.membershipSeasonTariff.findFirst({
      where: { id: nextTariffId, seasonId: fee.seasonId, season: { associationId } },
    })
    if (!tariff) throw new Error('Tarif introuvable pour cette saison.')
    tariffId = tariff.id
    categoryId = tariff.categoryId
    amountCents = tariff.amountCents
    duesAccountNumber = tariff.duesAccountNumber
  }

  await prisma.$transaction(async (tx) => {
    await tx.membershipFee.update({
      where: { id: fee.id },
      data: {
        ...snapshot,
        ...options,
        tariffId,
        categoryId,
        amountCents,
        duesAccountNumber,
      },
    })
    await writeAuditEvent(
      {
        associationId,
        action: 'MEMBERSHIP_UPDATE',
        entityType: 'MembershipFee',
        entityId: fee.id,
      },
      tx,
    )
  })
  revalidateMemberSurfaces(fee.memberId)
}

export async function importMembersFromCsv(opts: { csvText: string }) {
  const associationId = await requireAssociationId()
  const rows = parseMembersCsv(opts.csvText)
  const categories = await prisma.membershipCategory.findMany({ where: { associationId } })
  const byName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c]))

  let createdCount = 0
  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const category = row.categoryName ? byName.get(row.categoryName.trim().toLowerCase()) : null
      const input = normalizeMemberInput({
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        phone: row.phone,
        licenseNumber: row.licenseNumber,
        categoryId: category?.id ?? null,
      })
      const displayName = memberDisplayName(input)
      const counterpartyId = await upsertMemberCounterparty(tx as unknown as typeof prisma, {
        associationId,
        name: displayName,
      })
      await tx.member.create({
        data: { associationId, ...input, counterpartyId },
      })
      createdCount += 1
    }
    await writeAuditEvent(
      {
        associationId,
        action: 'MEMBER_IMPORT',
        entityType: 'Member',
        data: { createdCount },
      },
      tx,
    )
  })
  revalidateMemberSurfaces()
  return { createdCount }
}

export async function listMembersWithFees(seasonId: string | null) {
  const associationId = await requireAssociationId()
  return prisma.member.findMany({
    where: { associationId },
    include: {
      category: true,
      fees: { where: { seasonId: seasonId ?? '' }, include: { category: true, tariff: true } },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })
}

export async function listSeasonAdhesions(seasonId: string) {
  const associationId = await requireAssociationId()
  return prisma.membershipFee.findMany({
    where: { associationId, seasonId },
    include: {
      member: true,
      category: true,
      tariff: { include: { category: true } },
    },
    orderBy: [{ snapshotLastName: 'asc' }, { snapshotFirstName: 'asc' }],
  })
}

export async function getMemberDetail(id: string, seasonId: string | null) {
  const associationId = await requireAssociationId()
  return prisma.member.findFirst({
    where: { id, associationId },
    include: {
      category: true,
      fees: { where: { seasonId: seasonId ?? '' }, include: { season: true, category: true, tariff: true } },
    },
  })
}

export async function listUnpaidFeesForReminder(seasonId: string) {
  const associationId = await requireAssociationId()
  const season = await prisma.membershipSeason.findFirst({
    where: { id: seasonId, associationId },
  })
  if (!season) throw new Error('Saison introuvable.')
  const fees = await prisma.membershipFee.findMany({
    where: { associationId, seasonId, status: MEMBERSHIP_FEE_STATUS_DUE },
    include: { member: true, category: true, tariff: { include: { category: true } } },
    orderBy: { member: { lastName: 'asc' } },
  })
  const fiscalYearLabel = membershipSeasonLabel(season)
  return fees.map((f) => ({
    lastName: f.snapshotLastName || f.member.lastName,
    firstName: f.snapshotFirstName || f.member.firstName,
    email: f.member.email,
    categoryName: f.tariff.category.name ?? f.category?.name ?? null,
    amountCents: f.amountCents,
    fiscalYearLabel,
  }))
}
