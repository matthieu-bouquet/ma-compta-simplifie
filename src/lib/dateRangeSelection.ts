// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

export type DateRangeItem = { id: string; startDate: Date; endDate: Date }

export function pickNearestDateRangeItem<T extends DateRangeItem>(items: T[], now = new Date()): T | null {
  if (items.length === 0) return null
  const t = now.getTime()
  return items
    .map((item) => {
      const start = item.startDate.getTime()
      const end = item.endDate.getTime()
      const distanceMs = t >= start && t <= end ? 0 : Math.min(Math.abs(t - start), Math.abs(t - end))
      return { item, distanceMs, start }
    })
    .sort((a, b) => {
      if (a.distanceMs !== b.distanceMs) return a.distanceMs - b.distanceMs
      return b.start - a.start
    })[0]!.item
}
