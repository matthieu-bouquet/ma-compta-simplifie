// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { prisma } from '@/lib/prisma'
import { getValidatedCurrentAssociationId } from '@/lib/currentAssociationIdValidated'
import { getCurrentExerciceId } from '@/lib/exerciceContext'
import { getCurrentSeasonId } from '@/lib/seasonContext'
import { resolveSelectedFiscalYearId } from '@/lib/fiscalYearSelection'
import { resolveSelectedSeasonId, membershipSeasonLabel } from '@/lib/seasonSelection'
import { getMemberDetail } from '@/actions/memberActions'
import { getMembershipSeason } from '@/actions/seasonActions'
import { MEMBERSHIP_SEASON_STATUS_CLOSED } from '@/lib/membershipSeasonStatus'
import EntityRequiredEmptyState from '@/components/EntityRequiredEmptyState'
import PageBackLink from '@/components/PageBackLink'
import MemberForm from '../MemberForm'
import MemberFeePanel from '../MemberFeePanel'
import styles from '../../vie-asso.module.css'

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const associationId = await getValidatedCurrentAssociationId()
  const cookieExerciceId = await getCurrentExerciceId()
  const cookieSeasonId = await getCurrentSeasonId()

  if (!associationId) {
    return (
      <div className={styles.formPage}>
        <PageBackLink href="/adherents" aria-label="Retour à la liste des adhérents" />
        <EntityRequiredEmptyState />
      </div>
    )
  }

  const association = await prisma.association.findUnique({
    where: { id: associationId },
    select: { name: true },
  })
  const seasons = await prisma.membershipSeason.findMany({
    where: { associationId },
    orderBy: { startDate: 'desc' },
    select: { id: true },
  })
  const seasonId = resolveSelectedSeasonId(seasons, { cookieSeasonId })
  const member = await getMemberDetail(id, seasonId)
  if (!member) {
    return (
      <div className={styles.formPage}>
        <PageBackLink href="/adherents" aria-label="Retour à la liste des adhérents" />
        <p>Adhérent introuvable.</p>
      </div>
    )
  }

  const fiscalYears = await prisma.fiscalYear.findMany({
    where: { associationId },
    orderBy: { startDate: 'desc' },
  })
  const fiscalYearId = resolveSelectedFiscalYearId(fiscalYears, { cookieExerciceId })
  const fiscalYear = fiscalYears.find((fy) => fy.id === fiscalYearId)
  const season = seasonId ? await getMembershipSeason(seasonId) : null

  const treasuryAccounts = fiscalYear
    ? await prisma.account.findMany({
        where: { fiscalYearId: fiscalYear.id, number: { startsWith: '5' } },
        orderBy: { number: 'asc' },
        select: { number: true, name: true },
      })
    : []
  const fee = member.fees[0]
    ? {
        id: member.fees[0].id,
        status: member.fees[0].status,
        amountCents: member.fees[0].amountCents,
        duesAccountNumber: member.fees[0].duesAccountNumber,
        entryId: member.fees[0].entryId,
        categoryId: member.fees[0].categoryId,
        tariffId: member.fees[0].tariffId,
        snapshotFirstName: member.fees[0].snapshotFirstName,
        snapshotLastName: member.fees[0].snapshotLastName,
        snapshotEmail: member.fees[0].snapshotEmail,
        snapshotPhone: member.fees[0].snapshotPhone,
        snapshotAddress: member.fees[0].snapshotAddress,
        snapshotPostalCode: member.fees[0].snapshotPostalCode,
        snapshotCity: member.fees[0].snapshotCity,
        snapshotLicenseNumber: member.fees[0].snapshotLicenseNumber,
        imageRightsConsent: member.fees[0].imageRightsConsent,
        internalRulesAccepted: member.fees[0].internalRulesAccepted,
        emailCommunicationsConsent: member.fees[0].emailCommunicationsConsent,
      }
    : null

  return (
    <div className={styles.formPage}>
      <MemberForm
        member={{
          id: member.id,
          firstName: member.firstName,
          lastName: member.lastName,
          email: member.email,
          phone: member.phone,
          address: member.address,
          postalCode: member.postalCode,
          city: member.city,
          licenseNumber: member.licenseNumber,
          birthDate: member.birthDate,
          notes: member.notes,
          emergencyContactName: member.emergencyContactName,
          emergencyContactPhone: member.emergencyContactPhone,
          emergencyContactRelation: member.emergencyContactRelation,
        }}
      />
      {season ? (
        <MemberFeePanel
          key={fee?.id ?? `empty-${member.id}-${season.id}`}
          memberId={member.id}
          seasonId={season.id}
          member={{
            firstName: member.firstName,
            lastName: member.lastName,
            email: member.email,
            categoryId: member.categoryId,
          }}
          associationName={association?.name ?? ''}
          seasonLabel={membershipSeasonLabel(season)}
          fee={fee}
          tariffs={season.tariffs.map((t) => ({
            id: t.id,
            categoryName: t.category.name,
            amountCents: t.amountCents,
          }))}
          treasuryAccounts={treasuryAccounts}
          canWrite={season.status !== MEMBERSHIP_SEASON_STATUS_CLOSED}
          canPay={Boolean(
            season.status !== MEMBERSHIP_SEASON_STATUS_CLOSED && fiscalYear && fiscalYear.status === 'OPEN',
          )}
        />
      ) : (
        <div className="card">
          <p>Créez une saison pour enregistrer une adhésion.</p>
        </div>
      )}
    </div>
  )
}
