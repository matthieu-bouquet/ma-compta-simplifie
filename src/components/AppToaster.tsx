'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { Toaster } from 'sonner'
import 'sonner/dist/styles.css'
import styles from './AppToaster.module.css'

export default function AppToaster() {
  return (
    <Toaster
      position="top-right"
      richColors={false}
      closeButton
      className={styles.toaster}
      toastOptions={{
        classNames: {
          toast: styles.toast,
          success: styles.success,
          warning: styles.warning,
          error: styles.error,
        },
      }}
    />
  )
}
