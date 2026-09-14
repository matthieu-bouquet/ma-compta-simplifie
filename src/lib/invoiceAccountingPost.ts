// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import type { Prisma } from '@/lib/db'
import type { PrismaClient } from '@/lib/db'
import { COUNTERPARTY_KIND_CUSTOMER } from '@/lib/counterparty'
import {
  buildCustomerReceivableEntryLines,
  findReceivable411Account,
  type CustomerReceivableEntryLinesResult,
} from '@/lib/customerReceivableEntryLines'
import { allocateEntryReferenceNumber } from '@/lib/journalNumbering'

export type InvoiceLineForAccounting = {
  amountCents: number
  accountId: string | null
  accountNumber: string
  accountName: string
}

export type PreparedInvoiceAccountingPost = {
  fiscalYearId: string
  counterpartyId: string
  receivable411: { id: string; number: string; name: string }
  entryLinesPayload: CustomerReceivableEntryLinesResult
}

export async function prepareInvoiceAccountingPost(
  db: PrismaClient,
  opts: {
    associationId: string
    entryId: string | null
    counterpartyId: string | null
    fiscalYearId: string
    totalCents: number
    lines: InvoiceLineForAccounting[]
  },
): Promise<PreparedInvoiceAccountingPost> {
  if (opts.entryId) {
    throw new Error('Cette facture est déjà en compta.')
  }

  const counterpartyId = opts.counterpartyId?.trim() || null
  if (!counterpartyId) {
    throw new Error('Veuillez choisir un client pour envoyer la facture en compta.')
  }

  const cp = await db.counterparty.findUnique({
    where: { id: counterpartyId },
    select: { associationId: true, kind: true },
  })
  if (!cp || cp.associationId !== opts.associationId) throw new Error('Client introuvable.')
  if (cp.kind !== COUNTERPARTY_KIND_CUSTOMER) throw new Error('Le tiers sélectionné doit être un client.')

  const productLines: {
    accountId: string
    accountNumber: string
    accountName: string
    amountCents: number
  }[] = []

  let linesTotal = 0
  for (let idx = 0; idx < opts.lines.length; idx++) {
    const line = opts.lines[idx]!
    if (!Number.isInteger(line.amountCents) || line.amountCents <= 0) {
      throw new Error(`Ligne ${idx + 1} : montant invalide.`)
    }
    if (!line.accountId) {
      throw new Error(`Ligne ${idx + 1} : compte produit manquant.`)
    }
    if (!line.accountNumber.startsWith('7')) {
      throw new Error(`Ligne ${idx + 1} : choisissez un compte de produit (classe 7).`)
    }
    linesTotal += line.amountCents
    productLines.push({
      accountId: line.accountId,
      accountNumber: line.accountNumber,
      accountName: line.accountName,
      amountCents: line.amountCents,
    })
  }

  if (linesTotal !== opts.totalCents) {
    throw new Error('Le total de la facture ne correspond pas aux lignes enregistrées.')
  }

  const receivable411 = await findReceivable411Account(db, opts.fiscalYearId)
  if (!receivable411) throw new Error('Le compte 411 (Clients) est absent du plan de cet exercice.')

  const entryLinesPayload = await buildCustomerReceivableEntryLines(db, {
    fiscalYearId: opts.fiscalYearId,
    receivableAccountId: receivable411.id,
    receivableAccountNumber: receivable411.number,
    receivableAccountName: receivable411.name,
    productLines,
  })

  return {
    fiscalYearId: opts.fiscalYearId,
    counterpartyId,
    receivable411,
    entryLinesPayload,
  }
}

export async function createInvoiceReceivableEntryInTransaction(
  tx: Prisma.TransactionClient,
  opts: {
    fiscalYearId: string
    issueDate: Date
    invoiceNumber: string
    counterpartyId: string
    journalId: string
    pdfDocumentId: string | null
    entryLinesPayload: CustomerReceivableEntryLinesResult
  },
): Promise<string> {
  let descriptionFinal = `Facture ${opts.invoiceNumber}`
  const cp = await tx.counterparty.findUnique({
    where: { id: opts.counterpartyId },
    select: { name: true },
  })
  if (cp && !descriptionFinal.includes(cp.name)) {
    descriptionFinal = `${descriptionFinal} — ${cp.name}`
  }

  const { referenceNumber, referenceSequence } = await allocateEntryReferenceNumber(tx, {
    fiscalYearId: opts.fiscalYearId,
    journalId: opts.journalId,
  })

  const entry = await tx.entry.create({
    data: {
      date: opts.issueDate,
      description: descriptionFinal,
      journalId: opts.journalId,
      fiscalYearId: opts.fiscalYearId,
      counterpartyId: opts.counterpartyId,
      referenceNumber,
      referenceSequence,
      lines: {
        create: opts.entryLinesPayload.lines.map((l) => ({
          accountId: l.accountId,
          accountNumber: l.accountNumber,
          accountName: l.accountName,
          debitCents: l.debitCents,
          creditCents: l.creditCents,
        })),
      },
    },
    select: { id: true, lines: { select: { id: true } } },
  })

  if (opts.pdfDocumentId && entry.lines.length > 0) {
    await tx.documentEntryLine.createMany({
      data: entry.lines.map((l) => ({ documentId: opts.pdfDocumentId!, entryLineId: l.id })),
    })
  }

  return entry.id
}
