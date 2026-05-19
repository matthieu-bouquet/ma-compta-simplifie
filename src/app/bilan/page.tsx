// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { prisma } from '@/lib/prisma'
import DownloadPdfButton from './DownloadPdfButton'
import { getValidatedCurrentAssociationId } from '@/lib/currentAssociationIdValidated'
import { getCurrentExerciceId } from '@/lib/exerciceContext'
import styles from './bilan.module.css'
import { getNetAccountTotalsForFiscalYear } from '@/lib/accountTotals'
import EntityRequiredEmptyState from '@/components/EntityRequiredEmptyState'
import FiscalYearRequiredEmptyState from '@/components/FiscalYearRequiredEmptyState'
import { resolveSelectedFiscalYearId } from '@/lib/fiscalYearSelection'
import { showClass8CvnForLegalForm } from '@/lib/legalForms'

export default async function BilanPage({
  searchParams,
}: {
  searchParams?: Promise<{ exerciceId?: string }>
}) {
  const { exerciceId: spExerciceId } = (await searchParams) ?? {}
  const associationId = await getValidatedCurrentAssociationId()
  const cookieExerciceId = await getCurrentExerciceId()

  if (!associationId) {
    return (
      <div>
        <h1 className="page-title">Bilan Financier</h1>
        <EntityRequiredEmptyState purpose="bilan" />
      </div>
    )
  }

  const fiscalYears = await prisma.fiscalYear.findMany({
    where: { associationId },
    orderBy: { startDate: 'desc' },
  })

  if (fiscalYears.length === 0) {
    return (
      <div>
        <h1 className="page-title">Bilan Financier</h1>
        <FiscalYearRequiredEmptyState purpose="bilan" />
      </div>
    )
  }

  const fiscalYearId = resolveSelectedFiscalYearId(fiscalYears, {
    urlExerciceId: spExerciceId,
    cookieExerciceId: cookieExerciceId,
  })!

  const [fiscalYear, association] = await Promise.all([
    prisma.fiscalYear.findUnique({
      where: { id: fiscalYearId, associationId },
      select: {
        id: true,
        startDate: true,
        endDate: true,
      },
    }),
    prisma.association.findUnique({
      where: { id: associationId },
      select: { name: true, legalFormCode: true },
    }),
  ])

  if (!fiscalYear) {
    return (
      <div>
        <h1 className="page-title">Compte de Résultat Détaillé</h1>
        <div className="card">
          <p>Exercice introuvable pour cette association.</p>
        </div>
      </div>
    )
  }

  const totals = await getNetAccountTotalsForFiscalYear(fiscalYear.id)

  const comptesCharges = totals.charges.map((c) => ({
    numero: c.number,
    libelle: c.name,
    solde: c.netCents / 100,
  }))
  const comptesProduits = totals.produits.map((c) => ({
    numero: c.number,
    libelle: c.name,
    solde: c.netCents / 100,
  }))

  const totalCharges = totals.charges.reduce((s, c) => s + c.netCents, 0) / 100
  const totalProduits = totals.produits.reduce((s, c) => s + c.netCents, 0) / 100

  const cvnEmploisRows = totals.cvnEmplois.map((c) => ({
    numero: c.number,
    libelle: c.name,
    montant: c.netCents / 100,
  }))
  const cvnContributionRows = totals.cvnContributions.map((c) => ({
    numero: c.number,
    libelle: c.name,
    montant: c.netCents / 100,
  }))

  const totalCvnEmplois = totals.cvnEmplois.reduce((s, c) => s + c.netCents, 0) / 100
  const totalCvnContributions = totals.cvnContributions.reduce((s, c) => s + c.netCents, 0) / 100

  const resultat = totalProduits - totalCharges
  const cvnIsBalanced = Math.abs(totalCvnEmplois - totalCvnContributions) < 0.01

  const includeClass8CvnSection = showClass8CvnForLegalForm(association?.legalFormCode)

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={`page-title no-topbar-pad ${styles.pageTitle}`}>
          Compte de Résultat Détaillé
        </h1>
        <div className={styles.downloadRow}>
          <DownloadPdfButton
            associationName={association?.name ?? 'Association'}
            includeClass8CvnSection={includeClass8CvnSection}
            comptesCharges={comptesCharges}
            comptesProduits={comptesProduits}
            totalCharges={totalCharges}
            totalProduits={totalProduits}
            resultat={resultat}
            dateDebut={fiscalYear.startDate.toISOString()}
            dateFin={fiscalYear.endDate.toISOString()}
            cvnEmploisRows={cvnEmploisRows}
            cvnContributionRows={cvnContributionRows}
            totalCvnEmplois={totalCvnEmplois}
            totalCvnContributions={totalCvnContributions}
            cvnIsBalanced={cvnIsBalanced}
          />
        </div>
      </div>
      
      <div className={`card ${styles.synthesisCard}`}>
        <h2 className="card-title">Synthèse de l&apos;exercice</h2>
        <div className={styles.synthesisRow}>
          <span className={styles.chargesTotal}>Charges : {totalCharges.toFixed(2)} €</span>
          <span className={styles.produitsTotal}>Produits : {totalProduits.toFixed(2)} €</span>
          <span className={`${styles.resultTotal} ${resultat >= 0 ? styles.resultPositive : styles.resultNegative}`}>
            Résultat Net : {resultat >= 0 ? '+' : ''}{resultat.toFixed(2)} €
          </span>
        </div>
      </div>

      <div className={styles.columnsGrid}>
        {/* Colonne Charges */}
        <div className="card">
          <h2 className={`card-title ${styles.sectionTitleCharges}`}>Charges (Classe 6)</h2>
          {comptesCharges.length === 0 ? (
            <p>Aucune charge enregistrée.</p>
          ) : (
            <table className={styles.dataTable}>
              <thead>
                <tr className={styles.dataTableHead}>
                  <th className={styles.dataTableTh}>Compte</th>
                  <th className={styles.dataTableThRight}>Montant</th>
                </tr>
              </thead>
              <tbody>
                {comptesCharges.map(c => (
                  <tr key={c.numero} className={styles.dataTableRow}>
                    <td className={styles.dataTableCell}>{c.numero} - {c.libelle}</td>
                    <td className={styles.dataTableAmount}>{c.solde.toFixed(2)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Colonne Produits */}
        <div className="card">
          <h2 className={`card-title ${styles.sectionTitleProduits}`}>Produits (Classe 7)</h2>
          {comptesProduits.length === 0 ? (
            <p>Aucun produit enregistré.</p>
          ) : (
            <table className={styles.dataTable}>
              <thead>
                <tr className={styles.dataTableHead}>
                  <th className={styles.dataTableTh}>Compte</th>
                  <th className={styles.dataTableThRight}>Montant</th>
                </tr>
              </thead>
              <tbody>
                {comptesProduits.map(c => (
                  <tr key={c.numero} className={styles.dataTableRow}>
                    <td className={styles.dataTableCell}>{c.numero} - {c.libelle}</td>
                    <td className={styles.dataTableAmount}>{c.solde.toFixed(2)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {includeClass8CvnSection ? (
        <div className={`card ${styles.cvnSection}`}>
          <h2 className={`card-title ${styles.noMargin}`}>Contributions volontaires en nature (Classe 8)</h2>

          {!cvnIsBalanced ? (
            <div className={`card ${styles.cvnWarning}`}>
              Totaux non équilibrés (86 ≠ 87). Vérifiez les écritures de classe 8 (elles doivent présenter deux colonnes de totaux égaux).
            </div>
          ) : null}

          <div className={styles.cvnGrid}>
            <div>
              <h3 className={styles.noTopMargin}>Emplois (86)</h3>
              {cvnEmploisRows.length === 0 ? (
                <p>Aucun emploi de contribution volontaire en nature.</p>
              ) : (
                <table className={styles.cvnTable}>
                  <thead>
                    <tr className={styles.cvnTheadRow}>
                      <th className={styles.cvnTh}>Compte</th>
                      <th className={styles.cvnTh}>Libellé</th>
                      <th className={`${styles.cvnTh} ${styles.cvnAmount}`}>Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cvnEmploisRows.map((r) => (
                      <tr key={r.numero}>
                        <td className={styles.cvnTd}><strong>{r.numero}</strong></td>
                        <td className={styles.cvnTd}>{r.libelle}</td>
                        <td className={`${styles.cvnTd} ${styles.cvnAmount}`}>{r.montant.toFixed(2)} €</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div>
              <h3 className={styles.noTopMargin}>Contributions (87)</h3>
              {cvnContributionRows.length === 0 ? (
                <p>Aucune contribution volontaire en nature.</p>
              ) : (
                <table className={styles.cvnTable}>
                  <thead>
                    <tr className={styles.cvnTheadRow}>
                      <th className={styles.cvnTh}>Compte</th>
                      <th className={styles.cvnTh}>Libellé</th>
                      <th className={`${styles.cvnTh} ${styles.cvnAmount}`}>Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cvnContributionRows.map((r) => (
                      <tr key={r.numero}>
                        <td className={styles.cvnTd}><strong>{r.numero}</strong></td>
                        <td className={styles.cvnTd}>{r.libelle}</td>
                        <td className={`${styles.cvnTd} ${styles.cvnAmount}`}>{r.montant.toFixed(2)} €</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
