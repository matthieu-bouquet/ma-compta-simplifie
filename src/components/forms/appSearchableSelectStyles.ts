// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import type { StylesConfig, GroupBase } from 'react-select'

/** Shared react-select theme aligned with `forms.module.css` inputs */
export function getAppSearchableSelectStyles<
  Option,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>,
>(): StylesConfig<Option, IsMulti, Group> {
  return {
    control: (base, state) => ({
      ...base,
      minHeight: 40,
      borderRadius: '0.5rem',
      borderColor: state.isFocused ? 'rgba(124, 58, 237, 0.45)' : 'var(--border-color)',
      boxShadow: state.isFocused ? '0 0 0 3px rgba(124, 58, 237, 0.12)' : 'none',
      '&:hover': { borderColor: state.isFocused ? 'rgba(124, 58, 237, 0.45)' : 'var(--border-color)' },
    }),
    valueContainer: (base) => ({ ...base, padding: '0 0.5rem' }),
    input: (base) => ({ ...base, margin: 0, padding: 0 }),
    placeholder: (base) => ({ ...base, color: 'var(--text-secondary)' }),
    singleValue: (base) => ({ ...base, color: 'var(--text-primary)' }),
    menu: (base) => ({
      ...base,
      borderRadius: '0.5rem',
      border: '1px solid var(--border-color)',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-lg)',
    }),
    menuPortal: (base) => ({ ...base, zIndex: 10050 }),
    menuList: (base) => ({ ...base, padding: '0.25rem' }),
    option: (base, state) => ({
      ...base,
      borderRadius: '0.35rem',
      backgroundColor: state.isSelected
        ? 'rgba(124, 58, 237, 0.18)'
        : state.isFocused
          ? 'rgba(124, 58, 237, 0.08)'
          : 'transparent',
      color: 'var(--text-primary)',
      cursor: 'pointer',
    }),
    indicatorSeparator: () => ({ display: 'none' }),
    dropdownIndicator: (base, state) => ({
      ...base,
      color: state.isFocused ? 'var(--primary)' : 'var(--text-secondary)',
    }),
    clearIndicator: (base) => ({ ...base, color: 'var(--text-secondary)' }),
  }
}
