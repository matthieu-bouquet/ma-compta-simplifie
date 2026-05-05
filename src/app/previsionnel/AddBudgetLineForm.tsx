'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import AppSearchableSelect from '@/components/forms/AppSearchableSelect'
import forms from '@/components/forms/forms.module.css'
import { upsertBudgetLine } from '@/actions/budgetActions'
import styles from './previsionnel.module.css'

type EligibleGlobalAccount = { number: string; name: string }

export default function AddBudgetLineForm({
  budgetId,
  eligibleAccounts,
  canEdit,
}: {
  budgetId: string
  eligibleAccounts: EligibleGlobalAccount[]
  canEdit: boolean
}) {
  const [accountNumber, setAccountNumber] = useState<string | null>(null)
  const [clientError, setClientError] = useState<string | null>(null)

  const options = useMemo(
    () =>
      eligibleAccounts.map((a) => ({
        value: a.number,
        label: `${a.number} — ${a.name}`,
      })),
    [eligibleAccounts],
  )

  const selectedOption = useMemo(
    () => options.find((o) => o.value === accountNumber) ?? null,
    [options, accountNumber],
  )

  return (
    <div className={styles.addLineCardInner}>
      <form
        action={upsertBudgetLine}
        className={styles.addLineGrid}
        onSubmit={(e) => {
          if (!canEdit) {
            e.preventDefault()
            return
          }
          if (!accountNumber?.trim()) {
            e.preventDefault()
            setClientError('Choisissez un compte dans la liste.')
            return
          }
          setClientError(null)
        }}
      >
        <input type="hidden" name="budgetId" value={budgetId} />
        <input type="hidden" name="accountNumber" value={accountNumber ?? ''} />
        <div className={forms.field}>
          <label className={forms.label} htmlFor="add-budget-account">
            Compte (plan comptable global)
          </label>
          <AppSearchableSelect
            id="add-budget-account"
            inputId="add-budget-account"
            options={options}
            value={selectedOption}
            onChange={(v) => {
              setAccountNumber(v)
              setClientError(null)
            }}
            placeholder="Rechercher un numéro ou un libellé…"
            isClearable
            isDisabled={!canEdit}
            noOptionsMessage={() => 'Aucun compte éligible'}
            elevatedZIndex
          />
        </div>
        <div className={forms.field}>
          <label className={forms.label} htmlFor="add-budget-amount">
            Montant prévisionnel (€)
          </label>
          <input
            id="add-budget-amount"
            name="amountEuros"
            type="number"
            step="0.01"
            min="0"
            defaultValue="0"
            required
            disabled={!canEdit}
            className={forms.input}
          />
        </div>
        {clientError ? (
          <div className={forms.fieldFullWidth}>
            <p className={forms.alertError} role="alert">
              {clientError}
            </p>
          </div>
        ) : null}
        {canEdit ? (
          <div className={styles.addLineSubmitCell}>
            <button type="submit" className={`btn btn-primary ${forms.btnWithLeadingIcon} ${styles.addLineSubmitBtn}`}>
              <Plus size={18} aria-hidden="true" />
              Ajouter la ligne
            </button>
          </div>
        ) : null}
      </form>
    </div>
  )
}
