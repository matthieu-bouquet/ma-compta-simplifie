// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import type { AppSearchableOption } from '@/components/forms/AppSearchableSelect'
import {
  DUES_ACCOUNT_WITHOUT_COUNTERPART,
  DUES_ACCOUNT_WITH_COUNTERPART,
} from '@/lib/membership'
import { formatEurosFromCents } from '@/lib/money'

export function treasuryAccountSelectOptions(
  accounts: ReadonlyArray<{ number: string; name: string }>,
): AppSearchableOption[] {
  return accounts.map((a) => ({
    value: a.number,
    label: `${a.number} — ${a.name}`,
  }))
}

export function membershipTariffSelectOptions(
  tariffs: ReadonlyArray<{ id: string; categoryName: string; amountCents: number }>,
): AppSearchableOption[] {
  return tariffs.map((t) => ({
    value: t.id,
    label: `${t.categoryName} — ${formatEurosFromCents(t.amountCents)}`,
  }))
}

export const DUES_ACCOUNT_SELECT_OPTIONS: AppSearchableOption[] = [
  { value: DUES_ACCOUNT_WITH_COUNTERPART, label: '7562 — avec contrepartie' },
  { value: DUES_ACCOUNT_WITHOUT_COUNTERPART, label: '7561 — sans contrepartie' },
]

export function duesAccountSelectOption(value: string): AppSearchableOption | null {
  return DUES_ACCOUNT_SELECT_OPTIONS.find((o) => o.value === value) ?? null
}
