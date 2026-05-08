// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, it, expect } from 'vitest'
import { sortFiscalYearsOpenFirstNewestFirst } from '@/lib/fiscalYearSelection'

describe('fiscalYearSelection', () => {
  it('sorts OPEN before CLOSED', () => {
    const sorted = sortFiscalYearsOpenFirstNewestFirst([
      { id: 'c1', dateDebut: '2024-01-01', dateFin: '2024-12-31', statut: 'CLOTURE' },
      { id: 'o1', dateDebut: '2023-01-01', dateFin: '2023-12-31', statut: 'OUVERT' },
    ])
    expect(sorted.map((x) => x.id)).toEqual(['o1', 'c1'])
  })

  it('within same status, sorts by newest start date first', () => {
    const sorted = sortFiscalYearsOpenFirstNewestFirst([
      { id: 'o1', dateDebut: '2023-01-01', dateFin: '2023-12-31', statut: 'OUVERT' },
      { id: 'o2', dateDebut: '2024-01-01', dateFin: '2024-12-31', statut: 'OUVERT' },
    ])
    expect(sorted.map((x) => x.id)).toEqual(['o2', 'o1'])
  })
})

