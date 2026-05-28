// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { createPrismaClient } from '@/lib/createPrismaClient'
import { describe, expect, it } from 'vitest'
import { getOrCreateJournalByCode } from '@/lib/journals'

describe('getOrCreateJournalByCode', () => {
  it('returns existing journal by code', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = createPrismaClient(dbUrl)

    try {
      const created = await prisma.journal.upsert({
        where: { code: 'ZZ' },
        update: { name: 'Journal ZZ' },
        create: { code: 'ZZ', name: 'Journal ZZ' },
      })

      const found = await getOrCreateJournalByCode(prisma, { code: 'ZZ', name: 'Other name' })
      expect(found.id).toBe(created.id)
      expect(found.code).toBe('ZZ')
    } finally {
      await prisma.$disconnect()
    }
  })

  it('creates journal when missing', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = createPrismaClient(dbUrl)

    try {
      await prisma.journal.deleteMany({ where: { code: 'ZY' } })
      const created = await getOrCreateJournalByCode(prisma, { code: 'ZY', name: 'Created ZY' })
      expect(created.code).toBe('ZY')
      const row = await prisma.journal.findUnique({ where: { code: 'ZY' } })
      expect(row?.name).toBe('Created ZY')
    } finally {
      await prisma.$disconnect()
    }
  })
})
