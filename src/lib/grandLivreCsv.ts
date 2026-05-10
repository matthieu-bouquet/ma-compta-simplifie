// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

export function csvEscape(v: string): string {
  if (v.includes('"') || v.includes(';') || v.includes('\n') || v.includes('\r')) {
    return `"${v.replace(/"/g, '""')}"`
  }
  return v
}

export function fmtDateIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export type GrandLivreCsvEntry = {
  date: Date
  journal: { code: string }
  referenceNumber: string | null
  description: string | null
  lines: Array<{
    accountNumber: string
    accountName: string | null
    debitCents: number
    creditCents: number
  }>
}

/**
 * Builds grand livre CSV body (with header row). Optional filter applies per line (before debit/credit columns).
 */
export function buildGrandLivreCsv(
  entries: GrandLivreCsvEntry[],
  lineFilter?: (line: GrandLivreCsvEntry['lines'][number]) => boolean,
): string {
  const header = ['Date', 'Journal', 'NumeroPiece', 'Libelle', 'CompteNumero', 'CompteLibelle', 'Debit', 'Credit']

  const lines: string[] = []
  lines.push(header.join(';'))

  for (const e of entries) {
    for (const l of e.lines) {
      if (lineFilter && !lineFilter(l)) continue
      const debit = (l.debitCents / 100).toFixed(2)
      const credit = (l.creditCents / 100).toFixed(2)
      lines.push(
        [
          fmtDateIso(e.date),
          e.journal.code,
          e.referenceNumber ?? '',
          csvEscape(e.description ?? ''),
          l.accountNumber,
          csvEscape(l.accountName ?? ''),
          debit,
          credit,
        ].join(';'),
      )
    }
  }

  return lines.join('\n')
}
