// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { cache } from 'react'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'currentAssociationId'

export const getCurrentAssociationId = cache(async (): Promise<string | null> => {
  const store = await cookies()
  return store.get(COOKIE_NAME)?.value ?? null
})

