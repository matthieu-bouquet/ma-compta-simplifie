// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { PrismaClient } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

const redirect = vi.fn()

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => redirect(...args),
}))

vi.mock('@/lib/audit', () => ({
  writeAuditEvent: vi.fn(),
}))

let currentAssociationId: string | null = null

vi.mock('@/lib/associationContext', () => ({
  getCurrentAssociationId: async () => currentAssociationId,
}))

import {
  createBudget,
  deleteBudget,
  getBudgetDetail,
  getBudgetsForCurrentAssociation,
} from '@/actions/budgetActions'

describe('budgetActions CRUD', () => {
  beforeEach(() => {
    currentAssociationId = null
    redirect.mockClear()
  })

  it('returns empty list without association', async () => {
    expect(await getBudgetsForCurrentAssociation()).toEqual([])
  })

  it('creates and deletes a budget', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })

    try {
      const assoc = await prisma.association.create({ data: { name: 'Budget CRUD test' } })
      currentAssociationId = assoc.id

      const fd = new FormData()
      fd.set('name', 'Budget 2027')
      fd.set('notes', 'Notes test')

      await createBudget(fd)
      expect(redirect).toHaveBeenCalledWith('/previsionnel')

      const budgets = await getBudgetsForCurrentAssociation()
      expect(budgets.some((b) => b.name === 'Budget 2027')).toBe(true)

      const budget = budgets.find((b) => b.name === 'Budget 2027')!
      const detail = await getBudgetDetail(budget.id)
      expect(detail?.notes).toBe('Notes test')

      const deleteFd = new FormData()
      deleteFd.set('budgetId', budget.id)
      await deleteBudget(deleteFd)

      const after = await getBudgetDetail(budget.id)
      expect(after).toBeNull()
    } finally {
      await prisma.$disconnect()
    }
  })

  it('rejects create without name', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })

    try {
      const assoc = await prisma.association.create({ data: { name: 'Budget invalid' } })
      currentAssociationId = assoc.id

      const fd = new FormData()
      fd.set('name', '   ')
      await expect(createBudget(fd)).rejects.toThrow('nom du prévisionnel')
    } finally {
      await prisma.$disconnect()
    }
  })
})
