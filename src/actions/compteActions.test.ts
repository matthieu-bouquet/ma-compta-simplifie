// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { PrismaClient } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

let currentAssociationId: string | null = null

vi.mock('@/lib/associationContext', () => ({
  getCurrentAssociationId: async () => currentAssociationId,
}))

const writeAuditEvent = vi.fn()

vi.mock('@/lib/audit', () => ({
  writeAuditEvent: (...args: unknown[]) => writeAuditEvent(...args),
}))

import {
  createCompteForExercice,
  deleteCompteForExercice,
  updateCompteForExercice,
} from '@/actions/compteActions'

describe('compteActions', () => {
  beforeEach(() => {
    currentAssociationId = null
    writeAuditEvent.mockClear()
  })

  it('creates, updates and deletes an account on open fiscal year', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })

    try {
      const assoc = await prisma.association.create({ data: { name: 'Compte actions' } })
      currentAssociationId = assoc.id
      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: assoc.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
      })

      const fd = new FormData()
      fd.set('exerciceId', fy.id)
      fd.set('numero', '618')
      fd.set('libelle', 'Documentation')
      await createCompteForExercice(fd)

      const acc = await prisma.account.findFirst({
        where: { fiscalYearId: fy.id, number: '618' },
      })
      expect(acc?.name).toBe('Documentation')

      await updateCompteForExercice(fy.id, acc!.id, '618', 'Doc mise à jour')
      const updated = await prisma.account.findUnique({ where: { id: acc!.id } })
      expect(updated?.name).toBe('Doc mise à jour')

      await deleteCompteForExercice(fy.id, acc!.id)
      expect(await prisma.account.findUnique({ where: { id: acc!.id } })).toBeNull()

      expect(writeAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ACCOUNT_CREATE', entityType: 'Account' }),
      )
      expect(writeAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ACCOUNT_UPDATE', entityType: 'Account' }),
      )
      expect(writeAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ACCOUNT_DELETE', entityType: 'Account', entityId: acc!.id }),
      )
    } finally {
      await prisma.$disconnect()
    }
  })

  it('rejects duplicate account number', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })

    try {
      const assoc = await prisma.association.create({ data: { name: 'Dup compte' } })
      currentAssociationId = assoc.id
      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: assoc.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
      })
      await prisma.account.create({
        data: { fiscalYearId: fy.id, number: '512', name: 'Banque' },
      })

      const fd = new FormData()
      fd.set('exerciceId', fy.id)
      fd.set('numero', '512')
      fd.set('libelle', 'Autre banque')
      await expect(createCompteForExercice(fd)).rejects.toThrow('existe déjà')
    } finally {
      await prisma.$disconnect()
    }
  })

  it('rejects mutation on closed fiscal year', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })

    try {
      const assoc = await prisma.association.create({ data: { name: 'Closed FY compte' } })
      currentAssociationId = assoc.id
      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: assoc.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'CLOSED',
        },
      })

      const fd = new FormData()
      fd.set('exerciceId', fy.id)
      fd.set('numero', '601')
      fd.set('libelle', 'Achats')
      await expect(createCompteForExercice(fd)).rejects.toThrow()
    } finally {
      await prisma.$disconnect()
    }
  })
})
