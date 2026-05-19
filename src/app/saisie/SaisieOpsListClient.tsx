'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { forwardRef, useMemo, useState } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { Paperclip } from 'lucide-react'
import forms from '@/components/forms/forms.module.css'
import AppSearchableSelect, { type AppSearchableOption } from '@/components/forms/AppSearchableSelect'
import { filterOpsListRows, type OpsListRow } from '@/lib/filterOpsListRows'
import { parseIsoDateStrict } from '@/lib/vatStatementPayload'
import AttachDocumentButton from './AttachDocumentButton'
import DeleteLigneButton from './DeleteLigneButton'
import styles from './saisieList.module.css'

const DateInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function DateInput(
  props,
  ref,
) {
  return <input ref={ref} {...props} />
})

function parseYmdToDate(ymd: string): Date | null {
  return parseIsoDateStrict(ymd)
}

function formatEuros(value: number | null): string {
  if (value == null || value === 0) return ''
  return `${value.toFixed(2)} €`
}

export default function SaisieOpsListClient({
  rows,
  paymentAccountOptions,
  exerciceStartYmd,
  exerciceEndYmd,
}: {
  rows: OpsListRow[]
  paymentAccountOptions: AppSearchableOption[]
  exerciceStartYmd: string
  exerciceEndYmd: string
}) {
  const minDate = parseYmdToDate(exerciceStartYmd)
  const maxDate = parseYmdToDate(exerciceEndYmd)

  const [paymentAccountId, setPaymentAccountId] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState<Date | null>(null)
  const [dateTo, setDateTo] = useState<Date | null>(null)
  const [libelle, setLibelle] = useState('')

  const selectedPaymentOption =
    paymentAccountOptions.find((o) => o.value === paymentAccountId) ?? null

  const filtered = useMemo(
    () =>
      filterOpsListRows(rows, {
        paymentAccountId,
        dateFrom,
        dateTo,
        libelle,
      }),
    [rows, paymentAccountId, dateFrom, dateTo, libelle],
  )

  const resetFilters = () => {
    setPaymentAccountId(null)
    setDateFrom(null)
    setDateTo(null)
    setLibelle('')
  }

  const hasActiveFilters =
    paymentAccountId != null || dateFrom != null || dateTo != null || libelle.trim() !== ''

  if (rows.length === 0) {
    return <p>Aucune ligne comptable enregistrée pour l’instant.</p>
  }

  return (
    <>
      <div className={styles.toolbar}>
        <div className={forms.field}>
          <label className={forms.label} htmlFor="saisie-ops-filtre-paiement">
            Compte de paiement
          </label>
          <AppSearchableSelect
            id="saisie-ops-filtre-paiement"
            inputId="saisie-ops-filtre-paiement"
            options={paymentAccountOptions}
            value={selectedPaymentOption}
            onChange={(v) => setPaymentAccountId(v)}
            placeholder="Tous"
            isClearable
          />
        </div>
        <div className={forms.field}>
          <label className={forms.label} htmlFor="saisie-ops-date-debut">
            Date de début
          </label>
          <DatePicker
            id="saisie-ops-date-debut"
            selected={dateFrom}
            onChange={(d: Date | null) => setDateFrom(d)}
            dateFormat="dd/MM/yyyy"
            minDate={minDate ?? undefined}
            maxDate={maxDate ?? undefined}
            isClearable
            placeholderText="—"
            customInput={<DateInput className={forms.input} />}
            wrapperClassName="w-full"
          />
        </div>
        <div className={forms.field}>
          <label className={forms.label} htmlFor="saisie-ops-date-fin">
            Date de fin
          </label>
          <DatePicker
            id="saisie-ops-date-fin"
            selected={dateTo}
            onChange={(d: Date | null) => setDateTo(d)}
            dateFormat="dd/MM/yyyy"
            minDate={minDate ?? undefined}
            maxDate={maxDate ?? undefined}
            isClearable
            placeholderText="—"
            customInput={<DateInput className={forms.input} />}
            wrapperClassName="w-full"
          />
        </div>
        <div className={forms.field}>
          <label className={forms.label} htmlFor="saisie-ops-filtre-libelle">
            Filtrer par libellé
          </label>
          <input
            id="saisie-ops-filtre-libelle"
            type="search"
            className={forms.input}
            value={libelle}
            onChange={(e) => setLibelle(e.target.value)}
            placeholder="Rechercher…"
          />
        </div>
        <div className={`${styles.toolbarActions} ${forms.field}`}>
          {hasActiveFilters ? (
            <button type="button" className="btn" onClick={resetFilters}>
              Réinitialiser
            </button>
          ) : null}
          <span className={styles.count} aria-live="polite">
            {filtered.length}/{rows.length}
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className={styles.empty}>Aucune ligne ne correspond aux filtres.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr className={styles.theadRow}>
                <th className={`${styles.th} ${styles.nowrap}`}>Date</th>
                <th className={styles.th}>Libellé</th>
                <th className={styles.th}>Compte</th>
                <th className={styles.th}>Compte de paiement</th>
                <th className={`${styles.th} ${styles.nowrap}`}>Statut</th>
                <th className={`${styles.th} ${styles.thRight}`}>Débit</th>
                <th className={`${styles.th} ${styles.thRight}`}>Crédit</th>
                <th className={styles.thCenter} title="Pièce" aria-label="Pièce">
                  Pièce
                </th>
                <th className={styles.thActions}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row.id}
                  className={styles.tr}
                  data-testid="saisie-ops-row"
                  data-entry-description={row.libelle}
                >
                  <td className={`${styles.td} ${styles.nowrap}`}>
                    {new Date(row.dateIso + 'T12:00:00').toLocaleDateString('fr-FR')}
                  </td>
                  <td className={styles.td}>{row.libelle}</td>
                  <td className={styles.td}>
                    {row.accountNumber} - {row.accountName}
                  </td>
                  <td className={styles.td}>
                    {row.paymentAccountLabel ? (
                      row.paymentAccountLabel
                    ) : (
                      <span className={styles.paymentEmpty}>—</span>
                    )}
                  </td>
                  <td className={`${styles.td} ${styles.nowrap}`}>{row.statusLabel}</td>
                  <td className={`${styles.td} ${styles.tdRight}`}>{formatEuros(row.debitEuros)}</td>
                  <td className={`${styles.td} ${styles.tdRight}`}>{formatEuros(row.creditEuros)}</td>
                  <td className={styles.tdCenter}>
                    {row.hasDocument ? (
                      <span
                        aria-label="Une pièce justificative a été ajoutée"
                        className={`has-tooltip ${styles.docBadge}`}
                        data-tooltip="Justificatif ajouté"
                      >
                        <Paperclip size={14} aria-hidden="true" />
                      </span>
                    ) : (
                      <AttachDocumentButton ligneId={row.id} ligneSummary={row.ligneSummary} />
                    )}
                  </td>
                  <td className={styles.tdActions}>
                    <DeleteLigneButton ligneId={row.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className={styles.footer}>
        Filtre sur les {rows.length} dernières lignes de l’exercice (plus récentes en haut).
      </p>
    </>
  )
}
