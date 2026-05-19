// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, expect, it } from 'vitest'
import {
  findThirdPartyAccount,
  journalCodeForPayment,
  quickDocOperationLineIndex,
} from './saisieFormTypes'

describe('findThirdPartyAccount', () => {
  it('prefers exact account number match', () => {
    const comptes = [
      { id: '1', numero: '401', libelle: 'Fournisseurs' },
      { id: '2', numero: '4011', libelle: 'Sous-compte' },
    ]
    expect(findThirdPartyAccount(comptes, '401')?.id).toBe('1')
  })

  it('falls back to prefix match when exact number is missing', () => {
    const comptes = [{ id: '2', numero: '401000', libelle: 'Fournisseurs détaillés' }]
    expect(findThirdPartyAccount(comptes, '401')?.id).toBe('2')
  })
})

describe('journalCodeForPayment', () => {
  it('returns CA for cash accounts (53x)', () => {
    expect(journalCodeForPayment({ id: 'c', numero: '531', libelle: 'Caisse' })).toBe('CA')
  })

  it('returns BQ for bank accounts and when account is undefined', () => {
    expect(journalCodeForPayment({ id: 'b', numero: '512', libelle: 'Banque' })).toBe('BQ')
    expect(journalCodeForPayment(undefined)).toBe('BQ')
  })
})

describe('quickDocOperationLineIndex', () => {
  it('maps recette documents to line index 1', () => {
    expect(quickDocOperationLineIndex('RECETTE')).toBe(1)
  })

  it('maps other quick operations to line index 0', () => {
    expect(quickDocOperationLineIndex('DEPENSE')).toBe(0)
    expect(quickDocOperationLineIndex('TRANSFERT')).toBe(0)
    expect(quickDocOperationLineIndex('REGLEMENT_FOURNISSEUR')).toBe(0)
  })
})
