// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { eurosToCents } from '@/lib/money'

/**
 * Split a TTC amount into HT and VAT (France: TVA = TTC × t/(100+t), HT = TTC − VAT).
 * Uses integer cents so debits and credits stay balanced.
 */
export function splitTtcToHtAndVatCents(ttcCents: number, vatRatePercent: number): { htCents: number; vatCents: number } {
  if (ttcCents <= 0) {
    return { htCents: 0, vatCents: 0 }
  }
  const rate = vatRatePercent / 100
  const htCents = Math.round(ttcCents / (1 + rate))
  const vatCents = ttcCents - htCents
  return { htCents, vatCents }
}

export function splitTtcToHtAndVatEuros(ttcEuros: number, vatRatePercent: number): { htEuros: number; vatEuros: number } {
  const ttcCents = eurosToCents(ttcEuros)
  const { htCents, vatCents } = splitTtcToHtAndVatCents(ttcCents, vatRatePercent)
  return { htEuros: htCents / 100, vatEuros: vatCents / 100 }
}
