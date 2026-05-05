'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useCallback, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import DocumentViewer from './DocumentViewer'
import styles from './DocumentViewerDialog.module.css'

export default function DocumentViewerDialog({
  documentId,
  mimeType,
  title,
  trigger,
  actions,
}: {
  documentId: string
  mimeType?: string | null
  title: string
  actions?: ReactNode
  trigger: (opts: { open: () => void }) => ReactNode
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const titleId = useId()

  const open = useCallback(() => {
    dialogRef.current?.showModal()
  }, [])
  const close = useCallback(() => {
    dialogRef.current?.close()
  }, [])

  const onBackdropMouseDown = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) close()
  }

  return (
    <>
      {/* eslint-disable-next-line react-hooks/refs -- dialogRef is only read when user activates trigger */}
      {trigger({ open })}

      <dialog
        ref={dialogRef}
        className={`${styles.dialog} documentViewerDialog`}
        onMouseDown={onBackdropMouseDown}
        aria-labelledby={titleId}
      >
        <div className={styles.dialogInner}>
          <div className={styles.dialogHeader}>
            <div className={styles.dialogTitle} id={titleId}>
              {title}
            </div>
            <button
              type="button"
              onClick={close}
              className={styles.iconButton}
              title="Fermer"
              aria-label="Fermer"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <DocumentViewer documentId={documentId} mimeType={mimeType} title={title} actions={actions} showHeader={false} />
        </div>
      </dialog>
    </>
  )
}

