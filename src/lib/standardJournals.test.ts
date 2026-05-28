// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { createPrismaClient } from '@/lib/createPrismaClient'
import { describe, expect, it } from 'vitest'
import { ensureStandardJournals, STANDARD_JOURNALS } from '@/lib/standardJournals'

describe('ensureStandardJournals', () => {
  it('upserts all standard journal codes', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = createPrismaClient(dbUrl)

    try {
      await ensureStandardJournals(prisma)
      const codes = STANDARD_JOURNALS.map((j) => j.code)
      const rows = await prisma.journal.findMany({ where: { code: { in: codes } } })
      expect(rows.length).toBe(codes.length)
    } finally {
      await prisma.$disconnect()
    }
  })
})
