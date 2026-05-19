'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { forwardRef, type InputHTMLAttributes, type WheelEvent } from 'react'

/** Prevents trackpad / mouse wheel from changing the value while the field is focused. */
export function preventNumberInputWheel(e: WheelEvent<HTMLInputElement>) {
  e.currentTarget.blur()
}

export const NumberInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function NumberInput({ onWheel, type = 'number', ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        onWheel={(e) => {
          preventNumberInputWheel(e)
          onWheel?.(e)
        }}
        {...props}
      />
    )
  }
)
