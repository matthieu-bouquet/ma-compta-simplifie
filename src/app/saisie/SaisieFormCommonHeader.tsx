'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import forms from '@/components/forms/forms.module.css'
import styles from './saisieForm.module.css'
import { DateInput } from './saisieFormTypes'
import { useSaisieFormContext } from './saisieFormContext'

export default function SaisieFormCommonHeader() {
  const { date, setDate, libelle, setLibelle, mode, typeOperation, exerciceStart, calendarMaxDate } =
    useSaisieFormContext()

  return (
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
  )
}
