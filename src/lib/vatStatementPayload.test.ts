// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, expect, it } from 'vitest'
import {
  buildVatStatementPdfPayload,
  validateVatStatementDateRange,
} from '@/lib/vatStatementPayload'

describe('validateVatStatementDateRange', () => {
  it('throws when period is outside fiscal year', () => {
    expect(() =>
      validateVatStatementDateRange(
        '2025-01-01',
        '2026-06-01',
        new Date('2026-01-01'),
        new Date('2026-12-31'),
      ),
    ).toThrow(/exercice/)
  })

  it('accepts valid inclusive period within fiscal year', () => {
    expect(() =>
      validateVatStatementDateRange(
        '2026-02-01',
        '2026-02-28',
        new Date('2026-01-01'),
        new Date('2026-12-31'),
      ),
    ).not.toThrow()
  })
})

describe('buildVatStatementPdfPayload', () => {
  it('computes nets and detail for VAT lines in range', () => {
    const p = buildVatStatementPdfPayload({
      associationName: 'Assoc Test',
      fiscalYearStart: new Date('2026-01-01'),
      fiscalYearEnd: new Date('2026-12-31'),
      dateDebutIso: '2026-01-01',
      dateFinIso: '2026-12-31',
      entries: [
        {
          date: new Date('2026-02-10'),
          journal: { code: 'OD' },
          referenceNumber: '1',
          description: 'Vente',
          lines: [
            {
              accountNumber: '44571',
              accountName: 'TVA collectée',
              debitCents: 0,
              creditCents: 2000,
            },
          ],
        },
        {
          date: new Date('2026-02-11'),
          journal: { code: 'OD' },
          referenceNumber: '2',
          description: 'Achat',
          lines: [
            {
              accountNumber: '44566',
              accountName: 'TVA déductible',
              debitCents: 500,
              creditCents: 0,
            },
          ],
        },
      ],
    })

    expect(p.netCollectedEuros).toBe(20)
    expect(p.netDeductibleEuros).toBe(5)
    expect(p.netVatPositionEuros).toBe(15)
    expect(p.detailRows).toHaveLength(2)
    expect(p.fileName).toMatch(/^etat_tva_/)
  })

  it('excludes entries outside date range', () => {
    const p = buildVatStatementPdfPayload({
      associationName: 'A',
      fiscalYearStart: new Date('2026-01-01'),
      fiscalYearEnd: new Date('2026-12-31'),
      dateDebutIso: '2026-06-01',
      dateFinIso: '2026-06-30',
      entries: [
        {
          date: new Date('2026-02-10'),
          journal: { code: 'OD' },
          referenceNumber: null,
          description: 'early',
          lines: [
            {
              accountNumber: '44571',
              accountName: 'TVA collectée',
              debitCents: 0,
              creditCents: 100,
            },
          ],
        },
      ],
    })
    expect(p.detailRows).toHaveLength(0)
    expect(p.netCollectedEuros).toBe(0)
  })
})
