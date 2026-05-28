// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import type { PrismaClient } from '@/lib/db'

export const CHART_TEMPLATE_ASSOCIATION = '00000000-0000-0000-0000-000000000001'
export const CHART_TEMPLATE_TPE = '00000000-0000-0000-0000-000000000002'

export const STANDARD_JOURNAL_CODES = ['AC', 'BQ', 'CA', 'OD', 'VE'] as const

const STANDARD_JOURNALS: { code: string; name: string }[] = [
  { code: 'AC', name: 'Achats' },
  { code: 'BQ', name: 'Banque' },
  { code: 'CA', name: 'Caisse' },
  { code: 'OD', name: 'Opérations Diverses' },
  { code: 'VE', name: 'Ventes' },
]

export type SeedAssociationOptions = {
  name?: string
  vatLiable?: boolean
  chartTemplateId?: string
  legalFormCode?: string
}

export type SeedFiscalYearOptions = {
  startDate?: Date
  endDate?: Date
  status?: 'OPEN' | 'CLOSED'
}

export type SeededContext = {
  associationId: string
  fiscalYearId: string
}

export type SeededSaisieContext = SeededContext & {
  accounts: {
    expense606: { id: string; number: string }
    bank512: { id: string; number: string }
    supplier401?: { id: string; number: string }
  }
}

export async function seedStandardJournals(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction(
    STANDARD_JOURNALS.map((j) =>
      prisma.journal.upsert({
        where: { code: j.code },
        update: { name: j.name },
        create: { code: j.code, name: j.name },
      }),
    ),
  )
}

export async function seedAssociationWithFiscalYear(
  prisma: PrismaClient,
  associationOpts: SeedAssociationOptions = {},
  fiscalYearOpts: SeedFiscalYearOptions = {},
): Promise<SeededContext> {
  const assoc = await prisma.association.create({
    data: {
      name: associationOpts.name ?? 'Association E2E',
      vatLiable: associationOpts.vatLiable ?? false,
      chartTemplateId: associationOpts.chartTemplateId ?? CHART_TEMPLATE_ASSOCIATION,
      legalFormCode: associationOpts.legalFormCode,
    },
  })

  const fy = await prisma.fiscalYear.create({
    data: {
      associationId: assoc.id,
      startDate: fiscalYearOpts.startDate ?? new Date('2026-01-01'),
      endDate: fiscalYearOpts.endDate ?? new Date('2026-12-31'),
      status: fiscalYearOpts.status ?? 'OPEN',
    },
  })

  return { associationId: assoc.id, fiscalYearId: fy.id }
}

export async function seedSaisieBase(
  prisma: PrismaClient,
  associationOpts: SeedAssociationOptions = {},
): Promise<SeededSaisieContext> {
  const { associationId, fiscalYearId } = await seedAssociationWithFiscalYear(prisma, associationOpts)
  await seedStandardJournals(prisma)

  const [expense606, bank512, supplier401] = await Promise.all([
    prisma.account.create({
      data: { fiscalYearId, number: '606', name: 'Achats non stockés' },
    }),
    prisma.account.create({
      data: { fiscalYearId, number: '512', name: 'Banque' },
    }),
    prisma.account.create({
      data: { fiscalYearId, number: '401', name: 'Fournisseurs' },
    }),
  ])

  return {
    associationId,
    fiscalYearId,
    accounts: {
      expense606: { id: expense606.id, number: expense606.number },
      bank512: { id: bank512.id, number: bank512.number },
      supplier401: { id: supplier401.id, number: supplier401.number },
    },
  }
}

export async function seedBalancedExpenseEntry(
  prisma: PrismaClient,
  opts: {
    fiscalYearId: string
    description: string
    debitAccount: { id: string; number: string; name: string }
    creditAccount: { id: string; number: string; name: string }
    amountCents?: number
    date?: Date
    journalCode?: string
  },
): Promise<{ entryId: string; lineId: string }> {
  const journal = await prisma.journal.upsert({
    where: { code: opts.journalCode ?? 'OD' },
    update: { name: 'Opérations Diverses' },
    create: { code: opts.journalCode ?? 'OD', name: 'Opérations Diverses' },
  })

  const amountCents = opts.amountCents ?? 1000

  const entry = await prisma.entry.create({
    data: {
      fiscalYearId: opts.fiscalYearId,
      journalId: journal.id,
      date: opts.date ?? new Date('2026-02-01'),
      description: opts.description,
      referenceNumber: 'OD-E2E-001',
      referenceSequence: 1,
      lines: {
        create: [
          {
            accountId: opts.debitAccount.id,
            accountNumber: opts.debitAccount.number,
            accountName: opts.debitAccount.name,
            debitCents: amountCents,
            creditCents: 0,
          },
          {
            accountId: opts.creditAccount.id,
            accountNumber: opts.creditAccount.number,
            accountName: opts.creditAccount.name,
            debitCents: 0,
            creditCents: amountCents,
          },
        ],
      },
    },
    include: { lines: true },
  })

  const lineId = entry.lines[0]?.id
  if (!lineId) throw new Error('Expected at least one entry line')
  return { entryId: entry.id, lineId }
}
