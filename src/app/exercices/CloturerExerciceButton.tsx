'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useState } from 'react'
import { cloturerExercice } from '@/actions/exerciceActions'
import ConfirmDialog from '@/components/ConfirmDialog'

export default function CloturerExerciceButton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false)

  return (
    <div style={{ marginTop: '3rem', padding: '1.5rem', backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid var(--danger)', borderRadius: '0.5rem' }}>
      <h3 style={{ color: 'var(--danger)', marginBottom: '0.5rem' }}>Zone de danger</h3>
      <p style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
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
          <button
            onClick={open}
            disabled={loading}
            className="btn"
            style={{ backgroundColor: 'var(--danger)', color: 'white', border: 'none' }}
          >
            {loading ? 'Clôture en cours...' : 'Clôturer cet exercice'}
          </button>
        )}
      />
    </div>
  )
}
