// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

/** Default fiscal year period (Sept 1 → Aug 31) based on current calendar date. */
export function getDefaultExercisePeriod(): { dateDebut: Date; dateFin: Date } {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  let startYear = currentYear
  if (currentMonth < 8) {
    startYear = currentYear - 1
  }
  return {
    dateDebut: new Date(startYear, 8, 1),
    dateFin: new Date(startYear + 1, 7, 31),
  }
}
