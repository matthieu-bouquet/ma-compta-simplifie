'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import forms from '@/components/forms/forms.module.css'
import type { MembershipSeasonOptions } from '@/lib/membership'

const OPTION_FIELDS: { key: keyof MembershipSeasonOptions; label: string }[] = [
  { key: 'imageRightsConsent', label: 'Droit à l’image' },
  { key: 'internalRulesAccepted', label: 'Règlement intérieur accepté' },
  { key: 'emailCommunicationsConsent', label: 'Accepte les communications par e-mail' },
]

export default function MembershipOptionsFields({
  idPrefix,
  value,
  onChange,
  disabled,
}: {
  idPrefix: string
  value: MembershipSeasonOptions
  onChange: (next: MembershipSeasonOptions) => void
  disabled?: boolean
}) {
  return (
    <div className={`${forms.field} ${forms.fieldFullWidth}`}>
      <span className={forms.label} id={`${idPrefix}-options-label`}>
        Options
      </span>
      <div className={forms.checkboxStack} role="group" aria-labelledby={`${idPrefix}-options-label`}>
        {OPTION_FIELDS.map((field) => {
          const id = `${idPrefix}-${field.key}`
          return (
            <div key={field.key} className={forms.checkboxRow}>
              <input
                id={id}
                type="checkbox"
                checked={value[field.key]}
                disabled={disabled}
                onChange={(e) => onChange({ ...value, [field.key]: e.target.checked })}
              />
              <label htmlFor={id}>{field.label}</label>
            </div>
          )
        })}
      </div>
    </div>
  )
}
