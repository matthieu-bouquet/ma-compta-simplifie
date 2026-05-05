'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useRef, useState } from 'react'
import { deleteExercice } from '@/actions/exerciceActions'

export default function DeleteExerciceButton({ id, dateTexte }: { id: string, dateTexte: string }) {
  const [loading, setLoading] = useState(false)
  const dialogRef = useRef<HTMLDialogElement | null>(null)

  const open = () => dialogRef.current?.showModal()
  const close = () => dialogRef.current?.close()

  const confirmDelete = async () => {
    setLoading(true)
    try {
      await deleteExercice(id)
      close()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erreur')
    }
    setLoading(false)
  }

  const onBackdropMouseDown = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget && !loading) close()
  }

  const onCancel = (e: React.SyntheticEvent<HTMLDialogElement>) => {
    // Empêche ESC de fermer pendant suppression
    if (loading) e.preventDefault()
  }

  return (
    <>
      <button
        onClick={open}
        disabled={loading}
        className="btn"
        title="Supprimer"
        aria-label="Supprimer"
        style={{
          border: '1px solid var(--danger)',
          color: 'var(--danger)',
          backgroundColor: 'transparent',
          padding: '0.35rem',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 0,
        }}
      >
        {loading ? (
          <span style={{ fontSize: '0.85rem', lineHeight: 1 }}>…</span>
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
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
        )}
      </button>

      <dialog
        ref={dialogRef}
        onMouseDown={onBackdropMouseDown}
        onCancel={onCancel}
        aria-labelledby={`delete-exercice-title-${id}`}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          border: 'none',
          borderRadius: '0.75rem',
          padding: 0,
          width: 'min(560px, calc(100vw - 2rem))',
          maxHeight: 'calc(100vh - 2rem)',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
          background: 'white',
        }}
      >
        <div style={{ padding: '1.25rem 1.25rem 1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
            <div>
              <h3 id={`delete-exercice-title-${id}`} style={{ margin: 0, fontSize: '1.1rem' }}>
                Supprimer l’exercice {dateTexte} ?
              </h3>
              <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-secondary)' }}>
                Cette action est définitive. Toutes les écritures et tous les comptes liés seront effacés.
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              disabled={loading}
              className="btn"
              title="Fermer"
              aria-label="Fermer"
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
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <div
          style={{
            padding: '0 1.25rem 1.25rem 1.25rem',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
          }}
        >
          <button
            type="button"
            onClick={close}
            disabled={loading}
            className="btn"
            style={{ border: '1px solid var(--border-color)', backgroundColor: 'transparent' }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={confirmDelete}
            disabled={loading}
            className="btn btn-primary"
            style={{
              backgroundColor: 'var(--danger)',
              border: '1px solid var(--danger)',
            }}
          >
            {loading ? 'Suppression…' : 'Supprimer définitivement'}
          </button>
        </div>
      </dialog>

      <style jsx global>{`
        dialog::backdrop {
          background: rgba(0, 0, 0, 0.5);
        }
      `}</style>
    </>
  )
}
