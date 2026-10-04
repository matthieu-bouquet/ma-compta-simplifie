// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { cache } from 'react'
import { cookies } from 'next/headers'

export const SEASON_COOKIE_NAME = 'currentSeasonId'

export const getCurrentSeasonId = cache(async (): Promise<string | null> => {
  const store = await cookies()
  return store.get(SEASON_COOKIE_NAME)?.value ?? null
})
