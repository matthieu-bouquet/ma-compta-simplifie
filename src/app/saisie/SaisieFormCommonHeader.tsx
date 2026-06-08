'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useMemo } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import AppSearchableSelect from '@/components/forms/AppSearchableSelect'
import forms from '@/components/forms/forms.module.css'
import { ENTRY_TEMPLATE_PRESET_PACKS, getPackDisplayName } from '@/lib/entryTemplatePresets'
import { buildGroupedTemplateSelectOptions } from '@/lib/recurringExpenseTemplate'
import styles from './saisieForm.module.css'
import { DateInput } from './saisieFormTypes'
import { useSaisieFormContext } from './saisieFormContext'

export default function SaisieFormCommonHeader() {
  const {
    date,
    setDate,
    libelle,
    setLibelle,
    mode,
    typeOperation,
    exerciceStart,
    calendarMaxDate,
    recurringTemplates,
    selectedTemplateId,
    setSelectedTemplateId,
    applyRecurringTemplate,
  } = useSaisieFormContext()

  const presetPackOrder = useMemo(
    () => ENTRY_TEMPLATE_PRESET_PACKS.map((p) => p.code),
    [],
  )

  const templateGroups = useMemo(
    () =>
      buildGroupedTemplateSelectOptions(
        recurringTemplates,
        (packCode) => getPackDisplayName(packCode) ?? packCode,
        presetPackOrder,
      ),
    [recurringTemplates, presetPackOrder],
  )

  const flatTemplateOptions = useMemo(
    () => templateGroups.flatMap((g) => g.options),
    [templateGroups],
  )

  return (
        <>
          {mode === 'OPERATIONS' && recurringTemplates.length > 0 ? (
            <div className={`${forms.field} ${styles.recurringTemplateRow}`}>
              <label className={forms.label} htmlFor="saisie-recurring-template">
                Modèle de saisie
              </label>
              <AppSearchableSelect
                inputId="saisie-recurring-template"
                groupedOptions={templateGroups}
                value={flatTemplateOptions.find((o) => o.value === selectedTemplateId) ?? null}
                onChange={(v) => {
                  if (v) applyRecurringTemplate(v)
                  else setSelectedTemplateId(null)
                }}
                isClearable
                placeholder="Choisir un modèle…"
              />
            </div>
          ) : null}

        <div className={styles.commonHeaderGrid}>
          <div className={forms.field}>
            <label className={forms.label} htmlFor="saisie-date">
              Date
            </label>
            <DatePicker
              id="saisie-date"
              selected={date}
              onChange={(d: Date | null) => setDate(d)}
              dateFormat="dd/MM/yyyy"
              minDate={exerciceStart}
              maxDate={calendarMaxDate}
              customInput={<DateInput className={forms.input} />}
              wrapperClassName="w-full"
              required
            />
          </div>

          <div className={forms.field}>
            <label className={forms.label} htmlFor="saisie-libelle">
              Libellé{' '}
              {mode === 'OPERATIONS'
                ? typeOperation === 'TRANSFERT'
                  ? '(ex: Retrait caisse)'
                  : '(ex: Achat matériel)'
                : '(ex: Facture, don, virement...)'}
            </label>
            <input
              id="saisie-libelle"
              type="text"
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              required
              className={forms.input}
            />
          </div>
        </div>
        </>
  )
}
