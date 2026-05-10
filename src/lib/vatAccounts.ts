// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import type { Prisma } from '@prisma/client'

const VAT_ACCOUNTS: { number: string; name: string }[] = [
  { number: '44566', name: 'TVA déductible sur autres biens et services' },
  { number: '44571', name: 'TVA collectée' },
]

/**
 * Ensures PCG VAT sub-accounts exist on every OPEN fiscal year for the association.
 */
export async function ensureVatAccountsForAssociation(
  db: Prisma.TransactionClient | import('@prisma/client').PrismaClient,
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
