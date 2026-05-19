'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import { deleteExercice } from '@/actions/exerciceActions'
import styles from './DeleteExerciceButton.module.css'

export default function DeleteExerciceButton({ id, dateTexte }: { id: string; dateTexte: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className={styles.wrap}>
      <ConfirmDialog
        title={`Supprimer l'exercice ${dateTexte} ?`}
        description="Cette action est définitive. Toutes les écritures et tous les comptes liés seront effacés."
        confirmText={isPending ? 'Suppression…' : 'Supprimer définitivement'}
        confirmTone="danger"
        disabled={isPending}
        trigger={({ open }) => (
          <button
            type="button"
            className={`btn ${styles.iconBtn}`}
            onClick={open}
            disabled={isPending}
            title="Supprimer"
            aria-label="Supprimer"
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        )}
        onConfirm={({ close }) => {
          setError(null)
          startTransition(async () => {
            try {
              await deleteExercice(id)
              close()
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Erreur lors de la suppression.')
            }
          })
        }}
      />
      {error ? <span className={styles.error}>{error}</span> : null}
    </div>
  )
}
