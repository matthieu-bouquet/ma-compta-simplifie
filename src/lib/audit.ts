import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

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

