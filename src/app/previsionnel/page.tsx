// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import Link from 'next/link'
import { ChevronRight, Plus } from 'lucide-react'
import forms from '@/components/forms/forms.module.css'
import benevolatStyles from '@/app/benevolat/benevolat.module.css'
import { getCurrentAssociationId } from '@/lib/associationContext'
import { getCurrentAssociation } from '@/lib/currentAssociation'
import { getBudgetsForCurrentAssociation } from '@/actions/budgetActions'
import FloatingTooltipHost from '@/components/FloatingTooltipHost'
import DeleteBudgetButton from './DeleteBudgetButton'
import BudgetForecastPdfDownload from './BudgetForecastPdfDownload'
import styles from './previsionnel.module.css'

export default async function PrevisionnelListPage() {
  const associationId = await getCurrentAssociationId()

  if (!associationId) {
    return (
      <div className={benevolatStyles.page}>
        <h1 className="page-title">Prévisionnel</h1>
        <div className="card">
          <p className="text-warning">Sélectionnez une association (menu en haut à droite).</p>
        </div>
      </div>
    )
  }

  const budgets = await getBudgetsForCurrentAssociation()
  const association = await getCurrentAssociation()
  const canEdit = Boolean(association && !association.isClosed)

  return (
    <div className={benevolatStyles.page}>
      <div className={benevolatStyles.headerRow}>
        <h1 className={`page-title no-topbar-pad ${benevolatStyles.pageTitle}`}>Prévisionnel</h1>
        <div className={benevolatStyles.headerActions}>
          {canEdit ? (
            <Link href="/previsionnel/new" className={`btn btn-primary ${forms.btnWithLeadingIcon}`}>
              <Plus size={18} aria-hidden="true" />
              Nouveau prévisionnel
            </Link>
          ) : (
            <p className="text-warning">Association clôturée : création de prévisionnels désactivée.</p>
          )}
        </div>
      </div>

      <div className="card">
        <p>
          Les prévisionnels sont des <strong>brouillons de budget</strong> par compte (charges, produits, etc.). Aucune
          écriture comptable n’est créée : ils servent à planifier et comparer avec un exercice réalisé si besoin.
        </p>
      </div>

      <div className="card">
        <div className={benevolatStyles.tableWrap}>
          <table className={benevolatStyles.table}>
            <thead>
              <tr className={benevolatStyles.theadRow}>
                <th className={benevolatStyles.th}>Nom</th>
                <th className={benevolatStyles.th}>Dernière modification</th>
                <th className={`${benevolatStyles.th} ${benevolatStyles.actionsCell}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {budgets.map((b) => (
                <tr key={b.id}>
                  <td className={benevolatStyles.td}>
                    <div className={benevolatStyles.descriptionMain}>
                      <Link href={`/previsionnel/${b.id}`}>{b.name}</Link>
                    </div>
                  </td>
                  <td className={benevolatStyles.td}>{new Date(b.updatedAt).toLocaleString('fr-FR')}</td>
                  <td className={`${benevolatStyles.td} ${benevolatStyles.actionsCell}`}>
                    <span className={styles.listRowActions}>
                      <FloatingTooltipHost label="Editer">
                        <Link href={`/previsionnel/${b.id}`} className={benevolatStyles.iconBtn} aria-label="Editer">
                          <ChevronRight size={18} aria-hidden="true" />
                        </Link>
                      </FloatingTooltipHost>
                      <FloatingTooltipHost label="Télécharger en PDF">
                        <BudgetForecastPdfDownload variant="icon" budgetId={b.id} />
                      </FloatingTooltipHost>
                      <DeleteBudgetButton budgetId={b.id} budgetName={b.name} disabled={!canEdit} />
                    </span>
                  </td>
                </tr>
              ))}
              {budgets.length === 0 ? (
                <tr>
                  <td colSpan={3} className={benevolatStyles.emptyState}>
                    Aucun prévisionnel pour cette association. Créez-en un pour planifier la saison suivante.
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
