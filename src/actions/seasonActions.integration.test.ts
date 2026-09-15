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

import { createMembershipCategory } from '@/actions/memberActions'
import { createMembershipForSeason } from '@/actions/memberActions'
import {
  closeMembershipSeason,
  createMembershipSeason,
  deleteMembershipSeason,
  upsertMembershipSeasonTariffByCategoryName,
} from '@/actions/seasonActions'
import { DUES_ACCOUNT_WITH_COUNTERPART } from '@/lib/membership'
import { MEMBERSHIP_SEASON_STATUS_CLOSED } from '@/lib/membershipSeasonStatus'

describe('membership seasons', () => {
  beforeEach(() => {
    currentAssociationId = null
  })

  it('creates a season without tariffs until configured on the season page', async () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeTruthy()
    const prisma = createPrismaClient(dbUrl!)

    try {
      const assoc = await prisma.association.create({ data: { name: 'Season copy assoc' } })
      currentAssociationId = assoc.id
      await createMembershipCategory({
        name: 'Adulte',
        amountEuros: 80,
        duesAccountNumber: DUES_ACCOUNT_WITH_COUNTERPART,
      })
      const season = await createMembershipSeason({
        name: '2026-2027',
        startDate: '2026-09-01',
        endDate: '2027-08-31',
      })
      let tariffs = await prisma.membershipSeasonTariff.findMany({ where: { seasonId: season.id } })
      expect(tariffs).toHaveLength(0)

      await upsertMembershipSeasonTariffByCategoryName({
        seasonId: season.id,
        categoryName: 'Adulte',
        amountEuros: 80,
        duesAccountNumber: DUES_ACCOUNT_WITH_COUNTERPART,
      })
      tariffs = await prisma.membershipSeasonTariff.findMany({ where: { seasonId: season.id } })
      expect(tariffs).toHaveLength(1)
      expect(tariffs[0]?.amountCents).toBe(8000)
    } finally {
      await prisma.$disconnect()
    }
  })

  it('blocks creating adhesions after the season is closed', async () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeTruthy()
    const prisma = createPrismaClient(dbUrl!)

    try {
      const assoc = await prisma.association.create({ data: { name: 'Season close assoc' } })
      currentAssociationId = assoc.id
      await createMembershipCategory({
        name: 'Adulte',
        amountEuros: 50,
        duesAccountNumber: DUES_ACCOUNT_WITH_COUNTERPART,
      })
      const season = await createMembershipSeason({
        name: 'Close test',
        startDate: '2026-09-01',
        endDate: '2027-08-31',
      })
      await upsertMembershipSeasonTariffByCategoryName({
        seasonId: season.id,
        categoryName: 'Adulte',
        amountEuros: 50,
        duesAccountNumber: DUES_ACCOUNT_WITH_COUNTERPART,
      })
      const tariff = await prisma.membershipSeasonTariff.findFirst({ where: { seasonId: season.id } })
      const member = await prisma.member.create({
        data: { associationId: assoc.id, firstName: 'A', lastName: 'B' },
      })
      await closeMembershipSeason(season.id)
      const closed = await prisma.membershipSeason.findUnique({ where: { id: season.id } })
      expect(closed?.status).toBe(MEMBERSHIP_SEASON_STATUS_CLOSED)

      await expect(
        createMembershipForSeason({
          memberId: member.id,
          seasonId: season.id,
          tariffId: tariff!.id,
        }),
      ).rejects.toThrow(/clôturée/)
    } finally {
      await prisma.$disconnect()
    }
  })

  it('blocks deleting a season that already has adhesions', async () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeTruthy()
    const prisma = createPrismaClient(dbUrl!)

    try {
      const assoc = await prisma.association.create({ data: { name: 'Season delete assoc' } })
      currentAssociationId = assoc.id
      const category = await createMembershipCategory({
        name: 'Adulte',
        amountEuros: 50,
        duesAccountNumber: DUES_ACCOUNT_WITH_COUNTERPART,
      })
      const season = await createMembershipSeason({
        name: 'À supprimer',
        startDate: '2026-09-01',
        endDate: '2027-08-31',
      })
      const tariff = await prisma.membershipSeasonTariff.create({
        data: {
          seasonId: season.id,
          categoryId: category.id,
          amountCents: 5000,
          duesAccountNumber: DUES_ACCOUNT_WITH_COUNTERPART,
        },
      })
      const member = await prisma.member.create({
        data: {
          associationId: assoc.id,
          firstName: 'Léa',
          lastName: 'Martin',
        },
      })
      await prisma.membershipFee.create({
        data: {
          associationId: assoc.id,
          memberId: member.id,
          seasonId: season.id,
          tariffId: tariff.id,
          categoryId: category.id,
          snapshotFirstName: 'Léa',
          snapshotLastName: 'Martin',
          amountCents: 5000,
          duesAccountNumber: DUES_ACCOUNT_WITH_COUNTERPART,
          status: 'DUE',
        },
      })
      await expect(deleteMembershipSeason(season.id)).rejects.toThrow(/adhésions/)
    } finally {
      await prisma.$disconnect()
    }
  })
})
