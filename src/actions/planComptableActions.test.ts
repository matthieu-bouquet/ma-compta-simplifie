// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, expect, it } from 'vitest'
import {
  getChartTemplates,
  getTemplateAccountsForFiscalYearCreation,
} from '@/actions/planComptableActions'

describe('planComptableActions', () => {
  it('lists chart templates', async () => {
    const templates = await getChartTemplates()
    expect(templates.length).toBeGreaterThan(0)
    expect(templates.some((t) => t.code === 'ASSOCIATION' || t.code === 'TPE')).toBe(true)
  })

  it('returns seeded accounts for association template', async () => {
    const accounts = await getTemplateAccountsForFiscalYearCreation('ASSOCIATION')
    expect(accounts.length).toBeGreaterThan(0)
    expect(accounts.some((a) => a.number.startsWith('512'))).toBe(true)
  })
})
