// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import type { Prisma, PrismaClient } from '@/lib/db'

export async function getOrCreateJournalByCode(
  db: PrismaClient | Prisma.TransactionClient,
  opts: { code: string; name: string }
) {
  const existing = await db.journal.findUnique({ where: { code: opts.code }, select: { id: true, code: true } })
  if (existing) return existing

  return await db.journal.create({ data: { code: opts.code, name: opts.name }, select: { id: true, code: true } })
}

