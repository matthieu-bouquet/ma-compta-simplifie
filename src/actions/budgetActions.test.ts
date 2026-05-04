import { PrismaClient } from '@prisma/client'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

let mockAssociationId: string | null = null

vi.mock('@/lib/associationContext', () => ({
  getCurrentAssociationId: async () => mockAssociationId,
}))

import { prefillBudgetFromFiscalYear } from '@/actions/budgetActions'

describe('prefillBudgetFromFiscalYear', () => {
  beforeEach(() => {
    mockAssociationId = null
  })

  it('replaces lines using realized totals and coefficient percent', async () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeTruthy()

    const prisma = new PrismaClient({
      datasources: { db: { url: dbUrl } },
    })

    try {
      const assoc = await prisma.association.create({ data: { name: 'Budget prefill test' } })
      mockAssociationId = assoc.id

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
        update: { name: 'Opérations Diverses' },
        create: { code: 'OD', name: 'Opérations Diverses' },
      })

      const acc606 = await prisma.account.create({
        data: { fiscalYearId: fy.id, number: '606', name: 'Fournitures' },
      })
      const acc512 = await prisma.account.create({
        data: { fiscalYearId: fy.id, number: '512', name: 'Banque' },
      })

      await prisma.entry.create({
        data: {
          fiscalYearId: fy.id,
          journalId: journal.id,
          date: new Date('2026-03-01'),
          description: 'Charge test',
          lines: {
            create: [
              {
                accountId: acc606.id,
                accountNumber: acc606.number,
                accountName: acc606.name,
                debitCents: 10000,
                creditCents: 0,
              },
              {
                accountId: acc512.id,
                accountNumber: acc512.number,
                accountName: acc512.name,
                debitCents: 0,
                creditCents: 10000,
              },
            ],
          },
        },
      })

      const budget = await prisma.budget.create({
        data: {
          associationId: assoc.id,
          name: 'Draft',
        },
      })

      await prisma.budgetLine.create({
        data: {
          budgetId: budget.id,
          accountNumber: '740',
          accountName: 'Placeholder',
          amountCents: 999,
        },
      })

      const fd = new FormData()
      fd.set('budgetId', budget.id)
      fd.set('sourceFiscalYearId', fy.id)
      fd.set('coefficientPercent', '110')

      await prefillBudgetFromFiscalYear(fd)

      const lines = await prisma.budgetLine.findMany({
        where: { budgetId: budget.id },
        orderBy: { accountNumber: 'asc' },
      })

      expect(lines.some((l) => l.accountNumber === '740')).toBe(false)

      const l606 = lines.find((l) => l.accountNumber === '606')
      expect(l606).toBeTruthy()
      expect(l606?.amountCents).toBe(11000)

      const updated = await prisma.budget.findUnique({ where: { id: budget.id } })
      expect(updated?.sourceFiscalYearId).toBe(fy.id)
      expect(updated?.sourceCoefficientPercent).toBe(110)
    } finally {
      await prisma.$disconnect()
    }
  })
})
