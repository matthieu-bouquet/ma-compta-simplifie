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
  amountCents: number | null
  counterpartyId: string | null
  operationAccountNumber: string
  treasuryAccountNumber: string | null
  packCode: string | null
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
  amountCents: number | null
  counterpartyId: string | null
  operationAccountNumber: string
  treasuryAccountNumber: string | null
  packCode?: string | null
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
  if (data.amountCents !== null && data.amountCents <= 0) {
    return 'Le montant doit être strictement supérieur à 0.'
  }
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

  const normalizedMontant = state.montant
  const amountCents =
    normalizedMontant > 0 ? eurosToCents(normalizedMontant) : null

  const payload: TemplatePayloadFromSaisie = {
    title: state.libelle.trim(),
    operationType: state.typeOperation,
    amountCents,
    counterpartyId,
    operationAccountNumber,
    treasuryAccountNumber,
    packCode: null,
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

  const montant =
    template.amountCents === null ? 0 : centsToEuros(template.amountCents)

  return {
    state: {
      typeOperation,
      libelle: template.title,
      montant,
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

const OPERATION_TYPE_LABELS: Record<TypeOperation, string> = {
  DEPENSE: 'Dépense',
  RECETTE: 'Recette',
  TRANSFERT: 'Virement',
  REGLEMENT_FOURNISSEUR: 'Règlement fournisseur',
  ENCAISSEMENT_CLIENT: 'Encaissement client',
}

function templateSelectLabel(title: string, operationType: string): string {
  const opLabel =
    OPERATION_TYPE_LABELS[operationType as TypeOperation] ?? operationType
  return `${title} (${opLabel})`
}

export type TemplateSelectGroup = {
  label: string
  options: { value: string; label: string }[]
}

export function buildGroupedTemplateSelectOptions(
  templates: Pick<RecurringExpenseTemplateRecord, 'id' | 'title' | 'operationType' | 'packCode'>[],
  resolvePackName: (packCode: string) => string | null,
  presetPackOrder: string[],
): TemplateSelectGroup[] {
  const byPack = new Map<string | null, typeof templates>()
  for (const template of templates) {
    const key = template.packCode
    const list = byPack.get(key) ?? []
    list.push(template)
    byPack.set(key, list)
  }

  const groups: TemplateSelectGroup[] = []

  for (const packCode of presetPackOrder) {
    const items = byPack.get(packCode)
    if (!items?.length) continue
    groups.push({
      label: resolvePackName(packCode) ?? packCode,
      options: items
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title))
        .map((t) => ({
          value: t.id,
          label: templateSelectLabel(t.title, t.operationType),
        })),
    })
    byPack.delete(packCode)
  }

  for (const [packCode, items] of byPack.entries()) {
    if (!items.length) continue
    const label =
      packCode === null ? 'Mes modèles' : (resolvePackName(packCode) ?? packCode)
    groups.push({
      label,
      options: items
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title))
        .map((t) => ({
          value: t.id,
          label: templateSelectLabel(t.title, t.operationType),
        })),
    })
  }

  return groups
}
