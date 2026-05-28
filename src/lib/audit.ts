// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/lib/db'

export async function writeAuditEvent(evt: {
  associationId?: string | null
  fiscalYearId?: string | null
  actor?: string | null
  action: string
  entityType: string
  entityId?: string | null
  data?: unknown
}, db: Prisma.TransactionClient | typeof prisma = prisma) {
  await db.auditEvent.create({
    data: {
      associationId: evt.associationId ?? null,
      fiscalYearId: evt.fiscalYearId ?? null,
      actor: evt.actor ?? null,
      action: evt.action,
      entityType: evt.entityType,
      entityId: evt.entityId ?? null,
      data: evt.data === undefined ? null : JSON.stringify(evt.data),
    },
  })
}

