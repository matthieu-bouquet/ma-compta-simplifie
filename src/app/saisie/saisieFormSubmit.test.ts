// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, expect, it } from 'vitest'
import {
  buildAdvancedSubmitPayload,
  buildOperationsSubmitPayload,
  buildQuickDocumentsByLine,
  resolveAutoJournalCode,
} from './saisieFormSubmit'

const comptes = [
  { id: 'exp', numero: '606', libelle: 'Achats' },
  { id: 'bank', numero: '512', libelle: 'Banque' },
  { id: 'cash', numero: '531', libelle: 'Caisse' },
  { id: 'sup', numero: '401', libelle: 'Fournisseurs' },
  { id: 'cli', numero: '411', libelle: 'Clients' },
  { id: 'rev', numero: '706', libelle: 'Prestations' },
]

const journalByCode = (code: string) =>
  ({ AC: 'j-ac', VE: 'j-ve', OD: 'j-od', BQ: 'j-bq', CA: 'j-ca' })[code] ?? null

const compteById = (id: string | null) => comptes.find((c) => c.id === id)

describe('resolveAutoJournalCode', () => {
  it('maps operation types to standard journal codes', () => {
    expect(resolveAutoJournalCode('TRANSFERT')).toBe('OD')
    expect(resolveAutoJournalCode('DEPENSE')).toBe('AC')
    expect(resolveAutoJournalCode('RECETTE')).toBe('VE')
    expect(resolveAutoJournalCode('REGLEMENT_FOURNISSEUR')).toBeNull()
  })
})

describe('buildQuickDocumentsByLine', () => {
  it('returns undefined for advanced mode', () => {
    expect(
      buildQuickDocumentsByLine({
        mode: 'AVANCE',
        typeOperation: 'DEPENSE',
        quickDocuments: [new File(['x'], 'a.pdf')],
        lignesToSubmit: [],
      }),
    ).toBeUndefined()
  })

  it('attaches documents to the operation line for a simple expense', () => {
    const file = new File(['x'], 'facture.pdf')
    const lignes = [
      { compteId: 'exp', debit: 10, credit: 0 },
      { compteId: 'bank', debit: 0, credit: 10 },
    ]
    const rows = buildQuickDocumentsByLine({
      mode: 'OPERATIONS',
      typeOperation: 'DEPENSE',
      quickDocuments: [file],
      lignesToSubmit: lignes,
    })
    expect(rows).toEqual([[file], []])
  })

  it('uses three VAT rows with docs on charge line for DEPENSE', () => {
    const file = new File(['x'], 'facture.pdf')
    const rows = buildQuickDocumentsByLine({
      mode: 'OPERATIONS',
      typeOperation: 'DEPENSE',
      quickDocuments: [file],
      lignesToSubmit: [],
      quickVatPayload: {
        amountTtcEuros: 100,
        vatRatePercent: 20,
        flow: 'DEPENSE',
        settledImmediately: true,
        operationAccountId: 'exp',
        treasuryAccountId: 'bank',
        thirdPartyAccountId: null,
      },
    })
    expect(rows).toEqual([[file], [], []])
  })
})

describe('buildOperationsSubmitPayload', () => {
  const base = {
    normalizedAmount: 50,
    comptes,
    journalByCode,
    fallbackJournalId: 'j-fallback',
    compteById,
    vatLiable: false,
    vatRatePercent: 20,
    dejaRegle: true,
    supplierId: null,
    customerId: null,
  }

  it('builds balanced transfer lines on OD journal', () => {
    const result = buildOperationsSubmitPayload({
      ...base,
      typeOperation: 'TRANSFERT',
      comptePaiementId: 'bank',
      compteOperationId: 'cash',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.journalId).toBe('j-od')
    expect(result.lignesToSubmit).toEqual([
      { compteId: 'cash', debit: 50, credit: 0 },
      { compteId: 'bank', debit: 0, credit: 50 },
    ])
  })

  it('rejects transfer when source and destination are the same', () => {
    const result = buildOperationsSubmitPayload({
      ...base,
      typeOperation: 'TRANSFERT',
      comptePaiementId: 'bank',
      compteOperationId: 'bank',
    })
    expect(result).toEqual({
      ok: false,
      error: 'Le compte source et destination doivent être différents.',
    })
  })

  it('builds supplier payable lines for credit expense', () => {
    const result = buildOperationsSubmitPayload({
      ...base,
      typeOperation: 'DEPENSE',
      dejaRegle: false,
      compteOperationId: 'exp',
      comptePaiementId: null,
      supplierId: 'supplier-1',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.journalId).toBe('j-ac')
    expect(result.lignesToSubmit).toEqual([
      { compteId: 'exp', debit: 50, credit: 0 },
      { compteId: 'sup', debit: 0, credit: 50 },
    ])
    expect(result.counterpartyId).toBe('supplier-1')
  })

  it('uses BQ journal for supplier settlement from bank account', () => {
    const result = buildOperationsSubmitPayload({
      ...base,
      typeOperation: 'REGLEMENT_FOURNISSEUR',
      comptePaiementId: 'bank',
      supplierId: 'supplier-1',
      compteOperationId: null,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.journalId).toBe('j-bq')
  })
})

describe('buildAdvancedSubmitPayload', () => {
  it('accepts balanced lines with accounts', () => {
    const lignes = [
      { compteId: 'exp', debit: 40, credit: 0 },
      { compteId: 'bank', debit: 0, credit: 40 },
    ]
    const result = buildAdvancedSubmitPayload({ lignes, isEquilibre: true, totalDebit: 40 })
    expect(result).toEqual({ ok: true, lignesToSubmit: lignes })
  })

  it('rejects unbalanced or empty advanced entries', () => {
    expect(
      buildAdvancedSubmitPayload({
        lignes: [
          { compteId: 'exp', debit: 40, credit: 0 },
          { compteId: 'bank', debit: 0, credit: 10 },
        ],
        isEquilibre: false,
        totalDebit: 40,
      }),
    ).toEqual({ ok: false, error: "L'écriture doit être équilibrée (Total Débit = Total Crédit)." })

    expect(
      buildAdvancedSubmitPayload({
        lignes: [{ compteId: '', debit: 0, credit: 0 }],
        isEquilibre: true,
        totalDebit: 0,
      }),
    ).toEqual({ ok: false, error: 'Le montant doit être strictement supérieur à 0.' })
  })
})
