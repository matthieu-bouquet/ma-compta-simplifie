// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { createPrismaClient } from '@/lib/createPrismaClient'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Readable } from 'node:stream'

let currentAssociationId: string | null = null

vi.mock('@/lib/associationContext', () => ({
  getCurrentAssociationId: async () => currentAssociationId,
}))

vi.mock('@/lib/documentsStorage', () => ({
  createReadStreamForRelativePath: () => Readable.from([Buffer.from('%PDF-1.4\n')]),
  nodeStreamToWeb: (stream: Readable) =>
    new ReadableStream({
      start(controller) {
        stream.on('data', (chunk) => controller.enqueue(chunk))
        stream.on('end', () => controller.close())
        stream.on('error', (err) => controller.error(err))
      },
    }),
}))

import { GET as downloadDocument } from '@/app/api/documents/[id]/download/route'

describe('GET /api/documents/[id]/download', () => {
  beforeEach(() => {
    currentAssociationId = null
  })

  it('returns 401 without association', async () => {
    const res = await downloadDocument(new Request('http://test'), {
      params: Promise.resolve({ id: 'doc-1' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 404 when document belongs to another association', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = createPrismaClient(dbUrl)

    try {
      const owner = await prisma.association.create({ data: { name: 'Doc owner' } })
      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: owner.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
      })
      const doc = await prisma.document.create({
        data: {
          fiscalYearId: fy.id,
          originalName: 'facture.pdf',
          storedName: 'stored.pdf',
          relativePath: '2026/facture.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 12,
        },
      })

      const viewer = await prisma.association.create({ data: { name: 'Doc viewer' } })
      currentAssociationId = viewer.id

      const res = await downloadDocument(new Request('http://test'), {
        params: Promise.resolve({ id: doc.id }),
      })
      expect(res.status).toBe(404)
    } finally {
      await prisma.$disconnect()
    }
  })

  it('streams document for current association', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = createPrismaClient(dbUrl)

    try {
      const assoc = await prisma.association.create({ data: { name: 'Doc download' } })
      currentAssociationId = assoc.id
      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: assoc.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
      })
      const doc = await prisma.document.create({
        data: {
          fiscalYearId: fy.id,
          originalName: 'piece.pdf',
          storedName: 'stored.pdf',
          relativePath: '2026/piece.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 12,
        },
      })

      const res = await downloadDocument(new Request('http://test'), {
        params: Promise.resolve({ id: doc.id }),
      })
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('application/pdf')
      const body = await res.text()
      expect(body).toContain('%PDF')
    } finally {
      await prisma.$disconnect()
    }
  })
})
