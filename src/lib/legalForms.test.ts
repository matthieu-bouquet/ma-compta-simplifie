// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, expect, it } from 'vitest'
import { showClass8CvnForLegalForm } from '@/lib/legalForms'

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
