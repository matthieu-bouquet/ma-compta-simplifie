'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useEffect, useMemo, useRef, useState } from 'react'
import { getAssociations } from '@/actions/associationActions'
import { setCurrentAssociationId } from '@/actions/contextActions'
import { Building2 } from 'lucide-react'
import AppSearchableSelect from '@/components/forms/AppSearchableSelect'
import styles from './topBarSwitchers.module.css'
import { applyContextChangeAndReload } from '@/lib/reloadAfterContextChange'
import { appToast } from '@/lib/appToast'

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
  const [associations, setAssociations] = useState<Association[]>([])
  const [pending, setPending] = useState(false)
  const autoSelectStarted = useRef(false)

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
    if (currentAssociationId) return
    if (autoSelectStarted.current) return

    autoSelectStarted.current = true
    const only = associations[0]
    void applyContextChangeAndReload(
      () => setCurrentAssociationId(only.id),
      () => {
        autoSelectStarted.current = false
        appToast.error("Impossible de sélectionner l'entité.")
      },
    )
  }, [associations, currentAssociationId])

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
            if (nextValue === (currentAssociationId ?? '') || pending) return
            setPending(true)
            void applyContextChangeAndReload(
              () => setCurrentAssociationId(nextValue || null),
              () => {
                setPending(false)
                appToast.error("Impossible de changer d'entité.")
              },
            )
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
