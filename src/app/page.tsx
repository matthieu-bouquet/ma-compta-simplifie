import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import forms from '@/components/forms/forms.module.css'
import { getCurrentAssociationId } from '@/lib/associationContext'
import { getCurrentExerciceId } from '@/lib/exerciceContext'
import PaymentMethodsEvolutionChart from '@/components/PaymentMethodsEvolutionChart'
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
  const associationId = await getCurrentAssociationId()
  const currentExerciceId = await getCurrentExerciceId()
  const now = new Date()

  if (!associationId) {
    return (
      <div className={styles.wrap}>
        <header className={styles.pageHeader}>
          <h1 className="page-title">Tableau de bord</h1>
          <p className={styles.lead}>
            Choisissez une association pour afficher indicateurs et soldes de trésorerie.
          </p>
        </header>
        <div className={`card ${styles.centerCardCompact}`}>
          <h2 className={styles.centerTitle}>Sélectionnez une association</h2>
          <p className={styles.centerText}>
            Utilisez le menu en haut à droite pour choisir l’association sur laquelle vous travaillez.
          </p>
        </div>
      </div>
    )
  }

  // Prendre l’exercice sélectionné dans le select (TopBar), sinon fallback:
  // - dernier exercice OUVERT
  // - sinon dernier exercice tout court
  const exerciceFromCookie = currentExerciceId
    ? await prisma.fiscalYear.findFirst({
        where: { id: currentExerciceId, associationId },
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

  const exerciceFallbackOuvert = await prisma.fiscalYear.findFirst({
    where: { status: 'OPEN', associationId },
    orderBy: { startDate: 'desc' },
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

  const exerciceFallbackAny = await prisma.fiscalYear.findFirst({
    where: { associationId },
    orderBy: { startDate: 'desc' },
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

  const fiscalYear = exerciceFromCookie ?? exerciceFallbackOuvert ?? exerciceFallbackAny

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
        <p className={styles.lead}>
          {exercice
            ? 'Vue d’ensemble de la trésorerie et des flux par moyen de paiement pour l’exercice sélectionné.'
            : 'Créez un exercice pour activer les graphiques et le détail des soldes de trésorerie.'}
        </p>
      </header>

      {!exercice ? (
        <div className={`card ${styles.centerCard}`}>
          <h2 className={styles.centerTitleLarge}>Bienvenue dans votre outil de comptabilité</h2>
          <p className={styles.centerTextSpaced}>
            Pour commencer, vous devez créer votre premier exercice comptable (ex&nbsp;: Saison 2024-2025).
          </p>
          <div className={styles.ctaRow}>
            <Link href="/exercices" className={`btn btn-primary ${forms.btnWithLeadingIcon}`}>
              <Plus size={18} aria-hidden="true" />
              Créer un exercice
            </Link>
          </div>
        </div>
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
