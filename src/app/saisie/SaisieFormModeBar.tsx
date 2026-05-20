'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import type { Dispatch, SetStateAction } from 'react'
import {
  listOpenCustomerReceivables,
  listOpenSupplierPayables,
} from '@/actions/treasuryActions'
import styles from './saisieForm.module.css'
import type { TypeOperation } from './saisieFormTypes'

type TreasuryOpenItems =
  | Awaited<ReturnType<typeof listOpenSupplierPayables>>
  | Awaited<ReturnType<typeof listOpenCustomerReceivables>>
  | null

export default function SaisieFormModeBar({
  mode,
  setMode,
  setTypeOperation,
  setTreasuryAllocationsByLineId,
  setTreasuryOpenItems,
  setTabParam,
}: {
  mode: 'OPERATIONS' | 'TREASURY' | 'AVANCE'
  setMode: (mode: 'OPERATIONS' | 'TREASURY' | 'AVANCE') => void
  setTypeOperation: (op: TypeOperation) => void
  setTreasuryAllocationsByLineId: (v: Record<string, number>) => void
  setTreasuryOpenItems: Dispatch<SetStateAction<TreasuryOpenItems>>
  setTabParam: (tab: 'ops' | 'treasury') => void
}) {
  return (
    <div className={styles.modeBar}>
      <button
        type="button"
        className={`btn ${mode === 'OPERATIONS' ? 'btn-primary' : ''} ${mode === 'OPERATIONS' ? styles.modeBtnActive : ''} ${styles.modeBtn}`}
        onClick={() => {
          setMode('OPERATIONS')
          setTypeOperation('DEPENSE')
          setTabParam('ops')
        }}
      >
        Dépense / recette
      </button>
      <button
        type="button"
        className={`btn ${mode === 'TREASURY' ? 'btn-primary' : ''} ${mode === 'TREASURY' ? styles.modeBtnActive : ''} ${styles.modeBtn}`}
        onClick={() => {
          setMode('TREASURY')
          setTypeOperation('REGLEMENT_FOURNISSEUR')
          setTreasuryAllocationsByLineId({})
          setTreasuryOpenItems(null)
          setTabParam('treasury')
        }}
      >
        Règlement / Encaissement
      </button>
      <button
        type="button"
        className={`btn ${mode === 'AVANCE' ? 'btn-primary' : ''} ${mode === 'AVANCE' ? styles.modeBtnActive : ''} ${styles.modeBtn}`}
        onClick={() => {
          setMode('AVANCE')
          setTabParam('ops')
        }}
      >
        Saisie Avancée (Multiple)
      </button>
    </div>
  )
}
