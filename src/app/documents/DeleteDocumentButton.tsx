'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useState, useTransition } from 'react'
import ConfirmDialog from '@/components/ConfirmDialog'
import iconStyles from '@/components/iconActionButton.module.css'
import { deleteDocument } from '@/actions/documentActions'
import { Trash2 } from 'lucide-react'

export default function DeleteDocumentButton({
  documentId,
  documentLabel,
}: {
  documentId: string
  documentLabel: string
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className={iconStyles.wrapEnd}>
      <ConfirmDialog
        title="Supprimer le document ?"
        description={`Cette action est irréversible. Document : ${documentLabel}`}
        confirmText={isPending ? 'Suppression…' : 'Supprimer'}
        confirmTone="danger"
        disabled={isPending}
        trigger={({ open }) => (
          <button
            type="button"
            className={`btn ${iconStyles.iconBtnNeutral}`}
            onClick={open}
            disabled={isPending}
            title="Supprimer"
            aria-label="Supprimer"
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        )}
        onConfirm={({ close }) => {
          setError(null)
          startTransition(async () => {
            try {
              await deleteDocument({ documentId })
              close()
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Erreur lors de la suppression.')
            }
          })
        }}
      />
      {error ? <div className={iconStyles.errorEnd}>{error}</div> : null}
    </div>
  )
}
