'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createVolunteeringContribution } from '@/actions/inKindContributionActions'
import {
  calendarDateInTimeZone,
  ENTRY_DATE_TIMEZONE,
  isEntryDateAfterToday,
} from '@/lib/entryDateValidation'
import { Calculator, ClipboardList, ListChecks, ScrollText } from 'lucide-react'
import forms from '@/components/forms/forms.module.css'
import { NumberInput } from '@/components/forms/NumberInput'
import styles from './volunteeringForm.module.css'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { forwardRef } from 'react'
import { createPortal } from 'react-dom'
import { appToast } from '@/lib/appToast'

const DateInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function DateInput(
  props,
  ref
) {
  return <input ref={ref} {...props} />
})

function PopperToBody({ children }: { children?: React.ReactNode }) {
  if (typeof document === 'undefined') return children
  return createPortal(children, document.body)
}

export default function VolunteeringForm({ fiscalYearId }: { fiscalYearId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [date, setDate] = useState<Date | null>(() => new Date())
  const [description, setDescription] = useState('')
  const [contributorName, setContributorName] = useState('')

  const [hours, setHours] = useState<number>(0)
  const [hourlyRate, setHourlyRate] = useState<string>('') // required
  const [valuationMethod, setValuationMethod] = useState('')

  const [meetsEssential, setMeetsEssential] = useState(false)
  const [meetsMeasurable, setMeetsMeasurable] = useState(false)
  const [isRecorded, setIsRecorded] = useState(false)

  const [documentFile, setDocumentFile] = useState<File | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const hourlyRateNumber = Number(hourlyRate)
      if (!Number.isFinite(hourlyRateNumber) || hourlyRateNumber <= 0) {
        throw new Error('Le taux horaire doit être strictement supérieur à 0.')
      }
      if (!date) throw new Error('Date requise.')
      const dateStr = calendarDateInTimeZone(date, ENTRY_DATE_TIMEZONE)
      if (isEntryDateAfterToday(dateStr)) {
        throw new Error("La date ne peut pas être dans le futur.")
      }
      await createVolunteeringContribution({
        fiscalYearId,
        date: dateStr,
        description,
        contributorName: contributorName.trim() || null,
        hours,
        hourlyRate: hourlyRateNumber,
        valuationMethod,
        meetsAnc2112Essential: meetsEssential,
        meetsAnc2112Measurable: meetsMeasurable,
        isRecorded,
        documentFile,
      })
      appToast.success('Saisie enregistrée.')
      router.push('/benevolat')
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : null
      appToast.error(message ?? 'Erreur lors de l’enregistrement.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={`card ${styles.sectionCard} ${styles.detailCardStatic}`}>
        <div className={styles.detailSectionIntro}>
          <div className={styles.sectionIcon} aria-hidden="true">
            <ScrollText size={18} />
          </div>
          <div>
            <h2 className={styles.detailSectionHeading}>Conformité (ANC 2018-06, art. 211-2)</h2>
            <p className={styles.sectionDescription}>Critères d’information obligatoires pour la contribution volontaire en nature.</p>
          </div>
        </div>
        <p className={styles.bodyText}>
          La comptabilisation des contributions volontaires en nature est applicable si (1) leur nature/importance est essentielle à la
          compréhension de l’activité et (2) l’association est en mesure de les recenser et de les valoriser. L’annexe doit décrire la
          quantification et la méthode de valorisation.
        </p>
      </div>

      <div className={`card ${styles.sectionCard} ${styles.detailCardStatic}`}>
        <div className={styles.detailSectionIntro}>
          <div className={styles.sectionIcon} aria-hidden="true">
            <ClipboardList size={18} />
          </div>
          <div>
            <h2 className={styles.detailSectionHeading}>Prestation</h2>
            <p className={styles.sectionDescription}>Date, bénévole et description de l’activité réalisée.</p>
          </div>
        </div>
        <div className={styles.grid}>
          <div className={forms.field}>
            <label className={forms.label} htmlFor="vol-date">
              Date *
            </label>
            <DatePicker
              id="vol-date"
              selected={date}
              onChange={(d: Date | null) => setDate(d)}
              dateFormat="dd/MM/yyyy"
              maxDate={new Date()}
              customInput={<DateInput className={forms.input} />}
              wrapperClassName={styles.datePickerWrapper}
              popperContainer={PopperToBody}
              required
            />
          </div>

          <div className={forms.field}>
            <label className={forms.label} htmlFor="vol-contributor">
              Bénévole (optionnel)
            </label>
            <input
              id="vol-contributor"
              type="text"
              className={forms.input}
              value={contributorName}
              onChange={(e) => setContributorName(e.target.value)}
              placeholder="Nom / identifiant"
            />
          </div>
        </div>

        <div className={`${forms.field} ${styles.mt1}`}>
          <label className={forms.label} htmlFor="vol-description">
            Description *
          </label>
          <textarea
            id="vol-description"
            className={forms.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Encadrement entraînement, tenue de la buvette, etc."
            required
          />
        </div>
      </div>

      <div className={`card ${styles.sectionCard} ${styles.detailCardStatic}`}>
        <div className={styles.detailSectionIntro}>
          <div className={styles.sectionIcon} aria-hidden="true">
            <Calculator size={18} />
          </div>
          <div>
            <h2 className={styles.detailSectionHeading}>Quantification et valorisation</h2>
            <p className={styles.sectionDescription}>
              Heures, montants, méthode ; joignez un justificatif si vous en disposez.
            </p>
          </div>
        </div>
        <div className={styles.grid}>
          <div className={forms.field}>
            <label className={forms.label} htmlFor="vol-hours">
              Heures *
            </label>
            <NumberInput
              id="vol-hours"
              min="0.01"
              step="0.01"
              className={forms.input}
              value={hours || ''}
              onChange={(e) => setHours(Number(e.target.value) || 0)}
              required
            />
          </div>

          <div className={forms.field}>
            <label className={forms.label} htmlFor="vol-hourlyRate">
              Taux (€/h) *
            </label>
            <NumberInput
              id="vol-hourlyRate"
              min="0.01"
              step="0.01"
              className={forms.input}
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              placeholder="Ex: 20"
              required
            />
          </div>

          <div className={forms.field}>
            <label className={forms.label} htmlFor="vol-total">
              Total (€)
            </label>
            <input
              id="vol-total"
              type="text"
              className={forms.input}
              value={
                hours > 0 && hourlyRate.trim() !== '' && Number.isFinite(Number(hourlyRate))
                  ? (hours * Number(hourlyRate)).toFixed(2)
                  : ''
              }
              readOnly
              aria-readonly="true"
              tabIndex={-1}
            />
            <p className={styles.hint}>Calculé automatiquement: heures × taux.</p>
          </div>
        </div>

        <div className={`${forms.field} ${styles.mt1}`}>
          <label className={forms.label} htmlFor="vol-method">
            Méthode de valorisation *
          </label>
          <textarea
            id="vol-method"
            className={forms.textarea}
            value={valuationMethod}
            onChange={(e) => setValuationMethod(e.target.value)}
            placeholder="Décrivez la méthode (ex: grille salariale, convention collective, coût de remplacement, etc.)"
            required
          />
        </div>

        <div className={`${forms.field} ${styles.mt1}`}>
          <label className={forms.label} htmlFor="vol-document">
            Justificatif (optionnel)
          </label>
          <input
            id="vol-document"
            type="file"
            className={forms.input}
            accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
          />
          <p className={styles.hint}>Ex: feuille de temps, tableau récapitulatif, etc.</p>
        </div>
      </div>

      <div className={`card ${styles.sectionCard} ${styles.detailCardStatic}`}>
        <div className={styles.detailSectionIntro}>
          <div className={styles.sectionIcon} aria-hidden="true">
            <ListChecks size={18} />
          </div>
          <div>
            <h2 className={styles.detailSectionHeading}>Décision de comptabilisation</h2>
            <p className={styles.sectionDescription}>
              Cochez selon l’article 211-2 et indiquez si la contribution est passée en classe 8.
            </p>
          </div>
        </div>
        <div className={styles.checkboxStack}>
          <div className={styles.checkboxRow}>
            <input
              id="essential"
              type="checkbox"
              checked={meetsEssential}
              onChange={(e) => setMeetsEssential(e.target.checked)}
            />
            <label htmlFor="essential">Essentiel à la compréhension de l’activité</label>
          </div>
          <div className={styles.checkboxRow}>
            <input
              id="measurable"
              type="checkbox"
              checked={meetsMeasurable}
              onChange={(e) => setMeetsMeasurable(e.target.checked)}
            />
            <label htmlFor="measurable">Recensable et valorisable de manière fiable</label>
          </div>
          <div className={styles.checkboxRow}>
            <input
              id="recorded"
              type="checkbox"
              checked={isRecorded}
              onChange={(e) => setIsRecorded(e.target.checked)}
            />
            <label htmlFor="recorded">Comptabiliser en classe 8 (864/875)</label>
          </div>
        </div>
        <p className={`${styles.hint} ${styles.mt1}`}>
          Si vous ne comptabilisez pas, l’information restera disponible pour l’annexe (nature, importance, méthode).
        </p>
      </div>

      <div className={styles.actions}>
        <button type="button" className="btn" onClick={() => router.back()} disabled={loading}>
          Annuler
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  )
}

