// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { createPrismaClient } from '@/lib/createPrismaClient'
import { describe, expect, it } from 'vitest'
import { getBackupSelectionTree } from '@/actions/backupActions'

describe('backupActions', () => {
  it('getBackupSelectionTree returns fiscal years and budgets', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = createPrismaClient(dbUrl)

    try {
      const assoc = await prisma.association.create({ data: { name: 'Backup tree test' } })
      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: assoc.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
      })
      await prisma.budget.create({
        data: { associationId: assoc.id, name: 'Budget backup' },
      })

      const tree = await getBackupSelectionTree()
      const node = tree.find((a) => a.id === assoc.id)
      expect(node).toBeTruthy()
      expect(node!.fiscalYears.some((f) => f.id === fy.id)).toBe(true)
      expect(node!.budgets.some((b) => b.name === 'Budget backup')).toBe(true)
      expect(node!.fiscalYears[0]?.startDate).toMatch(/2026-01-01/)
    } finally {
      await prisma.$disconnect()
    }
  })
})
