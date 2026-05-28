// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

/** Stable error codes for accounting guards and server actions (tests, toasts). */
export type AccountingErrorCode =
  | 'FISCAL_YEAR_NOT_WRITABLE'
  | 'FISCAL_YEAR_NOT_FOUND'
  | 'ASSOCIATION_NOT_SELECTED'
  | 'VALIDATION_FAILED'

export class AccountingError extends Error {
  readonly code: AccountingErrorCode

  constructor(code: AccountingErrorCode, message: string) {
    super(message)
    this.name = 'AccountingError'
    this.code = code
  }
}

export function isAccountingError(err: unknown): err is AccountingError {
  return err instanceof AccountingError
}
