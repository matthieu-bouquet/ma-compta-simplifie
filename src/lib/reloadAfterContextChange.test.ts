// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, expect, it } from 'vitest'
import { contextChangeNavigationUrl } from './reloadAfterContextChange'

describe('contextChangeNavigationUrl', () => {
  it('drops exerciceId so the cookie becomes the source of truth', () => {
    expect(contextChangeNavigationUrl('http://127.0.0.1:3000/saisie?exerciceId=old&tab=treasury')).toBe(
      '/saisie?tab=treasury',
    )
  })

  it('keeps the current path when there is no exerciceId query', () => {
    expect(contextChangeNavigationUrl('http://127.0.0.1:3000/saisie')).toBe('/saisie')
  })
})
