'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useState } from 'react'
import { cloturerExercice } from '@/actions/exerciceActions'
import ConfirmDialog from '@/components/ConfirmDialog'
import styles from './CloturerExerciceButton.module.css'

export default function CloturerExerciceButton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false)

  return (
    <div className={styles.dangerZone}>
      <h3 className={styles.dangerTitle}>Zone de danger</h3>
      <p className={styles.dangerText}>
        La clôture d&apos;un exercice est définitive. Elle verrouille toutes les écritures et empêche toute modification ultérieure.
      </p>
      <ConfirmDialog
        title="Clôturer cet exercice ?"
        description="Cette action est irréversible. Aucune nouvelle écriture ne pourra être ajoutée et les écritures existantes ne pourront plus être modifiées."
        confirmText={loading ? 'Clôture…' : 'Clôturer définitivement'}
        confirmTone="danger"
        disabled={loading}
        onConfirm={async ({ close }) => {
          setLoading(true)
          try {
            await cloturerExercice(id)
            close()
            alert("L'exercice a été clôturé avec succès.")
          } catch (e: unknown) {
            alert(e instanceof Error ? e.message : 'Erreur')
          }
          setLoading(false)
        }}
        trigger={({ open }) => (
          <button onClick={open} disabled={loading} className={`btn ${styles.closeBtn}`}>
            {loading ? 'Clôture en cours...' : 'Clôturer cet exercice'}
          </button>
        )}
      />
    </div>
  )
}
