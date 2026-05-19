'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useCallback, useId, useRef } from 'react'
import styles from './ConfirmDialog.module.css'

export default function ConfirmDialog({
  title,
  description,
  cancelText = 'Annuler',
  confirmText = 'Confirmer',
  confirmTone = 'danger',
  disabled,
  trigger,
  onConfirm,
}: {
  title: string
  description?: string
  cancelText?: string
  confirmText?: string
  confirmTone?: 'danger' | 'primary'
  disabled?: boolean
  trigger: (opts: { open: () => void }) => React.ReactNode
  onConfirm: (opts: { close: () => void }) => Promise<void> | void
}) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLDialogElement | null>(null)

  const open = useCallback(() => {
    if (!disabled) dialogRef.current?.showModal()
  }, [disabled])
  const close = useCallback(() => {
    dialogRef.current?.close()
  }, [])

  const onBackdropMouseDown = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget && !disabled) close()
  }

  const onCancel = (e: React.SyntheticEvent<HTMLDialogElement>) => {
    if (disabled) e.preventDefault()
  }

  return (
    <>
      {/* Consumers use open in event handlers; trigger render prop cannot be proven to defer invocation. */}
      {/* eslint-disable-next-line react-hooks/refs -- dialogRef is only read when user activates trigger */}
      {trigger({ open })}

      <dialog
        ref={dialogRef}
        className={styles.dialog}
        onMouseDown={onBackdropMouseDown}
        onCancel={onCancel}
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <div className={styles.panel}>
          <div className={styles.body}>
            <button
              type="button"
              onClick={close}
              disabled={disabled}
              className={`btn ${styles.closeBtn}`}
              title="Fermer"
              aria-label="Fermer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <h3 id={titleId} className={styles.title}>
              {title}
            </h3>
            {description ? (
              <p className={styles.description} id={descriptionId}>
                {description}
              </p>
            ) : null}
          </div>

          <div className={styles.footer}>
            <button type="button" onClick={close} disabled={disabled} className={`btn ${styles.cancelBtn}`}>
              {cancelText}
            </button>
            <button
              type="button"
              onClick={() => onConfirm({ close })}
              disabled={disabled}
              className={`btn btn-primary ${confirmTone === 'danger' ? styles.confirmDanger : ''}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </dialog>
    </>
  )
}
