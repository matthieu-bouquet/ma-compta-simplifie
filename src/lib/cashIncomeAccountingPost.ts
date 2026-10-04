// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import type { Prisma } from '@/lib/db'
import { getOrCreateJournalByCode } from '@/lib/journals'
import { allocateEntryReferenceNumber } from '@/lib/journalNumbering'
import { writeAuditEvent } from '@/lib/audit'
import { journalCodeForTreasuryAccount } from '@/lib/membership'

export async function findFiscalYearAccountByNumber(
  tx: Prisma.TransactionClient,
  opts: { fiscalYearId: string; number: string },
) {
  const exact = await tx.account.findFirst({
    where: { fiscalYearId: opts.fiscalYearId, number: opts.number },
  })
  if (exact) return exact
  return tx.account.findFirst({
    where: { fiscalYearId: opts.fiscalYearId, number: { startsWith: opts.number } },
    orderBy: { number: 'asc' },
  })
}

/** Cash receipt: debit treasury (512 or 531), credit income (756 or 754). */
export async function createCashIncomeEntryInTransaction(
  tx: Prisma.TransactionClient,
  opts: {
    associationId: string
    fiscalYearId: string
    date: Date
    description: string
    amountCents: number
    treasuryAccountNumber: string
    incomeAccountNumber: string
    counterpartyId?: string | null
    pdfDocumentId?: string | null
  },
) {
  if (!Number.isInteger(opts.amountCents) || opts.amountCents <= 0) {
    throw new Error('Montant invalide.')
  }

  const treasury = await findFiscalYearAccountByNumber(tx, {
    fiscalYearId: opts.fiscalYearId,
    number: opts.treasuryAccountNumber,
  })
  if (!treasury) {
    throw new Error(`Compte de trésorerie ${opts.treasuryAccountNumber} introuvable dans l’exercice.`)
  }

  const income = await findFiscalYearAccountByNumber(tx, {
    fiscalYearId: opts.fiscalYearId,
    number: opts.incomeAccountNumber,
  })
  if (!income) {
    throw new Error(`Compte ${opts.incomeAccountNumber} introuvable dans l’exercice.`)
  }

  const journalCode = journalCodeForTreasuryAccount(treasury.number)
  const journal = await getOrCreateJournalByCode(tx, {
    code: journalCode,
    name: journalCode === 'CA' ? 'Caisse' : 'Banque',
  })
  const { referenceNumber, referenceSequence } = await allocateEntryReferenceNumber(tx, {
    fiscalYearId: opts.fiscalYearId,
    journalId: journal.id,
  })

  const entry = await tx.entry.create({
    data: {
      date: opts.date,
      description: opts.description,
      journalId: journal.id,
      fiscalYearId: opts.fiscalYearId,
      counterpartyId: opts.counterpartyId ?? null,
      referenceNumber,
      referenceSequence,
      lines: {
        create: [
          {
            accountId: treasury.id,
            accountNumber: treasury.number,
            accountName: treasury.name,
            debitCents: opts.amountCents,
            creditCents: 0,
          },
          {
            accountId: income.id,
            accountNumber: income.number,
            accountName: income.name,
            debitCents: 0,
            creditCents: opts.amountCents,
          },
        ],
      },
    },
    select: { id: true, referenceNumber: true, lines: { select: { id: true } } },
  })

  if (opts.pdfDocumentId && entry.lines.length > 0) {
    await tx.documentEntryLine.createMany({
      data: entry.lines.map((l) => ({ documentId: opts.pdfDocumentId!, entryLineId: l.id })),
    })
  }

  await writeAuditEvent(
    {
      associationId: opts.associationId,
      fiscalYearId: opts.fiscalYearId,
      actor: opts.associationId,
      action: 'ENTRY_CREATE',
      entityType: 'Entry',
      entityId: entry.id,
      data: {
        description: opts.description,
        journalCode,
        referenceNumber: entry.referenceNumber,
        incomeAccountNumber: income.number,
        treasuryAccountNumber: treasury.number,
      },
    },
    tx,
  )

  return { entryId: entry.id, referenceNumber: entry.referenceNumber, treasuryNumber: treasury.number }
}
