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

vi.mock('@/lib/audit', () => ({
  writeAuditEvent: vi.fn(),
}))

import {
  cloturerAssociation,
  createAssociation,
  deleteAssociation,
  getAssociation,
  getAssociations,
  updateAssociation,
} from '@/actions/associationActions'

function associationForm(overrides: Record<string, string> = {}) {
  const fd = new FormData()
  fd.set('nom', overrides.nom ?? 'Test Assoc')
  if (overrides.siret) fd.set('siret', overrides.siret)
  if (overrides.legalFormCode) fd.set('legalFormCode', overrides.legalFormCode)
  if (overrides.vatLiable) fd.set('vatLiable', 'on')
  return fd
}

describe('associationActions', () => {
  beforeEach(() => {
    cookieSet.mockClear()
    cookieDelete.mockClear()
  })

  it('createAssociation auto-seeds CORE_ASSOCIATION entry templates', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = createPrismaClient(dbUrl)
    try {
      const created = await createAssociation(associationForm({ nom: 'Auto templates' }))
      const templates = await prisma.recurringExpenseTemplate.findMany({
        where: { associationId: created.id, packCode: 'CORE_ASSOCIATION' },
      })
      expect(templates.length).toBeGreaterThanOrEqual(3)
      expect(templates.some((t) => t.title === 'Frais bancaires' && t.amountCents === null)).toBe(
        true,
      )
    } finally {
      await prisma.$disconnect()
    }
  })

  it('getAssociations maps legacy fields', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = createPrismaClient(dbUrl)
    try {
      await prisma.association.create({ data: { name: 'Listed Assoc' } })
      const rows = await getAssociations()
      const row = rows.find((r) => r.nom === 'Listed Assoc')
      expect(row).toBeTruthy()
      expect(row?.cloturee).toBe(false)
      expect(row?._count.exercices).toBe(0)
    } finally {
      await prisma.$disconnect()
    }
  })

  it('createAssociation sets cookie and rejects duplicate siret', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = createPrismaClient(dbUrl)
    try {
      const fd1 = associationForm({ nom: 'SIRET A', siret: '12345678901234' })
      const created = await createAssociation(fd1)
      expect(cookieSet).toHaveBeenCalledWith('currentAssociationId', created.id, expect.any(Object))

      const fd2 = associationForm({ nom: 'SIRET B', siret: '12345678901234' })
      await expect(createAssociation(fd2)).rejects.toThrow('SIRET')
    } finally {
      await prisma.$disconnect()
    }
  })

  it('getAssociation returns null for unknown id', async () => {
    expect(await getAssociation('00000000-0000-0000-0000-000000000099')).toBeNull()
  })

  it('updateAssociation and cloturerAssociation', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = createPrismaClient(dbUrl)
    try {
      const created = await createAssociation(associationForm({ nom: 'To update' }))
      const fd = associationForm({ nom: 'Updated name' })
      const updated = await updateAssociation(created.id, fd)
      expect(updated.name).toBe('Updated name')

      await prisma.fiscalYear.create({
        data: {
          associationId: created.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
      })

      await cloturerAssociation(created.id)
      const closed = await prisma.association.findUnique({ where: { id: created.id } })
      expect(closed?.isClosed).toBe(true)

      await expect(cloturerAssociation(created.id)).resolves.toBeUndefined()
    } finally {
      await prisma.$disconnect()
    }
  })

  it('deleteAssociation rejects when fiscal years exist', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = createPrismaClient(dbUrl)
    try {
      const created = await createAssociation(associationForm({ nom: 'Has FY' }))
      await prisma.fiscalYear.create({
        data: {
          associationId: created.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
      })
      await expect(deleteAssociation(created.id)).rejects.toThrow('exercice')
    } finally {
      await prisma.$disconnect()
    }
  })

  it('cloturerAssociation rejects association without fiscal year', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = createPrismaClient(dbUrl)
    try {
      const created = await createAssociation(associationForm({ nom: 'No FY close' }))
      await expect(cloturerAssociation(created.id)).rejects.toThrow('aucun exercice')
    } finally {
      await prisma.$disconnect()
    }
  })

  it('deleteAssociation removes association without fiscal years', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = createPrismaClient(dbUrl)
    try {
      const created = await createAssociation(associationForm({ nom: 'No FY delete' }))
      await deleteAssociation(created.id)
      expect(await prisma.association.findUnique({ where: { id: created.id } })).toBeNull()
    } finally {
      await prisma.$disconnect()
    }
  })
})
