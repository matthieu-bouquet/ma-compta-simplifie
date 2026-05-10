'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useId, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Paperclip } from 'lucide-react'
import { uploadDocumentForLine } from '@/actions/documentActions'
import forms from '@/components/forms/forms.module.css'
import styles from './AttachDocumentButton.module.css'

export default function AttachDocumentButton({
  ligneId,
  ligneSummary,
}: {
  ligneId: string
  ligneSummary: string
}) {
  const router = useRouter()
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const inputId = useId()

  const open = () => {
    setError(null)
    setFileName('')
    if (inputRef.current) inputRef.current.value = ''
    dialogRef.current?.showModal()
  }

  const close = () => {
    if (isPending) return
    dialogRef.current?.close()
  }

  const onBackdropMouseDown = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget && !isPending) dialogRef.current?.close()
  }

  const onCancel = (e: React.SyntheticEvent<HTMLDialogElement>) => {
    if (isPending) e.preventDefault()
  }

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
        await uploadDocumentForLine({ entryLineId: ligneId, file })
        dialogRef.current?.close()
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur lors de l’upload.')
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        title="Ajouter une pièce justificative"
        aria-label="Ajouter une pièce justificative"
        className={styles.triggerButton}
      >
        <Paperclip size={14} aria-hidden="true" />
      </button>

      <dialog
        ref={dialogRef}
        onMouseDown={onBackdropMouseDown}
        onCancel={onCancel}
        aria-labelledby={`attach-doc-title-${inputId}`}
        className={styles.dialog}
      >
        <form className={styles.dialogForm} onSubmit={onSubmit}>
          <div className={styles.dialogHeader}>
            <div className={styles.dialogHeaderLead}>
              <h3 id={`attach-doc-title-${inputId}`} className={styles.dialogTitle}>
                Ajouter une pièce justificative
              </h3>
              <p className={styles.dialogSummary}>{ligneSummary}</p>
            </div>
            <button
              type="button"
              onClick={close}
              disabled={isPending}
              className={`btn ${styles.closeButton}`}
              title="Fermer"
              aria-label="Fermer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className={styles.body}>
            <label htmlFor={inputId} className={forms.label}>
              Fichier
            </label>
            <div className={styles.fileInputShell}>
              <input
                ref={inputRef}
                id={inputId}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                disabled={isPending}
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
                className={`${forms.fileInput} ${styles.attachDocFileInput}`}
              />
            </div>
            <p className={styles.help}>Formats acceptés : PDF, JPG, PNG, WEBP. Taille max : 20 Mo.</p>
            {fileName ? <p className={styles.help}>Fichier sélectionné : {fileName}</p> : null}
            {error ? <div className={forms.alertError}>{error}</div> : null}
          </div>

          <div className={styles.footer}>
            <button
              type="button"
              onClick={close}
              disabled={isPending}
              className={`btn ${styles.cancelButton}`}
            >
              Annuler
            </button>
            <button type="submit" disabled={isPending} className="btn btn-primary">
              {isPending ? 'Upload…' : 'Uploader'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  )
}
