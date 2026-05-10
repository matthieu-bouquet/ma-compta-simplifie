// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

export function eurosToCents(euros: number) {
  return Math.round((euros || 0) * 100)
}

export function normalizeEurosAmount(euros: number) {
  return Math.round((euros || 0) * 100) / 100
}

export function centsToEuros(cents: number) {
  return (cents || 0) / 100
}

export function formatEurosFromCents(cents: number) {
  const euros = centsToEuros(cents)
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(euros)
  } catch {
    return `${euros.toFixed(2)} €`
  }
}

