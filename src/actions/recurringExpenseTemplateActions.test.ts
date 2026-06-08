// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { createPrismaClient } from '@/lib/createPrismaClient'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

const writeAuditEvent = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/audit', () => ({
  writeAuditEvent: (...args: unknown[]) => writeAuditEvent(...args),
}))

let currentAssociationId: string | null = null

vi.mock('@/lib/associationContext', () => ({
  getCurrentAssociationId: async () => currentAssociationId,
}))

import {
  createRecurringExpenseTemplate,
  deleteRecurringExpenseTemplate,
  listRecurringExpenseTemplates,
  updateRecurringExpenseTemplate,
} from '@/actions/recurringExpenseTemplateActions'

describe('recurringExpenseTemplateActions', () => {
  beforeEach(() => {
    currentAssociationId = null
    writeAuditEvent.mockClear()
  })

  it('creates template with null amount', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = createPrismaClient(dbUrl)

    try {
      const assoc = await prisma.association.create({ data: { name: 'RET null amount' } })
      currentAssociationId = assoc.id

      const created = await createRecurringExpenseTemplate({
        title: 'Frais bancaires',
        operationType: 'DEPENSE',
        amountCents: null,
        counterpartyId: null,
        operationAccountNumber: '627',
        treasuryAccountNumber: '512',
      })
      expect(created.amountCents).toBeNull()
    } finally {
      await prisma.$disconnect()
    }
  })

  it('creates, lists, updates and deletes a template', async () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeTruthy()

    const prisma = createPrismaClient(dbUrl)

    try {
      const assoc = await prisma.association.create({ data: { name: 'RET actions test' } })
      currentAssociationId = assoc.id

      const created = await createRecurringExpenseTemplate({
        title: 'Loyer mensuel',
        operationType: 'DEPENSE',
        amountCents: 50000,
        counterpartyId: null,
        operationAccountNumber: '601',
        treasuryAccountNumber: '512',
      })
      expect(created.title).toBe('Loyer mensuel')
      expect(created.amountCents).toBe(50000)

      const listed = await listRecurringExpenseTemplates()
      expect(listed.some((t) => t.id === created.id)).toBe(true)

      const updated = await updateRecurringExpenseTemplate({
        id: created.id,
        payload: {
          title: 'Loyer',
          operationType: 'DEPENSE',
          amountCents: 55000,
          counterpartyId: null,
          operationAccountNumber: '601',
          treasuryAccountNumber: null,
        },
      })
      expect(updated.title).toBe('Loyer')
      expect(updated.treasuryAccountNumber).toBeNull()

      await deleteRecurringExpenseTemplate(created.id)
      const gone = await prisma.recurringExpenseTemplate.findUnique({ where: { id: created.id } })
      expect(gone).toBeNull()
      expect(writeAuditEvent).toHaveBeenCalled()
    } finally {
      await prisma.$disconnect()
    }
  })

  it('rejects duplicate title and operation type', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = createPrismaClient(dbUrl)

    try {
      const assoc = await prisma.association.create({ data: { name: 'RET dup test' } })
      currentAssociationId = assoc.id

      await createRecurringExpenseTemplate({
        title: 'Doublon',
        operationType: 'RECETTE',
        amountCents: 1000,
        counterpartyId: null,
        operationAccountNumber: '701',
        treasuryAccountNumber: '512',
      })

      await expect(
        createRecurringExpenseTemplate({
          title: 'Doublon',
          operationType: 'RECETTE',
          amountCents: 2000,
          counterpartyId: null,
          operationAccountNumber: '701',
          treasuryAccountNumber: null,
        }),
      ).rejects.toThrow(/existe déjà/)
    } finally {
      await prisma.$disconnect()
    }
  })

  it('rejects counterparty from another association', async () => {
    const dbUrl = process.env.DATABASE_URL
    const prisma = createPrismaClient(dbUrl)

    try {
      const assocA = await prisma.association.create({ data: { name: 'RET scope A' } })
      const assocB = await prisma.association.create({ data: { name: 'RET scope B' } })
      const supplierB = await prisma.counterparty.create({
        data: { associationId: assocB.id, kind: 'SUPPLIER', name: 'S B' },
      })
      currentAssociationId = assocA.id

      await expect(
        createRecurringExpenseTemplate({
          title: 'Bad CP',
          operationType: 'DEPENSE',
          amountCents: 1000,
          counterpartyId: supplierB.id,
          operationAccountNumber: '601',
          treasuryAccountNumber: null,
        }),
      ).rejects.toThrow(/Tiers introuvable/)
    } finally {
      await prisma.$disconnect()
    }
  })
})
