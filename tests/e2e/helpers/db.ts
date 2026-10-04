// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import path from 'node:path'
import { createPrismaClient } from '@/lib/createPrismaClient'
import type { PrismaClient } from '@/lib/db'
import type { BrowserContext, Page } from '@playwright/test'

export const E2E_COOKIE_DOMAIN = '127.0.0.1'

export function getTestDbUrl(): string {
  const p = path.join(process.cwd(), '.tmp', 'e2e.db')
  return `file:${p}`
}

export function createE2EPrisma(): PrismaClient {
  return createPrismaClient({ url: getTestDbUrl() })
}

/** Wipe accounting rows so empty-state tests start from a blank ledger (keep chart templates). */
export async function clearE2EAccountingData(prisma: PrismaClient): Promise<void> {
  await prisma.taxReceipt.deleteMany({})
  await prisma.donation.deleteMany({})
  await prisma.membershipFee.deleteMany({})
  await prisma.membershipSeasonTariff.deleteMany({})
  await prisma.member.deleteMany({})
  await prisma.membershipCategory.deleteMany({})
  await prisma.membershipSeason.deleteMany({})
  await prisma.taxReceiptSequence.deleteMany({})
  await prisma.invoice.deleteMany({})
  await prisma.invoiceSequence.deleteMany({})
  await prisma.inKindContribution.deleteMany({})
  await prisma.documentEntryLine.deleteMany({})
  await prisma.counterpartySettlementAllocation.deleteMany({})
  await prisma.document.deleteMany({})
  await prisma.entryLine.deleteMany({})
  await prisma.entry.deleteMany({})
  await prisma.account.deleteMany({})
  await prisma.journalSequence.deleteMany({})
  await prisma.fiscalYear.deleteMany({})
  await prisma.budget.deleteMany({})
  await prisma.recurringExpenseTemplate.deleteMany({})
  await prisma.counterparty.deleteMany({})
  await prisma.auditEvent.deleteMany({})
  await prisma.association.deleteMany({})
}

export async function setContextCookies(
  page: Page,
  opts: { associationId: string; fiscalYearId?: string; seasonId?: string },
): Promise<void> {
  const cookies: Parameters<BrowserContext['addCookies']>[0] = [
    { name: 'currentAssociationId', value: opts.associationId, path: '/', domain: E2E_COOKIE_DOMAIN },
  ]
  if (opts.fiscalYearId) {
    cookies.push({
      name: 'currentExerciceId',
      value: opts.fiscalYearId,
      path: '/',
      domain: E2E_COOKIE_DOMAIN,
    })
  }
  if (opts.seasonId) {
    cookies.push({
      name: 'currentSeasonId',
      value: opts.seasonId,
      path: '/',
      domain: E2E_COOKIE_DOMAIN,
    })
  }
  await page.context().addCookies(cookies)
}
