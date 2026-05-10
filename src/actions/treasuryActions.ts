// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

'use server'

import { prisma } from '@/lib/prisma'
import { getCurrentAssociationId } from '@/lib/associationContext'
import { assertFiscalYearWritable } from '@/lib/accountingGuards'
import { getOrCreateJournalByCode } from '@/lib/journals'
import { allocateEntryReferenceNumber } from '@/lib/journalNumbering'
import { writeAuditEvent } from '@/lib/audit'
import { eurosToCents } from '@/lib/money'
import type { Prisma } from '@prisma/client'

type OpenItemRow = {
  payableLineId: string
  entryId: string
  entryDate: string // ISO
  description: string
  referenceNumber: string | null
  totalCents: number
  allocatedCents: number
  remainingCents: number
}

function isCashAccountNumber(accountNumber: string) {
  return accountNumber.startsWith('53')
}

async function loadThirdPartyAccountId(
  tx: Prisma.TransactionClient,
  fiscalYearId: string,
  rootPrefix: '401' | '411'
) {
  const exact = await tx.account.findFirst({
    where: { fiscalYearId, number: rootPrefix },
    select: { id: true },
  })
  if (exact) return exact.id

  const any = await tx.account.findFirst({
    where: { fiscalYearId, number: { startsWith: rootPrefix } },
    select: { id: true },
  })
  if (!any) throw new Error(`Compte ${rootPrefix} introuvable dans cet exercice.`)
  return any.id
}

async function loadAccountSnapshot(tx: Prisma.TransactionClient, fiscalYearId: string, accountId: string) {
  const acc = await tx.account.findFirst({
    where: { id: accountId, fiscalYearId },
    select: { id: true, number: true, name: true },
  })
  if (!acc) throw new Error('Compte introuvable dans cet exercice.')
  return acc
}

function assertNonEmptyString(v: unknown, msg: string): asserts v is string {
  if (typeof v !== 'string' || v.trim() === '') throw new Error(msg)
}

function assertPositiveCents(v: number, msg: string) {
  if (!Number.isFinite(v) || v <= 0) throw new Error(msg)
  if (!Number.isInteger(v)) throw new Error('Montant invalide (centimes).')
}

async function listOpenItems(opts: {
  fiscalYearId: string
  counterpartyId: string
  accountPrefix: '401' | '411'
  direction: 'CREDIT' | 'DEBIT'
  take?: number
}) {
  const take = opts.take ?? 200

  const lines = await prisma.entryLine.findMany({
    where: {
      entry: { fiscalYearId: opts.fiscalYearId, counterpartyId: opts.counterpartyId },
      accountNumber: { startsWith: opts.accountPrefix },
      ...(opts.direction === 'CREDIT' ? { creditCents: { gt: 0 } } : { debitCents: { gt: 0 } }),
    },
    include: {
      entry: { select: { id: true, date: true, description: true, referenceNumber: true } },
      payableAllocations: { select: { amountCents: true } },
    },
    orderBy: [{ entry: { date: 'desc' } }, { id: 'desc' }],
    take,
  })

  const rows: OpenItemRow[] = []
  for (const l of lines) {
    const totalCents = opts.direction === 'CREDIT' ? l.creditCents : l.debitCents
    const allocatedCents = l.payableAllocations.reduce((s, a) => s + a.amountCents, 0)
    const remainingCents = totalCents - allocatedCents
    if (remainingCents <= 0) continue
    rows.push({
      payableLineId: l.id,
      entryId: l.entry.id,
      entryDate: l.entry.date.toISOString().slice(0, 10),
      description: l.entry.description,
      referenceNumber: l.entry.referenceNumber ?? null,
      totalCents,
      allocatedCents,
      remainingCents,
    })
  }

  return rows
}

export async function listOpenSupplierPayables(data: {
  fiscalYearId: string
  counterpartyId: string
  take?: number
}) {
  const associationId = await getCurrentAssociationId()
  if (!associationId) throw new Error('Association non sélectionnée.')

  await assertFiscalYearWritable({ fiscalYearId: data.fiscalYearId, associationId })

  // Supplier debt comes from 401 credit lines.
  return await listOpenItems({
    fiscalYearId: data.fiscalYearId,
    counterpartyId: data.counterpartyId,
    accountPrefix: '401',
    direction: 'CREDIT',
    take: data.take,
  })
}

export async function listOpenCustomerReceivables(data: {
  fiscalYearId: string
  counterpartyId: string
  take?: number
}) {
  const associationId = await getCurrentAssociationId()
  if (!associationId) throw new Error('Association non sélectionnée.')

  await assertFiscalYearWritable({ fiscalYearId: data.fiscalYearId, associationId })

  // Customer receivable comes from 411 debit lines.
  return await listOpenItems({
    fiscalYearId: data.fiscalYearId,
    counterpartyId: data.counterpartyId,
    accountPrefix: '411',
    direction: 'DEBIT',
    take: data.take,
  })
}

