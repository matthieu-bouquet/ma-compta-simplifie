'use client'

import { useState, useTransition } from 'react'
import ConfirmDialog from '@/components/ConfirmDialog'
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
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
      <ConfirmDialog
        title="Supprimer le document ?"
        description={`Cette action est irréversible. Document : ${documentLabel}`}
        confirmText={isPending ? 'Suppression…' : 'Supprimer'}
        confirmTone="danger"
        disabled={isPending}
        trigger={({ open }) => (
          <button
            type="button"
            className="btn"
            onClick={open}
            disabled={isPending}
            title="Supprimer"
            aria-label="Supprimer"
            style={{
              padding: '0.35rem',
              border: '1px solid var(--border-color)',
              backgroundColor: 'transparent',
              color: 'var(--danger)',
              lineHeight: 0,
            }}
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
      {error ? (
        <div className="text-danger" style={{ fontSize: '0.85rem', maxWidth: '260px', textAlign: 'right' }}>
          {error}
        </div>
      ) : null}
    </div>
  )
}

