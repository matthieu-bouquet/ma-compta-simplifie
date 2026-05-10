// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

export type AllocationLike = { amountCents: number }

export type EntryLineLike = {
  accountNumber: string
  debitCents: number
  creditCents: number
  payableAllocations?: AllocationLike[]
}

export function getOpsLineStatusLabel(opts: {
  accountNumber: string
  entryLines: EntryLineLike[]
}): '' | 'À payer' | 'Payé' | 'À percevoir' | 'Perçu' {
  const n = opts.accountNumber
  const lines = opts.entryLines

  if (n.startsWith('6')) {
    const l401 = lines.find((l) => l.accountNumber.startsWith('401') && l.creditCents > 0) ?? null
    if (!l401) return 'Payé'
    const allocated = (l401.payableAllocations ?? []).reduce((s, a) => s + a.amountCents, 0)
    const remaining = l401.creditCents - allocated
    return remaining > 0 ? 'À payer' : 'Payé'
  }

  if (n.startsWith('7')) {
    const l411 = lines.find((l) => l.accountNumber.startsWith('411') && l.debitCents > 0) ?? null
    if (!l411) return 'Perçu'
    const allocated = (l411.payableAllocations ?? []).reduce((s, a) => s + a.amountCents, 0)
    const remaining = l411.debitCents - allocated
    return remaining > 0 ? 'À percevoir' : 'Perçu'
  }

  return ''
}