export async function createSupplierSettlement(data: {
  fiscalYearId: string
  date: string // YYYY-MM-DD
  counterpartyId: string
  treasuryAccountId: string
  description: string
  amountEuros: number
  allocations: { payableLineId: string; amountEuros: number }[]
}) {
  const associationId = await getCurrentAssociationId()
  if (!associationId) throw new Error('Association non sélectionnée.')
  await assertFiscalYearWritable({ fiscalYearId: data.fiscalYearId, associationId })

  assertNonEmptyString(data.date, 'Date requise.')
  assertNonEmptyString(data.counterpartyId, 'Fournisseur requis.')
  assertNonEmptyString(data.treasuryAccountId, 'Compte de trésorerie requis.')
  assertNonEmptyString(data.description, 'Libellé requis.')

  const amountCents = eurosToCents(data.amountEuros)
  assertPositiveCents(amountCents, 'Montant du règlement invalide.')

  const allocationCents = data.allocations.map((a) => ({
    payableLineId: a.payableLineId,
    amountCents: eurosToCents(a.amountEuros),
  }))
  const sumAllocCents = allocationCents.reduce((s, a) => s + a.amountCents, 0)
  if (sumAllocCents !== amountCents) {
    throw new Error('La somme des affectations doit être égale au montant du règlement.')
  }
  if (allocationCents.some((a) => a.amountCents <= 0)) {
    throw new Error('Chaque affectation doit être strictement positive.')
  }

  const created = await prisma.$transaction(async (tx) => {
    const thirdPartyAccountId = await loadThirdPartyAccountId(tx, data.fiscalYearId, '401')
    const [treasury, thirdParty] = await Promise.all([
      loadAccountSnapshot(tx, data.fiscalYearId, data.treasuryAccountId),
      loadAccountSnapshot(tx, data.fiscalYearId, thirdPartyAccountId),
    ])

    const journalCode = isCashAccountNumber(treasury.number) ? 'CA' : 'BQ'
    const journal = await getOrCreateJournalByCode(tx, {
      code: journalCode,
      name: journalCode === 'CA' ? 'Caisse' : 'Banque',
    })

    const { referenceNumber, referenceSequence } = await allocateEntryReferenceNumber(tx, {
      fiscalYearId: data.fiscalYearId,
      journalId: journal.id,
    })

    // Validate payable lines belong to same supplier + fiscal year and are 401 credit lines.
    const payableLineIds = allocationCents.map((a) => a.payableLineId)
    const payableLines = await tx.entryLine.findMany({
      where: {
        id: { in: payableLineIds },
        accountNumber: { startsWith: '401' },
        entry: { fiscalYearId: data.fiscalYearId, counterpartyId: data.counterpartyId },
      },
      include: { payableAllocations: { select: { amountCents: true } } },
    })
    if (payableLines.length !== payableLineIds.length) {
      throw new Error('Certaines dettes sélectionnées sont introuvables ou incohérentes.')
    }
    const remainingById = new Map(
      payableLines.map((l) => {
        const allocated = l.payableAllocations.reduce((s, a) => s + a.amountCents, 0)
        return [l.id, l.creditCents - allocated] as const
      })
    )
    for (const a of allocationCents) {
      const remaining = remainingById.get(a.payableLineId) ?? 0
      if (a.amountCents > remaining) {
        throw new Error("Affectation invalide : montant supérieur au restant dû pour une dette.")
      }
    }

    const entry = await tx.entry.create({
      data: {
        fiscalYearId: data.fiscalYearId,
        journalId: journal.id,
        date: new Date(data.date),
        description: data.description,
        counterpartyId: data.counterpartyId,
        referenceNumber,
        referenceSequence,
        lines: {
          create: [
            {
              accountId: thirdParty.id,
              accountNumber: thirdParty.number,
              accountName: thirdParty.name,
              debitCents: amountCents,
              creditCents: 0,
            },
            {
              accountId: treasury.id,
              accountNumber: treasury.number,
              accountName: treasury.name,
              debitCents: 0,
              creditCents: amountCents,
            },
          ],
        },
      },
      select: { id: true, lines: { select: { id: true, accountNumber: true } } },
    })

    const settlementLine = entry.lines.find((l) => l.accountNumber.startsWith('401'))
    if (!settlementLine) throw new Error('Ligne 401 introuvable sur le règlement créé.')

    await tx.counterpartySettlementAllocation.createMany({
      data: allocationCents.map((a) => ({
        payableLineId: a.payableLineId,
        settlementLineId: settlementLine.id,
        amountCents: a.amountCents,
      })),
    })

    await writeAuditEvent(
      {
        associationId,
        fiscalYearId: data.fiscalYearId,
        actor: associationId,
        action: 'SUPPLIER_SETTLEMENT_CREATE',
        entityType: 'Entry',
        entityId: entry.id,
        data: {
          counterpartyId: data.counterpartyId,
          treasuryAccountId: data.treasuryAccountId,
          amountCents,
          allocations: allocationCents,
        },
      },
      tx
    )

    return { entryId: entry.id }
  })

  return created
}

