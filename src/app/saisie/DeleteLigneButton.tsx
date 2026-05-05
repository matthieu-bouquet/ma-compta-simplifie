'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useRef, useState } from 'react'
import { annulerEcritureByLigneId } from '@/actions/ecritureActions'
import ConfirmDialog from '@/components/ConfirmDialog'
import { useRouter } from 'next/navigation'

export default function DeleteLigneButton({
  ligneId,
}: {
  ligneId: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isSubmittingRef = useRef(false)

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
      <ConfirmDialog
      title="Annuler l’écriture"
      description="Confirmer l’annulation ? Une écriture de contrepassation sera créée."
      cancelText="Fermer"
      confirmText={loading ? 'Annulation…' : "Valider l’annulation"}
      confirmTone="danger"
      disabled={loading}
      onConfirm={async ({ close }) => {
        if (isSubmittingRef.current) return
        isSubmittingRef.current = true
        setLoading(true)
        setError(null)
        try {
          await annulerEcritureByLigneId(ligneId)
          close()
          router.refresh()
        } catch (e: unknown) {
          setError(e instanceof Error ? e.message : "Erreur lors de l'annulation")
        } finally {
          setLoading(false)
          isSubmittingRef.current = false
        }
      }}
      trigger={({ open }) => (
        <button
          type="button"
          onClick={open}
          disabled={loading}
          className="btn"
          title="Annuler"
          aria-label="Annuler"
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
      {error ? (
        <div className="text-danger" style={{ fontSize: '0.85rem', maxWidth: '260px', textAlign: 'right' }}>
          {error}
        </div>
      ) : null}
    </div>
  )
}


