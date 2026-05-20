'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { Bookmark } from 'lucide-react'
import forms from '@/components/forms/forms.module.css'
import styles from './saisieForm.module.css'
import { useSaisieFormContext } from './saisieFormContext'

export default function SaisieFormSubmitRow() {
  const {
    mode,
    handleTreasurySave,
    treasuryOpenItems,
    treasuryAllocationMatchesAmount,
    montant,
    isEquilibre,
    totalDebit,
    canSaveAsRecurringTemplate,
    saveAsRecurringTemplate,
  } = useSaisieFormContext()

  return (
        <div className={styles.submitRow}>
          <div className={styles.submitActions}>
            {mode === 'OPERATIONS' ? (
              <button
                type="button"
                className={`btn btn-secondary ${forms.btnWithLeadingIcon}`}
                disabled={!canSaveAsRecurringTemplate}
                title="Enregistrer le formulaire comme modèle"
                onClick={() => void saveAsRecurringTemplate()}
              >
                <Bookmark size={16} aria-hidden="true" />
                Enregistrer comme modèle
              </button>
            ) : null}
            {mode === 'TREASURY' ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={
                  !treasuryOpenItems ||
                  treasuryOpenItems.length === 0 ||
                  !treasuryAllocationMatchesAmount ||
                  montant <= 0
                }
                onClick={handleTreasurySave}
              >
                Enregistrer l&apos;écriture
              </button>
            ) : (
              <button
                type="submit"
                className="btn btn-primary"
                disabled={mode === 'AVANCE' && (!isEquilibre || totalDebit <= 0)}
              >
                Enregistrer l&apos;écriture
              </button>
            )}
          </div>
        </div>
  )
}
