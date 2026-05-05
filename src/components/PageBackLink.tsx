// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import styles from './PageBackLink.module.css'

type PageBackLinkProps = {
  href: string
  children?: React.ReactNode
  'aria-label'?: string
}

/**
 * First-row “Retour” for create / edit flows (see AGENTS.md list-and-form-navigation).
 */
export default function PageBackLink({ href, children = 'Retour', 'aria-label': ariaLabel }: PageBackLinkProps) {
  const labelText = typeof children === 'string' ? children : 'Retour'
  return (
    <div className={styles.row}>
      <Link href={href} className={`btn ${styles.backLink}`} aria-label={ariaLabel ?? labelText}>
        <ChevronLeft size={18} aria-hidden="true" />
        {children}
      </Link>
    </div>
  )
}
