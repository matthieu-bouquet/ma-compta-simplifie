'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useEffect } from 'react'
import forms from '@/components/forms/forms.module.css'

export default function ParametresError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="card">
      <h2 className="page-title">Erreur — Paramètres</h2>
      <p className={forms.fieldHint}>Un problème est survenu lors du chargement des paramètres.</p>
      <div className={forms.formActions}>
        <button type="button" className="btn btn-primary" onClick={() => reset()}>
          Réessayer
        </button>
      </div>
    </div>
  )
}
