// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

export type MembershipSeasonRef = { id: string }

export function resolveSelectedSeasonId(
  seasons: MembershipSeasonRef[],
  opts: { urlSeasonId?: string | null; cookieSeasonId?: string | null },
): string | null {
  if (seasons.length === 0) return null
  const { urlSeasonId, cookieSeasonId } = opts
  if (urlSeasonId && seasons.some((s) => s.id === urlSeasonId)) return urlSeasonId
  if (cookieSeasonId && seasons.some((s) => s.id === cookieSeasonId)) return cookieSeasonId
  return seasons[0]?.id ?? null
}

export function membershipSeasonLabel(season: {
  name: string
  startDate: Date
  endDate: Date
  status?: string
}): string {
  const start = season.startDate.toLocaleDateString('fr-FR')
  const end = season.endDate.toLocaleDateString('fr-FR')
  const base = `${season.name} (${start} – ${end})`
  return season.status === 'CLOSED' ? `${base} — clôturée` : base
}
