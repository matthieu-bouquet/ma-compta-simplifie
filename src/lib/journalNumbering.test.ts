import { PrismaClient } from '@prisma/client'
import { allocateEntryReferenceNumber } from '@/lib/journalNumbering'

describe('allocateEntryReferenceNumber', () => {
  it('allocates sequential reference numbers per fiscal year and journal', async () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeTruthy()
    const prisma = new PrismaClient({
      datasources: { db: { url: dbUrl } },
    })
    try {
      const association = await prisma.association.create({ data: { name: 'Test Association' } })
      const fy = await prisma.fiscalYear.create({
        data: {
          associationId: association.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'OPEN',
        },
      })
      const journal = await prisma.journal.create({ data: { code: 'OD', name: 'Opérations Diverses' } })

      const r1 = await prisma.$transaction((tx) =>
        allocateEntryReferenceNumber(tx, { fiscalYearId: fy.id, journalId: journal.id })
      )
      const r2 = await prisma.$transaction((tx) =>
        allocateEntryReferenceNumber(tx, { fiscalYearId: fy.id, journalId: journal.id })
      )

      expect(r1.referenceSequence).toBe(1)
      expect(r2.referenceSequence).toBe(2)
      expect(r1.referenceNumber).toBe('OD-000001')
      expect(r2.referenceNumber).toBe('OD-000002')
    } finally {
      await prisma.$disconnect()
    }
  })
})

