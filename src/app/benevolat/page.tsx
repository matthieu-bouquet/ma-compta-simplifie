// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getCurrentExerciceId } from '@/lib/exerciceContext'
import { getCurrentAssociation } from '@/lib/currentAssociation'
import { isAssociationLegalForm } from '@/lib/legalForms'
import forms from '@/components/forms/forms.module.css'
import styles from './benevolat.module.css'
import DeleteContributionButton from './DeleteContributionButton'

function formatDateFr(d: Date) {
  return d.toLocaleDateString('fr-FR')
}

function formatEuros(cents: number) {
  return (cents / 100).toFixed(2)
}

export default async function VolunteeringPage({
  searchParams,
}: {
  searchParams?: Promise<{ exerciceId?: string }>
}) {
  const { exerciceId: spExerciceId } = (await searchParams) ?? {}
  const currentAssociation = await getCurrentAssociation()
  const associationId = currentAssociation?.id ?? null
  const cookieExerciceId = await getCurrentExerciceId()

  if (!associationId) {
    return (
      <div className={styles.page}>
        <h1 className="page-title">Bénévolat</h1>
        <div className="card">
          <p className="text-warning">Sélectionnez une association (menu en haut à droite).</p>
        </div>
      </div>
    )
  }

  if (!isAssociationLegalForm(currentAssociation?.legalFormCode)) {
    return (
      <div className={styles.page}>
        <h1 className="page-title">Bénévolat</h1>
        <div className="card">
          <p className="text-warning">Le bénévolat est disponible uniquement pour une entité de type association.</p>
        </div>
      </div>
    )
  }

  const fiscalYears = await prisma.fiscalYear.findMany({
    where: { associationId },
    orderBy: { startDate: 'desc' },
    select: { id: true, status: true },
  })

  if (fiscalYears.length === 0) {
    return (
      <div className={styles.page}>
        <h1 className="page-title">Bénévolat</h1>
        <div className="card">
          <p>Aucun exercice disponible pour cette association.</p>
        </div>
      </div>
    )
  }

  const fiscalYearId =
    (spExerciceId && fiscalYears.some((e) => e.id === spExerciceId)
      ? spExerciceId
      : cookieExerciceId && fiscalYears.some((e) => e.id === cookieExerciceId)
        ? cookieExerciceId
        : fiscalYears.find((e) => e.status === 'OPEN')?.id || fiscalYears[0].id)

  const rows = await prisma.inKindContribution.findMany({
    where: {
      associationId,
      fiscalYearId,
      kind: 'VOLUNTEERING',
    },
    orderBy: { date: 'desc' },
    select: {
      id: true,
      date: true,
      description: true,
      contributorName: true,
      quantityMilliUnits: true,
      unitValueCents: true,
      totalValueCents: true,
      valuationMethod: true,
      isRecorded: true,
    },
  })

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className={`page-title ${styles.pageTitle}`}>Bénévolat</h1>
        <div className={styles.headerActions}>
          <Link href="/benevolat/new" className={`btn btn-primary ${forms.btnWithLeadingIcon}`}>
            <Plus size={18} aria-hidden="true" />
            Ajouter
          </Link>
        </div>
      </div>

      <div className="card">
        <p>
          Les contributions volontaires en nature (bénévolat) sont <strong>valorisées et comptabilisées</strong> uniquement si les
          conditions de l’article 211-2 du règlement ANC 2018-06 sont remplies. Dans tous les cas, l’annexe doit documenter la
          quantification et la méthode de valorisation.
        </p>
      </div>

      <div className="card">
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr className={styles.theadRow}>
                <th className={styles.th}>Date</th>
                <th className={styles.th}>Description</th>
                <th className={styles.th}>Bénévole</th>
                <th className={styles.th}>Heures</th>
                <th className={styles.th}>Taux</th>
                <th className={`${styles.th} ${styles.statusHeader}`}>Statut</th>
                <th className={`${styles.th} ${styles.numberCell} ${styles.totalHeader}`}>Total</th>
                <th className={`${styles.th} ${styles.actionsCell}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const hours = (r.quantityMilliUnits / 1000).toFixed(2)
                const rate = r.unitValueCents == null ? '—' : `${formatEuros(r.unitValueCents)} €/h`
                return (
                  <tr key={r.id}>
                    <td className={styles.td}>{formatDateFr(r.date)}</td>
                    <td className={styles.td}>
                      <div className={styles.descriptionMain}>{r.description}</div>
                      <div className={styles.methodText}>{r.valuationMethod}</div>
                    </td>
                    <td className={styles.td}>{r.contributorName || '—'}</td>
                    <td className={styles.td}>{hours}</td>
                    <td className={styles.td}>{rate}</td>
                    <td className={`${styles.td} ${styles.statusCell}`}>
                      <span className={`${styles.statusPill} ${r.isRecorded ? styles.statusPillRecorded : ''}`}>
                        {r.isRecorded ? 'Comptabilisé' : 'Annexe'}
                      </span>
                    </td>
                    <td className={`${styles.td} ${styles.numberCell} ${styles.totalCell}`}>
                      {formatEuros(r.totalValueCents)} €
                    </td>
                    <td className={`${styles.td} ${styles.actionsCell}`}>
                      <DeleteContributionButton id={r.id} />
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className={styles.emptyState}>
                    Aucune saisie de bénévolat pour cet exercice.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

