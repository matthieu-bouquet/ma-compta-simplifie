import { Prisma } from '@prisma/client'

function formatReferenceNumber(journalCode: string, sequence: number) {
  return `${journalCode}-${String(sequence).padStart(6, '0')}`
}

export async function allocateEntryReferenceNumber(
  tx: Prisma.TransactionClient,
  opts: { fiscalYearId: string; journalId: string }
) {
  const journal = await tx.journal.findUnique({
    where: { id: opts.journalId },
    select: { code: true },
  })
  if (!journal) throw new Error('Journal introuvable.')

  const seq = await tx.journalSequence.findUnique({
    where: { fiscalYearId_journalId: { fiscalYearId: opts.fiscalYearId, journalId: opts.journalId } },
    select: { id: true, nextNumber: true },
  })

  const referenceSequence = seq?.nextNumber ?? 1

  if (!seq) {
    await tx.journalSequence.create({
      data: { fiscalYearId: opts.fiscalYearId, journalId: opts.journalId, nextNumber: referenceSequence + 1 },
    })
  } else {
    await tx.journalSequence.update({
      where: { id: seq.id },
      data: { nextNumber: referenceSequence + 1 },
    })
  }

  return {
    referenceSequence,
    referenceNumber: formatReferenceNumber(journal.code, referenceSequence),
  }
}

