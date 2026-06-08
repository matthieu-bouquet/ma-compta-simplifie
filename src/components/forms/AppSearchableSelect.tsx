'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import type { GroupBase } from 'react-select'
import Select, { type SingleValue } from 'react-select'
import { getAppSearchableSelectStyles } from './appSearchableSelectStyles'
import forms from './forms.module.css'

export type AppSearchableOption = { value: string; label: string }

export type AppSearchableOptionGroup = GroupBase<AppSearchableOption>

type AppSearchableSelectProps = {
  id?: string
  inputId?: string
  'aria-label'?: string
  options?: AppSearchableOption[]
  groupedOptions?: AppSearchableOptionGroup[]
  value: AppSearchableOption | null
  onChange: (nextValue: string | null) => void
  placeholder?: string
  isClearable?: boolean
  isDisabled?: boolean
  noOptionsMessage?: () => string
  /** When false, menu renders inline (default portal: body) */
  useMenuPortal?: boolean
  elevatedZIndex?: boolean
  className?: string
}

export default function AppSearchableSelect({
  id,
  inputId,
  'aria-label': ariaLabel,
  options = [],
  groupedOptions,
  value,
  onChange,
  placeholder,
  isClearable = true,
  isDisabled,
  noOptionsMessage = () => 'Aucun résultat',
  useMenuPortal = true,
  elevatedZIndex,
  className,
}: AppSearchableSelectProps) {
  const wrapClass = [
    forms.searchableSelectWrap,
    elevatedZIndex ? forms.searchableSelectWrapElevated : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ')

  const selectOptions = groupedOptions ?? options

  return (
    <div className={wrapClass}>
      <Select<AppSearchableOption, false, AppSearchableOptionGroup>
        instanceId={id ?? inputId}
        inputId={inputId ?? id}
        aria-label={ariaLabel}
        options={selectOptions}
        styles={getAppSearchableSelectStyles<AppSearchableOption, false, AppSearchableOptionGroup>()}
        value={value}
        onChange={(v: SingleValue<AppSearchableOption>) => onChange(v?.value ?? null)}
        placeholder={placeholder}
        isClearable={isClearable}
        isDisabled={isDisabled}
        isSearchable
        noOptionsMessage={noOptionsMessage}
        menuPortalTarget={useMenuPortal && typeof document !== 'undefined' ? document.body : null}
        menuPosition={useMenuPortal ? 'fixed' : 'absolute'}
      />
    </div>
  )
}
