// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

export type FiscalYearOption = {
  id: string
  dateDebut: string
  dateFin: string
  statut: string // 'OUVERT' | 'CLOTURE' in current UI payload
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

