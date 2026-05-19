// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, expect, it } from 'vitest'
import { resolveSelectedFiscalYearId, sortFiscalYearsOpenFirstNewestFirst } from './fiscalYearSelection'

describe('resolveSelectedFiscalYearId', () => {
  const years = [
    { id: 'closed-old', status: 'CLOSED' },
    { id: 'open-2026', status: 'OPEN' },
    { id: 'closed-new', status: 'CLOSED' },
  ]

  it('prefers URL param when valid', () => {
    expect(
      resolveSelectedFiscalYearId(years, {
        urlExerciceId: 'closed-new',
        cookieExerciceId: 'open-2026',
      }),
    ).toBe('closed-new')
  })

  it('falls back to cookie when URL is absent or invalid', () => {
    expect(resolveSelectedFiscalYearId(years, { cookieExerciceId: 'open-2026' })).toBe('open-2026')
    expect(
      resolveSelectedFiscalYearId(years, { urlExerciceId: 'unknown', cookieExerciceId: 'open-2026' }),
    ).toBe('open-2026')
  })

  it('falls back to first OPEN then first fiscal year', () => {
    expect(resolveSelectedFiscalYearId(years, {})).toBe('open-2026')
    expect(resolveSelectedFiscalYearId([{ id: 'only', status: 'CLOSED' }], {})).toBe('only')
    expect(resolveSelectedFiscalYearId([], {})).toBeNull()
  })
})

describe('sortFiscalYearsOpenFirstNewestFirst', () => {
  it('sorts open years before closed, newest start date first', () => {
    const sorted = sortFiscalYearsOpenFirstNewestFirst([
      { id: 'c', dateDebut: '2024-01-01', dateFin: '2024-12-31', statut: 'CLOTURE' },
      { id: 'o2', dateDebut: '2026-01-01', dateFin: '2026-12-31', statut: 'OUVERT' },
      { id: 'o1', dateDebut: '2025-01-01', dateFin: '2025-12-31', statut: 'OUVERT' },
    ])
    expect(sorted.map((y) => y.id)).toEqual(['o2', 'o1', 'c'])
  })
})
