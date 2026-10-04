// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, expect, it } from 'vitest'
import { showExerciceSwitcher, showSeasonSwitcher } from '@/lib/navigationContext'

describe('navigationContext switchers', () => {
  it('shows season on vie associative routes only', () => {
    expect(showSeasonSwitcher('/adherents')).toBe(true)
    expect(showSeasonSwitcher('/adhesions/new')).toBe(true)
    expect(showSeasonSwitcher('/saisons/abc/edit')).toBe(true)
    expect(showSeasonSwitcher('/saisie')).toBe(false)
    expect(showSeasonSwitcher('/ecritures')).toBe(false)
  })

  it('shows exercice on comptabilité routes only', () => {
    expect(showExerciceSwitcher('/ecritures')).toBe(true)
    expect(showExerciceSwitcher('/exercices')).toBe(true)
    expect(showExerciceSwitcher('/factures/new')).toBe(true)
    expect(showExerciceSwitcher('/adherents')).toBe(false)
    expect(showExerciceSwitcher('/adhesions')).toBe(false)
  })

  it('shows both on dashboard', () => {
    expect(showSeasonSwitcher('/')).toBe(true)
    expect(showExerciceSwitcher('/')).toBe(true)
  })
})
