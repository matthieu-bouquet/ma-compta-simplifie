// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { entityNameForFilename } from '@/lib/compteResultatPdf'
import { isVatAccountNumber, VAT_ACCOUNT_NUMBERS } from '@/lib/vatAccounts'

const VAT_COLLECTEE = '44571'
const VAT_DED = '44566'

export type VatStatementDetailRow = {
  dateIso: string
  journalCode: string
  referenceNumber: string
  description: string
  accountNumber: string
  accountName: string
  debitEuros: number
  creditEuros: number
}

export type VatStatementAccountSummary = {
  accountNumber: string
  accountName: string
  totalDebitEuros: number
  totalCreditEuros: number
}

export type VatStatementPdfPayload = {
  associationName: string
  dateDebutIso: string
  dateFinIso: string
  summaries: VatStatementAccountSummary[]
  /** Crédits − débits sur 44571 (TVA collectée). */
  netCollectedEuros: number
  /** Débits − crédits sur 44566 (TVA déductible). */
  netDeductibleEuros: number
  /** netCollectedEuros − netDeductibleEuros (positif ≈ net à verser, indicatif). */
  netVatPositionEuros: number
  detailRows: VatStatementDetailRow[]
  fileName: string
}

/** Calendar date in local TZ as YYYY-MM-DD (for comparisons with user input). */
export function toLocalYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseIsoDateStrict(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const dt = new Date(y, mo - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null
  return dt
}

function endOfDayLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

export function validateVatStatementDateRange(
  dateDebutIso: string,
  dateFinIso: string,
  fiscalYearStart: Date,
  fiscalYearEnd: Date,
): void {
  const start = parseIsoDateStrict(dateDebutIso)
  const end = parseIsoDateStrict(dateFinIso)
  if (!start || !end) {
    throw new Error('Dates invalides (format attendu : AAAA-MM-JJ).')
  }
  if (start.getTime() > end.getTime()) {
    throw new Error('La date de début doit précéder la date de fin.')
  }

  const fyStartDay = parseIsoDateStrict(toLocalYmd(fiscalYearStart))
  const fyEndDay = parseIsoDateStrict(toLocalYmd(fiscalYearEnd))
  if (!fyStartDay || !fyEndDay) {
    throw new Error('Exercice invalide.')
  }

  if (start.getTime() < fyStartDay.getTime()) {
    throw new Error('La date de début doit être comprise dans l’exercice.')
  }
  if (end.getTime() > endOfDayLocal(fyEndDay).getTime()) {
    throw new Error('La date de fin doit être comprise dans l’exercice.')
  }
}

export type VatStatementEntryInput = {
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

export function buildVatStatementPdfPayload(opts: {
  associationName: string
  fiscalYearStart: Date
  fiscalYearEnd: Date
  dateDebutIso: string
  dateFinIso: string
  entries: VatStatementEntryInput[]
}): VatStatementPdfPayload {
  validateVatStatementDateRange(opts.dateDebutIso, opts.dateFinIso, opts.fiscalYearStart, opts.fiscalYearEnd)

  const rangeStart = parseIsoDateStrict(opts.dateDebutIso)!
  const rangeEnd = endOfDayLocal(parseIsoDateStrict(opts.dateFinIso)!)

  const detailRows: VatStatementDetailRow[] = []
  const summaryMap = new Map<
    string,
    { accountName: string; debitCents: number; creditCents: number }
  >()

  let collectedDebitCents = 0
  let collectedCreditCents = 0
  let deductibleDebitCents = 0
  let deductibleCreditCents = 0

  for (const e of opts.entries) {
    const t = e.date.getTime()
    if (t < rangeStart.getTime() || t > rangeEnd.getTime()) continue

    for (const line of e.lines) {
      if (!isVatAccountNumber(line.accountNumber)) continue

      const debitEuros = line.debitCents / 100
      const creditEuros = line.creditCents / 100

      detailRows.push({
        dateIso: toLocalYmd(e.date),
        journalCode: e.journal.code,
        referenceNumber: e.referenceNumber ?? '',
        description: e.description ?? '',
        accountNumber: line.accountNumber,
        accountName: line.accountName ?? '',
        debitEuros,
        creditEuros,
      })

      const prev = summaryMap.get(line.accountNumber) ?? {
        accountName: line.accountName ?? '',
        debitCents: 0,
        creditCents: 0,
      }
      prev.debitCents += line.debitCents
      prev.creditCents += line.creditCents
      if (!prev.accountName && line.accountName) prev.accountName = line.accountName
      summaryMap.set(line.accountNumber, prev)

      if (line.accountNumber === VAT_COLLECTEE) {
        collectedDebitCents += line.debitCents
        collectedCreditCents += line.creditCents
      } else if (line.accountNumber === VAT_DED) {
        deductibleDebitCents += line.debitCents
        deductibleCreditCents += line.creditCents
      }
    }
  }

  const summaries: VatStatementAccountSummary[] = VAT_ACCOUNT_NUMBERS.map((num) => {
    const s = summaryMap.get(num)
    return {
      accountNumber: num,
      accountName: s?.accountName ?? (num === VAT_DED ? 'TVA déductible' : 'TVA collectée'),
      totalDebitEuros: (s?.debitCents ?? 0) / 100,
      totalCreditEuros: (s?.creditCents ?? 0) / 100,
    }
  })

  detailRows.sort((a, b) => {
    const c = a.dateIso.localeCompare(b.dateIso)
    if (c !== 0) return c
    return `${a.journalCode}${a.referenceNumber}`.localeCompare(`${b.journalCode}${b.referenceNumber}`)
  })

  const netCollectedEuros = (collectedCreditCents - collectedDebitCents) / 100
  const netDeductibleEuros = (deductibleDebitCents - deductibleCreditCents) / 100
  const netVatPositionEuros = netCollectedEuros - netDeductibleEuros

  const entitySegment = entityNameForFilename(opts.associationName)
  const fileName = `etat_tva_${entitySegment}_${opts.dateDebutIso}_${opts.dateFinIso}.pdf`

  return {
    associationName: opts.associationName,
    dateDebutIso: opts.dateDebutIso,
    dateFinIso: opts.dateFinIso,
    summaries,
    netCollectedEuros,
    netDeductibleEuros,
    netVatPositionEuros,
    detailRows,
    fileName,
  }
}
