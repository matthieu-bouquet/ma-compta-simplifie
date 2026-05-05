'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import { deleteBudgetLine } from '@/actions/budgetActions'
import styles from './previsionnel.module.css'

export default function DeleteBudgetLineButton({
  lineId,
  accountLabel,
  disabled,
}: {
  lineId: string
  accountLabel: string
  disabled?: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  if (disabled) return null

  return (
    <ConfirmDialog
      title="Supprimer cette ligne ?"
      description={`La ligne « ${accountLabel} » sera retirée du prévisionnel.`}
      confirmText="Supprimer"
      confirmTone="danger"
      disabled={pending}
      trigger={({ open }) => (
        <button
          type="button"
          className={styles.iconBtn}
          title="Supprimer la ligne"
          aria-label="Supprimer la ligne"
          onClick={open}
          disabled={pending}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      )}
      onConfirm={async ({ close }) => {
        setPending(true)
        try {
          const fd = new FormData()
          fd.set('lineId', lineId)
          await deleteBudgetLine(fd)
          close()
          router.refresh()
        } finally {
          setPending(false)
        }
      }}
    />
  )
}
