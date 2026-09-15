'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import forms from '@/components/forms/forms.module.css'
import styles from '../vie-asso.module.css'
import { upsertMembershipSeasonTariff } from '@/actions/seasonActions'
import { centsToEuros, formatEurosFromCents } from '@/lib/money'
import AppSearchableSelect from '@/components/forms/AppSearchableSelect'
import { DUES_ACCOUNT_WITH_COUNTERPART } from '@/lib/membership'
import { DUES_ACCOUNT_SELECT_OPTIONS, duesAccountSelectOption } from '@/lib/vieAssoSelectOptions'
import { appToast } from '@/lib/appToast'

export default function SeasonTariffRow({
  seasonId,
  tariff,
  readOnly = false,
  onSaved,
  onDelete,
}: {
  seasonId: string
  tariff: { id: string; categoryId: string; categoryName: string; amountCents: number; duesAccountNumber: string }
  readOnly?: boolean
  onSaved: () => void
  onDelete: () => Promise<void>
}) {
  const [pending, setPending] = useState(false)
  const [amount, setAmount] = useState(String(centsToEuros(tariff.amountCents)))
  const [account, setAccount] = useState(tariff.duesAccountNumber)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    try {
      await upsertMembershipSeasonTariff({
        seasonId,
        categoryId: tariff.categoryId,
        amountEuros: Number(amount.replace(',', '.')),
        duesAccountNumber: account,
      })
      appToast.success('Tarif enregistré.')
      onSaved()
    } catch (err) {
      appToast.error(err instanceof Error ? err.message : 'Erreur lors de l’enregistrement.')
    } finally {
      setPending(false)
    }
  }

  if (readOnly) {
    return (
      <div className={styles.tariffRow}>
        <div className={styles.tariffRowCategory}>{tariff.categoryName}</div>
        <div className={styles.tariffRowField}>{formatEurosFromCents(tariff.amountCents)}</div>
        <div className={styles.tariffRowField}>{tariff.duesAccountNumber}</div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className={styles.tariffRow}>
      <div className={styles.tariffRowCategory}>{tariff.categoryName}</div>
      <div className={styles.tariffRowField}>
        <span className={styles.tariffRowFieldLabel}>Tarif (€)</span>
        <input
          id={`tariff-amount-${tariff.id}`}
          className={forms.input}
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-label={`Tarif en euros pour ${tariff.categoryName}`}
          required
        />
      </div>
      <div className={styles.tariffRowField}>
        <span className={styles.tariffRowFieldLabel}>Compte</span>
        <AppSearchableSelect
          inputId={`tariff-account-${tariff.id}`}
          aria-label={`Compte cotisation pour ${tariff.categoryName}`}
          options={DUES_ACCOUNT_SELECT_OPTIONS}
          value={duesAccountSelectOption(account)}
          onChange={(next) => setAccount(next ?? DUES_ACCOUNT_WITH_COUNTERPART)}
          placeholder="Compte 756…"
          isClearable={false}
          elevatedZIndex
        />
      </div>
      <div className={styles.tariffRowActions}>
        <button type="submit" className="btn btn-secondary" disabled={pending}>
          Enregistrer
        </button>
        <ConfirmDialog
          title="Supprimer ce tarif ?"
          description="Impossible s’il est déjà utilisé par une adhésion."
          confirmText="Supprimer"
          onConfirm={onDelete}
          trigger={({ open }) => (
            <button
              type="button"
              className={styles.iconBtn}
              onClick={open}
              title="Supprimer le tarif"
              aria-label={`Supprimer ${tariff.categoryName}`}
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          )}
        />
      </div>
    </form>
  )
}
