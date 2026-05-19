// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

export type FiscalYearOption = {
  id: string
  dateDebut: string
  dateFin: string
  statut: string // 'OUVERT' | 'CLOTURE' in current UI payload
}

export type FiscalYearRef = {
  id: string
  status: string
}

export function sortFiscalYearsOpenFirstNewestFirst(exercices: FiscalYearOption[]): FiscalYearOption[] {
  return exercices
    .slice()
    .sort((a, b) => {
      const aOpen = a.statut === 'OUVERT' ? 1 : 0
      const bOpen = b.statut === 'OUVERT' ? 1 : 0
      if (aOpen !== bOpen) return bOpen - aOpen
      return new Date(b.dateDebut).getTime() - new Date(a.dateDebut).getTime()
    })
}

/**
 * Resolves the active fiscal year: URL param → cookie → first OPEN → first in list.
 */
export function resolveSelectedFiscalYearId(
  fiscalYears: FiscalYearRef[],
  opts: { urlExerciceId?: string | null; cookieExerciceId?: string | null },
): string | null {
  if (fiscalYears.length === 0) return null

  const { urlExerciceId, cookieExerciceId } = opts
  if (urlExerciceId && fiscalYears.some((fy) => fy.id === urlExerciceId)) {
    return urlExerciceId
  }
  if (cookieExerciceId && fiscalYears.some((fy) => fy.id === cookieExerciceId)) {
    return cookieExerciceId
  }
  return fiscalYears.find((fy) => fy.status === 'OPEN')?.id ?? fiscalYears[0]?.id ?? null
}
