// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { PrismaClient } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let currentAssociationId: string | null = null

vi.mock('@/lib/associationContext', () => ({
  getCurrentAssociationId: async () => currentAssociationId,
}))

import { GET as getDocumentsZip } from '@/app/api/exercices/[id]/documents.zip/route'
import { GET as getGrandLivreTva } from '@/app/api/exercices/[id]/grand-livre-tva.csv/route'
import { POST as exportBackup } from '@/app/api/backups/export/route'

describe('API routes auth guards', () => {
  beforeEach(() => {
    currentAssociationId = null
  })

  it('GET documents.zip returns 401 without association', async () => {
    const res = await getDocumentsZip(new Request('http://test'), {
      params: Promise.resolve({ id: 'fy-1' }),
    })
    expect(res.status).toBe(401)
  })

  it('GET grand-livre-tva.csv returns 401 without association', async () => {
    const res = await getGrandLivreTva(new Request('http://test'), {
      params: Promise.resolve({ id: 'fy-1' }),
    })
    expect(res.status).toBe(401)
  })

  it('POST backups/export returns 400 when nothing selected', async () => {
    const res = await exportBackup(
      new Request('http://test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fiscalYearIds: [], budgetIds: [] }),
      }),
    )
    expect(res.status).toBe(400)
  })

  it('GET documents.zip returns 404 for fiscal year owned by another association', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })

    try {
      const owner = await prisma.association.create({ data: { name: 'ZIP owner' } })
      const other = await prisma.association.create({ data: { name: 'ZIP other ctx' } })
      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: owner.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
      })
      currentAssociationId = other.id

      const res = await getDocumentsZip(new Request('http://test'), {
        params: Promise.resolve({ id: fy.id }),
      })
      expect(res.status).toBe(404)
    } finally {
      await prisma.$disconnect()
      currentAssociationId = null
    }
  })

  it('GET documents.zip returns empty zip for fiscal year without documents', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })

    try {
      const assoc = await prisma.association.create({ data: { name: 'ZIP route test' } })
      currentAssociationId = assoc.id
      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: assoc.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
      })

      const res = await getDocumentsZip(new Request('http://test'), {
        params: Promise.resolve({ id: fy.id }),
      })
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toMatch(/zip/)
      const buf = Buffer.from(await res.arrayBuffer())
      expect(buf.length).toBeGreaterThan(0)
    } finally {
      await prisma.$disconnect()
      currentAssociationId = null
    }
  })

  it('GET grand-livre-tva.csv returns 404 when fiscal year belongs to another association', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })

    try {
      const owner = await prisma.association.create({ data: { name: 'TVA owner' } })
      const other = await prisma.association.create({ data: { name: 'TVA other ctx' } })
      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: owner.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
      })
      currentAssociationId = other.id

      const res = await getGrandLivreTva(new Request('http://test'), {
        params: Promise.resolve({ id: fy.id }),
      })
      expect(res.status).toBe(404)
    } finally {
      await prisma.$disconnect()
      currentAssociationId = null
    }
  })

  it('GET grand-livre-tva.csv returns CSV headers for owned fiscal year', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })

    try {
      const assoc = await prisma.association.create({
        data: { name: 'TVA CSV route', vatLiable: true },
      })
      currentAssociationId = assoc.id
      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: assoc.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
      })

      const res = await getGrandLivreTva(new Request('http://test'), {
        params: Promise.resolve({ id: fy.id }),
      })
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toMatch(/csv/)
      const text = await res.text()
      expect(text).toContain('Date')
    } finally {
      await prisma.$disconnect()
      currentAssociationId = null
    }
  })
})
