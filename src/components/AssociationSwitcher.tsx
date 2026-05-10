'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { getAssociations } from '@/actions/associationActions'
import { setCurrentAssociationId } from '@/actions/contextActions'
import { Building2 } from 'lucide-react'
import AppSearchableSelect from '@/components/forms/AppSearchableSelect'
import styles from './topBarSwitchers.module.css'

type Association = { id: string; nom: string; cloturee?: boolean }

export default function AssociationSwitcher({
  currentAssociationId,
  inputId = 'topbar-association',
  className,
}: {
  currentAssociationId: string | null
  /** Distinct id when several entity selectors exist on the page (labels / a11y). */
  inputId?: string
  className?: string
}) {
  const router = useRouter()
  const [associations, setAssociations] = useState<Association[]>([])
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    ;(async () => {
      try {
        const data = await getAssociations()
        setAssociations(data)
      } catch {
        setAssociations([])
      }
    })()
  }, [])

  // Si une seule entité existe, on la pré-sélectionne automatiquement.
  useEffect(() => {
    if (associations.length !== 1) return
    if (pending) return
    if (currentAssociationId) return

    const only = associations[0]
    startTransition(async () => {
      await setCurrentAssociationId(only.id)
      router.refresh()
    })
  }, [associations, currentAssociationId, pending, router, startTransition])

  const options = useMemo(
    () => associations.map((a) => ({ value: a.id, label: a.nom })),
    [associations],
  )
  const selectedValue =
    currentAssociationId && associations.some((a) => a.id === currentAssociationId)
      ? { value: currentAssociationId, label: associations.find((a) => a.id === currentAssociationId)!.nom }
      : null

  return (
    <div className={[styles.row, className].filter(Boolean).join(' ')}>
      <span title="Association" aria-label="Association" className={styles.icon}>
        <Building2 size={16} aria-hidden="true" />
      </span>
      <div className={styles.selectWrap}>
        <AppSearchableSelect
          inputId={inputId}
          aria-label="Sélectionner une association"
          options={options}
          value={selectedValue}
          onChange={(next) => {
            const nextValue = next ?? ''
            startTransition(async () => {
              await setCurrentAssociationId(nextValue || null)
              // Always refresh so entity-scoped pages (e.g. /parametres/tiers) reload with the new cookie.
              router.refresh()
            })
          }}
          placeholder={associations.length === 0 ? '—' : associations.length === 1 ? associations[0].nom : 'Choisir…'}
          isClearable={associations.length > 1}
          isDisabled={pending || associations.length <= 1}
          elevatedZIndex
        />
      </div>
    </div>
  )
}

