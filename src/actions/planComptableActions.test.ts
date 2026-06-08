// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

let currentAssociationId: string | null = null

vi.mock('@/lib/associationContext', () => ({
  getCurrentAssociationId: async () => currentAssociationId,
}))

const writeAuditEvent = vi.fn()

vi.mock('@/lib/audit', () => ({
  writeAuditEvent: (...args: unknown[]) => writeAuditEvent(...args),
}))

import {
  addAccountToTemplate,
  deleteAccountFromTemplate,
  getChartTemplates,
  getTemplateAccounts,
  getTemplateAccountsForFiscalYearCreation,
  syncTemplateWithDefault,
} from '@/actions/planComptableActions'
import { expectAuditCalled } from '../../tests/helpers/expectAudit'

describe('planComptableActions', () => {
  beforeEach(() => {
    currentAssociationId = null
    writeAuditEvent.mockClear()
  })

  it('lists chart templates', async () => {
    const templates = await getChartTemplates()
    expect(templates.length).toBeGreaterThan(0)
    expect(templates.some((t) => t.code === 'ASSOCIATION' || t.code === 'TPE')).toBe(true)
  })

  it('returns seeded accounts for association template', async () => {
    const accounts = await getTemplateAccountsForFiscalYearCreation('ASSOCIATION')
    expect(accounts.length).toBeGreaterThan(0)
    expect(accounts.some((a) => a.number.startsWith('512'))).toBe(true)
    expect(accounts.some((a) => a.number === '6718')).toBe(true)
    expect(accounts.some((a) => a.number === '6788')).toBe(true)
  })

  it('seeds exceptional charge accounts for TPE template', async () => {
    const accounts = await getTemplateAccountsForFiscalYearCreation('TPE')
    expect(accounts.some((a) => a.number === '6718')).toBe(true)
    expect(accounts.some((a) => a.number === '6788')).toBe(true)
  })

  it('syncTemplateWithDefault adds missing default accounts', async () => {
    const templates = await getChartTemplates()
    const template = templates.find((t) => t.code === 'ASSOCIATION')!
    const bank = (await getTemplateAccounts(template.id)).find((a) => a.number === '512')
    expect(bank).toBeTruthy()
    await deleteAccountFromTemplate(bank!.id)

    const result = await syncTemplateWithDefault('ASSOCIATION')
    expect(result.addedCount).toBeGreaterThan(0)
    const after = await getTemplateAccounts(template.id)
    expect(after.some((a) => a.number === '512')).toBe(true)
  })

  it('rejects duplicate account number on template', async () => {
    const templates = await getChartTemplates()
    const template = templates.find((t) => t.code === 'ASSOCIATION')!
    const accounts = await getTemplateAccounts(template.id)
    const existing = accounts[0]!
    const fd = new FormData()
    fd.set('numero', existing.number)
    fd.set('libelle', 'Duplicate')
    await expect(addAccountToTemplate(template.id, fd)).rejects.toThrow('already exists')
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

    expectAuditCalled(writeAuditEvent, 'CHART_TEMPLATE_ACCOUNT_CREATE', {
      entityType: 'ChartTemplateAccount',
    })
    expectAuditCalled(writeAuditEvent, 'CHART_TEMPLATE_ACCOUNT_DELETE', {
      entityType: 'ChartTemplateAccount',
      entityId: added!.id,
    })
  })
})
