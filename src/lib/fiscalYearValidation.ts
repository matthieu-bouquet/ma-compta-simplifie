// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { z } from 'zod'

const fiscalYearIdSchema = z.string().min(1, 'Fiscal year id is required.')

export function parseFiscalYearId(id: string) {
  const parsed = fiscalYearIdSchema.safeParse(id)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid fiscal year id.')
  }
  return parsed.data
}
