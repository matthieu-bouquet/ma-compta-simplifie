import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type AccountTotal = {
  number: string
  name: string
  /** Signed net in centimes (charges/produits convention aligned with bilan page). */
  netCents: number
}

export type FiscalYearNetTotals = {
  charges: AccountTotal[]
  produits: AccountTotal[]
  cvnEmplois: AccountTotal[]
  cvnContributions: AccountTotal[]
}

export type AccountWithLines = {
  number: string
  name: string
  lines: Array<{ debitCents: number; creditCents: number }>
}

/**
 * Pure aggregation used by bilan, budget prefill, and tests.
 */
export function aggregateAccountTotalsFromAccounts(accounts: AccountWithLines[]): FiscalYearNetTotals {
  const charges: AccountTotal[] = []
  const produits: AccountTotal[] = []
  const cvnEmplois: AccountTotal[] = []
  const cvnContributions: AccountTotal[] = []

  for (const account of accounts) {
    const debit = account.lines.reduce((sum, l) => sum + l.debitCents, 0)
    const credit = account.lines.reduce((sum, l) => sum + l.creditCents, 0)

    // Class 8 CVN (86/87) must be evaluated before class 6/7 — e.g. "864" also starts with "6".
    if (account.number.startsWith('86')) {
      const netCents = debit - credit
      if (netCents !== 0) {
        cvnEmplois.push({ number: account.number, name: account.name, netCents })
      }
    } else if (account.number.startsWith('87')) {
      const netCents = credit - debit
      if (netCents !== 0) {
        cvnContributions.push({ number: account.number, name: account.name, netCents })
      }
    } else if (account.number.startsWith('6')) {
      const netCents = debit - credit
      if (netCents !== 0) {
        charges.push({ number: account.number, name: account.name, netCents })
      }
    } else if (account.number.startsWith('7')) {
      const netCents = credit - debit
      if (netCents !== 0) {
        produits.push({ number: account.number, name: account.name, netCents })
      }
    }
  }

  const cmp = (a: AccountTotal, b: AccountTotal) => a.number.localeCompare(b.number)
  charges.sort(cmp)
  produits.sort(cmp)
  cvnEmplois.sort(cmp)
  cvnContributions.sort(cmp)

  return { charges, produits, cvnEmplois, cvnContributions }
}

export function scaleAbsoluteAmountCents(netCents: number, coefficientPercent: number): number {
  return Math.max(0, Math.round((Math.abs(netCents) * coefficientPercent) / 100))
}

/** Builds budget lines (amounts ≥ 0) from fiscal-year totals and a coefficient % (100 = identity). */
export function budgetLinesFromFiscalYearTotals(
  totals: FiscalYearNetTotals,
  coefficientPercent: number,
): Array<{ accountNumber: string; accountName: string; amountCents: number }> {
  const out: Array<{ accountNumber: string; accountName: string; amountCents: number }> = []
  const append = (rows: AccountTotal[]) => {
    for (const r of rows) {
      const amountCents = scaleAbsoluteAmountCents(r.netCents, coefficientPercent)
      if (amountCents > 0) {
        out.push({ accountNumber: r.number, accountName: r.name, amountCents })
      }
    }
  }
  append(totals.charges)
  append(totals.produits)
  append(totals.cvnEmplois)
  append(totals.cvnContributions)
  return out
}

/** Lookup realized net (signed cents) for an account from fiscal-year totals. */
export function findNetCentsForAccount(
  totals: FiscalYearNetTotals,
  accountNumber: string,
): number | null {
  const all = [
    ...totals.charges,
    ...totals.produits,
    ...totals.cvnEmplois,
    ...totals.cvnContributions,
  ]
  const row = all.find((r) => r.number === accountNumber)
  return row === undefined ? null : row.netCents
}

export async function getNetAccountTotalsForFiscalYear(
  fiscalYearId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<FiscalYearNetTotals> {
  const fiscalYear = await db.fiscalYear.findUnique({
    where: { id: fiscalYearId },
    include: {
      accounts: {
        include: { lines: true },
      },
    },
  })

  if (!fiscalYear) {
    return { charges: [], produits: [], cvnEmplois: [], cvnContributions: [] }
  }

  return aggregateAccountTotalsFromAccounts(fiscalYear.accounts)
}
