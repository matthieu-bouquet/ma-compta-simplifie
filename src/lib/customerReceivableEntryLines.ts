// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import type { PrismaClient } from '@/lib/db'

export type CustomerReceivableLineInput = {
  accountId: string
  accountNumber: string
  accountName: string
  amountCents: number
}

export type CustomerReceivableEntryLinesResult = {
  lines: {
    accountId: string
    accountNumber: string
    accountName: string
    debitCents: number
    creditCents: number
  }[]
}

/** Sums invoice line amounts per product account for a single accounting entry. */
export function mergeProductLinesByAccount(
  productLines: CustomerReceivableLineInput[],
): CustomerReceivableLineInput[] {
  const byAccount = new Map<string, CustomerReceivableLineInput>()
  for (const line of productLines) {
    const existing = byAccount.get(line.accountId)
    if (existing) {
      byAccount.set(line.accountId, {
        ...existing,
        amountCents: existing.amountCents + line.amountCents,
      })
    } else {
      byAccount.set(line.accountId, { ...line })
    }
  }
  return Array.from(byAccount.values()).sort((a, b) => a.accountNumber.localeCompare(b.accountNumber))
}

/**
 * Builds balanced entry lines for an unpaid customer invoice (411 debit, product credits).
 */
export async function buildCustomerReceivableEntryLines(
  db: PrismaClient,
  opts: {
    fiscalYearId: string
    receivableAccountId: string
    receivableAccountNumber: string
    receivableAccountName: string
    productLines: CustomerReceivableLineInput[]
  },
): Promise<CustomerReceivableEntryLinesResult> {
  const totalCents = opts.productLines.reduce((sum, l) => sum + l.amountCents, 0)
  if (totalCents <= 0) throw new Error('Le montant total doit être strictement positif.')

  for (const line of opts.productLines) {
    if (line.amountCents <= 0) throw new Error('Chaque ligne doit avoir un montant strictement positif.')
  }

  const mergedProductLines = mergeProductLinesByAccount(opts.productLines)

  for (const line of mergedProductLines) {
    const account = await db.account.findFirst({
      where: { id: line.accountId, fiscalYearId: opts.fiscalYearId },
    })
    if (!account) throw new Error(`Compte produit introuvable: ${line.accountNumber}`)
  }

  const receivable = await db.account.findFirst({
    where: { id: opts.receivableAccountId, fiscalYearId: opts.fiscalYearId },
  })
  if (!receivable) throw new Error('Le compte 411 (Clients) est absent du plan de cet exercice.')

  const lines: CustomerReceivableEntryLinesResult['lines'] = [
    {
      accountId: opts.receivableAccountId,
      accountNumber: opts.receivableAccountNumber,
      accountName: opts.receivableAccountName,
      debitCents: totalCents,
      creditCents: 0,
    },
    ...mergedProductLines.map((l) => ({
      accountId: l.accountId,
      accountNumber: l.accountNumber,
      accountName: l.accountName,
      debitCents: 0,
      creditCents: l.amountCents,
    })),
  ]

  return { lines }
}

export async function findReceivable411Account(
  db: PrismaClient,
  fiscalYearId: string,
): Promise<{ id: string; number: string; name: string } | null> {
  const accounts = await db.account.findMany({
    where: { fiscalYearId, number: { startsWith: '411' } },
    orderBy: { number: 'asc' },
  })
  const exact = accounts.find((a) => a.number === '411')
  return exact ?? accounts[0] ?? null
}
