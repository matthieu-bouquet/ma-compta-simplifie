'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { createPortal } from 'react-dom'
import { forwardRef } from 'react'
import { CalendarRange } from 'lucide-react'
import FormSection from '@/components/forms/FormSection'
import PageBackLink from '@/components/PageBackLink'
import forms from '@/components/forms/forms.module.css'
import styles from '../vie-asso.module.css'
import { createMembershipSeason, updateMembershipSeason } from '@/actions/seasonActions'
import { MEMBERSHIP_SEASON_STATUS_CLOSED } from '@/lib/membershipSeasonStatus'
import { calendarDateInTimeZone, ENTRY_DATE_TIMEZONE } from '@/lib/entryDateValidation'
import { getDefaultExercisePeriod } from '@/lib/defaultExercisePeriod'
import { appToast } from '@/lib/appToast'

const DateInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function DateInput(
  props,
  ref,
) {
  return <input ref={ref} {...props} className={`${forms.input} ${props.className ?? ''}`} />
})

function PopperToBody({ children }: { children?: React.ReactNode }) {
  if (typeof document === 'undefined') return children
  return createPortal(children, document.body)
}

export default function SeasonForm({
  season,
}: {
  season?: { id: string; name: string; startDate: Date; endDate: Date; status?: string; closedAt?: Date | null }
}) {
  const router = useRouter()
  const readOnly = season?.status === MEMBERSHIP_SEASON_STATUS_CLOSED
  const defaults = getDefaultExercisePeriod()
  const [pending, setPending] = useState(false)
  const [name, setName] = useState(season?.name ?? '')
  const [startDate, setStartDate] = useState<Date | null>(season ? new Date(season.startDate) : defaults.dateDebut)
  const [endDate, setEndDate] = useState<Date | null>(season ? new Date(season.endDate) : defaults.dateFin)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (readOnly) return
    if (!startDate || !endDate) {
      appToast.error('Dates de saison requises.')
      return
    }
    setPending(true)
    try {
      const payload = {
        name,
        startDate: calendarDateInTimeZone(startDate, ENTRY_DATE_TIMEZONE),
        endDate: calendarDateInTimeZone(endDate, ENTRY_DATE_TIMEZONE),
      }
      if (season) {
        await updateMembershipSeason({ id: season.id, ...payload })
        appToast.success('Saison enregistrée.')
        router.push(`/saisons/${season.id}/edit`)
      } else {
        const created = await createMembershipSeason(payload)
        appToast.success('Saison créée. Ajoutez les tarifs ci-dessous.')
        router.push(`/saisons/${created.id}/edit`)
      }
      router.refresh()
    } catch (err) {
      appToast.error(err instanceof Error ? err.message : 'Erreur lors de l’enregistrement.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={styles.formPage}>
      <header className={styles.formHeader}>
        <PageBackLink href="/saisons" aria-label="Retour aux saisons" />
        <h1 className="page-title no-topbar-pad">{season ? 'Modifier la saison' : 'Nouvelle saison'}</h1>
      </header>
      <div className="card">
        <form onSubmit={handleSubmit} className={forms.formStack}>
          <div className={forms.sections}>
          <FormSection
            icon={CalendarRange}
            title="Période sportive"
            description={
              readOnly
                ? season?.closedAt
                  ? `Saison clôturée le ${new Date(season.closedAt).toLocaleDateString('fr-FR')} : consultation seule.`
                  : 'Saison clôturée : consultation seule.'
                : 'Indépendante de l’exercice comptable. Une adhésion se rattache à cette saison.'
            }
          >
            <div className={forms.sectionGrid}>
              <div className={forms.field}>
                <label className={forms.label} htmlFor="season-name">
                  Nom *
                </label>
                <input
                  id="season-name"
                  className={forms.input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  readOnly={readOnly}
                  disabled={readOnly}
                />
              </div>
              <div className={forms.field}>
                <label className={forms.label} htmlFor="season-start">
                  Début *
                </label>
                <DatePicker
                  selected={startDate}
                  onChange={(d: Date | null) => setStartDate(d)}
                  dateFormat="dd/MM/yyyy"
                  disabled={readOnly}
                  customInput={<DateInput id="season-start" required readOnly={readOnly} disabled={readOnly} />}
                  popperContainer={PopperToBody}
                />
              </div>
              <div className={forms.field}>
                <label className={forms.label} htmlFor="season-end">
                  Fin *
                </label>
                <DatePicker
                  selected={endDate}
                  onChange={(d: Date | null) => setEndDate(d)}
                  dateFormat="dd/MM/yyyy"
                  disabled={readOnly}
                  customInput={<DateInput id="season-end" required readOnly={readOnly} disabled={readOnly} />}
                  popperContainer={PopperToBody}
                />
              </div>
            </div>
          </FormSection>
          </div>
          {!readOnly ? (
            <div className={forms.formActionsBar}>
              <button type="submit" className="btn btn-primary" disabled={pending}>
                {season ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          ) : null}
        </form>
      </div>
    </div>
  )
}
