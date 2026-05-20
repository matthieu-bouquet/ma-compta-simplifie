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
  addPaymentAccount,
  closeFiscalYear,
  createFiscalYear,
  deleteFiscalYear,
  getFiscalYears,
  updateOpeningBalance,
} from '@/actions/exerciceActions'

describe('updateOpeningBalance', () => {
  beforeEach(() => {
    currentAssociationId = null
  })

  it('creates the opening-balance entry dated at fiscal year start (class 5 account)', async () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeTruthy()

    const prisma = new PrismaClient({
      datasources: { db: { url: dbUrl } },
    })

    try {
      const assoc = await prisma.association.create({ data: { name: 'Opening balance test' } })
      currentAssociationId = assoc.id

      const startDate = new Date('2026-01-01')
      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: assoc.id,
          startDate,
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
        select: { id: true },
      })

      const cash = await prisma.account.create({
        data: { fiscalYearId: fy.id, number: '512', name: 'Banque' },
      })

      const fd = new FormData()
      fd.set('exerciceId', fy.id)
      fd.set('compteId', cash.id)
      fd.set('soldeInitial', '100')

      await updateOpeningBalance(fd)

      const entry = await prisma.entry.findFirst({
        where: { fiscalYearId: fy.id, description: { startsWith: 'Opening balance:' } },
        orderBy: { createdAt: 'desc' },
        include: { lines: true },
      })

      expect(entry).toBeTruthy()
      expect(entry?.date.toISOString()).toBe(startDate.toISOString())

      const cashLine = entry?.lines.find((l) => l.accountId === cash.id)
      expect(cashLine).toBeTruthy()
      expect(cashLine?.debitCents).toBe(10000)
      expect(cashLine?.creditCents).toBe(0)

      const obLine = entry?.lines.find((l) => l.accountNumber === '890')
      expect(obLine).toBeTruthy()
      expect(obLine?.debitCents).toBe(0)
      expect(obLine?.creditCents).toBe(10000)
    } finally {
      await prisma.$disconnect()
    }
  })
})

describe('getFiscalYears and deleteFiscalYear', () => {
  beforeEach(() => {
    currentAssociationId = null
  })

  it('lists fiscal years for current association and deletes open year', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })

    try {
      const assoc = await prisma.association.create({ data: { name: 'FY list/delete' } })
      currentAssociationId = assoc.id
      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: assoc.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
      })

      const list = await getFiscalYears()
      expect(list.some((f) => f.id === fy.id)).toBe(true)

      await deleteFiscalYear(fy.id)
      expect(await prisma.fiscalYear.findUnique({ where: { id: fy.id } })).toBeNull()
    } finally {
      await prisma.$disconnect()
    }
  })

  it('rejects delete on closed fiscal year', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })

    try {
      const assoc = await prisma.association.create({ data: { name: 'FY delete closed' } })
      currentAssociationId = assoc.id
      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: assoc.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'CLOSED',
        },
      })

      await expect(deleteFiscalYear(fy.id)).rejects.toThrow('closed')
    } finally {
      await prisma.$disconnect()
    }
  })
})

describe('addPaymentAccount', () => {
  beforeEach(() => {
    currentAssociationId = null
  })

  it('creates class-5 account with opening balance entry', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })

    try {
      const assoc = await prisma.association.create({ data: { name: 'Payment account' } })
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
      fd.set('numero', '531')
      fd.set('libelle', 'Caisse')
      fd.set('soldeInitial', '50')

      await addPaymentAccount(fd)

      const acc = await prisma.account.findFirst({
        where: { fiscalYearId: fy.id, number: '531' },
      })
      expect(acc).toBeTruthy()

      const obEntry = await prisma.entry.findFirst({
        where: { fiscalYearId: fy.id, description: { startsWith: 'Opening balance:' } },
        include: { lines: true },
      })
      expect(obEntry?.lines.some((l) => l.accountNumber === '531' && l.debitCents === 5000)).toBe(true)
    } finally {
      await prisma.$disconnect()
    }
  })
})

describe('closeFiscalYear', () => {
  beforeEach(() => {
    currentAssociationId = null
    writeAuditEvent.mockClear()
  })

  it('sets fiscal year status to CLOSED and writes audit', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })

    try {
      const assoc = await prisma.association.create({ data: { name: 'Close FY test' } })
      currentAssociationId = assoc.id

      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: assoc.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
      })

      await closeFiscalYear(fy.id)

      const updated = await prisma.fiscalYear.findUnique({ where: { id: fy.id } })
      expect(updated?.status).toBe('CLOSED')
      expect(writeAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'FISCAL_YEAR_CLOSE',
          fiscalYearId: fy.id,
        }),
      )
    } finally {
      await prisma.$disconnect()
    }
  })
})

describe('createFiscalYear', () => {
  beforeEach(() => {
    currentAssociationId = null
    writeAuditEvent.mockClear()
  })

  it('stores start/end as the exact calendar dates (no timezone day shift)', async () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeTruthy()

    const prisma = new PrismaClient({
      datasources: { db: { url: dbUrl } },
    })

    try {
      const assoc = await prisma.association.create({ data: { name: 'FY date storage test' } })
      currentAssociationId = assoc.id

      const fd = new FormData()
      fd.set('dateDebut', '2025-09-01')
      fd.set('dateFin', '2026-08-31')

      await createFiscalYear(fd)

      const fy = await prisma.fiscalYear.findFirst({
        where: { associationId: assoc.id, startDate: new Date('2025-09-01'), endDate: new Date('2026-08-31') },
      })
      expect(fy).toBeTruthy()
      expect(fy?.startDate.toISOString().slice(0, 10)).toBe('2025-09-01')
      expect(fy?.endDate.toISOString().slice(0, 10)).toBe('2026-08-31')

      expect(writeAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          associationId: assoc.id,
          fiscalYearId: fy!.id,
          action: 'FISCAL_YEAR_CREATE',
          entityType: 'FiscalYear',
          entityId: fy!.id,
        }),
      )
    } finally {
      await prisma.$disconnect()
    }
  })

  it('requires current association cookie', async () => {
    const fd = new FormData()
    fd.set('dateDebut', '2025-09-01')
    fd.set('dateFin', '2026-08-31')
    await expect(createFiscalYear(fd)).rejects.toThrow('Association non sélectionnée.')
  })

  it('rejects when end date is before start date', async () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeTruthy()

    const prisma = new PrismaClient({
      datasources: { db: { url: dbUrl } },
    })

    try {
      const assoc = await prisma.association.create({ data: { name: 'FY invalid range test' } })
      currentAssociationId = assoc.id

      const fd = new FormData()
      fd.set('dateDebut', '2025-09-01')
      fd.set('dateFin', '2025-08-31')

      await expect(createFiscalYear(fd)).rejects.toThrow('End date cannot be before start date.')
    } finally {
      await prisma.$disconnect()
    }
  })
})

