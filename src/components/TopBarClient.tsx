'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { usePathname } from 'next/navigation'
import ExerciceSwitcher from '@/components/ExerciceSwitcher'
import AssociationSwitcher from '@/components/AssociationSwitcher'
import styles from './TopBarClient.module.css'

export default function TopBarClient({
  currentAssociationId,
  currentExerciceId,
  exercices,
}: {
  currentAssociationId: string | null
  currentExerciceId: string | null
  exercices: { id: string; dateDebut: string; dateFin: string; statut: string }[]
}) {
  const pathname = usePathname()

  // pas de contexte dans Paramètres
  if (pathname.startsWith('/parametres')) return null
  const isExercices = pathname.startsWith('/exercices')

  return (
    <div className={styles.topbar}>
      <div className={[styles.controls, isExercices ? styles.controlsNarrow : ''].filter(Boolean).join(' ')}>
        {!isExercices && <ExerciceSwitcher currentExerciceId={currentExerciceId} exercices={exercices} />}
        <AssociationSwitcher currentAssociationId={currentAssociationId} />
      </div>
    </div>
  )
}

