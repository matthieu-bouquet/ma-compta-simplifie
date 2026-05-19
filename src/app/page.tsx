// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { prisma } from '@/lib/prisma'
import { getValidatedCurrentAssociationId } from '@/lib/currentAssociationIdValidated'
import { getCurrentExerciceId } from '@/lib/exerciceContext'
import { resolveSelectedFiscalYearId } from '@/lib/fiscalYearSelection'
import PaymentMethodsEvolutionChart from '@/components/PaymentMethodsEvolutionChart'
import EntityRequiredEmptyState from '@/components/EntityRequiredEmptyState'
import FiscalYearRequiredEmptyState from '@/components/FiscalYearRequiredEmptyState'
import styles from './page.module.css'

type DashboardEcriture = {
  date: Date
  libelle: string | null
}

type DashboardLine = {
  montantDebit: number
  montantCredit: number
  ecriture: DashboardEcriture | null
}

type DashboardAccount = {
  id: string
  numero: string
  libelle: string
  lignes: DashboardLine[]
}

type DashboardExercice = {
  id: string
  dateDebut: Date
  dateFin: Date
  statut: 'OUVERT' | 'CLOTURE'
  comptes: DashboardAccount[]
}

type TreasuryAccountRow = DashboardAccount & { soldeActuel: number }

export default async function Dashboard() {
  const associationId = await getValidatedCurrentAssociationId()
  const currentExerciceId = await getCurrentExerciceId()
  const now = new Date()

  if (!associationId) {
    return (
      <div className={styles.wrap}>
        <header className={styles.pageHeader}>
          <h1 className="page-title">Tableau de bord</h1>
        </header>
        <EntityRequiredEmptyState purpose="dashboard" />
      </div>
    )
  }

  const fiscalYearList = await prisma.fiscalYear.findMany({
    where: { associationId },
    orderBy: { startDate: 'desc' },
    select: { id: true, status: true },
  })

  const selectedFiscalYearId = resolveSelectedFiscalYearId(fiscalYearList, {
    cookieExerciceId: currentExerciceId,
  })

  const fiscalYear = selectedFiscalYearId
    ? await prisma.fiscalYear.findFirst({
        where: { id: selectedFiscalYearId, associationId },
        include: {
          accounts: {
            where: { number: { startsWith: '5' } },
            orderBy: { number: 'asc' },
            include: {
              lines: {
                include: {
                  entry: { select: { date: true, description: true } },
                },
              },
            },
          },
        },
      })
    : null

  const exercice: DashboardExercice | null = fiscalYear
    ? {
        id: fiscalYear.id,
        dateDebut: fiscalYear.startDate,
        dateFin: fiscalYear.endDate,
        statut: fiscalYear.status === 'OPEN' ? 'OUVERT' : 'CLOTURE',
        comptes: fiscalYear.accounts.map((a) => ({
          id: a.id,
          numero: a.number,
          libelle: a.name,
          lignes: a.lines.map((l) => ({
            montantDebit: l.debitCents,
            montantCredit: l.creditCents,
            ecriture: l.entry
              ? { date: l.entry.date, libelle: l.entry.description }
              : null,
          })),
        })),
      }
    : null

  const chartComptes: DashboardAccount[] = exercice ? [...exercice.comptes] : []

  let comptesTresorerie: TreasuryAccountRow[] = []
  if (exercice) {
    comptesTresorerie = exercice.comptes.map((compte) => {
      const lignesPassees = compte.lignes.filter((l) => {
        const d = l.ecriture?.date ? new Date(l.ecriture.date) : null
        if (!d) return false
        return d.getTime() <= now.getTime()
      })
      const totalDebit = lignesPassees.reduce((sum, l) => sum + l.montantDebit, 0)
      const totalCredit = lignesPassees.reduce((sum, l) => sum + l.montantCredit, 0)
      const soldeActuel = (totalDebit - totalCredit) / 100 // Solde débiteur normal pour la trésorerie
      return { ...compte, soldeActuel }
    })
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.pageHeader}>
        <h1 className="page-title">Tableau de bord</h1>
      </header>

      {!exercice ? (
        <FiscalYearRequiredEmptyState />
      ) : (
        <>
          <div className={styles.dashboardGrid}>
            <div className={`card ${styles.cardAccent}`}>
              <h2 className={styles.cardTitle}>Évolution des moyens de paiement</h2>
              <p className={styles.periodHint}>
                Exercice {new Date(exercice.dateDebut).toLocaleDateString('fr-FR')} →{' '}
                {new Date(exercice.dateFin).toLocaleDateString('fr-FR')}
              </p>
              <PaymentMethodsEvolutionChart
                dateDebut={exercice.dateDebut.toISOString()}
                dateFin={exercice.dateFin.toISOString()}
                nowIso={now.toISOString()}
                comptes={chartComptes.map((c) => ({
                  id: c.id,
                  numero: c.numero,
                  libelle: c.libelle,
                  lignes: c.lignes.map((l) => ({
                    montantDebit: l.montantDebit / 100,
                    montantCredit: l.montantCredit / 100,
                    ecritureDate: l.ecriture?.date ? new Date(l.ecriture.date).toISOString() : null,
                    ecritureLibelle: l.ecriture?.libelle ?? null,
                  })),
                }))}
              />
            </div>

            <div className={`card ${styles.cardAccent}`}>
              <h2 className={styles.cardTitleSpaced}>
                Détail de la trésorerie (au {now.toLocaleDateString('fr-FR')})
              </h2>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Compte</th>
                      <th scope="col">Libellé</th>
                      <th scope="col" className={styles.balance}>
                        Solde
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {comptesTresorerie.map((compte) => (
                      <tr key={compte.id}>
                        <td className={styles.accountNum}>{compte.numero}</td>
                        <td>{compte.libelle}</td>
                        <td
                          className={
                            compte.soldeActuel >= 0 ? styles.balancePositive : styles.balanceNegative
                          }
                        >
                          {compte.soldeActuel.toFixed(2)} €
                        </td>
                      </tr>
                    ))}
                    {comptesTresorerie.length === 0 && (
                      <tr>
                        <td colSpan={3} className={styles.emptyCell}>
                          Aucun moyen de paiement configuré.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
