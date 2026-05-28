// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { PrismaClient } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { writeAuditEvent } from '@/lib/audit'

describe('writeAuditEvent', () => {
  it('persists an audit row with JSON data', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })

    try {
      const assoc = await prisma.association.create({ data: { name: 'Audit lib test' } })

      await writeAuditEvent(
        {
          associationId: assoc.id,
          fiscalYearId: null,
          actor: assoc.id,
          action: 'TEST_AUDIT',
          entityType: 'Test',
          entityId: 'test-1',
          data: { foo: 'bar' },
        },
        prisma,
      )

      const row = await prisma.auditEvent.findFirst({
        where: { associationId: assoc.id, action: 'TEST_AUDIT' },
      })
      expect(row?.entityType).toBe('Test')
      expect(row?.entityId).toBe('test-1')
      expect(JSON.parse(row!.data as string)).toEqual({ foo: 'bar' })
    } finally {
      await prisma.$disconnect()
    }
  })
})
