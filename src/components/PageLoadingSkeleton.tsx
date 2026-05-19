// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import styles from './PageLoadingSkeleton.module.css'

export default function PageLoadingSkeleton({ cards = 2 }: { cards?: number }) {
  return (
    <div className={styles.root} aria-busy="true" aria-label="Chargement">
      <div className={styles.titleBar} />
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className={styles.card}>
          <div className={`${styles.line} ${styles.lineWide}`} />
          <div className={`${styles.line} ${styles.lineMedium}`} />
          <div className={`${styles.line} ${styles.lineShort}`} />
        </div>
      ))}
    </div>
  )
}
