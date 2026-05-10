// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

/** Standard French VAT rates (normal cases). */
export const VAT_RATE_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Exonéré / 0 %' },
  { value: 2.1, label: '2,1 %' },
  { value: 5.5, label: '5,5 %' },
  { value: 10, label: '10 %' },
  { value: 20, label: '20 %' },
]
