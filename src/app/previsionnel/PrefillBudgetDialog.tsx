'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { prefillBudgetFromFiscalYear } from '@/actions/budgetActions'
import forms from '@/components/forms/forms.module.css'
import { NumberInput } from '@/components/forms/NumberInput'
import styles from './previsionnel.module.css'

export default function PrefillBudgetDialog({
  budgetId,
  fiscalYears,
  disabled,
}: {
  budgetId: string
  fiscalYears: { id: string; label: string }[]
  disabled?: boolean
}) {
  const router = useRouter()
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const [pending, setPending] = useState(false)

  const open = () => dialogRef.current?.showModal()
  const close = () => dialogRef.current?.close()

  const onBackdropMouseDown = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget && !pending) close()
  }

  if (disabled) return null

  return (
    <>
      <button type="button" className={`btn ${styles.prefillOpenBtn}`} onClick={open}>
        Pré-remplir depuis un exercice
      </button>

      <dialog
        ref={dialogRef}
        onMouseDown={onBackdropMouseDown}
        className={styles.prefillDialog}
        aria-labelledby="prefill-title"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const form = e.currentTarget
            setPending(true)
            try {
              const fd = new FormData(form)
              fd.set('budgetId', budgetId)
              await prefillBudgetFromFiscalYear(fd)
              close()
              form.reset()
              router.refresh()
            } finally {
              setPending(false)
            }
          }}
        >
          <div className={styles.dialogPadding}>
            <h3 id="prefill-title" className={styles.dialogTitle}>
              Pré-remplir le prévisionnel
            </h3>
            <p className={styles.dialogDesc}>
              Les lignes existantes seront remplacées par les montants réalisés de l&apos;exercice choisi,
              multipliés par le coefficient (100 = inchangé, 110 = +10 %).
            </p>
          </div>

          <div className={styles.prefillDialogBody}>
            <div className={forms.field}>
              <label className={forms.label} htmlFor="prefill-source-exercice">
                Exercice source
              </label>
              <select
                id="prefill-source-exercice"
                name="sourceFiscalYearId"
                required
                disabled={pending}
                className={forms.select}
              >
                <option value="">— Choisir —</option>
                {fiscalYears.map((fy) => (
                  <option key={fy.id} value={fy.id}>
                    {fy.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={forms.field}>
              <label className={forms.label} htmlFor="prefill-coefficient">
                Coefficient (%)
              </label>
              <NumberInput
                id="prefill-coefficient"
                name="coefficientPercent"
                min={1}
                max={1000}
                step={1}
                defaultValue={100}
                required
                disabled={pending}
                className={forms.input}
              />
            </div>

            <div className={styles.dialogActions}>
              <button type="button" className="btn" onClick={close} disabled={pending}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={pending}>
                Appliquer
              </button>
            </div>
          </div>
        </form>
      </dialog>
    </>
  )
}
