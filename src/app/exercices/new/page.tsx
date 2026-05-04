'use client'

import { useSearchParams } from 'next/navigation'
import PageBackLink from '@/components/PageBackLink'
import ExerciceForm from '../ExerciceForm'

export default function NewExercicePage() {
  const searchParams = useSearchParams()
  const associationId = searchParams.get('associationId') || undefined

  return (
    <div className="p-6">
      <PageBackLink href="/exercices" aria-label="Retour à la liste des exercices" />
      <h1 className="text-2xl font-bold mb-6">Nouvel exercice comptable</h1>
      <div className="bg-white rounded-lg shadow-md p-6" style={{ maxWidth: '500px' }}>
        <ExerciceForm associationId={associationId} />
      </div>
    </div>
  )
}
