'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { setCurrentExerciceId } from '@/actions/contextActions'
import { CalendarDays } from 'lucide-react'

export default function ExerciceSwitcher({
  currentExerciceId,
  exercices,
}: {
  currentExerciceId: string | null
  exercices: { id: string; dateDebut: string; dateFin: string; statut: string }[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()
  const value = currentExerciceId ?? ''

  const hideOnExercices = pathname.startsWith('/exercices')
  const hideOnParametres = pathname.startsWith('/parametres')
  if (hideOnParametres || hideOnExercices) return null
  if (!exercices || exercices.length === 0) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
      <span title="Exercice" aria-label="Exercice" style={{ display: 'inline-flex', lineHeight: 0, color: 'var(--text-secondary)' }}>
        <CalendarDays size={16} aria-hidden="true" />
      </span>
      <select
        value={value || exercices[0].id}
        onChange={(e) => {
          const next = e.target.value
          startTransition(async () => {
            await setCurrentExerciceId(next || null)
            router.refresh()
          })
        }}
        disabled={pending}
        style={{
          width: '100%',
          height: '32px',
          borderRadius: '0.5rem',
          border: '1px solid var(--border-color)',
          background: 'white',
          color: 'var(--text-primary)',
          padding: '0 0.55rem',
          outline: 'none',
          fontSize: '0.92rem',
        }}
        aria-label="Sélectionner un exercice"
        title="Sélectionner un exercice"
      >
        {exercices.map((ex) => (
          <option key={ex.id} value={ex.id}>
            {new Date(ex.dateDebut).toLocaleDateString('fr-FR')} → {new Date(ex.dateFin).toLocaleDateString('fr-FR')} ({ex.statut})
          </option>
        ))}
      </select>
    </div>
  )
}

