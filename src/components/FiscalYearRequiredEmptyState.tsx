// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import Image from 'next/image'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import forms from '@/components/forms/forms.module.css'
import styles from './FiscalYearRequiredEmptyState.module.css'
import { type FiscalYearRequiredEmptyStatePurpose, getFiscalYearRequiredCopy } from '@/lib/emptyStateCopy'

export default function FiscalYearRequiredEmptyState({
  purpose = 'default',
  title = 'Aucun exercice',
  createFiscalYearHref = '/exercices',
}: {
  purpose?: FiscalYearRequiredEmptyStatePurpose
  title?: string
  createFiscalYearHref?: string
}) {
  return (
    <div className={`card ${styles.card}`}>
      <div className={styles.imageWrap}>
        <Image src="/empty-state-exercice.svg" alt="" width={560} height={360} priority />
      </div>
      <div className={styles.messageWrap}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.message}>{getFiscalYearRequiredCopy(purpose)}</p>
        <div className={styles.ctaRow}>
          <Link href={createFiscalYearHref} className={`btn btn-primary ${forms.btnWithLeadingIcon}`}>
            <Plus size={18} aria-hidden="true" />
            Créer un exercice
          </Link>
        </div>
      </div>
    </div>
  )
}

