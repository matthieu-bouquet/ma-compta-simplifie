'use client'

import { usePathname } from 'next/navigation'
import ExerciceSwitcher from '@/components/ExerciceSwitcher'
import AssociationSwitcher from '@/components/AssociationSwitcher'

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
    <div className="topbar" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
      <div
        style={{
          width: isExercices ? 'min(420px, 100%)' : 'min(760px, 100%)',
          display: 'flex',
          gap: '0.75rem',
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}
      >
        {!isExercices && <ExerciceSwitcher currentExerciceId={currentExerciceId} exercices={exercices} />}
        <AssociationSwitcher currentAssociationId={currentAssociationId} />
      </div>
    </div>
  )
}

