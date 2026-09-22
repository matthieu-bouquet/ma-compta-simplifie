'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmDialog from '@/components/ConfirmDialog'
import { closeMembershipSeason } from '@/actions/seasonActions'
import { MEMBERSHIP_SEASON_STATUS_CLOSED } from '@/lib/membershipSeasonStatus'
import { appToast } from '@/lib/appToast'
import dangerStyles from '../exercices/CloturerExerciceButton.module.css'

export default function SeasonClosePanel({ seasonId, status }: { seasonId: string; status: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  if (status === MEMBERSHIP_SEASON_STATUS_CLOSED) {
    return null
  }

  return (
    <div className={dangerStyles.dangerZone}>
      <h3 className={dangerStyles.dangerTitle}>Zone de danger</h3>
      <p className={dangerStyles.dangerText}>
        La clôture d&apos;une saison est définitive. Plus aucune adhésion ne pourra être créée et les tarifs ainsi que
        les encaissements liés ne pourront plus être modifiés. Les données restent consultables.
      </p>
      <ConfirmDialog
        title="Clôturer cette saison ?"
        description="Cette action est irréversible. Aucune nouvelle adhésion ne pourra être ajoutée et les éléments liés à cette saison ne pourront plus être modifiés."
        confirmText={loading ? 'Clôture…' : 'Clôturer définitivement'}
        confirmTone="danger"
        disabled={loading}
        onConfirm={async ({ close }) => {
          setLoading(true)
          try {
            await closeMembershipSeason(seasonId)
            close()
            appToast.success('Saison clôturée.')
            router.refresh()
          } catch (e: unknown) {
            appToast.error(e instanceof Error ? e.message : 'Erreur lors de la clôture')
          }
          setLoading(false)
        }}
        trigger={({ open }) => (
          <button type="button" onClick={open} disabled={loading} className={`btn ${dangerStyles.closeBtn}`}>
            {loading ? 'Clôture en cours...' : 'Clôturer cette saison'}
          </button>
        )}
      />
    </div>
  )
}
