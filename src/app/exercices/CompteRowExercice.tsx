'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useState } from 'react'
import { deleteCompteForExercice, updateCompteForExercice } from '@/actions/compteActions'
import ConfirmDialog from '@/components/ConfirmDialog'

export default function CompteRowExercice({
  exerciceId,
  compte,
  disabled,
}: {
  exerciceId: string
  compte: { id: string; numero: string; libelle: string }
  disabled?: boolean
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [numero, setNumero] = useState(compte.numero)
  const [libelle, setLibelle] = useState(compte.libelle)
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    setLoading(true)
    try {
      await updateCompteForExercice(exerciceId, compte.id, numero, libelle)
      setIsEditing(false)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erreur lors de la modification')
    }
    setLoading(false)
  }

  if (isEditing) {
    return (
      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
        <td style={{ padding: '0.5rem 0' }}>
          <input value={numero} onChange={(e) => setNumero(e.target.value)} style={{ width: '80px', padding: '0.25rem' }} />
        </td>
        <td>
          <input value={libelle} onChange={(e) => setLibelle(e.target.value)} style={{ width: '100%', padding: '0.25rem' }} />
        </td>
        <td style={{ textAlign: 'right', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="btn btn-primary"
            title="Valider"
            aria-label="Valider"
            style={{ padding: '0.35rem', lineHeight: 0 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            disabled={loading}
            className="btn"
            title="Annuler"
            aria-label="Annuler"
            style={{
              padding: '0.35rem',
              border: '1px solid var(--border-color)',
              backgroundColor: 'transparent',
              lineHeight: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr
      data-testid={`exercice-plan-account-row-${compte.numero}`}
      style={{ borderBottom: '1px solid var(--border-color)' }}
    >
      <td style={{ padding: '0.5rem 0', fontWeight: 'bold' }}>{compte.numero}</td>
      <td>{compte.libelle}</td>
      <td style={{ textAlign: 'right', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          disabled={disabled}
          className="btn"
          title="Modifier"
          aria-label="Modifier"
          style={{
            padding: '0.35rem',
            border: '1px solid var(--border-color)',
            backgroundColor: 'transparent',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
          title={`Supprimer le compte ${compte.numero} ?`}
          description="Cette action est définitive."
          confirmText={loading ? 'Suppression…' : 'Supprimer'}
          confirmTone="danger"
          disabled={loading || disabled}
          onConfirm={async () => {
            setLoading(true)
            try {
              await deleteCompteForExercice(exerciceId, compte.id)
            } catch (e: unknown) {
              alert(e instanceof Error ? e.message : 'Erreur lors de la suppression')
            }
            setLoading(false)
          }}
          trigger={({ open }) => (
            <button
              type="button"
              onClick={open}
              disabled={loading || disabled}
              className="btn"
              title="Supprimer"
              aria-label="Supprimer"
              style={{
                padding: '0.35rem',
                border: '1px solid var(--danger)',
                color: 'var(--danger)',
                backgroundColor: 'transparent',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 0,
              }}
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
      </td>
    </tr>
  )
}

