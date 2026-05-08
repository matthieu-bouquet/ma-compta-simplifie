// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/associationContext', () => ({
  getCurrentAssociationId: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    association: {
      findUnique: vi.fn<(...args: unknown[]) => Promise<{ id: string } | null>>(),
    },
  },
}))

describe('getValidatedCurrentAssociationId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when cookie is missing', async () => {
    const { getCurrentAssociationId } = await import('@/lib/associationContext')
    const { getValidatedCurrentAssociationId } = await import('@/lib/currentAssociationIdValidated')

    vi.mocked(getCurrentAssociationId).mockResolvedValue(null)
    await expect(getValidatedCurrentAssociationId()).resolves.toBeNull()
  })

  it('returns null when entity does not exist', async () => {
    const { getCurrentAssociationId } = await import('@/lib/associationContext')
    const { prisma } = await import('@/lib/prisma')
    const { getValidatedCurrentAssociationId } = await import('@/lib/currentAssociationIdValidated')

    vi.mocked(getCurrentAssociationId).mockResolvedValue('missing-id')
    vi.mocked(prisma.association.findUnique).mockResolvedValue(null)

    await expect(getValidatedCurrentAssociationId()).resolves.toBeNull()
  })

  it('returns id when entity exists', async () => {
    const { getCurrentAssociationId } = await import('@/lib/associationContext')
    const { prisma } = await import('@/lib/prisma')
    const { getValidatedCurrentAssociationId } = await import('@/lib/currentAssociationIdValidated')

    vi.mocked(getCurrentAssociationId).mockResolvedValue('a1')
    vi.mocked(prisma.association.findUnique).mockResolvedValue({ id: 'a1' })

    await expect(getValidatedCurrentAssociationId()).resolves.toBe('a1')
  })
})

