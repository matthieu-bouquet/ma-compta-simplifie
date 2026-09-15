// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { Prisma } from '@/lib/db'

export function formatTaxReceiptNumber(calendarYear: number, sequence: number): string {
  return `RF-${calendarYear}-${String(sequence).padStart(4, '0')}`
}

export async function allocateTaxReceiptNumber(
  tx: Prisma.TransactionClient,
  opts: { associationId: string; calendarYear: number },
): Promise<{ sequence: number; number: string }> {
  const seqRow = await tx.taxReceiptSequence.findUnique({
    where: {
      associationId_calendarYear: {
        associationId: opts.associationId,
        calendarYear: opts.calendarYear,
      },
    },
    select: { id: true, nextNumber: true },
  })

  const sequence = seqRow?.nextNumber ?? 1

  if (!seqRow) {
    await tx.taxReceiptSequence.create({
      data: {
        associationId: opts.associationId,
        calendarYear: opts.calendarYear,
        nextNumber: sequence + 1,
      },
    })
  } else {
    await tx.taxReceiptSequence.update({
      where: { id: seqRow.id },
      data: { nextNumber: sequence + 1 },
    })
  }

  return { sequence, number: formatTaxReceiptNumber(opts.calendarYear, sequence) }
}
