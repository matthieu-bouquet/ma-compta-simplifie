'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { usePathname } from 'next/navigation'
import ExerciceSwitcher from '@/components/ExerciceSwitcher'
import SeasonSwitcher from '@/components/SeasonSwitcher'
import AssociationSwitcher from '@/components/AssociationSwitcher'
import { showExerciceSwitcher, showSeasonSwitcher } from '@/lib/navigationContext'
import styles from './TopBarClient.module.css'

export default function TopBarClient({
  currentAssociationId,
  currentExerciceId,
  currentSeasonId,
  exercices,
  seasons,
}: {
  currentAssociationId: string | null
  currentExerciceId: string | null
  currentSeasonId: string | null
  exercices: { id: string; dateDebut: string; dateFin: string; statut: string }[]
  seasons: { id: string; name: string; startDate: string; endDate: string }[]
}) {
  const pathname = usePathname()

  if (pathname.startsWith('/parametres')) return null

  const showExercice = showExerciceSwitcher(pathname)
  const showSeason = showSeasonSwitcher(pathname)
  const narrow = (showExercice ? 1 : 0) + (showSeason ? 1 : 0) <= 1

  return (
    <div className={styles.topbar}>
      <div className={[styles.controls, narrow ? styles.controlsNarrow : ''].filter(Boolean).join(' ')}>
        {showExercice ? (
          <ExerciceSwitcher currentExerciceId={currentExerciceId} exercices={exercices} />
        ) : null}
        {showSeason ? <SeasonSwitcher currentSeasonId={currentSeasonId} seasons={seasons} /> : null}
        <AssociationSwitcher currentAssociationId={currentAssociationId} />
      </div>
    </div>
  )
}

