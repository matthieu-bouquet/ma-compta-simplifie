'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useRouter } from 'next/navigation'
import forms from '@/components/forms/forms.module.css'

export default function BudgetCompareSelect({
  budgetId,
  fiscalYears,
  compareExerciceId,
}: {
  budgetId: string
  fiscalYears: { id: string; label: string }[]
  compareExerciceId: string | null
}) {
  const router = useRouter()

  return (
    <div className={forms.field}>
      <label className={forms.label} htmlFor="compare-exercice">
        Comparer avec l&apos;exercice (réalisé)
      </label>
      <select
        id="compare-exercice"
        name="compareExercice"
        value={compareExerciceId ?? ''}
        className={forms.select}
        onChange={(e) => {
          const id = e.target.value
          const url = id
            ? `/previsionnel/${budgetId}?compareExerciceId=${encodeURIComponent(id)}`
            : `/previsionnel/${budgetId}`
          router.push(url)
        }}
      >
        <option value="">— Aucune comparaison —</option>
        {fiscalYears.map((fy) => (
          <option key={fy.id} value={fy.id}>
            {fy.label}
          </option>
        ))}
      </select>
    </div>
  )
}
