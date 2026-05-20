// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import type { OpsListRow } from '@/lib/filterOpsListRows'
import {
  paymentAccountLabel,
  resolveEntryPaymentAccount,
  type EntryLineForPaymentAccount,
} from '@/lib/entryPaymentAccount'
import { getOpsLineStatusLabel } from '@/lib/opsStatus'
import { toLocalYmd } from '@/lib/vatStatementPayload'

export type OpsEntryLineFromDb = {
  id: string
  accountNumber: string
  accountName: string
  debitCents: number
  creditCents: number
  documents: { document: { id: string; mimeType: string; originalName: string } }[]
  entry: {
    date: Date
    description: string
    lines: EntryLineForPaymentAccount[]
  }
}

export function mapOpsEntryLineToRow(line: OpsEntryLineFromDb): OpsListRow {
  const entryLines = line.entry.lines
  const payment = resolveEntryPaymentAccount(entryLines)
  const statusLines = entryLines
    .filter((l) => l.accountNumber.startsWith('401') || l.accountNumber.startsWith('411'))
    .map((l) => ({
      accountNumber: l.accountNumber,
      debitCents: l.debitCents,
      creditCents: l.creditCents,
      payableAllocations: (l.payableAllocations ?? []).map((a) => ({
        amountCents: a.amountCents ?? 0,
      })),
    }))

  const libelle = line.entry.description
  const dateIso = toLocalYmd(new Date(line.entry.date))
  const accountLabel = `${line.accountNumber} - ${line.accountName}`
  const document = line.documents[0]?.document ?? null

  return {
    id: line.id,
    dateIso,
    libelle,
    accountNumber: line.accountNumber,
    accountName: line.accountName,
    paymentAccountId: payment?.accountId ?? null,
    paymentAccountLabel: paymentAccountLabel(payment),
    statusLabel: getOpsLineStatusLabel({
      accountNumber: line.accountNumber,
      entryLines: statusLines,
    }),
    debitEuros: line.debitCents > 0 ? line.debitCents / 100 : null,
    creditEuros: line.creditCents > 0 ? line.creditCents / 100 : null,
    hasDocument: document != null,
    documentId: document?.id ?? null,
    documentMimeType: document?.mimeType ?? null,
    documentOriginalName: document?.originalName ?? null,
    ligneSummary: `${new Date(line.entry.date).toLocaleDateString('fr-FR')} · ${libelle} · ${accountLabel}`,
  }
}
