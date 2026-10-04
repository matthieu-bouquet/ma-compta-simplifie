'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { setCurrentSeasonId } from '@/actions/contextActions'
import { CalendarRange } from 'lucide-react'
import AppSearchableSelect from '@/components/forms/AppSearchableSelect'
import styles from './topBarSwitchers.module.css'
import { applyContextChangeAndReload } from '@/lib/reloadAfterContextChange'
import { appToast } from '@/lib/appToast'

const SEASON_PATHS = ['/adherents', '/adhesions', '/saisons']

export default function SeasonSwitcher({
  currentSeasonId,
  seasons,
}: {
  currentSeasonId: string | null
  seasons: { id: string; name: string; startDate: string; endDate: string }[]
}) {
  const pathname = usePathname()
  const [pending, setPending] = useState(false)
  const value = currentSeasonId ?? ''

  const visible = pathname === '/' || SEASON_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  const options = useMemo(
    () =>
      (seasons ?? []).map((s) => ({
        value: s.id,
        label: `${s.name} (${new Date(s.startDate).toLocaleDateString('fr-FR')} → ${new Date(s.endDate).toLocaleDateString('fr-FR')})`,
      })),
    [seasons],
  )
  if (!visible || options.length === 0) return null

  const ids = new Set((seasons ?? []).map((s) => s.id))
  const defaultOption = options[0] ?? null
  const selectedValue =
    value && ids.has(value)
      ? {
          value,
          label: options.find((o) => o.value === value)?.label ?? defaultOption?.label ?? seasons[0]!.name,
        }
      : defaultOption

  return (
    <div className={styles.row}>
      <span title="Saison" aria-label="Saison" className={styles.icon}>
        <CalendarRange size={16} aria-hidden="true" />
      </span>
      <div className={styles.selectWrap}>
        <AppSearchableSelect
          inputId="topbar-season"
          aria-label="Sélectionner une saison"
          options={options}
          value={selectedValue}
          onChange={(next) => {
            if (!next || next === value || pending) return
            setPending(true)
            void applyContextChangeAndReload(
              () => setCurrentSeasonId(next),
              () => {
                setPending(false)
                appToast.error('Impossible de changer de saison.')
              },
            )
          }}
          placeholder="Saison…"
          isClearable={false}
          isDisabled={pending}
          elevatedZIndex
        />
      </div>
    </div>
  )
}
