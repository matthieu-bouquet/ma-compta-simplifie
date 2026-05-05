'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import { deleteBudget } from '@/actions/budgetActions'
import styles from './previsionnel.module.css'

export default function DeleteBudgetButton({
  budgetId,
  budgetName,
  redirectAfterDelete,
  disabled,
}: {
  budgetId: string
  budgetName: string
  /** If set, navigate here after successful delete (e.g. back to list from detail page). */
  redirectAfterDelete?: string
  /** When true, hide the control (e.g. association closed). */
  disabled?: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  if (disabled) return null

  return (
    <ConfirmDialog
      title="Supprimer ce prévisionnel ?"
      description={`Le prévisionnel « ${budgetName} » et toutes ses lignes seront supprimés définitivement.`}
      confirmText="Supprimer"
      confirmTone="danger"
      disabled={pending}
      trigger={({ open }) => (
        <button
          type="button"
          className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
          title="Supprimer"
          aria-label="Supprimer"
          onClick={open}
          disabled={pending}
        >
          <Trash2 size={18} aria-hidden="true" />
        </button>
      )}
      onConfirm={async ({ close }) => {
        setPending(true)
        try {
          const fd = new FormData()
          fd.set('budgetId', budgetId)
          await deleteBudget(fd)
          close()
          if (redirectAfterDelete) {
            router.push(redirectAfterDelete)
          } else {
            router.refresh()
          }
        } finally {
          setPending(false)
        }
      }}
    />
  )
}
