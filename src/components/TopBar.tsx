// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { prisma } from '@/lib/prisma'
import { getCurrentExerciceId } from '@/lib/exerciceContext'
import TopBarClient from '@/components/TopBarClient'

export default async function TopBar({ currentAssociationId }: { currentAssociationId: string | null }) {
  const currentExerciceId = await getCurrentExerciceId()

  const exercices =
    currentAssociationId
      ? await prisma.fiscalYear.findMany({
          where: { associationId: currentAssociationId },
          orderBy: { startDate: 'desc' },
          select: { id: true, startDate: true, endDate: true, status: true },
        })
      : []

  return (
    <TopBarClient
      currentAssociationId={currentAssociationId}
      currentExerciceId={currentExerciceId}
      exercices={exercices.map((e) => ({
        id: e.id,
        dateDebut: e.startDate.toISOString(),
        dateFin: e.endDate.toISOString(),
        statut: e.status === 'OPEN' ? 'OUVERT' : 'CLOTURE',
      }))}
    />
  )
}

