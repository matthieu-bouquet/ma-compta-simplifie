// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

/** Paths where the season switcher applies (vie associative). */
const VIE_ASSOCIATIVE_PREFIXES = ['/adherents', '/adhesions', '/saisons', '/dons', '/benevolat'] as const

/** Paths where the fiscal year switcher applies (comptabilité & facturation). */
const COMPTABILITE_PREFIXES = [
  '/saisie',
  '/documents',
  '/ecritures',
  '/bilan',
  '/previsionnel',
  '/exercices',
  '/factures',
] as const

function matchesAnyPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

/** Tableau de bord spans both domains. */
export function showSeasonSwitcher(pathname: string): boolean {
  if (pathname === '/') return true
  return matchesAnyPrefix(pathname, VIE_ASSOCIATIVE_PREFIXES)
}

export function showExerciceSwitcher(pathname: string): boolean {
  if (pathname === '/') return true
  return matchesAnyPrefix(pathname, COMPTABILITE_PREFIXES)
}
