'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useCallback, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import DocumentViewer from './DocumentViewer'
import styles from './DocumentViewerDialog.module.css'

export type DocumentViewerItem = {
  id: string
  mimeType?: string | null
  title: string
}

export default function DocumentViewerDialog({
  documentId,
  mimeType,
  title,
  documents,
  trigger,
  actions,
}: {
  documentId?: string
  mimeType?: string | null
  title?: string
  documents?: DocumentViewerItem[]
  actions?: ReactNode
  trigger: (opts: { open: () => void }) => ReactNode
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const titleId = useId()
  const [visible, setVisible] = useState(false)
  const items: DocumentViewerItem[] =
    documents && documents.length > 0
      ? documents
      : documentId
        ? [{ id: documentId, mimeType, title: title ?? 'Document' }]
        : []
  const dialogTitle = items.length > 1 ? 'Pièces justificatives' : (items[0]?.title ?? title ?? 'Document')

  const open = useCallback(() => {
    dialogRef.current?.showModal()
    setVisible(true)
  }, [])
  const close = useCallback(() => {
    dialogRef.current?.close()
  }, [])
  const onDialogClose = useCallback(() => {
    setVisible(false)
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
        onClose={onDialogClose}
        aria-labelledby={titleId}
      >
        <div className={styles.dialogInner}>
          <div className={styles.dialogHeader}>
            <div className={styles.dialogTitle} id={titleId}>
              {dialogTitle}
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

          <div className={styles.dialogBody}>
            {visible
              ? items.map((document) => (
                  <section key={document.id} className={styles.documentBlock}>
                    {items.length > 1 ? <h3 className={styles.documentName}>{document.title}</h3> : null}
                    <DocumentViewer
                      documentId={document.id}
                      mimeType={document.mimeType}
                      title={document.title}
                      actions={items.length === 1 ? actions : undefined}
                      showHeader={false}
                    />
                  </section>
                ))
              : null}
          </div>
        </div>
      </dialog>
    </>
  )
}

