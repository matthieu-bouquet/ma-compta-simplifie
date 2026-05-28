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

export async function setContextCookies(
  page: Page,
  opts: { associationId: string; fiscalYearId?: string },
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
  await page.context().addCookies(cookies)
}
