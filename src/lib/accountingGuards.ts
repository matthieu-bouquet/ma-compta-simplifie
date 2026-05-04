import { prisma } from '@/lib/prisma'

export async function assertFiscalYearBelongsToCurrentAssociation(opts: {
  fiscalYearId: string
  associationId: string
}) {
  const fiscalYear = await prisma.fiscalYear.findUnique({
    where: { id: opts.fiscalYearId },
    select: { id: true, associationId: true, status: true, association: { select: { isClosed: true } } },
  })

  if (!fiscalYear || fiscalYear.associationId !== opts.associationId) {
    throw new Error('Fiscal year not found.')
  }

  return fiscalYear
}

export async function assertFiscalYearWritable(opts: { fiscalYearId: string; associationId: string }) {
  const fiscalYear = await assertFiscalYearBelongsToCurrentAssociation(opts)

  if (fiscalYear.status !== 'OPEN') {
    throw new Error('Cannot write: fiscal year is closed.')
  }
  if (fiscalYear.association?.isClosed) {
    throw new Error('Cannot write: association is closed.')
  }

  return fiscalYear
}

