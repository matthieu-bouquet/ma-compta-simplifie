// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, expect, it } from 'vitest'
import { formatInvoiceNumber } from '@/lib/invoiceNumbering'

describe('formatInvoiceNumber', () => {
  it('formats year and zero-padded sequence', () => {
    expect(formatInvoiceNumber(1, new Date('2026-03-15T12:00:00.000Z'))).toBe('2026-0001')
    expect(formatInvoiceNumber(42, new Date('2026-03-15T12:00:00.000Z'))).toBe('2026-0042')
  })
})
