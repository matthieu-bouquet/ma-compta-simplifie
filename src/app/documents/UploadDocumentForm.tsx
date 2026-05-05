'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useRef, useState, useTransition } from 'react'
import { uploadDocument } from '@/actions/documentActions'
import forms from '@/components/forms/forms.module.css'
import styles from './documentsForms.module.css'

export default function UploadDocumentForm({ exerciceId }: { exerciceId: string }) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const file = inputRef.current?.files?.[0]
    if (!file) {
      setError('Sélectionnez un fichier.')
      return
    }

    startTransition(async () => {
      try {
        await uploadDocument({ fiscalYearId: exerciceId, file })
        if (inputRef.current) inputRef.current.value = ''
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur lors de l’upload.')
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className={styles.uploadRow}>
      <label className="sr-only" htmlFor="documents-upload-file">
        Fichier
      </label>
      <input
        id="documents-upload-file"
        ref={inputRef}
        type="file"
        name="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        disabled={isPending}
        className={`${forms.fileInput} ${styles.uploadFile}`}
      />
      <button className="btn btn-primary" type="submit" disabled={isPending}>
        {isPending ? 'Upload…' : 'Uploader'}
      </button>
      {error ? <div className={`text-danger ${styles.errorLine}`}>{error}</div> : null}
    </form>
  )
}
