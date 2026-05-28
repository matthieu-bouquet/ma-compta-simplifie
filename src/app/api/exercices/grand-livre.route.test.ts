// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { createPrismaClient } from '@/lib/createPrismaClient'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let currentAssociationId: string | null = null

vi.mock('@/lib/associationContext', () => ({
  getCurrentAssociationId: async () => currentAssociationId,
}))

import { GET as getGrandLivre } from '@/app/api/exercices/[id]/grand-livre.csv/route'

describe('GET /api/exercices/[id]/grand-livre.csv', () => {
  beforeEach(() => {
    currentAssociationId = null
  })

  it('returns 401 without association context', async () => {
    const res = await getGrandLivre(new Request('http://test'), {
      params: Promise.resolve({ id: 'any' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns CSV for owned fiscal year with entries', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = createPrismaClient(dbUrl)

    try {
      const assoc = await prisma.association.create({ data: { name: 'GL export test' } })
      currentAssociationId = assoc.id

      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: assoc.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
      })

      const journal = await prisma.journal.upsert({
        where: { code: 'OD' },
        update: {},
        create: { code: 'OD', name: 'OD' },
      })
      const debit = await prisma.account.create({
        data: { fiscalYearId: fy.id, number: '606', name: 'Achats' },
      })
      const credit = await prisma.account.create({
        data: { fiscalYearId: fy.id, number: '512', name: 'Banque' },
      })

      await prisma.entry.create({
        data: {
          fiscalYearId: fy.id,
          journalId: journal.id,
          date: new Date('2026-02-01'),
          description: 'GL line',
          lines: {
            create: [
              {
                accountId: debit.id,
                accountNumber: debit.number,
                accountName: debit.name,
                debitCents: 1000,
                creditCents: 0,
              },
              {
                accountId: credit.id,
                accountNumber: credit.number,
                accountName: credit.name,
                debitCents: 0,
                creditCents: 1000,
              },
            ],
          },
        },
      })

      const res = await getGrandLivre(new Request('http://test'), {
        params: Promise.resolve({ id: fy.id }),
      })
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toContain('text/csv')
      const body = await res.text()
      expect(body).toContain('GL line')
    } finally {
      await prisma.$disconnect()
    }
  })

  it('returns 404 for fiscal year of another association', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = createPrismaClient(dbUrl)

    try {
      const other = await prisma.association.create({ data: { name: 'Other assoc GL' } })
      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: other.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
      })

      const viewer = await prisma.association.create({ data: { name: 'Viewer assoc GL' } })
      currentAssociationId = viewer.id

      const res = await getGrandLivre(new Request('http://test'), {
        params: Promise.resolve({ id: fy.id }),
      })
      expect(res.status).toBe(404)
    } finally {
      await prisma.$disconnect()
    }
  })
})
