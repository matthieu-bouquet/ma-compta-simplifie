// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

/** Stored in DB (SQLite has no native enum). */
export const COUNTERPARTY_KIND_SUPPLIER = 'SUPPLIER'
export const COUNTERPARTY_KIND_CUSTOMER = 'CUSTOMER'

export type CounterpartyKind = typeof COUNTERPARTY_KIND_SUPPLIER | typeof COUNTERPARTY_KIND_CUSTOMER

export function isSupplierAccountNumber(accountNumber: string): boolean {
  return accountNumber.startsWith('401')
}

export function isCustomerAccountNumber(accountNumber: string): boolean {
  return accountNumber.startsWith('411')
}
