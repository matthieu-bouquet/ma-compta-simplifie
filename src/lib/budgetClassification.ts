// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

export type BudgetAccountKind =
  | 'CHARGE'
  | 'PRODUIT'
  | 'CVN_EMPLOI'
  | 'CVN_CONTRIBUTION'
  | 'OTHER'

/**
 * Classifies a PCA account number for budget / income-statement buckets.
 * Order matters: class 86/87 must be checked before class 6/7 prefixes.
 */
export function classifyAccount(accountNumber: string): BudgetAccountKind {
  const n = accountNumber.trim()
  if (n.startsWith('86')) return 'CVN_EMPLOI'
  if (n.startsWith('87')) return 'CVN_CONTRIBUTION'
  if (n.startsWith('6')) return 'CHARGE'
  if (n.startsWith('7')) return 'PRODUIT'
  return 'OTHER'
}
