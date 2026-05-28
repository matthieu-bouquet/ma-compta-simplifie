// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { z } from 'zod'

const entryLineSchema = z.object({
  accountId: z.string().min(1),
  debit: z.number().finite().nonnegative(),
  credit: z.number().finite().nonnegative(),
})

export const createEntryInputSchema = z.object({
  date: z.string().min(1, 'Date is required.'),
  description: z.string().min(1, 'Description is required.'),
  fiscalYearId: z.string().min(1, 'Fiscal year is required.'),
  journalId: z.string().nullable().optional(),
  counterpartyId: z.string().nullable().optional(),
  lines: z.array(entryLineSchema).min(2, 'At least two lines are required.'),
})

export type CreateEntryInput = z.infer<typeof createEntryInputSchema>

const createEntryCoreSchema = z.object({
  date: z.string().min(1, 'Date is required.'),
  description: z.string().min(1, 'Description is required.'),
  fiscalYearId: z.string().min(1, 'Fiscal year is required.'),
})

/** Validates date, description and fiscal year before guards (quick VAT builds lines later). */
export function parseCreateEntryCore(data: {
  date: string
  description: string
  fiscalYearId: string
}) {
  const parsed = createEntryCoreSchema.safeParse(data)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    throw new Error(first?.message ?? 'Invalid entry payload.')
  }
  return parsed.data
}

export function parseCreateEntryInput(data: unknown): CreateEntryInput {
  const parsed = createEntryInputSchema.safeParse(data)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    throw new Error(first?.message ?? 'Invalid entry payload.')
  }
  return parsed.data
}
