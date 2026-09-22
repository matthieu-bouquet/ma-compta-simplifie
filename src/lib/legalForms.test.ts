// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, expect, it } from 'vitest'
import {
  assertCreateAssociationLegalForm,
  isLegalFormCode,
  legalFormSelectOptions,
  showClass8CvnForLegalForm,
  validateLegalForm,
} from '@/lib/legalForms'

describe('showClass8CvnForLegalForm', () => {
  it('is true when unset or association', () => {
    expect(showClass8CvnForLegalForm(undefined)).toBe(true)
    expect(showClass8CvnForLegalForm(null)).toBe(true)
    expect(showClass8CvnForLegalForm('ASSOCIATION')).toBe(true)
  })

  it('is false for explicit non-association forms', () => {
    expect(showClass8CvnForLegalForm('SAS')).toBe(false)
    expect(showClass8CvnForLegalForm('EI')).toBe(false)
  })
})

describe('isLegalFormCode', () => {
  it('accepts known codes and rejects unknown', () => {
    expect(isLegalFormCode('SARL')).toBe(true)
    expect(isLegalFormCode('')).toBe(false)
    expect(isLegalFormCode('UNKNOWN')).toBe(false)
  })
})

describe('legalFormSelectOptions', () => {
  it('returns association only, including when VAT feature is enabled', () => {
    expect(legalFormSelectOptions(true).map((o) => o.code)).toEqual(['ASSOCIATION'])
    expect(legalFormSelectOptions(false).map((o) => o.code)).toEqual(['ASSOCIATION'])
  })

  it('keeps legacy commercial form on edit', () => {
    const options = legalFormSelectOptions(false, 'SAS')
    expect(options.map((o) => o.code)).toEqual(['ASSOCIATION', 'SAS'])
  })
})

describe('assertCreateAssociationLegalForm', () => {
  it('defaults empty to ASSOCIATION', () => {
    expect(assertCreateAssociationLegalForm(null)).toBe('ASSOCIATION')
  })

  it('rejects non-association forms on create', () => {
    expect(() => assertCreateAssociationLegalForm('SAS')).toThrow(/associations/)
  })
})

describe('validateLegalForm', () => {
  it('returns nulls when code is empty', () => {
    expect(validateLegalForm({ legalFormCode: null, legalFormOther: null })).toEqual({
      legalFormCode: null,
      legalFormOther: null,
    })
  })

  it('throws on invalid code', () => {
    expect(() => validateLegalForm({ legalFormCode: 'BAD', legalFormOther: null })).toThrow(
      'Forme juridique invalide',
    )
  })

  it('requires other label when code is OTHER', () => {
    expect(() =>
      validateLegalForm({ legalFormCode: 'OTHER', legalFormOther: '   ' }),
    ).toThrow('Veuillez préciser la forme juridique')
  })

  it('trims other label for OTHER', () => {
    expect(
      validateLegalForm({ legalFormCode: 'OTHER', legalFormOther: '  Coop  ' }),
    ).toEqual({ legalFormCode: 'OTHER', legalFormOther: 'Coop' })
  })

  it('clears other for standard codes', () => {
    expect(validateLegalForm({ legalFormCode: 'SAS', legalFormOther: 'ignored' })).toEqual({
      legalFormCode: 'SAS',
      legalFormOther: null,
    })
  })
})
