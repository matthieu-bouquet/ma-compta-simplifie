// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type CounterpartyMoveRow = {
  entryId: string
  entryDate: Date
  description: string
  referenceNumber: string | null
  lineAmountSignedCents: number
  debitCents: number
  creditCents: number
}

/**
 * Supplier debt on collective supplier accounts (401…): credits − debits on matching lines.
 */
export async function getSupplierPayableBalanceCents(
  fiscalYearId: string,
  counterpartyId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<number> {
  const lines = await db.entryLine.findMany({
    where: {
      entry: { fiscalYearId, counterpartyId },
      accountNumber: { startsWith: '401' },
    },
    select: { debitCents: true, creditCents: true },
  })
  return lines.reduce((s, l) => s + (l.creditCents - l.debitCents), 0)
}

/**
 * Customer receivable on 411…: debits − credits.
 */
export async function getCustomerReceivableBalanceCents(
  fiscalYearId: string,
  counterpartyId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<number> {
  const lines = await db.entryLine.findMany({
    where: {
      entry: { fiscalYearId, counterpartyId },
      accountNumber: { startsWith: '411' },
    },
    select: { debitCents: true, creditCents: true },
  })
  return lines.reduce((s, l) => s + (l.debitCents - l.creditCents), 0)
}

export async function listSupplier401Movements(
  fiscalYearId: string,
  counterpartyId: string,
  take = 50
): Promise<CounterpartyMoveRow[]> {
  const lines = await prisma.entryLine.findMany({
    where: {
      entry: { fiscalYearId, counterpartyId },
      accountNumber: { startsWith: '401' },
    },
    include: {
      entry: { select: { id: true, date: true, description: true, referenceNumber: true } },
    },
    orderBy: [{ entry: { date: 'desc' } }, { id: 'desc' }],
    take,
  })
  return lines.map((l) => ({
    entryId: l.entry.id,
    entryDate: l.entry.date,
    description: l.entry.description,
    referenceNumber: l.entry.referenceNumber,
    lineAmountSignedCents: l.creditCents - l.debitCents,
    debitCents: l.debitCents,
    creditCents: l.creditCents,
  }))
}

/**
 * Customer receivable lines on 411… for this counterparty (signed: debit − credit).
 */
export async function listCustomer411Movements(
  fiscalYearId: string,
  counterpartyId: string,
  take = 50
): Promise<CounterpartyMoveRow[]> {
  const lines = await prisma.entryLine.findMany({
    where: {
      entry: { fiscalYearId, counterpartyId },
      accountNumber: { startsWith: '411' },
    },
    include: {
      entry: { select: { id: true, date: true, description: true, referenceNumber: true } },
    },
    orderBy: [{ entry: { date: 'desc' } }, { id: 'desc' }],
    take,
  })
  return lines.map((l) => ({
    entryId: l.entry.id,
    entryDate: l.entry.date,
    description: l.entry.description,
    referenceNumber: l.entry.referenceNumber,
    lineAmountSignedCents: l.debitCents - l.creditCents,
    debitCents: l.debitCents,
    creditCents: l.creditCents,
  }))
}

export async function count401LinesWithoutCounterparty(fiscalYearId: string): Promise<number> {
  return prisma.entryLine.count({
    where: {
      accountNumber: { startsWith: '401' },
      entry: { fiscalYearId, counterpartyId: null },
    },
  })
}

export async function count411LinesWithoutCounterparty(fiscalYearId: string): Promise<number> {
  return prisma.entryLine.count({
    where: {
      accountNumber: { startsWith: '411' },
      entry: { fiscalYearId, counterpartyId: null },
    },
  })
}
