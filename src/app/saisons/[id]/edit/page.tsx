// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { getValidatedCurrentAssociationId } from '@/lib/currentAssociationIdValidated'
import EntityRequiredEmptyState from '@/components/EntityRequiredEmptyState'
import PageBackLink from '@/components/PageBackLink'
import { getMembershipSeason } from '@/actions/seasonActions'
import SeasonForm from '../../SeasonForm'
import SeasonTariffsForm from '../../SeasonTariffsForm'
import SeasonClosePanel from '../../SeasonClosePanel'
import styles from '../../../vie-asso.module.css'
import { MEMBERSHIP_SEASON_STATUS_CLOSED } from '@/lib/membershipSeasonStatus'

export default async function EditSeasonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const associationId = await getValidatedCurrentAssociationId()
  if (!associationId) {
    return (
      <div className={styles.formPage}>
        <PageBackLink href="/saisons" aria-label="Retour aux saisons" />
        <EntityRequiredEmptyState />
      </div>
    )
  }
  const season = await getMembershipSeason(id)
  if (!season) {
    return (
      <div className={styles.formPage}>
        <PageBackLink href="/saisons" aria-label="Retour aux saisons" />
        <p>Saison introuvable.</p>
      </div>
    )
  }
  const readOnly = season.status === MEMBERSHIP_SEASON_STATUS_CLOSED

  return (
    <>
      <SeasonForm season={season} />
      <div className={styles.formPage}>
        <SeasonTariffsForm
          seasonId={season.id}
          readOnly={readOnly}
          tariffs={season.tariffs.map((t) => ({
            id: t.id,
            categoryId: t.categoryId,
            categoryName: t.category.name,
            amountCents: t.amountCents,
            duesAccountNumber: t.duesAccountNumber,
          }))}
        />
        <SeasonClosePanel seasonId={season.id} status={season.status} />
      </div>
    </>
  )
}
