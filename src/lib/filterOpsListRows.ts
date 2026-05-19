// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { toLocalYmd } from '@/lib/vatStatementPayload'

export type OpsListRow = {
  id: string
  dateIso: string
  libelle: string
  accountNumber: string
  accountName: string
  paymentAccountId: string | null
  paymentAccountLabel: string | null
  statusLabel: '' | 'À payer' | 'Payé' | 'À percevoir' | 'Perçu'
  debitEuros: number | null
  creditEuros: number | null
  hasDocument: boolean
  ligneSummary: string
}

export type OpsListFilters = {
  paymentAccountId: string | null
  dateFrom: Date | null
  dateTo: Date | null
  libelle: string
}

export function filterOpsListRows(rows: OpsListRow[], filters: OpsListFilters): OpsListRow[] {
  const libelleQ = filters.libelle.trim().toLowerCase()
  const dateFromIso = filters.dateFrom ? toLocalYmd(filters.dateFrom) : null
  const dateToIso = filters.dateTo ? toLocalYmd(filters.dateTo) : null

  return rows.filter((row) => {
    if (filters.paymentAccountId && row.paymentAccountId !== filters.paymentAccountId) {
      return false
    }
    if (dateFromIso && row.dateIso < dateFromIso) return false
    if (dateToIso && row.dateIso > dateToIso) return false
    if (libelleQ && !row.libelle.toLowerCase().includes(libelleQ)) return false
    return true
  })
}
