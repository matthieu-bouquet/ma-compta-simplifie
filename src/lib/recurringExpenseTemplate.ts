// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { eurosToCents, centsToEuros } from '@/lib/money'
import type { TypeOperation } from '@/app/saisie/saisieFormTypes'

export type CompteLite = { id: string; numero: string; libelle: string }

export type RecurringExpenseTemplateRecord = {
  id: string
  associationId: string
  title: string
  operationType: string
  amountCents: number
  counterpartyId: string | null
  operationAccountNumber: string
  treasuryAccountNumber: string | null
}

export type SaisieStateForTemplate = {
  libelle: string
  typeOperation: TypeOperation
  montant: number
  supplierId: string | null
  customerId: string | null
  compteOperationId: string | null
  comptePaiementId: string | null
  dejaRegle: boolean
}

export type TemplatePayloadFromSaisie = {
  title: string
  operationType: TypeOperation
  amountCents: number
  counterpartyId: string | null
  operationAccountNumber: string
  treasuryAccountNumber: string | null
}

export type AppliedSaisieState = {
  typeOperation: TypeOperation
  libelle: string
  montant: number
  supplierId: string | null
  customerId: string | null
  compteOperationId: string | null
  comptePaiementId: string | null
  dejaRegle: boolean
}

export type ApplyTemplateResult = {
  state: AppliedSaisieState
  missingAccountNumbers: string[]
}

const QUICK_OPERATION_TYPES: TypeOperation[] = ['DEPENSE', 'RECETTE', 'TRANSFERT']

export function isQuickOperationType(value: string): value is TypeOperation {
  return (QUICK_OPERATION_TYPES as string[]).includes(value)
}

export function resolveAccountIdByNumber(
  comptes: CompteLite[],
  accountNumber: string,
): string | null {
  const trimmed = accountNumber.trim()
  if (!trimmed) return null
  const exact = comptes.find((c) => c.numero === trimmed)
  if (exact) return exact.id
  const prefix = comptes.find((c) => c.numero.startsWith(trimmed) || trimmed.startsWith(c.numero))
  return prefix?.id ?? null
}

export function accountNumberFromId(
  comptes: CompteLite[],
  accountId: string | null,
): string | null {
  if (!accountId) return null
  return comptes.find((c) => c.id === accountId)?.numero ?? null
}

export function validateTemplatePayload(data: TemplatePayloadFromSaisie): string | null {
  const title = data.title.trim()
  if (!title) return 'Le titre du modèle est requis.'
  if (!isQuickOperationType(data.operationType)) {
    return "Type d'opération invalide."
  }
  if (data.amountCents <= 0) return 'Le montant doit être strictement supérieur à 0.'
  if (!data.operationAccountNumber.trim()) {
    return data.operationType === 'TRANSFERT'
      ? 'Le compte destination est requis.'
      : data.operationType === 'RECETTE'
        ? 'Le compte produit est requis.'
        : 'Le compte charge est requis.'
  }
  if (data.operationType === 'TRANSFERT') {
    if (!data.treasuryAccountNumber?.trim()) {
      return 'Le compte source est requis pour un virement.'
    }
    if (data.treasuryAccountNumber === data.operationAccountNumber) {
      return 'Les comptes source et destination doivent être différents.'
    }
  }
  return null
}

export function buildTemplateFromSaisieState(
  state: SaisieStateForTemplate,
  comptes: CompteLite[],
): { ok: true; data: TemplatePayloadFromSaisie } | { ok: false; error: string } {
  const operationAccountNumber = accountNumberFromId(comptes, state.compteOperationId)
  if (!operationAccountNumber) {
    return {
      ok: false,
      error:
        state.typeOperation === 'TRANSFERT'
          ? 'Veuillez choisir le compte destination.'
          : state.typeOperation === 'RECETTE'
            ? 'Veuillez choisir le compte produit.'
            : 'Veuillez choisir la catégorie (charge).',
    }
  }

  let treasuryAccountNumber: string | null = null
  if (state.typeOperation === 'TRANSFERT' || state.dejaRegle) {
    treasuryAccountNumber = accountNumberFromId(comptes, state.comptePaiementId)
    if (!treasuryAccountNumber) {
      return {
        ok: false,
        error:
          state.typeOperation === 'TRANSFERT'
            ? 'Veuillez choisir le compte source.'
            : 'Veuillez choisir le moyen de paiement.',
      }
    }
  }

  const counterpartyId =
    state.typeOperation === 'DEPENSE'
      ? state.supplierId
      : state.typeOperation === 'RECETTE'
        ? state.customerId
        : null

  const payload: TemplatePayloadFromSaisie = {
    title: state.libelle.trim(),
    operationType: state.typeOperation,
    amountCents: eurosToCents(state.montant),
    counterpartyId,
    operationAccountNumber,
    treasuryAccountNumber,
  }

  const validationError = validateTemplatePayload(payload)
  if (validationError) return { ok: false, error: validationError }

  if (state.typeOperation === 'DEPENSE' && state.dejaRegle && !payload.treasuryAccountNumber) {
    return { ok: false, error: 'Veuillez choisir le moyen de paiement.' }
  }
  if (state.typeOperation === 'RECETTE' && state.dejaRegle && !payload.treasuryAccountNumber) {
    return { ok: false, error: 'Veuillez choisir le compte de trésorerie.' }
  }

  return { ok: true, data: payload }
}

export function applyTemplateToSaisieState(
  template: RecurringExpenseTemplateRecord,
  comptes: CompteLite[],
): ApplyTemplateResult | { ok: false; error: string } {
  if (!isQuickOperationType(template.operationType)) {
    return { ok: false, error: "Type d'opération du modèle invalide." }
  }

  const typeOperation = template.operationType
  const missingAccountNumbers: string[] = []

  const compteOperationId = resolveAccountIdByNumber(comptes, template.operationAccountNumber)
  if (!compteOperationId) missingAccountNumbers.push(template.operationAccountNumber)

  let comptePaiementId: string | null = null
  let dejaRegle = false

  if (typeOperation === 'TRANSFERT') {
    if (template.treasuryAccountNumber) {
      comptePaiementId = resolveAccountIdByNumber(comptes, template.treasuryAccountNumber)
      if (!comptePaiementId) missingAccountNumbers.push(template.treasuryAccountNumber)
    } else {
      missingAccountNumbers.push('(compte source)')
    }
    dejaRegle = true
  } else {
    const hasTreasury = Boolean(template.treasuryAccountNumber?.trim())
    dejaRegle = hasTreasury
    if (hasTreasury && template.treasuryAccountNumber) {
      comptePaiementId = resolveAccountIdByNumber(comptes, template.treasuryAccountNumber)
      if (!comptePaiementId) missingAccountNumbers.push(template.treasuryAccountNumber)
    }
  }

  let supplierId: string | null = null
  let customerId: string | null = null
  if (typeOperation === 'DEPENSE') supplierId = template.counterpartyId
  if (typeOperation === 'RECETTE') customerId = template.counterpartyId

  return {
    state: {
      typeOperation,
      libelle: template.title,
      montant: centsToEuros(template.amountCents),
      supplierId,
      customerId,
      compteOperationId,
      comptePaiementId,
      dejaRegle,
    },
    missingAccountNumbers,
  }
}

export function canBuildTemplateFromSaisie(
  state: SaisieStateForTemplate,
  comptes: CompteLite[],
): boolean {
  return buildTemplateFromSaisieState(state, comptes).ok
}
