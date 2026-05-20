// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))
import {
  addAccountToTemplate,
  deleteAccountFromTemplate,
  getChartTemplates,
  getTemplateAccounts,
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

  it('adds and deletes a custom template account', async () => {
    const templates = await getChartTemplates()
    const template = templates.find((t) => t.code === 'ASSOCIATION')
    expect(template).toBeTruthy()

    const fd = new FormData()
    fd.set('numero', '99999')
    fd.set('libelle', 'Compte test template')
    await addAccountToTemplate(template!.id, fd)

    const accounts = await getTemplateAccounts(template!.id)
    const added = accounts.find((a) => a.number === '99999')
    expect(added?.name).toBe('Compte test template')

    await deleteAccountFromTemplate(added!.id)
    const after = await getTemplateAccounts(template!.id)
    expect(after.some((a) => a.number === '99999')).toBe(false)
  })
})
