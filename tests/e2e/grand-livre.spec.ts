import { test, expect } from '@playwright/test'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

function getTestDbUrl() {
  const p = path.join(process.cwd(), '.tmp', 'e2e.db')
  return `file:${p}`
}

test('grand livre shows injected entry', async ({ page }) => {
  const prisma = new PrismaClient({
    datasources: { db: { url: getTestDbUrl() } },
  })

  let associationId: string
  let fiscalYearId: string

  try {
    const association = await prisma.association.create({ data: { name: 'Association GL E2E' } })
    associationId = association.id

    const fy = await prisma.fiscalYear.create({
      data: {
        associationId,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        status: 'OPEN',
      },
    })
    fiscalYearId = fy.id

    const journal = await prisma.journal.upsert({
      where: { code: 'OD' },
      update: { name: 'Opérations Diverses' },
      create: { code: 'OD', name: 'Opérations Diverses' },
    })

    const debitAccount = await prisma.account.create({
      data: { fiscalYearId, number: '601', name: 'Achats' },
    })
    const creditAccount = await prisma.account.create({
      data: { fiscalYearId, number: '512', name: 'Banque' },
    })

    await prisma.entry.create({
      data: {
        fiscalYearId,
        journalId: journal.id,
        date: new Date('2026-02-01'),
        description: 'Test entry for grand livre',
        referenceNumber: 'OD-000001',
        referenceSequence: 1,
        lines: {
          create: [
            {
              accountId: debitAccount.id,
              accountNumber: debitAccount.number,
              accountName: debitAccount.name,
              debitCents: 1234,
              creditCents: 0,
            },
            {
              accountId: creditAccount.id,
              accountNumber: creditAccount.number,
              accountName: creditAccount.name,
              debitCents: 0,
              creditCents: 1234,
            },
          ],
        },
      },
    })
  } finally {
    await prisma.$disconnect()
  }

  await page.context().addCookies([
    { name: 'currentAssociationId', value: associationId!, path: '/', domain: '127.0.0.1' },
    { name: 'currentExerciceId', value: fiscalYearId!, path: '/', domain: '127.0.0.1' },
  ])

  await page.goto('/ecritures')

  await expect(page.getByText('Test entry for grand livre')).toBeVisible()
  await expect(page.getByText('OD')).toBeVisible()
  await expect(page.getByText('601 - Achats')).toBeVisible()
  await expect(page.getByText('512 - Banque')).toBeVisible()
})

