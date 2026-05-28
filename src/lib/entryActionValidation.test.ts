// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, expect, it } from 'vitest'
import { parseCreateEntryCore, parseCreateEntryInput } from '@/lib/entryActionValidation'

describe('parseCreateEntryCore', () => {
  it('rejects missing fiscal year', () => {
    expect(() =>
      parseCreateEntryCore({
        date: '2026-03-01',
        description: 'Test',
        fiscalYearId: '',
      }),
    ).toThrow(/Fiscal year/)
  })
})

describe('parseCreateEntryInput', () => {
  it('accepts a balanced minimal payload', () => {
    const parsed = parseCreateEntryInput({
      date: '2026-03-01',
      description: 'Test',
      fiscalYearId: 'fy-1',
      lines: [
        { accountId: 'a1', debit: 10, credit: 0 },
        { accountId: 'a2', debit: 0, credit: 10 },
      ],
    })
    expect(parsed.fiscalYearId).toBe('fy-1')
  })

  it('rejects single line', () => {
    expect(() =>
      parseCreateEntryInput({
        date: '2026-03-01',
        description: 'Test',
        fiscalYearId: 'fy-1',
        lines: [{ accountId: 'a1', debit: 10, credit: 0 }],
      }),
    ).toThrow(/two lines/)
  })
})
