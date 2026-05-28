// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { Prisma, PrismaClient } from '@/generated/prisma/client'

export type CreatePrismaClientOptions = {
  url?: string
  log?: Prisma.LogLevel[]
}

const testClientsByUrl = new Map<string, PrismaClient>()

export function createPrismaClient(opts?: CreatePrismaClientOptions): PrismaClient {
  const url = opts?.url ?? process.env.DATABASE_URL ?? 'file:./prisma/dev.db'

  if (process.env.NODE_ENV === 'test') {
    const cached = testClientsByUrl.get(url)
    if (cached) return cached
  }
  const adapter = new PrismaBetterSqlite3({
    url,
    // SQLite busy wait (ms) — avoids flaky locks under parallel Vitest + sequential $transaction.
    timeout: 30_000,
  })
  const client = new PrismaClient({
    adapter,
    log: opts?.log,
    transactionOptions: {
      maxWait: 30_000,
      timeout: 60_000,
    },
  })

  if (process.env.NODE_ENV === 'test') {
    testClientsByUrl.set(url, client)
  }

  return client
}
