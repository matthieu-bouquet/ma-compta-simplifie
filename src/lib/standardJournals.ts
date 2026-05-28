// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import type { PrismaClient } from '@/lib/db'

export const STANDARD_JOURNALS: { code: string; name: string }[] = [
  { code: 'AC', name: 'Achats' },
  { code: 'BQ', name: 'Banque' },
  { code: 'CA', name: 'Caisse' },
  { code: 'OD', name: 'Opérations Diverses' },
  { code: 'VE', name: 'Ventes' },
]

type JournalDb = Pick<PrismaClient, '$transaction' | 'journal'>

export async function ensureStandardJournals(db: JournalDb): Promise<void> {
  await db.$transaction(
    STANDARD_JOURNALS.map((j) =>
      db.journal.upsert({
        where: { code: j.code },
        update: { name: j.name },
        create: { code: j.code, name: j.name },
      }),
    ),
  )
}
