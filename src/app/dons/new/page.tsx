// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { prisma } from '@/lib/prisma'
import { getValidatedCurrentAssociationId } from '@/lib/currentAssociationIdValidated'
import { getCurrentExerciceId } from '@/lib/exerciceContext'
import { resolveSelectedFiscalYearId } from '@/lib/fiscalYearSelection'
import { assertFiscalYearWritable } from '@/lib/accountingGuards'
import EntityRequiredEmptyState from '@/components/EntityRequiredEmptyState'
import FiscalYearRequiredEmptyState from '@/components/FiscalYearRequiredEmptyState'
import PageBackLink from '@/components/PageBackLink'
import DonationForm from './DonationForm'
import styles from '../../vie-asso.module.css'

export default async function NewDonationPage() {
  const associationId = await getValidatedCurrentAssociationId()
  const cookieExerciceId = await getCurrentExerciceId()

  if (!associationId) {
    return (
      <div className={styles.formPage}>
        <PageBackLink href="/dons" aria-label="Retour à la liste des dons" />
        <h1 className="page-title no-topbar-pad">Enregistrer un don</h1>
        <EntityRequiredEmptyState />
      </div>
    )
  }

  const fiscalYears = await prisma.fiscalYear.findMany({
    where: { associationId },
    orderBy: { startDate: 'desc' },
  })
  const fiscalYearId = resolveSelectedFiscalYearId(fiscalYears, { cookieExerciceId })
  const fiscalYear = fiscalYears.find((fy) => fy.id === fiscalYearId)

  if (!fiscalYear) {
    return (
      <div className={styles.formPage}>
        <PageBackLink href="/dons" aria-label="Retour à la liste des dons" />
        <h1 className="page-title no-topbar-pad">Enregistrer un don</h1>
        <FiscalYearRequiredEmptyState />
      </div>
    )
  }

  try {
    await assertFiscalYearWritable({ fiscalYearId: fiscalYear.id, associationId })
  } catch {
    return (
      <div className={styles.formPage}>
        <PageBackLink href="/dons" aria-label="Retour à la liste des dons" />
        <h1 className="page-title no-topbar-pad">Enregistrer un don</h1>
        <p className="text-warning">L’exercice n’est pas modifiable.</p>
      </div>
    )
  }

  const treasuryAccounts = await prisma.account.findMany({
    where: { fiscalYearId: fiscalYear.id, number: { startsWith: '5' } },
    orderBy: { number: 'asc' },
    select: { number: true, name: true },
  })

  return <DonationForm fiscalYearId={fiscalYear.id} treasuryAccounts={treasuryAccounts} />
}
