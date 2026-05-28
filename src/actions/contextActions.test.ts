// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { createPrismaClient } from '@/lib/createPrismaClient'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const cookieSet = vi.fn()
const cookieDelete = vi.fn()

vi.mock('next/headers', () => ({
  cookies: async () => ({
    set: cookieSet,
    delete: cookieDelete,
  }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { setCurrentAssociationId, setCurrentExerciceId } from '@/actions/contextActions'

describe('contextActions', () => {
  beforeEach(() => {
    cookieSet.mockClear()
    cookieDelete.mockClear()
  })

  it('clears association and exercice cookies when association is null', async () => {
    await setCurrentAssociationId(null)
    expect(cookieDelete).toHaveBeenCalledWith('currentAssociationId')
    expect(cookieDelete).toHaveBeenCalledWith('currentExerciceId')
  })

  it('sets association and nearest fiscal year cookie', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = createPrismaClient(dbUrl)

    try {
      const assoc = await prisma.association.create({ data: { name: 'Context FY pick' } })
      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: assoc.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
      })

      await setCurrentAssociationId(assoc.id)

      expect(cookieSet).toHaveBeenCalledWith('currentAssociationId', assoc.id, expect.any(Object))
      expect(cookieSet).toHaveBeenCalledWith('currentExerciceId', fy.id, expect.any(Object))
    } finally {
      await prisma.$disconnect()
    }
  })

  it('setCurrentExerciceId updates exercice cookie', async () => {
    await setCurrentExerciceId('fy-test-id')
    expect(cookieSet).toHaveBeenCalledWith('currentExerciceId', 'fy-test-id', expect.any(Object))

    await setCurrentExerciceId(null)
    expect(cookieDelete).toHaveBeenCalledWith('currentExerciceId')
  })
})
