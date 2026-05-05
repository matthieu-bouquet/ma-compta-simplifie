// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { cookies } from 'next/headers'

const COOKIE_NAME = 'currentExerciceId'

export async function getCurrentExerciceId(): Promise<string | null> {
  const store = await cookies()
  return store.get(COOKIE_NAME)?.value ?? null
}