export async function createCustomerReceipt(data: {
  fiscalYearId: string
  date: string // YYYY-MM-DD
  counterpartyId: string
  treasuryAccountId: string
  description: string
  amountEuros: number
  allocations: { payableLineId: string; amountEuros: number }[]
}) {
  const associationId = await getCurrentAssociationId()
  if (!associationId) throw new Error('Association non sélectionnée.')
  await assertFiscalYearWritable({ fiscalYearId: data.fiscalYearId, associationId })

  assertNonEmptyString(data.date, 'Date requise.')
  assertNonEmptyString(data.counterpartyId, 'Client requis.')
  assertNonEmptyString(data.treasuryAccountId, 'Compte de trésorerie requis.')
  assertNonEmptyString(data.description, 'Libellé requis.')

  const amountCents = eurosToCents(data.amountEuros)
  assertPositiveCents(amountCents, "Montant de l'encaissement invalide.")

  const allocationCents = data.allocations.map((a) => ({
    payableLineId: a.payableLineId,
    amountCents: eurosToCents(a.amountEuros),
  }))
  const sumAllocCents = allocationCents.reduce((s, a) => s + a.amountCents, 0)
  if (sumAllocCents !== amountCents) {
    throw new Error("La somme des affectations doit être égale au montant de l'encaissement.")
  }
  if (allocationCents.some((a) => a.amountCents <= 0)) {
    throw new Error('Chaque affectation doit être strictement positive.')
  }

  const created = await prisma.$transaction(async (tx) => {
    const thirdPartyAccountId = await loadThirdPartyAccountId(tx, data.fiscalYearId, '411')
    const [treasury, thirdParty] = await Promise.all([
      loadAccountSnapshot(tx, data.fiscalYearId, data.treasuryAccountId),
      loadAccountSnapshot(tx, data.fiscalYearId, thirdPartyAccountId),
    ])

    const journalCode = isCashAccountNumber(treasury.number) ? 'CA' : 'BQ'
    const journal = await getOrCreateJournalByCode(tx, {
      code: journalCode,
      name: journalCode === 'CA' ? 'Caisse' : 'Banque',
    })

    const { referenceNumber, referenceSequence } = await allocateEntryReferenceNumber(tx, {
      fiscalYearId: data.fiscalYearId,
      journalId: journal.id,
    })

    // Validate receivable lines belong to same customer + fiscal year and are 411 debit lines.
    const payableLineIds = allocationCents.map((a) => a.payableLineId)
    const receivableLines = await tx.entryLine.findMany({
      where: {
        id: { in: payableLineIds },
        accountNumber: { startsWith: '411' },
        entry: { fiscalYearId: data.fiscalYearId, counterpartyId: data.counterpartyId },
      },
      include: { payableAllocations: { select: { amountCents: true } } },
    })
    if (receivableLines.length !== payableLineIds.length) {
      throw new Error('Certaines créances sélectionnées sont introuvables ou incohérentes.')
    }
    const remainingById = new Map(
      receivableLines.map((l) => {
        const allocated = l.payableAllocations.reduce((s, a) => s + a.amountCents, 0)
        return [l.id, l.debitCents - allocated] as const
      })
    )
    for (const a of allocationCents) {
      const remaining = remainingById.get(a.payableLineId) ?? 0
      if (a.amountCents > remaining) {
        throw new Error("Affectation invalide : montant supérieur au restant dû pour une créance.")
      }
    }

    const entry = await tx.entry.create({
      data: {
        fiscalYearId: data.fiscalYearId,
        journalId: journal.id,
        date: new Date(data.date),
        description: data.description,
        counterpartyId: data.counterpartyId,
        referenceNumber,
        referenceSequence,
        lines: {
          create: [
            {
              accountId: treasury.id,
              accountNumber: treasury.number,
              accountName: treasury.name,
              debitCents: amountCents,
              creditCents: 0,
            },
            {
              accountId: thirdParty.id,
              accountNumber: thirdParty.number,
              accountName: thirdParty.name,
              debitCents: 0,
              creditCents: amountCents,
            },
          ],
        },
      },
      select: { id: true, lines: { select: { id: true, accountNumber: true } } },
    })

    const settlementLine = entry.lines.find((l) => l.accountNumber.startsWith('411'))
    if (!settlementLine) throw new Error('Ligne 411 introuvable sur l’encaissement créé.')

    await tx.counterpartySettlementAllocation.createMany({
      data: allocationCents.map((a) => ({
        payableLineId: a.payableLineId,
        settlementLineId: settlementLine.id,
        amountCents: a.amountCents,
      })),
    })

    await writeAuditEvent(
      {
        associationId,
        fiscalYearId: data.fiscalYearId,
        actor: associationId,
        action: 'CUSTOMER_RECEIPT_CREATE',
        entityType: 'Entry',
        entityId: entry.id,
        data: {
          counterpartyId: data.counterpartyId,
          treasuryAccountId: data.treasuryAccountId,
          amountCents,
          allocations: allocationCents,
        },
      },
      tx
    )

    return { entryId: entry.id }
  })

  return created
}

