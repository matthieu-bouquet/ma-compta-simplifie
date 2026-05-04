import { findNetCentsForAccount, type FiscalYearNetTotals } from '@/lib/accountTotals'

export type ForecastVsRealizedKind = 'up' | 'equal' | 'down' | null

/** Compare prévisionnel (unsigned cents) to absolute realized magnitude for the account. */
export function forecastVsRealizedKind(
  forecastCents: number,
  totals: FiscalYearNetTotals,
  accountNumber: string,
): ForecastVsRealizedKind {
  const n = findNetCentsForAccount(totals, accountNumber)
  if (n === null) return null
  const realizedAbs = Math.abs(n)
  const diff = forecastCents - realizedAbs
  if (Math.abs(diff) <= 1) return 'equal'
  if (diff > 0) return 'up'
  return 'down'
}
