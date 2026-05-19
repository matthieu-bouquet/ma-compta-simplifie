// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import type { QuickVatInput } from '@/lib/vatQuickEntry'
import {
  findThirdPartyAccount,
  journalCodeForPayment,
  quickDocOperationLineIndex,
  type Compte,
  type LigneForm,
  type TypeOperation,
} from './saisieFormTypes'

export type JournalByCode = (code: string) => string | null

export type BuildQuickDocumentsByLineInput = {
  mode: 'OPERATIONS' | 'TREASURY' | 'AVANCE'
  typeOperation: TypeOperation
  quickDocuments: (File | null)[]
  quickVatPayload?: QuickVatInput
  lignesToSubmit: LigneForm[]
}

export function buildQuickDocumentsByLine(
  input: BuildQuickDocumentsByLineInput,
): File[][] | undefined {
  if (input.mode === 'AVANCE') return undefined
  if (
    input.typeOperation === 'REGLEMENT_FOURNISSEUR' ||
    input.typeOperation === 'ENCAISSEMENT_CLIENT'
  ) {
    return undefined
  }

  const docs = input.quickDocuments.filter((d): d is File => d != null)
  if (docs.length === 0) return undefined

  if (input.quickVatPayload) {
    const operationLineIndex = quickDocOperationLineIndex(input.typeOperation)
    const rows: File[][] = [[], [], []]
    rows[operationLineIndex] = docs
    return rows
  }

  const operationLineIndex = quickDocOperationLineIndex(input.typeOperation)
  return input.lignesToSubmit.map((_, idx) => (idx === operationLineIndex ? docs : []))
}

export function resolveAutoJournalCode(typeOperation: TypeOperation): string | null {
  if (typeOperation === 'TRANSFERT') return 'OD'
  if (typeOperation === 'DEPENSE') return 'AC'
  if (typeOperation === 'RECETTE') return 'VE'
  if (typeOperation === 'REGLEMENT_FOURNISSEUR' || typeOperation === 'ENCAISSEMENT_CLIENT') {
    return null
  }
  return 'OD'
}

export type BuildOperationsSubmitInput = {
  typeOperation: TypeOperation
  normalizedAmount: number
  comptes: Compte[]
  comptePaiementId: string | null
  compteOperationId: string | null
  supplierId: string | null
  customerId: string | null
  dejaRegle: boolean
  vatLiable: boolean
  vatRatePercent: number
  journalByCode: JournalByCode
  fallbackJournalId: string
  compteById: (id: string | null) => Compte | undefined
}

export type BuildOperationsSubmitResult =
  | {
      ok: true
      lignesToSubmit: LigneForm[]
      counterpartyId: string | null
      quickVatPayload?: QuickVatInput
      journalId: string
    }
  | { ok: false; error: string }

