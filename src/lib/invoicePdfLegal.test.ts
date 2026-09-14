// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, expect, it } from 'vitest'
import {
  INVOICE_FRANCHISE_VAT_MENTION,
  assertAssociationReadyForInvoice,
  formatEmitterSiretOrRnaLine,
  invoiceLegalFooterLines,
} from '@/lib/invoicePdfLegal'

describe('invoicePdfLegal', () => {
  it('uses exact franchise TVA wording', () => {
    expect(INVOICE_FRANCHISE_VAT_MENTION).toBe('TVA non applicable, art. 293 B du CGI')
    expect(invoiceLegalFooterLines(false)[0]).toBe(INVOICE_FRANCHISE_VAT_MENTION)
  })

  it('omits franchise mention when vat liable', () => {
    const lines = invoiceLegalFooterLines(true)
    expect(lines.some((l) => l.includes('293 B'))).toBe(false)
    expect(lines.some((l) => l.includes('retard'))).toBe(true)
  })

  it('formats SIRET/RNA line', () => {
    expect(formatEmitterSiretOrRnaLine('12345678900012')).toBe('SIRET / RNA : 12345678900012')
    expect(formatEmitterSiretOrRnaLine(null)).toBe('SIRET / RNA : —')
  })

  it('assertAssociationReadyForInvoice requires address and identifier', () => {
    expect(() =>
      assertAssociationReadyForInvoice({
        name: 'Asso',
        address: '1 rue Test',
        postalCode: '75001',
        city: 'Paris',
        siret: '12345678900012',
      }),
    ).not.toThrow()

    expect(() =>
      assertAssociationReadyForInvoice({
        name: 'Asso',
        address: '',
        postalCode: '75001',
        city: 'Paris',
        siret: '12345678900012',
      }),
    ).toThrow(/adresse/)

    expect(() =>
      assertAssociationReadyForInvoice({
        name: 'Asso',
        address: '1 rue Test',
        postalCode: '75001',
        city: 'Paris',
        siret: '',
      }),
    ).toThrow(/SIRET|RNA/)
  })
})
