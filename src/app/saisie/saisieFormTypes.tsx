'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { forwardRef } from 'react'

export type Journal = { id: string; code: string; nom: string }
export type Compte = { id: string; numero: string; libelle: string }
export type LigneForm = { compteId: string; debit: number; credit: number }

export type CounterpartyLite = { id: string; name: string; kind: string }

export type TypeOperation =
  | 'DEPENSE'
  | 'RECETTE'
  | 'TRANSFERT'
  | 'REGLEMENT_FOURNISSEUR'
  | 'ENCAISSEMENT_CLIENT'

export const DateInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function DateInput(props, ref) {
    return <input ref={ref} {...props} />
  },
)

export function findThirdPartyAccount(comptes: Compte[], rootPrefix: string): Compte | undefined {
  const exact = comptes.find((c) => c.numero === rootPrefix)
  if (exact) return exact
  return comptes.find((c) => c.numero.startsWith(rootPrefix))
}

export function journalCodeForPayment(compte: Compte | undefined): 'BQ' | 'CA' {
  if (!compte) return 'BQ'
  return compte.numero.startsWith('53') ? 'CA' : 'BQ'
}

export function quickDocOperationLineIndex(op: TypeOperation): number {
  if (op === 'REGLEMENT_FOURNISSEUR') return 0
  if (op === 'ENCAISSEMENT_CLIENT') return 0
  if (op === 'TRANSFERT') return 0
  if (op === 'DEPENSE') return 0
  if (op === 'RECETTE') return 1
  return 0
}
