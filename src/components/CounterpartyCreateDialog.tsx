'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useState } from 'react'
import type { Counterparty } from '@prisma/client'
import { createCounterparty } from '@/actions/counterpartyActions'
import {
  COUNTERPARTY_KIND_CUSTOMER,
  COUNTERPARTY_KIND_SUPPLIER,
  type CounterpartyKind,
} from '@/lib/counterparty'
import forms from '@/components/forms/forms.module.css'
import styles from '@/components/counterpartyCreateDialog.module.css'

export default function CounterpartyCreateDialog({
  kind,
  title,
  isOpen,
  onClose,
  onCreated,
}: {
  kind: CounterpartyKind
  title: string
  isOpen: boolean
  onClose: () => void
  onCreated: (row: Counterparty) => void
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  if (!isOpen) return null

  const kindLabel =
    kind === COUNTERPARTY_KIND_SUPPLIER
      ? 'fournisseur'
      : kind === COUNTERPARTY_KIND_CUSTOMER
        ? 'client'
        : 'tiers'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setPending(true)
    try {
      const created = await createCounterparty({ name, kind })
      onCreated(created)
      setName('')
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={styles.backdrop} role="presentation">
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="counterparty-create-title"
      >
        <h2 id="counterparty-create-title" className={styles.dialogTitle}>
          {title}
        </h2>
        <form onSubmit={handleSubmit} className={styles.form}>
          {error ? <div className={forms.alertError}>{error}</div> : null}
          <div className={forms.field}>
            <label className={forms.label} htmlFor="counterparty-create-name">
              Nom du {kindLabel}
            </label>
            <input
              id="counterparty-create-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={forms.input}
              required
              autoComplete="organization"
            />
          </div>
          <div className={forms.formActions}>
            <button type="button" className={`btn ${forms.btnSecondary}`} onClick={onClose} disabled={pending}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary" disabled={pending}>
              Créer
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
