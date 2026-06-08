// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { createPrismaClient } from '@/lib/createPrismaClient'
import { describe, expect, it } from 'vitest'
import {
  importAutoSeedEntryTemplatePacks,
  importEntryTemplatePack,
  listImportedPackCodes,
} from '@/lib/entryTemplateImport'

describe('entryTemplateImport', () => {
  it('imports EVENT_MANIFESTATION pack idempotently', async () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeTruthy()
    const prisma = createPrismaClient(dbUrl)

    try {
      const assoc = await prisma.association.create({
        data: { name: 'Import pack test', legalFormCode: 'ASSOCIATION' },
      })

      const first = await importEntryTemplatePack(prisma, assoc.id, 'EVENT_MANIFESTATION')
      expect(first.imported).toBeGreaterThan(0)
      expect(first.skipped).toBe(0)

      const second = await importEntryTemplatePack(prisma, assoc.id, 'EVENT_MANIFESTATION')
      expect(second.imported).toBe(0)
      expect(second.skipped).toBeGreaterThan(0)

      const codes = await listImportedPackCodes(prisma, assoc.id)
      expect(codes).toContain('EVENT_MANIFESTATION')

      const templates = await prisma.recurringExpenseTemplate.findMany({
        where: { associationId: assoc.id, packCode: 'EVENT_MANIFESTATION' },
      })
      expect(templates.every((t) => t.amountCents === null)).toBe(true)
      expect(templates.some((t) => t.title === 'Buvette')).toBe(true)
      expect(
        templates.some((t) => t.title === 'Récompenses (coupes, médailles, diplômes)'),
      ).toBe(true)
    } finally {
      await prisma.$disconnect()
    }
  })

  it('auto-seeds CORE_ASSOCIATION for new associations', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = createPrismaClient(dbUrl)

    try {
      const assoc = await prisma.association.create({
        data: { name: 'Auto seed test', legalFormCode: 'ASSOCIATION' },
      })

      const results = await importAutoSeedEntryTemplatePacks(prisma, assoc.id)
      expect(results.some((r) => r.packCode === 'CORE_ASSOCIATION' && r.imported > 0)).toBe(true)

      const templates = await prisma.recurringExpenseTemplate.findMany({
        where: { associationId: assoc.id, packCode: 'CORE_ASSOCIATION' },
      })
      expect(templates.some((t) => t.title === 'Frais bancaires')).toBe(true)
      expect(templates.some((t) => t.title === 'Don manuel')).toBe(true)
    } finally {
      await prisma.$disconnect()
    }
  })

  it('imports VIE_ASSOCIATIVE pack with transfer and activity templates', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = createPrismaClient(dbUrl)

    try {
      const assoc = await prisma.association.create({
        data: { name: 'Vie associative pack test', legalFormCode: 'ASSOCIATION' },
      })

      const result = await importEntryTemplatePack(prisma, assoc.id, 'VIE_ASSOCIATIVE')
      expect(result.imported).toBe(5)

      const templates = await prisma.recurringExpenseTemplate.findMany({
        where: { associationId: assoc.id, packCode: 'VIE_ASSOCIATIVE' },
      })
      expect(templates.some((t) => t.title === 'Séance / cours (participation payante)')).toBe(true)
      expect(templates.some((t) => t.operationType === 'TRANSFERT')).toBe(true)
    } finally {
      await prisma.$disconnect()
    }
  })
})
