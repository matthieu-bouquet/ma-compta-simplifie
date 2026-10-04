'use server'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { pickNearestDateRangeItem } from '@/lib/dateRangeSelection'
import { SEASON_COOKIE_NAME } from '@/lib/seasonContext'

const COOKIE_NAME = 'currentAssociationId'
const EXERCICE_COOKIE = 'currentExerciceId'

export async function setCurrentAssociationId(associationId: string | null) {
  const store = await cookies()
  if (!associationId) {
    store.delete(COOKIE_NAME)
    store.delete(EXERCICE_COOKIE)
    store.delete(SEASON_COOKIE_NAME)
  } else {
    store.set(COOKIE_NAME, associationId, {
      path: '/',
      sameSite: 'lax',
    })

    const fiscalYears = await prisma.fiscalYear.findMany({
      where: { associationId },
      select: { id: true, startDate: true, endDate: true },
      orderBy: { startDate: 'desc' },
    })
    const bestFy = pickNearestDateRangeItem(fiscalYears)
    if (bestFy) {
      store.set(EXERCICE_COOKIE, bestFy.id, { path: '/', sameSite: 'lax' })
    } else {
      store.delete(EXERCICE_COOKIE)
    }

    const seasons = await prisma.membershipSeason.findMany({
      where: { associationId },
      select: { id: true, startDate: true, endDate: true },
      orderBy: { startDate: 'desc' },
    })
    const bestSeason = pickNearestDateRangeItem(seasons)
    if (bestSeason) {
      store.set(SEASON_COOKIE_NAME, bestSeason.id, { path: '/', sameSite: 'lax' })
    } else {
      store.delete(SEASON_COOKIE_NAME)
    }
  }
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
}

export async function setCurrentSeasonId(seasonId: string | null) {
  const store = await cookies()
  if (!seasonId) {
    store.delete(SEASON_COOKIE_NAME)
  } else {
    store.set(SEASON_COOKIE_NAME, seasonId, {
      path: '/',
      sameSite: 'lax',
    })
  }
}
