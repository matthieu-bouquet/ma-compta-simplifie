'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useSearchParams } from 'next/navigation'
import PageBackLink from '@/components/PageBackLink'
import ExerciceForm from '../ExerciceForm'
import formStyles from '../exerciceForm.module.css'

export default function NewExercicePage() {
  const searchParams = useSearchParams()
  const associationId = searchParams.get('associationId') || undefined

  return (
    <div className="p-6">
      <PageBackLink href="/exercices" aria-label="Retour à la liste des exercices" />
      <h1 className="text-2xl font-bold mb-6">Nouvel exercice comptable</h1>
      <div className={`bg-white rounded-lg shadow-md p-6 ${formStyles.formCard}`}>
        <ExerciceForm associationId={associationId} />
      </div>
    </div>
  )
}
