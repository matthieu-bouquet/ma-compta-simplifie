// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

export type PaymentAccountSnapshot = {
  accountId: string | null
  accountNumber: string
  accountName: string
}

export type EntryLineForPaymentAccount = {
  accountId?: string | null
  accountNumber: string
  accountName: string
  debitCents: number
  creditCents: number
  payableAllocations?: {
    amountCents?: number
    settlementLine?: {
      entry?: {
        lines?: {
          accountId?: string | null
          accountNumber: string
          accountName: string
        }[]
      }
    }
  }[]
}

function formatPaymentAccountLabel(accountNumber: string, accountName: string): string {
  return `${accountNumber} - ${accountName}`
}

function treasuryLineFromLines(
  lines: { accountId?: string | null; accountNumber: string; accountName: string }[] | undefined,
): PaymentAccountSnapshot | null {
  const line = lines?.find((l) => l.accountNumber.startsWith('5'))
  if (!line) return null
  return {
    accountId: line.accountId ?? null,
    accountNumber: line.accountNumber,
    accountName: line.accountName,
  }
}

export function resolveEntryPaymentAccount(
  entryLines: EntryLineForPaymentAccount[],
): PaymentAccountSnapshot | null {
  const direct = treasuryLineFromLines(entryLines)
  if (direct) return direct

  for (const line of entryLines) {
    const isPayable401 = line.accountNumber.startsWith('401') && line.creditCents > 0
    const isReceivable411 = line.accountNumber.startsWith('411') && line.debitCents > 0
    if (!isPayable401 && !isReceivable411) continue

    for (const alloc of line.payableAllocations ?? []) {
      const settlementTreasury = treasuryLineFromLines(alloc.settlementLine?.entry?.lines)
      if (settlementTreasury) return settlementTreasury
    }
  }

  return null
}

export function paymentAccountLabel(snapshot: PaymentAccountSnapshot | null): string | null {
  if (!snapshot) return null
  return formatPaymentAccountLabel(snapshot.accountNumber, snapshot.accountName)
}
