import Link from 'next/link'
import { CalendarRange, FileText, Plus } from 'lucide-react'
import PageBackLink from '@/components/PageBackLink'
import { getCurrentAssociationId } from '@/lib/associationContext'
import { getCurrentAssociation } from '@/lib/currentAssociation'
import { getFiscalYears } from '@/actions/exerciceActions'
import { createBudget } from '@/actions/budgetActions'
import forms from '@/components/forms/forms.module.css'
import styles from '../previsionnel.module.css'

export default async function NewPrevisionnelPage() {
  const associationId = await getCurrentAssociationId()

  if (!associationId) {
    return (
      <div className={styles.newBudgetPage}>
        <PageBackLink href="/previsionnel" aria-label="Retour à la liste des prévisionnels" />
        <h1 className="page-title no-topbar-pad">Nouveau prévisionnel</h1>
        <div className="card">
          <p className="text-warning">Sélectionnez une association (menu en haut à droite).</p>
        </div>
      </div>
    )
  }

  const fiscalYears = await getFiscalYears(associationId)
  const association = await getCurrentAssociation()
  const canEdit = Boolean(association && !association.isClosed)

  if (!canEdit) {
    return (
      <div className={styles.newBudgetPage}>
        <div className={styles.newBudgetHeader}>
          <PageBackLink href="/previsionnel" aria-label="Retour à la liste des prévisionnels" />
          <h1 className="page-title no-topbar-pad">Nouveau prévisionnel</h1>
        </div>
        <div className="card">
          <p className="text-warning">Association clôturée : vous ne pouvez pas créer de prévisionnel.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.newBudgetPage}>
      <div className={styles.newBudgetHeader}>
        <PageBackLink href="/previsionnel" aria-label="Retour à la liste des prévisionnels" />
        <h1 className="page-title no-topbar-pad">Nouveau prévisionnel</h1>
        <p className="text-secondary">
          Définissez un brouillon de budget par compte (classes 6, 7 et options 86/87). Aucune écriture n’est créée.
        </p>
      </div>

      <div className={`card ${styles.newBudgetCard}`}>
        <div className={styles.newBudgetCardInner}>
          <form action={createBudget} className={forms.formStack}>
            <div className={forms.sections}>
              <div className={forms.section}>
                <div className={forms.sectionHeader}>
                  <div className={forms.sectionIcon} aria-hidden="true">
                    <FileText size={18} />
                  </div>
                  <div>
                    <div className={forms.sectionTitle}>Intitulé et notes</div>
                    <div className={forms.sectionDescription}>
                      Donnez un nom reconnaissable (ex. saison sportive) et des hypothèses pour votre équipe ou votre AG.
                    </div>
                  </div>
                </div>

                <div className={forms.formGrid}>
                  <div className={forms.field}>
                    <label className={forms.label} htmlFor="budget-name">
                      Nom du prévisionnel *
                    </label>
                    <input
                      id="budget-name"
                      name="name"
                      type="text"
                      required
                      autoComplete="off"
                      placeholder="Ex. Saison 2026-2027"
                      className={forms.input}
                    />
                  </div>

                  <div className={`${forms.field} ${forms.fieldFullWidth}`}>
                    <label className={forms.label} htmlFor="budget-notes">
                      Notes (optionnel)
                    </label>
                    <textarea
                      id="budget-notes"
                      name="notes"
                      rows={4}
                      placeholder="Hypothèses, contexte AG, arbitrages…"
                      className={forms.textarea}
                    />
                  </div>
                </div>
              </div>

              <div className={forms.section}>
                <div className={forms.sectionHeader}>
                  <div className={forms.sectionIcon} aria-hidden="true">
                    <CalendarRange size={18} />
                  </div>
                  <div>
                    <div className={forms.sectionTitle}>Pré-remplissage depuis un exercice</div>
                    <div className={forms.sectionDescription}>
                      Optionnel : repartez des montants réalisés d’un exercice existant et appliquez un coefficient (100 =
                      inchangé, 110 = hausse de 10 %).
                    </div>
                  </div>
                </div>

                <div className={forms.formGrid}>
                  <div className={`${forms.field} ${forms.fieldFullWidth}`}>
                    <label className={forms.label} htmlFor="budget-source-exercice">
                      Exercice source
                    </label>
                    <select
                      id="budget-source-exercice"
                      name="sourceFiscalYearId"
                      defaultValue=""
                      className={forms.select}
                    >
                      <option value="">— Aucun : prévisionnel vide —</option>
                      {fiscalYears.map((fy) => (
                        <option key={fy.id} value={fy.id}>
                          {new Date(fy.startDate).toLocaleDateString('fr-FR')} —{' '}
                          {new Date(fy.endDate).toLocaleDateString('fr-FR')} ({fy.status})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={forms.field}>
                    <label className={forms.label} htmlFor="budget-coefficient">
                      Coefficient (%)
                    </label>
                    <input
                      id="budget-coefficient"
                      name="coefficientPercent"
                      type="number"
                      min={1}
                      max={1000}
                      step={1}
                      defaultValue={100}
                      className={forms.input}
                    />
                    <p className={forms.fieldHint}>
                      Utilisé uniquement si un exercice source est sélectionné (100 = montants identiques, 110 = +10 %).
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className={forms.formActionsBar}>
              <Link href="/previsionnel" className={`btn ${styles.formSecondaryBtn}`}>
                Annuler
              </Link>
              <button type="submit" className={`btn btn-primary ${forms.btnWithLeadingIcon}`}>
                <Plus size={18} aria-hidden="true" />
                Créer le prévisionnel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
