'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useState } from 'react'
import { updateSoldeInitial } from '@/actions/exerciceActions'
import { deleteCompteForExercice } from '@/actions/compteActions'
import ConfirmDialog from '@/components/ConfirmDialog'
import forms from '@/components/forms/forms.module.css'
import styles from './comptePaiementRow.module.css'

export default function ComptePaiementRow({
  compte,
  soldeDepart,
  exerciceId,
  isCloture,
}: {
  compte: { id: string; numero: string; libelle: string }
  soldeDepart: number
  exerciceId: string
  isCloture: boolean
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    try {
      await updateSoldeInitial(formData)
      setIsEditing(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur')
    }
    setLoading(false)
  }

  return (
    <tr className={styles.row}>
      <td className={styles.tdNum}>{compte.numero}</td>
      <td className={styles.tdLib}>{compte.libelle}</td>
      <td className={styles.tdRight}>
        {error ? <div className={`${forms.alertError} ${styles.inlineAlert}`}>{error}</div> : null}
        {isEditing ? (
          <form onSubmit={handleSubmit} className={styles.editForm}>
            <input type="hidden" name="exerciceId" value={exerciceId} />
            <input type="hidden" name="compteId" value={compte.id} />
            <label className="sr-only" htmlFor={`solde-edit-${compte.id}`}>
              Solde de départ (€)
            </label>
            <input
              id={`solde-edit-${compte.id}`}
              type="number"
              step="0.01"
              name="soldeInitial"
              defaultValue={soldeDepart}
              className={`${forms.input} ${styles.soldeInput}`}
            />
            <button
              type="submit"
              disabled={loading}
              className={`btn btn-primary ${styles.iconBtn}`}
              title="Valider"
              aria-label="Valider"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M20 6L9 17l-5-5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsEditing(false)
                setError(null)
              }}
              disabled={loading}
              className={`btn ${styles.iconBtn}`}
              title="Annuler"
              aria-label="Annuler"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </form>
        ) : (
          <div className={styles.rowActions}>
            <span className={`${styles.balance} ${soldeDepart >= 0 ? styles.balancePos : styles.balanceNeg}`}>
              {soldeDepart.toFixed(2)} €
            </span>
            {!isCloture ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className={`btn ${styles.iconBtn}`}
                  title="Modifier"
                  aria-label="Modifier"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path d="M12 20h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path
                      d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                <ConfirmDialog
                  title={`Supprimer le moyen de paiement ${compte.numero} ?`}
                  description="Cette action est définitive."
                  confirmText={loading ? 'Suppression…' : 'Supprimer'}
                  confirmTone="danger"
                  disabled={loading}
                  onConfirm={async ({ close }) => {
                    setLoading(true)
                    setError(null)
                    try {
                      await deleteCompteForExercice(exerciceId, compte.id)
                      close()
                    } catch (err: unknown) {
                      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression')
                    }
                    setLoading(false)
                  }}
                  trigger={({ open }) => (
                    <button
                      type="button"
                      onClick={open}
                      disabled={loading}
                      className={`btn ${styles.iconBtnDanger}`}
                      title="Supprimer"
                      aria-label="Supprimer"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M10 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path
                          d="M6 7l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  )}
                />
              </>
            ) : null}
          </div>
        )}
      </td>
    </tr>
  )
}
