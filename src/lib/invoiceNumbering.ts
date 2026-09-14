// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { Prisma } from '@/lib/db'

export function formatInvoiceNumber(sequence: number, issueDate: Date): string {
  const year = issueDate.getUTCFullYear()
  return `${year}-${String(sequence).padStart(4, '0')}`
}

export async function allocateInvoiceNumber(
  tx: Prisma.TransactionClient,
  opts: { fiscalYearId: string; issueDate: Date },
): Promise<{ sequence: number; number: string }> {
  const seqRow = await tx.invoiceSequence.findUnique({
    where: { fiscalYearId: opts.fiscalYearId },
    select: { id: true, nextNumber: true },
  })

  const sequence = seqRow?.nextNumber ?? 1

  if (!seqRow) {
    await tx.invoiceSequence.create({
      data: { fiscalYearId: opts.fiscalYearId, nextNumber: sequence + 1 },
    })
  } else {
    await tx.invoiceSequence.update({
      where: { id: seqRow.id },
      data: { nextNumber: sequence + 1 },
    })
  }

  return {
    sequence,
    number: formatInvoiceNumber(sequence, opts.issueDate),
  }
}
