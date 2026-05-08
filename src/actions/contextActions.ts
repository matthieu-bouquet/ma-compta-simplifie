'use server'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'

const COOKIE_NAME = 'currentAssociationId'
const EXERCICE_COOKIE = 'currentExerciceId'

export async function setCurrentAssociationId(associationId: string | null) {
  const store = await cookies()
  if (!associationId) {
    store.delete(COOKIE_NAME)
    store.delete(EXERCICE_COOKIE)
  } else {
    store.set(COOKIE_NAME, associationId, {
      path: '/',
      sameSite: 'lax',
    })

    // Changement de contexte → pré-sélectionner l'exercice le plus proche d'aujourd'hui.
    const fiscalYears = await prisma.fiscalYear.findMany({
      where: { associationId },
      select: { id: true, startDate: true, endDate: true },
      orderBy: { startDate: 'desc' },
    })

    const now = new Date()
    const best = fiscalYears
      .map((fy) => {
        const start = fy.startDate.getTime()
        const end = fy.endDate.getTime()
        const t = now.getTime()
        const distanceMs = t >= start && t <= end ? 0 : Math.min(Math.abs(t - start), Math.abs(t - end))
        return { ...fy, distanceMs }
      })
      .sort((a, b) => {
        if (a.distanceMs !== b.distanceMs) return a.distanceMs - b.distanceMs
        // tie-breaker: most recent start date
        return b.startDate.getTime() - a.startDate.getTime()
      })[0]

    if (best) {
      store.set(EXERCICE_COOKIE, best.id, {
        path: '/',
        sameSite: 'lax',
      })
    } else {
      store.delete(EXERCICE_COOKIE)
    }
  }

  revalidatePath('/')
}

export async function setCurrentExerciceId(exerciceId: string | null) {
  const store = await cookies()
  if (!exerciceId) {
    store.delete(EXERCICE_COOKIE)
  } else {
    store.set(EXERCICE_COOKIE, exerciceId, {
      path: '/',
      sameSite: 'lax',
    })
  }
  revalidatePath('/')
}

