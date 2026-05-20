// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, expect, it } from 'vitest'
import { buildOperationsSubmitPayload } from '@/app/saisie/saisieFormSubmit'
import {
  applyTemplateToSaisieState,
  buildTemplateFromSaisieState,
  resolveAccountIdByNumber,
  validateTemplatePayload,
  type RecurringExpenseTemplateRecord,
} from './recurringExpenseTemplate'

const comptes = [
  { id: 'c601', numero: '601', libelle: 'Achats' },
  { id: 'c512', numero: '512', libelle: 'Banque' },
  { id: 'c531', numero: '531', libelle: 'Caisse' },
  { id: 'c701', numero: '701', libelle: 'Ventes' },
]

describe('recurringExpenseTemplate', () => {
  it('resolveAccountIdByNumber matches exact then prefix', () => {
    expect(resolveAccountIdByNumber(comptes, '601')).toBe('c601')
    expect(resolveAccountIdByNumber(comptes, '999')).toBeNull()
  })

  it('buildTemplateFromSaisieState DEPENSE payée', () => {
    const built = buildTemplateFromSaisieState(
      {
        libelle: 'Loyer',
        typeOperation: 'DEPENSE',
        montant: 100,
        supplierId: 'sup-1',
        customerId: null,
        compteOperationId: 'c601',
        comptePaiementId: 'c512',
        dejaRegle: true,
      },
      comptes,
    )
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.data.treasuryAccountNumber).toBe('512')
    expect(built.data.operationAccountNumber).toBe('601')
    expect(built.data.amountCents).toBe(10000)
    expect(built.data.counterpartyId).toBe('sup-1')
  })

  it('buildTemplateFromSaisieState DEPENSE à payer', () => {
    const built = buildTemplateFromSaisieState(
      {
        libelle: 'Facture',
        typeOperation: 'DEPENSE',
        montant: 50,
        supplierId: 'sup-1',
        customerId: null,
        compteOperationId: 'c601',
        comptePaiementId: null,
        dejaRegle: false,
      },
      comptes,
    )
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.data.treasuryAccountNumber).toBeNull()
  })

  it('buildTemplateFromSaisieState RECETTE et TRANSFERT', () => {
    const recette = buildTemplateFromSaisieState(
      {
        libelle: 'Cotisation',
        typeOperation: 'RECETTE',
        montant: 20,
        supplierId: null,
        customerId: 'cli-1',
        compteOperationId: 'c701',
        comptePaiementId: 'c512',
        dejaRegle: true,
      },
      comptes,
    )
    expect(recette.ok).toBe(true)
    if (recette.ok) expect(recette.data.operationAccountNumber).toBe('701')

    const transfert = buildTemplateFromSaisieState(
      {
        libelle: 'Virement interne',
        typeOperation: 'TRANSFERT',
        montant: 10,
        supplierId: null,
        customerId: null,
        compteOperationId: 'c531',
        comptePaiementId: 'c512',
        dejaRegle: true,
      },
      comptes,
    )
    expect(transfert.ok).toBe(true)
    if (transfert.ok) {
      expect(transfert.data.operationAccountNumber).toBe('531')
      expect(transfert.data.treasuryAccountNumber).toBe('512')
    }
  })

  it('applyTemplateToSaisieState sets dejaRegle and resolves accounts', () => {
    const template: RecurringExpenseTemplateRecord = {
      id: 't1',
      associationId: 'a1',
      title: 'Loyer',
      operationType: 'DEPENSE',
      amountCents: 12000,
      counterpartyId: 'sup-1',
      operationAccountNumber: '601',
      treasuryAccountNumber: '512',
    }
    const applied = applyTemplateToSaisieState(template, comptes)
    expect('state' in applied).toBe(true)
    if (!('state' in applied)) return
    expect(applied.state.dejaRegle).toBe(true)
    expect(applied.state.compteOperationId).toBe('c601')
    expect(applied.state.comptePaiementId).toBe('c512')
    expect(applied.state.montant).toBe(120)
    expect(applied.missingAccountNumbers).toEqual([])
  })

  it('applyTemplateToSaisieState reports missing accounts', () => {
    const template: RecurringExpenseTemplateRecord = {
      id: 't2',
      associationId: 'a1',
      title: 'X',
      operationType: 'DEPENSE',
      amountCents: 100,
      counterpartyId: null,
      operationAccountNumber: '999',
      treasuryAccountNumber: '888',
    }
    const applied = applyTemplateToSaisieState(template, comptes)
    expect('state' in applied).toBe(true)
    if (!('state' in applied)) return
    expect(applied.state.compteOperationId).toBeNull()
    expect(applied.missingAccountNumbers).toContain('999')
    expect(applied.missingAccountNumbers).toContain('888')
  })

  it('applied template state produces valid submit payload', () => {
    const template: RecurringExpenseTemplateRecord = {
      id: 't1',
      associationId: 'a1',
      title: 'Loyer',
      operationType: 'DEPENSE',
      amountCents: 10000,
      counterpartyId: null,
      operationAccountNumber: '601',
      treasuryAccountNumber: '512',
    }
    const applied = applyTemplateToSaisieState(template, comptes)
    expect('state' in applied).toBe(true)
    if (!('state' in applied)) return

    const built = buildOperationsSubmitPayload({
      typeOperation: applied.state.typeOperation,
      normalizedAmount: applied.state.montant,
      comptes,
      comptePaiementId: applied.state.comptePaiementId,
      compteOperationId: applied.state.compteOperationId,
      supplierId: applied.state.supplierId,
      customerId: applied.state.customerId,
      dejaRegle: applied.state.dejaRegle,
      vatLiable: false,
      vatRatePercent: 0,
      journalByCode: () => 'journal-ac',
      fallbackJournalId: 'journal-ac',
      compteById: (id) => comptes.find((c) => c.id === id),
    })
    expect(built.ok).toBe(true)
  })

  it('validateTemplatePayload rejects invalid data', () => {
    expect(
      validateTemplatePayload({
        title: '',
        operationType: 'DEPENSE',
        amountCents: 100,
        counterpartyId: null,
        operationAccountNumber: '601',
        treasuryAccountNumber: null,
      }),
    ).toBeTruthy()
    expect(
      validateTemplatePayload({
        title: 'Ok',
        operationType: 'DEPENSE',
        amountCents: 0,
        counterpartyId: null,
        operationAccountNumber: '601',
        treasuryAccountNumber: null,
      }),
    ).toBeTruthy()
  })
})
