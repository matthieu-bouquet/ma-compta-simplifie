// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getValidatedCurrentAssociationId } from '@/lib/currentAssociationIdValidated'
import { getCurrentSeasonId } from '@/lib/seasonContext'
import { resolveSelectedSeasonId } from '@/lib/seasonSelection'
import EntityRequiredEmptyState from '@/components/EntityRequiredEmptyState'
import PageBackLink from '@/components/PageBackLink'
import forms from '@/components/forms/forms.module.css'
import styles from '../../vie-asso.module.css'
import { listMembersWithFees } from '@/actions/memberActions'
import { getMembershipSeason } from '@/actions/seasonActions'
import { MEMBERSHIP_SEASON_STATUS_CLOSED } from '@/lib/membershipSeasonStatus'
import NewAdhesionForm from './NewAdhesionForm'

export default async function NewAdhesionPage() {
  const associationId = await getValidatedCurrentAssociationId()
  const cookieSeasonId = await getCurrentSeasonId()
  if (!associationId) {
    return (
      <div className={styles.formPage}>
        <PageBackLink href="/adhesions" aria-label="Retour aux adhésions" />
        <EntityRequiredEmptyState />
      </div>
    )
  }
  const seasons = await prisma.membershipSeason.findMany({
    where: { associationId },
    orderBy: { startDate: 'desc' },
    select: { id: true },
  })
  const seasonId = resolveSelectedSeasonId(seasons, { cookieSeasonId })
  const season = seasonId ? await getMembershipSeason(seasonId) : null
  if (!season) {
    return (
      <div className={styles.formPage}>
        <PageBackLink href="/adhesions" aria-label="Retour aux adhésions" />
        <h1 className="page-title no-topbar-pad">Nouvelle adhésion</h1>
        <div className="card">
          <p className={styles.lead}>Créez une saison avant d’ajouter une adhésion.</p>
          <Link href="/saisons/new" className={`btn btn-primary ${forms.btnWithLeadingIcon}`}>
            <Plus size={18} aria-hidden="true" />
            Nouvelle saison
          </Link>
        </div>
      </div>
    )
  }
  if (season.status === MEMBERSHIP_SEASON_STATUS_CLOSED) {
    return (
      <div className={styles.formPage}>
        <PageBackLink href="/adhesions" aria-label="Retour aux adhésions" />
        <h1 className="page-title no-topbar-pad">Nouvelle adhésion</h1>
        <div className="card">
          <p className={styles.lead}>Cette saison est clôturée. Vous ne pouvez plus créer d’adhésion.</p>
        </div>
      </div>
    )
  }

  const members = await listMembersWithFees(season.id)
  const withoutAdhesion = members.filter((m) => m.fees.length === 0)
  return (
    <NewAdhesionForm
      seasonId={season.id}
      members={withoutAdhesion.map((m) => ({ id: m.id, firstName: m.firstName, lastName: m.lastName }))}
      tariffs={season.tariffs.map((t) => ({
        id: t.id,
        categoryName: t.category.name,
        amountCents: t.amountCents,
      }))}
    />
  )
}
