'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { CircleCheck, HandCoins, Wallet } from 'lucide-react'
import FloatingTooltipHost from '@/components/FloatingTooltipHost'
import type { OpsListRow } from '@/lib/filterOpsListRows'
import styles from './saisieList.module.css'

const ICON_SIZE = 18

export default function OpsLineStatusIcon({ status }: { status: OpsListRow['statusLabel'] }) {
  if (!status) {
    return <span className={styles.statusEmpty}>—</span>
  }

  if (status === 'Payé' || status === 'Perçu') {
    return (
      <FloatingTooltipHost label={status}>
        <span className={`${styles.statusIcon} ${styles.statusIconPaid}`} aria-label={status}>
          <CircleCheck size={ICON_SIZE} strokeWidth={2.25} aria-hidden="true" />
        </span>
      </FloatingTooltipHost>
    )
  }

  if (status === 'À payer') {
    return (
      <FloatingTooltipHost label={status}>
        <span className={`${styles.statusIcon} ${styles.statusIconPending}`} aria-label={status}>
          <Wallet size={ICON_SIZE} strokeWidth={2.25} aria-hidden="true" />
        </span>
      </FloatingTooltipHost>
    )
  }

  return (
    <FloatingTooltipHost label={status}>
      <span className={`${styles.statusIcon} ${styles.statusIconPending}`} aria-label={status}>
        <HandCoins size={ICON_SIZE} strokeWidth={2.25} aria-hidden="true" />
      </span>
    </FloatingTooltipHost>
  )
}