export function buildOperationsSubmitPayload(
  input: BuildOperationsSubmitInput,
): BuildOperationsSubmitResult {
  const {
    typeOperation,
    normalizedAmount,
    comptes,
    comptePaiementId,
    compteOperationId,
    supplierId,
    customerId,
    dejaRegle,
    vatLiable,
    vatRatePercent,
    journalByCode,
    fallbackJournalId,
    compteById,
  } = input

  if (normalizedAmount <= 0) {
    return { ok: false, error: 'Le montant doit être strictement supérieur à 0.' }
  }

  const autoCode = resolveAutoJournalCode(typeOperation)
  let journalId = (autoCode ? journalByCode(autoCode) : null) || fallbackJournalId

  if (typeOperation === 'REGLEMENT_FOURNISSEUR') {
    if (!supplierId || !comptePaiementId) {
      return { ok: false, error: 'Veuillez choisir le fournisseur et le compte de trésorerie.' }
    }
    const c401 = findThirdPartyAccount(comptes, '401')
    if (!c401) {
      return { ok: false, error: 'Le compte 401 (Fournisseurs) est absent du plan de cet exercice.' }
    }
    const pay = compteById(comptePaiementId)
    journalId = journalByCode(journalCodeForPayment(pay)) || journalByCode('BQ') || journalId
    return {
      ok: true,
      counterpartyId: supplierId,
      journalId,
      lignesToSubmit: [
        { compteId: c401.id, debit: normalizedAmount, credit: 0 },
        { compteId: comptePaiementId, debit: 0, credit: normalizedAmount },
      ],
    }
  }

  if (typeOperation === 'ENCAISSEMENT_CLIENT') {
    if (!customerId || !comptePaiementId) {
      return { ok: false, error: 'Veuillez choisir le client et le compte de trésorerie.' }
    }
    const c411 = findThirdPartyAccount(comptes, '411')
    if (!c411) {
      return { ok: false, error: 'Le compte 411 (Clients) est absent du plan de cet exercice.' }
    }
    const pay = compteById(comptePaiementId)
    journalId = journalByCode(journalCodeForPayment(pay)) || journalByCode('BQ') || journalId
    return {
      ok: true,
      counterpartyId: customerId,
      journalId,
      lignesToSubmit: [
        { compteId: comptePaiementId, debit: normalizedAmount, credit: 0 },
        { compteId: c411.id, debit: 0, credit: normalizedAmount },
      ],
    }
  }

  if (typeOperation === 'TRANSFERT') {
    if (!comptePaiementId || !compteOperationId) {
      return { ok: false, error: 'Veuillez remplir les deux comptes.' }
    }
    if (comptePaiementId === compteOperationId) {
      return { ok: false, error: 'Le compte source et destination doivent être différents.' }
    }
    journalId = journalByCode('OD') || journalId
    return {
      ok: true,
      counterpartyId: null,
      journalId,
      lignesToSubmit: [
        { compteId: compteOperationId, debit: normalizedAmount, credit: 0 },
        { compteId: comptePaiementId, debit: 0, credit: normalizedAmount },
      ],
    }
  }

  if (vatLiable && vatRatePercent > 0 && typeOperation === 'DEPENSE') {
    if (!compteOperationId) {
      return { ok: false, error: 'Veuillez choisir la catégorie (charge).' }
    }
    if (dejaRegle) {
      if (!comptePaiementId) {
        return { ok: false, error: 'Veuillez choisir le moyen de paiement.' }
      }
      return {
        ok: true,
        counterpartyId: supplierId,
        journalId: journalByCode('AC') || journalId,
        lignesToSubmit: [],
        quickVatPayload: {
          amountTtcEuros: normalizedAmount,
          vatRatePercent,
          flow: 'DEPENSE',
          settledImmediately: true,
          operationAccountId: compteOperationId,
          treasuryAccountId: comptePaiementId,
          thirdPartyAccountId: null,
        },
      }
    }
    if (!supplierId) {
      return { ok: false, error: 'Veuillez choisir ou créer un fournisseur pour une dette fournisseur.' }
    }
    const c401 = findThirdPartyAccount(comptes, '401')
    if (!c401) {
      return { ok: false, error: 'Le compte 401 (Fournisseurs) est absent du plan de cet exercice.' }
    }
    return {
      ok: true,
      counterpartyId: supplierId,
      journalId: journalByCode('AC') || journalId,
      lignesToSubmit: [],
      quickVatPayload: {
        amountTtcEuros: normalizedAmount,
        vatRatePercent,
        flow: 'DEPENSE',
        settledImmediately: false,
        operationAccountId: compteOperationId,
        treasuryAccountId: null,
        thirdPartyAccountId: c401.id,
      },
    }
  }

  if (vatLiable && vatRatePercent > 0 && typeOperation === 'RECETTE') {
    if (!compteOperationId) {
      return { ok: false, error: 'Veuillez choisir la catégorie (produit).' }
    }
    if (dejaRegle) {
      if (!comptePaiementId) {
        return { ok: false, error: 'Veuillez choisir le moyen de paiement.' }
      }
      return {
        ok: true,
        counterpartyId: customerId,
        journalId: journalByCode('VE') || journalId,
        lignesToSubmit: [],
        quickVatPayload: {
          amountTtcEuros: normalizedAmount,
          vatRatePercent,
          flow: 'RECETTE',
          settledImmediately: true,
          operationAccountId: compteOperationId,
          treasuryAccountId: comptePaiementId,
          thirdPartyAccountId: null,
        },
      }
    }
    if (!customerId) {
      return { ok: false, error: 'Veuillez choisir ou créer un client pour une créance.' }
    }
    const c411 = findThirdPartyAccount(comptes, '411')
    if (!c411) {
      return { ok: false, error: 'Le compte 411 (Clients) est absent du plan de cet exercice.' }
    }
    return {
      ok: true,
      counterpartyId: customerId,
      journalId: journalByCode('VE') || journalId,
      lignesToSubmit: [],
      quickVatPayload: {
        amountTtcEuros: normalizedAmount,
        vatRatePercent,
        flow: 'RECETTE',
        settledImmediately: false,
        operationAccountId: compteOperationId,
        treasuryAccountId: null,
        thirdPartyAccountId: c411.id,
      },
    }
  }

  if (typeOperation === 'DEPENSE') {
    if (!compteOperationId) {
      return { ok: false, error: 'Veuillez choisir la catégorie (charge).' }
    }
    if (dejaRegle) {
      if (!comptePaiementId) {
        return { ok: false, error: 'Veuillez choisir le moyen de paiement.' }
      }
      return {
        ok: true,
        counterpartyId: supplierId,
        journalId,
        lignesToSubmit: [
          { compteId: compteOperationId, debit: normalizedAmount, credit: 0 },
          { compteId: comptePaiementId, debit: 0, credit: normalizedAmount },
        ],
      }
    }
    if (!supplierId) {
      return { ok: false, error: 'Veuillez choisir ou créer un fournisseur pour une dette fournisseur.' }
    }
    const c401 = findThirdPartyAccount(comptes, '401')
    if (!c401) {
      return { ok: false, error: 'Le compte 401 (Fournisseurs) est absent du plan de cet exercice.' }
    }
    return {
      ok: true,
      counterpartyId: supplierId,
      journalId: journalByCode('AC') || journalId,
      lignesToSubmit: [
        { compteId: compteOperationId, debit: normalizedAmount, credit: 0 },
        { compteId: c401.id, debit: 0, credit: normalizedAmount },
      ],
    }
  }

  if (typeOperation === 'RECETTE') {
    if (!compteOperationId) {
      return { ok: false, error: 'Veuillez choisir la catégorie (produit).' }
    }
    if (dejaRegle) {
      if (!comptePaiementId) {
        return { ok: false, error: 'Veuillez choisir le moyen de paiement.' }
      }
      return {
        ok: true,
        counterpartyId: customerId,
        journalId,
        lignesToSubmit: [
          { compteId: comptePaiementId, debit: normalizedAmount, credit: 0 },
          { compteId: compteOperationId, debit: 0, credit: normalizedAmount },
        ],
      }
    }
    if (!customerId) {
      return { ok: false, error: 'Veuillez choisir ou créer un client pour une créance.' }
    }
    const c411 = findThirdPartyAccount(comptes, '411')
    if (!c411) {
      return { ok: false, error: 'Le compte 411 (Clients) est absent du plan de cet exercice.' }
    }
    return {
      ok: true,
      counterpartyId: customerId,
      journalId: journalByCode('VE') || journalId,
      lignesToSubmit: [
        { compteId: c411.id, debit: normalizedAmount, credit: 0 },
        { compteId: compteOperationId, debit: 0, credit: normalizedAmount },
      ],
    }
  }

  return { ok: false, error: 'Type d\'opération non pris en charge.' }
}

export type BuildAdvancedSubmitInput = {
  lignes: LigneForm[]
  isEquilibre: boolean
  totalDebit: number
}

export type BuildAdvancedSubmitResult =
  | { ok: true; lignesToSubmit: LigneForm[] }
  | { ok: false; error: string }

export function buildAdvancedSubmitPayload(input: BuildAdvancedSubmitInput): BuildAdvancedSubmitResult {
  const { lignes, isEquilibre, totalDebit } = input

  if (!isEquilibre) {
    return { ok: false, error: "L'écriture doit être équilibrée (Total Débit = Total Crédit)." }
  }
  if (totalDebit <= 0) {
    return { ok: false, error: 'Le montant doit être strictement supérieur à 0.' }
  }
  if (lignes.some((l) => !l.compteId)) {
    return { ok: false, error: 'Veuillez sélectionner un compte pour toutes les lignes.' }
  }

  return { ok: true, lignesToSubmit: lignes }
}
