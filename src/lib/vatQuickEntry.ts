// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import type { Prisma } from '@prisma/client'
import { centsToEuros, eurosToCents } from '@/lib/money'
import { splitTtcToHtAndVatCents } from '@/lib/vatSplit'
import { ensureVatAccountsForAssociation } from '@/lib/vatAccounts'

const VAT_DED = '44566'
const VAT_COL = '44571'

export type QuickVatInput = {
  amountTtcEuros: number
  vatRatePercent: number
  flow: 'DEPENSE' | 'RECETTE'
  settledImmediately: boolean
  operationAccountId: string
  treasuryAccountId: string | null
  thirdPartyAccountId: string | null
}

export type EntryLineInput = { accountId: string; debit: number; credit: number; documents?: File[] }

async function loadAccount(
  db: Prisma.TransactionClient | import('@prisma/client').PrismaClient,
  fiscalYearId: string,
  accountId: string,
) {
  const a = await db.account.findFirst({
    where: { id: accountId, fiscalYearId },
  })
  if (!a) throw new Error('Compte introuvable pour cet exercice.')
  return a
}

async function loadAccountByNumber(
  db: Prisma.TransactionClient | import('@prisma/client').PrismaClient,
  fiscalYearId: string,
  number: string,
) {
  const a = await db.account.findFirst({
    where: { fiscalYearId, number },
  })
  if (!a) throw new Error(`Le compte ${number} est absent du plan de cet exercice.`)
  return a
}

/**
 * Builds three balanced lines (charge/produit + TVA + trésorerie ou tiers) from a TTC amount.
 */
export async function buildEntryLinesFromQuickVat(
  db: Prisma.TransactionClient | import('@prisma/client').PrismaClient,
  opts: {
    fiscalYearId: string
    associationId: string
    input: QuickVatInput
    documentsByLine?: File[][]
  },
): Promise<EntryLineInput[]> {
  const q = opts.input
  if (q.vatRatePercent <= 0) {
    throw new Error('Taux de TVA invalide.')
  }
  if (q.settledImmediately) {
    if (!q.treasuryAccountId) throw new Error('Compte de trésorerie requis.')
    if (q.thirdPartyAccountId) throw new Error('Écriture réglée : ne pas renseigner de compte tiers.')
  } else {
    if (!q.thirdPartyAccountId) throw new Error('Compte fournisseur ou client requis pour une écriture à crédit.')
    if (q.treasuryAccountId) throw new Error('Écriture à crédit : ne pas renseigner la trésorerie.')
  }

  await ensureVatAccountsForAssociation(db, opts.associationId)

  const ttcCents = eurosToCents(q.amountTtcEuros)
  const { htCents, vatCents } = splitTtcToHtAndVatCents(ttcCents, q.vatRatePercent)
  const ht = centsToEuros(htCents)
  const vat = centsToEuros(vatCents)
  const ttc = centsToEuros(ttcCents)

  const fyId = opts.fiscalYearId
  const op = await loadAccount(db, fyId, q.operationAccountId)
  const vatDed = await loadAccountByNumber(db, fyId, VAT_DED)
  const vatCol = await loadAccountByNumber(db, fyId, VAT_COL)

  const treasury = q.treasuryAccountId ? await loadAccount(db, fyId, q.treasuryAccountId) : null
  const third = q.thirdPartyAccountId ? await loadAccount(db, fyId, q.thirdPartyAccountId) : null

  if (third) {
    if (q.flow === 'DEPENSE' && !third.number.startsWith('401')) {
      throw new Error('Pour une dépense à crédit, utilisez un compte fournisseur (401).')
    }
    if (q.flow === 'RECETTE' && !third.number.startsWith('411')) {
      throw new Error('Pour une recette à crédit, utilisez un compte client (411).')
    }
  }

  const docs = opts.documentsByLine ?? []
  const opRowIndex = q.flow === 'DEPENSE' ? 0 : 1
  const opDocs = docs[opRowIndex]?.filter((f): f is File => f != null)

  if (q.flow === 'DEPENSE') {
    const thirdLine = q.settledImmediately && treasury
      ? { accountId: treasury.id, debit: 0, credit: ttc }
      : { accountId: third!.id, debit: 0, credit: ttc }
    return [
      {
        accountId: op.id,
        debit: ht,
        credit: 0,
        documents: opDocs,
      },
      {
        accountId: vatDed.id,
        debit: vat,
        credit: 0,
      },
      thirdLine,
    ]
  }

  // RECETTE
  if (q.settledImmediately && treasury) {
    return [
      {
        accountId: treasury.id,
        debit: ttc,
        credit: 0,
      },
      {
        accountId: op.id,
        debit: 0,
        credit: ht,
        documents: opDocs,
      },
      {
        accountId: vatCol.id,
        debit: 0,
        credit: vat,
      },
    ]
  }

  return [
    {
      accountId: third!.id,
      debit: ttc,
      credit: 0,
    },
    {
      accountId: op.id,
      debit: 0,
      credit: ht,
      documents: opDocs,
    },
    {
      accountId: vatCol.id,
      debit: 0,
      credit: vat,
    },
  ]
}
