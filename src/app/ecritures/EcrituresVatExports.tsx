'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { forwardRef, useCallback, useId, useRef, useState, useTransition } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { FileDown, X } from 'lucide-react'
import forms from '@/components/forms/forms.module.css'
import { getVatStatementPdfPayload } from '@/actions/vatStatementActions'
import { downloadVatStatementPdf } from '@/lib/vatStatementPdf'
import { parseIsoDateStrict } from '@/lib/vatStatementPayload'
import styles from './ecritures.module.css'

const DateInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function DateInput(
  props,
  ref,
) {
  return <input ref={ref} {...props} />
})

function parseYmdToDate(ymd: string): Date | null {
  return parseIsoDateStrict(ymd)
}

export default function EcrituresVatExports({
  fiscalYearId,
  exerciceStartYmd,
  exerciceEndYmd,
}: {
  fiscalYearId: string
  exerciceStartYmd: string
  exerciceEndYmd: string
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const baseId = useId()
  const dateDebutId = `${baseId}-date-debut`
  const dateFinId = `${baseId}-date-fin`

  const minDate = parseYmdToDate(exerciceStartYmd)
  const maxDate = parseYmdToDate(exerciceEndYmd)

  const [dateDebut, setDateDebut] = useState<Date | null>(() => parseYmdToDate(exerciceStartYmd))
  const [dateFin, setDateFin] = useState<Date | null>(() => parseYmdToDate(exerciceEndYmd))
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const tvaCsvHref = `/api/exercices/${encodeURIComponent(fiscalYearId)}/grand-livre-tva.csv`

  const openDialog = useCallback(() => {
    setError(null)
    setDateDebut(parseYmdToDate(exerciceStartYmd))
    setDateFin(parseYmdToDate(exerciceEndYmd))
    dialogRef.current?.showModal()
  }, [exerciceStartYmd, exerciceEndYmd])

  const closeDialog = useCallback(() => {
    dialogRef.current?.close()
  }, [])

  const fmt = useCallback((d: Date | null) => {
    if (!d) return ''
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }, [])

  const onBackdropMouseDown = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) closeDialog()
  }

  const onDownloadPdf = () => {
    setError(null)
    if (!dateDebut || !dateFin) {
      setError('Veuillez renseigner les deux dates.')
      return
    }
    startTransition(async () => {
      try {
        const payload = await getVatStatementPdfPayload(fiscalYearId, fmt(dateDebut), fmt(dateFin))
        if (!payload) {
          setError('Impossible de générer le PDF.')
          return
        }
        downloadVatStatementPdf(payload)
        closeDialog()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur lors de la génération.')
      }
    })
  }

  return (
    <>
      <a
        className={`btn ${styles.toolbarBtn} ${styles.vatCsvLink}`}
        href={tvaCsvHref}
        title="Exporter uniquement les lignes des comptes TVA (44566, 44571)"
      >
        Exporter CSV (comptes TVA)
      </a>
      <button
        type="button"
        className={`btn btn-primary ${styles.toolbarBtn} ${forms.btnWithLeadingIcon}`}
        title="Télécharger l’état de la TVA sur une période en PDF"
        aria-label="État TVA (PDF)"
        onClick={openDialog}
      >
        <FileDown size={18} className={styles.pdfBtnIcon} aria-hidden />
        État TVA (PDF)
      </button>

      <dialog
        ref={dialogRef}
        className={styles.vatDialog}
        onMouseDown={onBackdropMouseDown}
        aria-labelledby={`${baseId}-vat-title`}
      >
        <div className={styles.vatPanel}>
          <button
            type="button"
            className={styles.vatCloseBtn}
            onClick={closeDialog}
            title="Fermer"
            aria-label="Fermer"
          >
            <X size={18} aria-hidden />
          </button>
          <h2 id={`${baseId}-vat-title`} className={styles.vatTitle}>
            État TVA (PDF)
          </h2>
          <p className={`${forms.label} ${styles.vatIntro}`}>
            Choisissez la période (incluse dans l’exercice affiché).
          </p>
          <div className={styles.vatFields}>
            <div className={forms.field}>
              <label className={forms.label} htmlFor={dateDebutId}>
                Date de début
              </label>
              <DatePicker
                id={dateDebutId}
                selected={dateDebut}
                onChange={(d: Date | null) => setDateDebut(d)}
                dateFormat="dd/MM/yyyy"
                minDate={minDate ?? undefined}
                maxDate={maxDate ?? undefined}
                customInput={<DateInput className={forms.input} />}
                wrapperClassName="w-full"
              />
            </div>
            <div className={forms.field}>
              <label className={forms.label} htmlFor={dateFinId}>
                Date de fin
              </label>
              <DatePicker
                id={dateFinId}
                selected={dateFin}
                onChange={(d: Date | null) => setDateFin(d)}
                dateFormat="dd/MM/yyyy"
                minDate={minDate ?? undefined}
                maxDate={maxDate ?? undefined}
                customInput={<DateInput className={forms.input} />}
                wrapperClassName="w-full"
              />
            </div>
          </div>
          {error ? <div className={`${forms.alertError} card ${styles.vatError}`}>{error}</div> : null}
          <div className={styles.vatFooter}>
            <button type="button" className="btn" onClick={closeDialog}>
              Annuler
            </button>
            <button type="button" className="btn btn-primary" disabled={pending} onClick={onDownloadPdf}>
              {pending ? 'Génération…' : 'Télécharger le PDF'}
            </button>
          </div>
        </div>
      </dialog>
    </>
  )
}
