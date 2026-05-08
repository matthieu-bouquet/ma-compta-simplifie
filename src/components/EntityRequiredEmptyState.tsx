// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import styles from './EntityRequiredEmptyState.module.css'
import Image from 'next/image'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import forms from '@/components/forms/forms.module.css'
import { prisma } from '@/lib/prisma'
import {
  type EntityRequiredEmptyStatePurpose,
  getEntityRequiredCopy,
  getNoEntitiesCopy,
} from '@/lib/emptyStateCopy'

export default async function EntityRequiredEmptyState({
  purpose = 'default',
  createEntityHref = '/parametres/entites?create=1',
}: {
  purpose?: EntityRequiredEmptyStatePurpose
  createEntityHref?: string
}) {
  const entityCount = await prisma.association.count()
  const hasEntities = entityCount > 0

  const title = hasEntities ? 'Sélectionnez une entité' : 'Aucune entité'
  const message = hasEntities ? getEntityRequiredCopy(purpose) : getNoEntitiesCopy(purpose)
  const showCreateEntityCta = !hasEntities

  return (
    <div className={`card ${styles.card}`}>
      <div className={styles.imageWrap}>
        <Image src="/empty-state-entity.svg" alt="" width={560} height={360} priority />
      </div>
      <div className={styles.messageWrap}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.message}>{message}</p>
        {showCreateEntityCta ? (
          <div className={styles.ctaRow}>
            <Link href={createEntityHref} className={`btn btn-primary ${forms.btnWithLeadingIcon}`}>
              <Plus size={18} aria-hidden="true" />
              Créer une entité
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  )
}

