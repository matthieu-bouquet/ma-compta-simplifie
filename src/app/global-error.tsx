'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useEffect } from 'react'
import styles from './global-error.module.css'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="fr">
      <body>
        <main className={styles.main}>
          <h1 className={styles.title}>Une erreur est survenue</h1>
          <p className={styles.text}>L&apos;application a rencontré un problème inattendu.</p>
          <button type="button" className={styles.button} onClick={() => reset()}>
            Réessayer
          </button>
        </main>
      </body>
    </html>
  )
}
