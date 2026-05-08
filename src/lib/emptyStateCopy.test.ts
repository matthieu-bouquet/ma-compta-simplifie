// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, it, expect } from 'vitest'
import {
  getEntityRequiredCopy,
  getNoEntitiesCopy,
  getFiscalYearRequiredCopy,
} from '@/lib/emptyStateCopy'

describe('emptyStateCopy', () => {
  it('getEntityRequiredCopy returns purpose-specific copy', () => {
    expect(getEntityRequiredCopy('saisie')).toContain('accéder à la saisie')
    expect(getEntityRequiredCopy('documents')).toContain('accéder aux documents')
    expect(getEntityRequiredCopy('grandLivre')).toContain('accéder au grand livre')
  })

  it('getNoEntitiesCopy returns purpose-specific no-entities copy', () => {
    expect(getNoEntitiesCopy('saisie')).toContain('commencer la saisie')
    expect(getNoEntitiesCopy('bilan')).toContain('accéder au bilan')
  })

  it('getFiscalYearRequiredCopy returns purpose-specific copy', () => {
    expect(getFiscalYearRequiredCopy('saisie')).toContain('saisie comptable')
    expect(getFiscalYearRequiredCopy('previsionnel')).toContain('prévisionnel')
  })
})

