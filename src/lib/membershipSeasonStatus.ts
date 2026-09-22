// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import type { PrismaClient } from '@/generated/prisma/client'

export const MEMBERSHIP_SEASON_STATUS_OPEN = 'OPEN'
export const MEMBERSHIP_SEASON_STATUS_CLOSED = 'CLOSED'

type Db = Pick<PrismaClient, 'membershipSeason'>

export function isMembershipSeasonClosed(status: string): boolean {
  return status === MEMBERSHIP_SEASON_STATUS_CLOSED
}

export function assertMembershipSeasonWritable(season: { status: string } | null | undefined) {
  if (!season) throw new Error('Saison introuvable.')
  if (isMembershipSeasonClosed(season.status)) {
    throw new Error('Cette saison est clôturée : consultation seule, plus de modification ni d’adhésion.')
  }
}

export async function loadWritableMembershipSeason(
  db: Db,
  opts: { seasonId: string; associationId: string },
) {
  const season = await db.membershipSeason.findFirst({
    where: { id: opts.seasonId, associationId: opts.associationId },
    select: { id: true, status: true, name: true },
  })
  assertMembershipSeasonWritable(season)
  return season!
}
