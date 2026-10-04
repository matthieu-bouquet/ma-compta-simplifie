// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getValidatedCurrentAssociationId } from '@/lib/currentAssociationIdValidated'
import EntityRequiredEmptyState from '@/components/EntityRequiredEmptyState'
import forms from '@/components/forms/forms.module.css'
import styles from '../vie-asso.module.css'
import { listMembershipSeasons } from '@/actions/seasonActions'
import { membershipSeasonLabel } from '@/lib/seasonSelection'
import { MEMBERSHIP_SEASON_STATUS_CLOSED } from '@/lib/membershipSeasonStatus'
import SeasonsListClient from './SeasonsListClient'

export default async function SaisonsPage() {
  const associationId = await getValidatedCurrentAssociationId()
  if (!associationId) {
    return (
      <div className={styles.page}>
        <h1 className="page-title no-topbar-pad">Saisons</h1>
        <EntityRequiredEmptyState purpose="default" />
      </div>
    )
  }

  const seasons = await listMembershipSeasons()

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className={`page-title no-topbar-pad ${styles.pageTitle}`}>Saisons</h1>
        <div className={styles.headerActions}>
          <Link href="/saisons/new" className={`btn btn-primary ${forms.btnWithLeadingIcon}`}>
            <Plus size={18} aria-hidden="true" />
            Nouvelle saison
          </Link>
        </div>
      </div>
      <div className="card">
        <p className={styles.lead}>
          La saison sportive est indépendante de l’exercice comptable. Les tarifs par catégorie se règlent sur chaque
          saison ; une personne prend ensuite une adhésion liée à un tarif.
        </p>
      </div>
      <SeasonsListClient
        seasons={seasons.map((s) => ({
          id: s.id,
          label: membershipSeasonLabel(s),
          tariffCount: s.tariffs.length,
          closed: s.status === MEMBERSHIP_SEASON_STATUS_CLOSED,
        }))}
      />
    </div>
  )
}
