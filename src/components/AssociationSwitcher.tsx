'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useEffect, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getAssociations } from '@/actions/associationActions'
import { setCurrentAssociationId } from '@/actions/contextActions'
import { Building2 } from 'lucide-react'

type Association = { id: string; nom: string; cloturee?: boolean }

export default function AssociationSwitcher({ currentAssociationId }: { currentAssociationId: string | null }) {
  const router = useRouter()
  const pathname = usePathname()
  const [associations, setAssociations] = useState<Association[]>([])
  const [pending, startTransition] = useTransition()
  const [value, setValue] = useState<string>(currentAssociationId ?? '')

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

  // Paramètres ne dépend pas du contexte (mais on laisse visible le sélecteur)
  const isParametres = pathname.startsWith('/parametres')

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
      <span title="Association" aria-label="Association" style={{ display: 'inline-flex', lineHeight: 0, color: 'var(--text-secondary)' }}>
        <Building2 size={16} aria-hidden="true" />
      </span>
      <select
        value={value}
        onChange={(e) => {
          const next = e.target.value
          setValue(next)
          startTransition(async () => {
            await setCurrentAssociationId(next || null)
            // Pour les pages dépendantes, on refresh pour recharger les données filtrées
            if (!isParametres) router.refresh()
          })
        }}
        disabled={pending}
        style={{
          width: '100%',
          height: '32px',
          borderRadius: '0.5rem',
          border: '1px solid var(--border-color)',
          background: 'white',
          color: 'var(--text-primary)',
          padding: '0 0.55rem',
          outline: 'none',
          fontSize: '0.92rem',
        }}
        aria-label="Sélectionner une association"
        title="Sélectionner une association"
      >
        <option value="">— Choisir —</option>
        {associations.map((a) => (
          <option key={a.id} value={a.id}>
            {a.nom}
          </option>
        ))}
      </select>
    </div>
  )
}

