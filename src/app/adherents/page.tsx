// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getValidatedCurrentAssociationId } from '@/lib/currentAssociationIdValidated'
import { getCurrentSeasonId } from '@/lib/seasonContext'
import { prisma } from '@/lib/prisma'
import { resolveSelectedSeasonId } from '@/lib/seasonSelection'
import EntityRequiredEmptyState from '@/components/EntityRequiredEmptyState'
import forms from '@/components/forms/forms.module.css'
import styles from '../vie-asso.module.css'
import { listMembersWithFees } from '@/actions/memberActions'
import MembersTableClient from './MembersTableClient'

export default async function AdherentsPage() {
  const associationId = await getValidatedCurrentAssociationId()
  const cookieSeasonId = await getCurrentSeasonId()

  if (!associationId) {
    return (
      <div className={styles.page}>
        <h1 className="page-title no-topbar-pad">Adhérents</h1>
        <EntityRequiredEmptyState purpose="default" />
      </div>
    )
  }

  const seasons = await prisma.membershipSeason.findMany({
    where: { associationId },
    orderBy: { startDate: 'desc' },
    select: { id: true },
  })
  const seasonId = resolveSelectedSeasonId(seasons, { cookieSeasonId })
  const members = await listMembersWithFees(seasonId)

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className={`page-title no-topbar-pad ${styles.pageTitle}`}>Adhérents</h1>
        <div className={styles.headerActions}>
          <Link href="/adherents/new" className={`btn btn-primary ${forms.btnWithLeadingIcon}`}>
            <Plus size={18} aria-hidden="true" />
            Nouvel adhérent
          </Link>
        </div>
      </div>

      <div className="card">
        <p className={styles.lead}>
          Le fichier des personnes, indépendant des saisons. Une adhésion se prend ensuite pour une saison, sur un
          tarif de cette saison.
        </p>
      </div>

      <MembersTableClient
        members={members.map((m) => ({
          id: m.id,
          firstName: m.firstName,
          lastName: m.lastName,
          email: m.email,
          licenseNumber: m.licenseNumber,
          categoryName: m.fees[0]?.category?.name ?? m.category?.name ?? null,
          feeStatus: m.fees[0]?.status ?? null,
          feeAmountCents: m.fees[0]?.amountCents ?? null,
        }))}
      />
    </div>
  )
}
