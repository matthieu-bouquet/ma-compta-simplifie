'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useRef, useState } from 'react'
import ConfirmDialog from '@/components/ConfirmDialog'
import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { deleteInKindContribution } from '@/actions/inKindContributionActions'
import styles from './benevolat.module.css'

export default function DeleteContributionButton({ id }: { id: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isSubmittingRef = useRef(false)

  return (
    <div className={styles.deleteCellStack}>
      <ConfirmDialog
        title="Supprimer cette saisie ?"
        description="Êtes-vous sûr de vouloir supprimer cette saisie de bénévolat ? Si comptabilisée : contrepassation au journal ; l’écriture initiale (864/875) n’est pas supprimée."
        cancelText="Annuler"
        confirmText={loading ? 'Suppression…' : 'Supprimer'}
        confirmTone="danger"
        disabled={loading}
        trigger={({ open }) => (
          <button
            type="button"
            className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
            title="Supprimer"
            aria-label="Supprimer"
            disabled={loading}
            onClick={open}
          >
            <Trash2 size={18} aria-hidden="true" />
          </button>
        )}
        onConfirm={async ({ close }) => {
          if (isSubmittingRef.current) return
          isSubmittingRef.current = true
          setLoading(true)
          setError(null)
          try {
            await deleteInKindContribution(id)
            close()
            router.refresh()
          } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Erreur lors de la suppression.')
          } finally {
            setLoading(false)
            isSubmittingRef.current = false
          }
        }}
      />
      {error ? (
        <div className={`${styles.deleteError} text-danger`} role="status">
          {error}
        </div>
      ) : null}
    </div>
  )
}
