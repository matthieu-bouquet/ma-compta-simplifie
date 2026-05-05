// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { prisma } from '@/lib/prisma'
import DownloadPdfButton from './DownloadPdfButton'
import { getCurrentAssociationId } from '@/lib/associationContext'
import { getCurrentExerciceId } from '@/lib/exerciceContext'
import styles from './bilan.module.css'
import { getNetAccountTotalsForFiscalYear } from '@/lib/accountTotals'

export default async function BilanPage({
  searchParams,
}: {
  searchParams?: Promise<{ exerciceId?: string }>
}) {
  const { exerciceId: spExerciceId } = (await searchParams) ?? {}
  const associationId = await getCurrentAssociationId()
  const cookieExerciceId = await getCurrentExerciceId()

  if (!associationId) {
    return (
      <div>
        <h1 className="page-title">Bilan Financier</h1>
        <div className="card">
          <p className="text-warning">Sélectionnez une association (menu en haut à droite).</p>
        </div>
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
        : fiscalYears[0].id)

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
      select: { name: true },
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

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title no-topbar-pad" style={{ margin: 0 }}>
          Compte de Résultat Détaillé
        </h1>
        <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-start' }}>
          <DownloadPdfButton
            associationName={association?.name ?? 'Association'}
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
      
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2 className="card-title">Synthèse de l&apos;exercice</h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 600 }}>
          <span style={{ color: 'var(--danger)' }}>Charges : {totalCharges.toFixed(2)} €</span>
          <span style={{ color: 'var(--success)' }}>Produits : {totalProduits.toFixed(2)} €</span>
          <span style={{ color: resultat >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: '1.5rem', fontWeight: 700 }}>
            Résultat Net : {resultat >= 0 ? '+' : ''}{resultat.toFixed(2)} €
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Colonne Charges */}
        <div className="card">
          <h2 className="card-title" style={{ color: 'var(--danger)' }}>Charges (Classe 6)</h2>
          {comptesCharges.length === 0 ? (
            <p>Aucune charge enregistrée.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '0.75rem 0' }}>Compte</th>
                  <th style={{ textAlign: 'right' }}>Montant</th>
                </tr>
              </thead>
              <tbody>
                {comptesCharges.map(c => (
                  <tr key={c.numero} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.5rem 0' }}>{c.numero} - {c.libelle}</td>
                    <td style={{ textAlign: 'right', fontWeight: 500 }}>{c.solde.toFixed(2)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Colonne Produits */}
        <div className="card">
          <h2 className="card-title" style={{ color: 'var(--success)' }}>Produits (Classe 7)</h2>
          {comptesProduits.length === 0 ? (
            <p>Aucun produit enregistré.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '0.75rem 0' }}>Compte</th>
                  <th style={{ textAlign: 'right' }}>Montant</th>
                </tr>
              </thead>
              <tbody>
                {comptesProduits.map(c => (
                  <tr key={c.numero} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.5rem 0' }}>{c.numero} - {c.libelle}</td>
                    <td style={{ textAlign: 'right', fontWeight: 500 }}>{c.solde.toFixed(2)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: '2rem' }}>
        <div className={styles.cvnHeader}>
          <h2 className={`card-title ${styles.noMargin}`}>Contributions volontaires en nature (Classe 8)</h2>
          <div className={styles.cvnTotals}>
            <span>Emplois (86) : {totalCvnEmplois.toFixed(2)} €</span>
            <span>Contributions (87) : {totalCvnContributions.toFixed(2)} €</span>
          </div>
        </div>

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
    </div>
  )
}
