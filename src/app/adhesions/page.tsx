// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getValidatedCurrentAssociationId } from '@/lib/currentAssociationIdValidated'
import { getCurrentSeasonId } from '@/lib/seasonContext'
import { resolveSelectedSeasonId } from '@/lib/seasonSelection'
import EntityRequiredEmptyState from '@/components/EntityRequiredEmptyState'
import forms from '@/components/forms/forms.module.css'
import styles from '../vie-asso.module.css'
import { listSeasonAdhesions } from '@/actions/memberActions'
import { MEMBERSHIP_FEE_STATUS_DUE } from '@/lib/membership'
import { getMembershipSeason } from '@/actions/seasonActions'
import { MEMBERSHIP_SEASON_STATUS_CLOSED } from '@/lib/membershipSeasonStatus'
import AdhesionsTableClient from './AdhesionsTableClient'

export default async function AdhesionsPage({
  searchParams,
}: {
  searchParams?: Promise<{ seasonId?: string }>
}) {
  const { seasonId: spSeasonId } = (await searchParams) ?? {}
  const associationId = await getValidatedCurrentAssociationId()
  const cookieSeasonId = await getCurrentSeasonId()

  if (!associationId) {
    return (
      <div className={styles.page}>
        <h1 className="page-title no-topbar-pad">Adhésions</h1>
        <EntityRequiredEmptyState purpose="default" />
      </div>
    )
  }

  const seasons = await prisma.membershipSeason.findMany({
    where: { associationId },
    orderBy: { startDate: 'desc' },
    select: { id: true, name: true },
  })
  const seasonId = resolveSelectedSeasonId(seasons, { urlSeasonId: spSeasonId, cookieSeasonId })

  if (!seasonId) {
    return (
      <div className={styles.page}>
        <h1 className="page-title no-topbar-pad">Adhésions</h1>
        <div className="card">
          <p className={styles.lead}>Créez une saison sportive avant d’enregistrer des adhésions.</p>
          <Link href="/saisons/new" className={`btn btn-primary ${forms.btnWithLeadingIcon}`}>
            <Plus size={18} aria-hidden="true" />
            Nouvelle saison
          </Link>
        </div>
      </div>
    )
  }

  const season = await getMembershipSeason(seasonId)
  const seasonClosed = season?.status === MEMBERSHIP_SEASON_STATUS_CLOSED
  const adhesions = await listSeasonAdhesions(seasonId)
  const unpaidCount = adhesions.filter((a) => a.status === MEMBERSHIP_FEE_STATUS_DUE).length

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className={`page-title no-topbar-pad ${styles.pageTitle}`}>Adhésions</h1>
        {!seasonClosed ? (
          <div className={styles.headerActions}>
            <Link href="/adhesions/new" className={`btn btn-primary ${forms.btnWithLeadingIcon}`}>
              <Plus size={18} aria-hidden="true" />
              Nouvelle adhésion
            </Link>
          </div>
        ) : null}
      </div>
      {seasonClosed ? (
        <div className="card">
          <p className={styles.lead}>Saison clôturée : consultation seule, plus de nouvelle adhésion.</p>
        </div>
      ) : null}
      <div className="card">
        <p className={styles.lead}>
          Une adhésion = une personne + une saison + un tarif. L’encaissement 756 s’écrit dans l’exercice comptable
          qui couvre la date de paiement.
        </p>
      </div>
      <AdhesionsTableClient
        seasonId={seasonId}
        unpaidCount={unpaidCount}
        adhesions={adhesions.map((a) => ({
          id: a.id,
          memberId: a.memberId,
          firstName: a.snapshotFirstName || a.member.firstName,
          lastName: a.snapshotLastName || a.member.lastName,
          email: a.member.email,
          categoryName: a.tariff.category.name,
          status: a.status,
          amountCents: a.amountCents,
        }))}
      />
    </div>
  )
}
