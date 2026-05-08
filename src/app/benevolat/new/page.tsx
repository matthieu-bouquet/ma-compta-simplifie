// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { prisma } from '@/lib/prisma'
import { getCurrentExerciceId } from '@/lib/exerciceContext'
import VolunteeringForm from './VolunteeringForm'
import { getCurrentAssociation } from '@/lib/currentAssociation'
import { isAssociationLegalForm } from '@/lib/legalForms'
import PageBackLink from '@/components/PageBackLink'
import styles from './page.module.css'
import EntityRequiredEmptyState from '@/components/EntityRequiredEmptyState'
import FiscalYearRequiredEmptyState from '@/components/FiscalYearRequiredEmptyState'

export default async function NewVolunteeringPage() {
  const currentAssociation = await getCurrentAssociation()
  const associationId = currentAssociation?.id ?? null
  const exerciceId = await getCurrentExerciceId()

  if (!associationId) {
    return (
      <div className={styles.shell}>
        <PageBackLink href="/benevolat" aria-label="Retour à la liste du bénévolat" />
        <header className={styles.pageHeader}>
          <h1 className="page-title no-topbar-pad">Ajouter du bénévolat</h1>
          <p className={styles.lead}>
            Enregistrez une contribution volontaire en nature pour l’annexe et, le cas échéant, la comptabilité.
          </p>
        </header>
        <EntityRequiredEmptyState />
      </div>
    )
  }

  if (!isAssociationLegalForm(currentAssociation?.legalFormCode)) {
    return (
      <div className={styles.shell}>
        <PageBackLink href="/benevolat" aria-label="Retour à la liste du bénévolat" />
        <header className={styles.pageHeader}>
          <h1 className="page-title no-topbar-pad">Ajouter du bénévolat</h1>
          <p className={styles.lead}>Réservé aux associations au sens du cadre juridique pris en charge par l’application.</p>
        </header>
        <div className={styles.noticeCard}>
          <p className={`${styles.noticeBody} text-warning`}>
            Le bénévolat est disponible uniquement pour une entité de type association.
          </p>
        </div>
      </div>
    )
  }

  const fiscalYear =
    (exerciceId
      ? await prisma.fiscalYear.findFirst({ where: { id: exerciceId, associationId }, select: { id: true, status: true } })
      : null) ||
    (await prisma.fiscalYear.findFirst({
      where: { associationId, status: 'OPEN' },
      orderBy: { startDate: 'desc' },
      select: { id: true, status: true },
    })) ||
    (await prisma.fiscalYear.findFirst({
      where: { associationId },
      orderBy: { startDate: 'desc' },
      select: { id: true, status: true },
    }))

  if (!fiscalYear) {
    return (
      <div className={styles.shell}>
        <PageBackLink href="/benevolat" aria-label="Retour à la liste du bénévolat" />
        <header className={styles.pageHeader}>
          <h1 className="page-title no-topbar-pad">Ajouter du bénévolat</h1>
          <p className={styles.lead}>Les saisies sont rattachées à un exercice comptable.</p>
        </header>
        <FiscalYearRequiredEmptyState />
      </div>
    )
  }

  if (fiscalYear.status !== 'OPEN') {
    return (
      <div className={styles.shell}>
        <PageBackLink href="/benevolat" aria-label="Retour à la liste du bénévolat" />
        <header className={styles.pageHeader}>
          <h1 className="page-title no-topbar-pad">Ajouter du bénévolat</h1>
          <p className={styles.lead}>
            Les exercices clôturés ne peuvent pas recevoir de nouvelles écritures ni contributions.
          </p>
        </header>
        <div className={styles.noticeCard}>
          <p className={`${styles.noticeBody} text-warning`}>
            L’exercice sélectionné est clôturé. Sélectionnez un exercice ouvert.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      <PageBackLink href="/benevolat" aria-label="Retour à la liste du bénévolat" />
      <header className={styles.pageHeader}>
        <h1 className="page-title no-topbar-pad">Ajouter du bénévolat</h1>
      </header>
      <VolunteeringForm fiscalYearId={fiscalYear.id} />
    </div>
  )
}
