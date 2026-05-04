import { prisma } from '@/lib/prisma'
import { addComptePaiement } from '@/actions/exerciceActions'
import { createCompteForExercice } from '@/actions/compteActions'
import { notFound } from 'next/navigation'
import PageBackLink from '@/components/PageBackLink'
import CloturerExerciceButton from '../CloturerExerciceButton'
import ComptePaiementRow from '../ComptePaiementRow'
import CompteRowExercice from '../CompteRowExercice'
import forms from '@/components/forms/forms.module.css'
import layout from '../exerciceConfig.module.css'

export default async function ConfigurationExercicePage({ params }: { params: { id: string } }) {
  const paramObj = await params;
  const exerciceId = paramObj.id;

  const fiscalYear = await prisma.fiscalYear.findUnique({
    where: { id: exerciceId },
    include: {
      accounts: {
        where: { number: { startsWith: '5' } },
        orderBy: { number: 'asc' },
        include: {
          lines: {
            include: { entry: true },
          },
        },
      },
    },
  })

  if (!fiscalYear) notFound()

  // Compatibility mapping (UI still expects FR field names).
  const exercice: any = {
    id: fiscalYear.id,
    dateDebut: fiscalYear.startDate,
    dateFin: fiscalYear.endDate,
    statut: fiscalYear.status === 'OPEN' ? 'OUVERT' : 'CLOTURE',
    comptes: fiscalYear.accounts.map((a) => ({
      ...a,
      numero: a.number,
      libelle: a.name,
      lignes: a.lines.map((l) => ({
        ...l,
        montantDebit: l.debitCents,
        montantCredit: l.creditCents,
        ecriture: l.entry ? { ...l.entry, libelle: l.entry.description } : null,
      })),
    })),
  }

  // Calcul du solde de départ pour chaque compte (via écriture d'A-nouveau)
  const comptesAvecSolde = exercice.comptes.map((compte: any) => {
    // On repère la ligne d'A-Nouveau par son libellé
    const ligneANouveau = compte.lignes.find((l: any) =>
      String(l.ecriture?.libelle ?? '').startsWith('Opening balance')
    )
    const soldeDepart = ligneANouveau ? (ligneANouveau.montantDebit - ligneANouveau.montantCredit) / 100 : 0

    return {
      ...compte,
      soldeDepart
    }
  })

  const comptesPlan = (await prisma.account.findMany({
    where: { fiscalYearId: exerciceId },
    orderBy: { number: 'asc' },
  })).map((a) => ({ ...a, numero: a.number, libelle: a.name })) as any[]

  return (
    <div>
      <div className={layout.pageHeader}>
        <h1 className={`page-title ${layout.pageTitle}`}>
          Configuration: {new Date(exercice.dateDebut).getFullYear()}-{new Date(exercice.dateFin).getFullYear()}
        </h1>
        <PageBackLink href="/exercices" aria-label="Retour à la liste des exercices" />
      </div>

      <details className={`card config-toggle ${layout.configBlock}`}>
        <summary className={layout.summary}>
          <span className={layout.summaryTitle}>Moyens de paiement (classe 5)</span>
          <svg
            className={`details-chevron ${layout.chevron}`}
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M6 9l6 6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </summary>

        <div className={layout.twoCol}>
          <div className={`card ${layout.cardFit}`}>
            <h2 className="card-title">Ajouter un moyen de paiement</h2>

            {exercice.statut === 'CLOTURE' ? (
              <div className={layout.closedNotice}>
                Cet exercice est clôturé. Il n&apos;est plus possible de modifier sa configuration ou d&apos;ajouter des
                moyens de paiement.
              </div>
            ) : (
              <form action={addComptePaiement} className={layout.formStack}>
                <input type="hidden" name="exerciceId" value={exerciceId} />

                <div className={forms.field}>
                  <label className={forms.label} htmlFor="exercice-mp-numero">
                    Numéro de compte (ex: 5121)
                  </label>
                  <input
                    id="exercice-mp-numero"
                    type="text"
                    name="numero"
                    required
                    defaultValue="512"
                    className={forms.input}
                  />
                </div>

                <div className={forms.field}>
                  <label className={forms.label} htmlFor="exercice-mp-libelle">
                    Nom (ex: Crédit Agricole)
                  </label>
                  <input id="exercice-mp-libelle" type="text" name="libelle" required className={forms.input} />
                </div>

                <div className={forms.field}>
                  <label className={forms.label} htmlFor="exercice-mp-solde">
                    Solde initial à l&apos;ouverture (€)
                  </label>
                  <input
                    id="exercice-mp-solde"
                    type="number"
                    step="0.01"
                    min="0"
                    name="soldeInitial"
                    defaultValue="0"
                    className={forms.input}
                  />
                  <p className={layout.hint}>
                    Si &gt; 0, une écriture d&apos;A-Nouveau sera automatiquement générée en contrepartie du compte 890.
                  </p>
                </div>

                <button type="submit" className={`btn btn-primary ${layout.submitSpaced}`}>
                  Ajouter et initialiser
                </button>
              </form>
            )}
          </div>

          <div className="card">
            <h2 className="card-title">Moyens de paiement configurés</h2>
            {comptesAvecSolde.length === 0 ? (
              <p>Aucun compte de paiement (Classe 5) trouvé pour cet exercice.</p>
            ) : (
              <table className={layout.table}>
                <thead>
                  <tr className={layout.tableHeadRow}>
                    <th className={layout.th}>Compte</th>
                    <th className={layout.th}>Libellé</th>
                    <th className={`${layout.th} ${layout.thRight}`}>Solde de départ</th>
                  </tr>
                </thead>
                <tbody>
                  {comptesAvecSolde.map((compte: any) => (
                    <ComptePaiementRow 
                      key={compte.id} 
                      compte={compte} 
                      soldeDepart={compte.soldeDepart} 
                      exerciceId={exercice.id} 
                      isCloture={exercice.statut === 'CLOTURE'} 
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </details>

      <details className={`card config-toggle ${layout.configBlock}`}>
        <summary className={layout.summary}>
          <span className={layout.summaryTitle}>Plan comptable de l’exercice</span>
          <svg
            className={`details-chevron ${layout.chevron}`}
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M6 9l6 6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </summary>

        <div className={layout.twoCol}>
          <div className={`card ${layout.cardFit}`}>
            <h2 className="card-title">Ajouter un compte</h2>

            {exercice.statut === 'CLOTURE' ? (
              <div className={layout.closedNotice}>Cet exercice est clôturé. Le plan comptable est en lecture seule.</div>
            ) : (
              <form action={createCompteForExercice} className={layout.formStack}>
                <input type="hidden" name="exerciceId" value={exerciceId} />
                <div className={forms.field}>
                  <label className={forms.label} htmlFor="exercice-plan-numero">
                    Numéro (ex: 512, 706)
                  </label>
                  <input id="exercice-plan-numero" type="text" name="numero" required className={forms.input} />
                </div>
                <div className={forms.field}>
                  <label className={forms.label} htmlFor="exercice-plan-libelle">
                    Libellé du compte
                  </label>
                  <input id="exercice-plan-libelle" type="text" name="libelle" required className={forms.input} />
                </div>
                <button type="submit" className={`btn btn-primary ${layout.submitSpacedSm}`}>
                  Ajouter
                </button>
              </form>
            )}
          </div>

          <div className="card">
            <h2 className="card-title">Comptes de l’exercice</h2>
            <table className={layout.table}>
              <thead>
                <tr className={layout.tableHeadRow}>
                  <th className={layout.th}>Numéro</th>
                  <th className={layout.th}>Libellé</th>
                  <th className={`${layout.th} ${layout.thRight}`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {comptesPlan.map((compte) => (
                  <CompteRowExercice key={compte.id} exerciceId={exerciceId} compte={compte} disabled={exercice.statut === 'CLOTURE'} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>

      {exercice.statut === 'OUVERT' && (
        <CloturerExerciceButton id={exercice.id} />
      )}
    </div>
  )
}
