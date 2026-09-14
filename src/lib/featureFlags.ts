// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

function parseTruthyEnv(value: string | undefined): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized === 'true' || normalized === '1'
}

/** When false (default), entity UI hides « Assujetti à la TVA » (see FEATURE_VAT_LIABLE). */
export function isVatLiableFeatureEnabled(): boolean {
  return parseTruthyEnv(process.env.FEATURE_VAT_LIABLE)
}
