'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { setCurrentExerciceId } from '@/actions/contextActions'
import { CalendarDays } from 'lucide-react'
import AppSearchableSelect from '@/components/forms/AppSearchableSelect'
import styles from './topBarSwitchers.module.css'
import { sortFiscalYearsOpenFirstNewestFirst } from '@/lib/fiscalYearSelection'
import { applyContextChangeAndReload } from '@/lib/reloadAfterContextChange'
import { appToast } from '@/lib/appToast'

export default function ExerciceSwitcher({
  currentExerciceId,
  exercices,
}: {
  currentExerciceId: string | null
  exercices: { id: string; dateDebut: string; dateFin: string; statut: string }[]
}) {
  const pathname = usePathname()
  const [pending, setPending] = useState(false)
  const value = currentExerciceId ?? ''

  const hideOnExercices = pathname.startsWith('/exercices')
  const hideOnParametres = pathname.startsWith('/parametres')

  const options = useMemo(
    () =>
      sortFiscalYearsOpenFirstNewestFirst(exercices ?? []).map((ex) => ({
        value: ex.id,
        label: `${new Date(ex.dateDebut).toLocaleDateString('fr-FR')} → ${new Date(ex.dateFin).toLocaleDateString('fr-FR')} (${ex.statut})`,
      })),
    [exercices],
  )
  const shouldHide = hideOnParametres || hideOnExercices || options.length === 0
  if (shouldHide) return null

  const exerciceIds = new Set((exercices ?? []).map((e) => e.id))
  const defaultOption = options[0] ?? null

  const selectedValue =
    value && exerciceIds.has(value)
      ? {
          value,
          label:
            options.find((o) => o.value === value)?.label ??
            defaultOption?.label ??
            `${new Date(exercices[0].dateDebut).toLocaleDateString('fr-FR')} → ${new Date(exercices[0].dateFin).toLocaleDateString('fr-FR')} (${exercices[0].statut})`,
        }
      : defaultOption

  return (
    <div className={styles.row}>
      <span title="Exercice" aria-label="Exercice" className={styles.icon}>
        <CalendarDays size={16} aria-hidden="true" />
      </span>
      <div className={styles.selectWrap}>
        <AppSearchableSelect
          inputId="topbar-exercice"
          aria-label="Sélectionner un exercice"
          options={options}
          value={selectedValue}
          onChange={(next) => {
            if (!next || next === value || pending) return
            setPending(true)
            void applyContextChangeAndReload(
              () => setCurrentExerciceId(next),
              () => {
                setPending(false)
                appToast.error("Impossible de changer d'exercice.")
              },
            )
          }}
          placeholder="Choisir…"
          isClearable={false}
          isDisabled={pending}
          elevatedZIndex
        />
      </div>
    </div>
  )
}
