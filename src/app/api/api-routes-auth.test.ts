// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

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
})
