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
    expect(getEntityRequiredCopy('exercices')).toContain('exercices')
    expect(getEntityRequiredCopy('bilan')).toContain('bilan')
    expect(getEntityRequiredCopy('previsionnel')).toContain('prévisionnels')
    expect(getEntityRequiredCopy('previsionnelNew')).toContain('créer un prévisionnel')
    expect(getEntityRequiredCopy('default')).toContain('choisir l’entité')
    expect(getEntityRequiredCopy('dashboard')).toContain('choisir l’entité')
  })

  it('getNoEntitiesCopy returns purpose-specific no-entities copy', () => {
    expect(getNoEntitiesCopy('saisie')).toContain('commencer la saisie')
    expect(getNoEntitiesCopy('bilan')).toContain('accéder au bilan')
    expect(getNoEntitiesCopy('grandLivre')).toContain('grand livre')
    expect(getNoEntitiesCopy('previsionnel')).toContain('prévisionnels')
    expect(getNoEntitiesCopy('previsionnelNew')).toContain('créer un prévisionnel')
    expect(getNoEntitiesCopy('default')).toContain('commencer')
    expect(getNoEntitiesCopy('exercices')).toContain('commencer')
  })

  it('getFiscalYearRequiredCopy returns purpose-specific copy', () => {
    expect(getFiscalYearRequiredCopy('saisie')).toContain('saisie comptable')
    expect(getFiscalYearRequiredCopy('previsionnel')).toContain('prévisionnel')
    expect(getFiscalYearRequiredCopy('documents')).toContain('documents')
    expect(getFiscalYearRequiredCopy('grandLivre')).toContain('grand livre')
    expect(getFiscalYearRequiredCopy('bilan')).toContain('bilan')
    expect(getFiscalYearRequiredCopy('default')).toContain('exercice')
  })
})

