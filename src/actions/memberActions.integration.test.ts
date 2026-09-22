// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPrismaClient } from '@/lib/createPrismaClient'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

let currentAssociationId: string | null = null

vi.mock('@/lib/associationContext', () => ({
  getCurrentAssociationId: async () => currentAssociationId,
}))

vi.mock('@/lib/audit', () => ({
  writeAuditEvent: vi.fn(),
}))

import {
  createMember,
  createMembershipCategory,
  createMembershipForSeason,
  markMembershipFeePaid,
  updateMember,
  updateMembership,
} from '@/actions/memberActions'
import { createMembershipSeason, upsertMembershipSeasonTariffByCategoryName } from '@/actions/seasonActions'
import { DUES_ACCOUNT_WITH_COUNTERPART, MEMBERSHIP_FEE_STATUS_PAID } from '@/lib/membership'

describe('membership dues posting', () => {
  beforeEach(() => {
    currentAssociationId = null
  })

  it('posts 512 debit / 7562 credit on the fiscal year that covers the payment date', async () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeTruthy()
    const prisma = createPrismaClient(dbUrl!)

    try {
      const assoc = await prisma.association.create({ data: { name: 'Dues posting assoc' } })
      currentAssociationId = assoc.id
      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: assoc.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
      })
      await prisma.$transaction([
        prisma.account.create({ data: { fiscalYearId: fy.id, number: '512', name: 'Banque' } }),
        prisma.account.create({ data: { fiscalYearId: fy.id, number: '7562', name: 'Cotisations avec contrepartie' } }),
      ])

      const category = await createMembershipCategory({
        name: 'Adulte',
        amountEuros: 80,
        duesAccountNumber: DUES_ACCOUNT_WITH_COUNTERPART,
      })
      const season = await createMembershipSeason({
        name: '2025-2026',
        startDate: '2025-09-01',
        endDate: '2026-08-31',
      })
      await upsertMembershipSeasonTariffByCategoryName({
        seasonId: season.id,
        categoryName: 'Adulte',
        amountEuros: 80,
        duesAccountNumber: DUES_ACCOUNT_WITH_COUNTERPART,
      })
      const tariff = await prisma.membershipSeasonTariff.findFirst({
        where: { seasonId: season.id, categoryId: category.id },
      })
      expect(tariff).toBeTruthy()

      const member = await createMember({
        firstName: 'Marie',
        lastName: 'Dupont',
        categoryId: category.id,
        seasonId: season.id,
        tariffId: tariff!.id,
        imageRightsConsent: true,
      })
      const fee = await prisma.membershipFee.findUnique({
        where: { memberId_seasonId: { memberId: member.id, seasonId: season.id } },
      })
      expect(fee?.status).toBe('DUE')
      expect(fee?.amountCents).toBe(8000)
      expect(fee?.snapshotFirstName).toBe('Marie')
      expect(fee?.snapshotLastName).toBe('Dupont')
      expect(fee?.imageRightsConsent).toBe(true)
      expect(fee?.categoryId).toBe(category.id)
      expect(fee?.tariffId).toBe(tariff!.id)

      await updateMember(member.id, {
        firstName: 'Other',
        lastName: 'Name',
        categoryId: category.id,
      })
      const frozen = await prisma.membershipFee.findUnique({ where: { id: fee!.id } })
      expect(frozen?.snapshotFirstName).toBe('Marie')
      expect(frozen?.snapshotLastName).toBe('Dupont')
      const living = await prisma.member.findUnique({ where: { id: member.id } })
      expect(living?.firstName).toBe('Other')

      await markMembershipFeePaid({
        feeId: fee!.id,
        paidOn: '2026-03-02',
        treasuryAccountNumber: '512',
      })

      const paid = await prisma.membershipFee.findUnique({ where: { id: fee!.id } })
      expect(paid?.status).toBe(MEMBERSHIP_FEE_STATUS_PAID)
      expect(paid?.entryId).toBeTruthy()

      const entry = await prisma.entry.findUnique({
        where: { id: paid!.entryId! },
        include: { lines: true },
      })
      expect(entry?.fiscalYearId).toBe(fy.id)
      expect(entry?.description).toContain('DUPONT Marie')
      expect(entry?.description).toContain('2025-2026')
      const debit512 = entry?.lines.find((l) => l.accountNumber === '512')
      const credit756 = entry?.lines.find((l) => l.accountNumber === '7562')
      expect(debit512?.debitCents).toBe(8000)
      expect(credit756?.creditCents).toBe(8000)

      const youth = await createMembershipCategory({
        name: 'Jeune',
        amountEuros: 40,
        duesAccountNumber: DUES_ACCOUNT_WITH_COUNTERPART,
      })
      const youthTariff = await prisma.membershipSeasonTariff.create({
        data: {
          seasonId: season.id,
          categoryId: youth.id,
          amountCents: 4000,
          duesAccountNumber: DUES_ACCOUNT_WITH_COUNTERPART,
        },
      })
      await expect(
        updateMembership({
          membershipId: fee!.id,
          snapshotFirstName: 'Marie',
          snapshotLastName: 'Dupont',
          tariffId: youthTariff.id,
        }),
      ).rejects.toThrow(/déjà comptabilisée/)
    } finally {
      await prisma.$disconnect()
    }
  })

  it('updates DUE membership amount when the season tariff changes', async () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeTruthy()
    const prisma = createPrismaClient(dbUrl!)

    try {
      const assoc = await prisma.association.create({ data: { name: 'Dues tariff assoc' } })
      currentAssociationId = assoc.id
      await prisma.fiscalYear.create({
        data: {
          associationId: assoc.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
      })
      const adult = await createMembershipCategory({
        name: 'Adulte',
        amountEuros: 80,
        duesAccountNumber: DUES_ACCOUNT_WITH_COUNTERPART,
      })
      const youth = await createMembershipCategory({
        name: 'Jeune',
        amountEuros: 40,
        duesAccountNumber: DUES_ACCOUNT_WITH_COUNTERPART,
      })
      const season = await createMembershipSeason({
        name: '2026-2027',
        startDate: '2026-09-01',
        endDate: '2027-08-31',
      })
      await upsertMembershipSeasonTariffByCategoryName({
        seasonId: season.id,
        categoryName: 'Adulte',
        amountEuros: 80,
        duesAccountNumber: DUES_ACCOUNT_WITH_COUNTERPART,
      })
      await upsertMembershipSeasonTariffByCategoryName({
        seasonId: season.id,
        categoryName: 'Jeune',
        amountEuros: 40,
        duesAccountNumber: DUES_ACCOUNT_WITH_COUNTERPART,
      })
      const adultTariff = await prisma.membershipSeasonTariff.findFirst({
        where: { seasonId: season.id, categoryId: adult.id },
      })
      const youthTariff = await prisma.membershipSeasonTariff.findFirst({
        where: { seasonId: season.id, categoryId: youth.id },
      })
      const member = await createMember({
        firstName: 'Léa',
        lastName: 'Martin',
        categoryId: adult.id,
        seasonId: season.id,
        tariffId: adultTariff!.id,
      })
      const fee = await prisma.membershipFee.findUnique({
        where: { memberId_seasonId: { memberId: member.id, seasonId: season.id } },
      })
      await updateMembership({
        membershipId: fee!.id,
        snapshotFirstName: 'Léa',
        snapshotLastName: 'Martin-Dupont',
        tariffId: youthTariff!.id,
        internalRulesAccepted: true,
      })
      const updated = await prisma.membershipFee.findUnique({ where: { id: fee!.id } })
      expect(updated?.snapshotLastName).toBe('Martin-Dupont')
      expect(updated?.categoryId).toBe(youth.id)
      expect(updated?.tariffId).toBe(youthTariff!.id)
      expect(updated?.amountCents).toBe(4000)
      expect(updated?.internalRulesAccepted).toBe(true)
      const living = await prisma.member.findUnique({ where: { id: member.id } })
      expect(living?.lastName).toBe('Martin')
    } finally {
      await prisma.$disconnect()
    }
  })

  it('rejects a second adhesion for the same member and season', async () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeTruthy()
    const prisma = createPrismaClient(dbUrl!)

    try {
      const assoc = await prisma.association.create({ data: { name: 'Unique adhesion assoc' } })
      currentAssociationId = assoc.id
      const category = await createMembershipCategory({
        name: 'Adulte',
        amountEuros: 80,
        duesAccountNumber: DUES_ACCOUNT_WITH_COUNTERPART,
      })
      const season = await createMembershipSeason({
        name: 'Saison unique',
        startDate: '2026-09-01',
        endDate: '2027-08-31',
      })
      await upsertMembershipSeasonTariffByCategoryName({
        seasonId: season.id,
        categoryName: 'Adulte',
        amountEuros: 80,
        duesAccountNumber: DUES_ACCOUNT_WITH_COUNTERPART,
      })
      const tariff = await prisma.membershipSeasonTariff.findFirst({
        where: { seasonId: season.id, categoryId: category.id },
      })
      const member = await createMember({
        firstName: 'Paul',
        lastName: 'Durand',
        seasonId: season.id,
        tariffId: tariff!.id,
      })
      await expect(
        createMembershipForSeason({
          memberId: member.id,
          seasonId: season.id,
          tariffId: tariff!.id,
        }),
      ).rejects.toThrow(/déjà/)
    } finally {
      await prisma.$disconnect()
    }
  })
})
