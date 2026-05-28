// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import type { Prisma } from '@/lib/db'

const VAT_ACCOUNTS: { number: string; name: string }[] = [
  { number: '44566', name: 'TVA déductible sur autres biens et services' },
  { number: '44571', name: 'TVA collectée' },
]

/** PCG sub-accounts used for VAT lines in the app (export / filters). */
export const VAT_ACCOUNT_NUMBERS: readonly string[] = VAT_ACCOUNTS.map((a) => a.number)

const VAT_ACCOUNT_SET = new Set(VAT_ACCOUNT_NUMBERS)

export function isVatAccountNumber(accountNumber: string): boolean {
  return VAT_ACCOUNT_SET.has(accountNumber)
}

/**
 * Ensures PCG VAT sub-accounts exist on every OPEN fiscal year for the association.
 */
export async function ensureVatAccountsForAssociation(
  db: Prisma.TransactionClient | import('@/lib/db').PrismaClient,
  associationId: string,
): Promise<void> {
  const openYears = await db.fiscalYear.findMany({
    where: { associationId, status: 'OPEN' },
    select: { id: true },
  })

  for (const fy of openYears) {
    for (const va of VAT_ACCOUNTS) {
      const existing = await db.account.findFirst({
        where: { fiscalYearId: fy.id, number: va.number },
      })
      if (!existing) {
        await db.account.create({
          data: {
            fiscalYearId: fy.id,
            number: va.number,
            name: va.name,
          },
        })
      }
    }
  }
}
