// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import type { Prisma } from '@/lib/db'
import { allocateEntryReferenceNumber } from '@/lib/journalNumbering'
import { writeAuditEvent } from '@/lib/audit'

export type ReverseEntryInTransactionResult =
  | { skipped: true; reason: 'already_reversed' }
  | { skipped: false; reverseEntryId: string; reverseReferenceNumber: string | null }

/**
 * Creates a balancing reversal entry (swap debits/credits per line), same journal and date as the source.
 * Idempotent: if an ENTRY_REVERSE audit already exists for this entry, does nothing.
 */
export async function reverseEntryInTransaction(
  tx: Prisma.TransactionClient,
  opts: { entryId: string; associationId: string },
): Promise<ReverseEntryInTransactionResult> {
  const alreadyReversed = await tx.auditEvent.findFirst({
    where: {
      action: 'ENTRY_REVERSE',
      entityType: 'Entry',
      entityId: opts.entryId,
    },
    select: { id: true },
  })
  if (alreadyReversed) {
    return { skipped: true, reason: 'already_reversed' }
  }

  const entry = await tx.entry.findUnique({
    where: { id: opts.entryId },
    include: { lines: true },
  })
  if (!entry) throw new Error('Entry not found.')
  if (entry.lines.length === 0) throw new Error('Entry has no lines.')

  const { referenceNumber, referenceSequence } = await allocateEntryReferenceNumber(tx, {
    fiscalYearId: entry.fiscalYearId,
    journalId: entry.journalId,
  })

  const reverse = await tx.entry.create({
    data: {
      date: entry.date,
      description: `REVERSAL: ${entry.description}`,
      journalId: entry.journalId,
      fiscalYearId: entry.fiscalYearId,
      counterpartyId: entry.counterpartyId,
      referenceNumber,
      referenceSequence,
      lines: {
        create: entry.lines.map((l) => ({
          accountId: l.accountId,
          accountNumber: l.accountNumber,
          accountName: l.accountName,
          debitCents: l.creditCents,
          creditCents: l.debitCents,
        })),
      },
    },
    select: { id: true, referenceNumber: true },
  })

  await writeAuditEvent(
    {
      associationId: opts.associationId,
      fiscalYearId: entry.fiscalYearId,
      actor: opts.associationId,
      action: 'ENTRY_REVERSE',
      entityType: 'Entry',
      entityId: entry.id,
      data: { reverseEntryId: reverse.id, reverseReferenceNumber: reverse.referenceNumber },
    },
    tx,
  )

  return { skipped: false, reverseEntryId: reverse.id, reverseReferenceNumber: reverse.referenceNumber }
}
