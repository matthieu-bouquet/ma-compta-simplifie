// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getValidatedCurrentAssociationId } from '@/lib/currentAssociationIdValidated'
import { getCurrentExerciceId } from '@/lib/exerciceContext'
import { resolveSelectedFiscalYearId } from '@/lib/fiscalYearSelection'
import EntityRequiredEmptyState from '@/components/EntityRequiredEmptyState'
import FiscalYearRequiredEmptyState from '@/components/FiscalYearRequiredEmptyState'
import forms from '@/components/forms/forms.module.css'
import styles from '../vie-asso.module.css'
import { listDonations } from '@/actions/donationActions'
import { formatEurosFromCents } from '@/lib/money'
import { donationPaymentMethodLabel } from '@/lib/membership'
import { FileDown } from 'lucide-react'

export default async function DonsPage({
  searchParams,
}: {
  searchParams?: Promise<{ exerciceId?: string }>
}) {
  const { exerciceId: spExerciceId } = (await searchParams) ?? {}
  const associationId = await getValidatedCurrentAssociationId()
  const cookieExerciceId = await getCurrentExerciceId()

  if (!associationId) {
    return (
      <div className={styles.page}>
        <h1 className="page-title no-topbar-pad">Dons</h1>
        <EntityRequiredEmptyState purpose="default" />
      </div>
    )
  }

  const fiscalYears = await prisma.fiscalYear.findMany({
    where: { associationId },
    orderBy: { startDate: 'desc' },
  })
  if (fiscalYears.length === 0) {
    return (
      <div className={styles.page}>
        <h1 className="page-title no-topbar-pad">Dons</h1>
        <FiscalYearRequiredEmptyState purpose="default" />
      </div>
    )
  }

  const selectedFiscalYearId = resolveSelectedFiscalYearId(fiscalYears, {
    urlExerciceId: spExerciceId,
    cookieExerciceId,
  })
  const fiscalYear = selectedFiscalYearId ? fiscalYears.find((e) => e.id === selectedFiscalYearId) : null
  if (!fiscalYear) {
    return (
      <div className={styles.page}>
        <h1 className="page-title no-topbar-pad">Dons</h1>
        <p className="text-warning">Impossible de charger l’exercice sélectionné.</p>
      </div>
    )
  }

  const donations = await listDonations(fiscalYear.id)
  const canCreate = fiscalYear.status === 'OPEN'

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className={`page-title no-topbar-pad ${styles.pageTitle}`}>Dons</h1>
        {canCreate ? (
          <div className={styles.headerActions}>
            <Link href="/dons/new" className={`btn btn-primary ${forms.btnWithLeadingIcon}`}>
              <Plus size={18} aria-hidden="true" />
              Enregistrer un don
            </Link>
          </div>
        ) : null}
      </div>

      <div className="card">
        <p className={styles.lead}>
          Enregistrement d’un don manuel (compte 7541) et édition d’un reçu Cerfa n° 11580. Pas de reçu fiscal pour une
          cotisation avec contrepartie (7562). L’association doit attester son intérêt général dans Paramètres.
        </p>
      </div>

      {donations.length === 0 ? (
        <div className="card">
          <p>Aucun don enregistré pour cet exercice.</p>
        </div>
      ) : (
        <div className="card">
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Date</th>
                  <th className={styles.th}>Donateur</th>
                  <th className={styles.th}>Montant</th>
                  <th className={styles.th}>Reçu</th>
                  <th className={`${styles.th} ${styles.actionsCell}`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {donations.map((d) => (
                  <tr key={d.id}>
                    <td className={styles.td}>{d.date.toLocaleDateString('fr-FR')}</td>
                    <td className={styles.td}>
                      {d.donorName}
                      <br />
                      <span className={styles.lead}>{donationPaymentMethodLabel(d.paymentMethod)}</span>
                    </td>
                    <td className={styles.td}>{formatEurosFromCents(d.amountCents)}</td>
                    <td className={styles.td}>{d.taxReceipt?.number ?? '—'}</td>
                    <td className={`${styles.td} ${styles.actionsCell}`}>
                      {d.taxReceipt ? (
                        <a
                          href={`/api/dons/${d.id}/pdf`}
                          className={styles.iconBtn}
                          title="Télécharger le reçu fiscal"
                          aria-label={`Télécharger le reçu ${d.taxReceipt.number}`}
                        >
                          <FileDown size={16} aria-hidden="true" />
                        </a>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
