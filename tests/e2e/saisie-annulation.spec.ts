import { test, expect } from '@playwright/test'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

function getTestDbUrl() {
  const p = path.join(process.cwd(), '.tmp', 'e2e.db')
  return `file:${p}`
}

test("annuler une écriture: wording distinct et fermeture de modal", async ({ page }) => {
  const prisma = new PrismaClient({ datasources: { db: { url: getTestDbUrl() } } })

  let associationId: string
  let fiscalYearId: string

  try {
    const assoc = await prisma.association.create({ data: { name: 'Association SAISIE E2E' } })
    associationId = assoc.id

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
        description: 'Test annulation saisie',
        referenceNumber: 'OD-000001',
        referenceSequence: 1,
        lines: {
          create: [
            {
              accountId: debitAccount.id,
              accountNumber: debitAccount.number,
              accountName: debitAccount.name,
              debitCents: 1000,
              creditCents: 0,
            },
            {
              accountId: creditAccount.id,
              accountNumber: creditAccount.number,
              accountName: creditAccount.name,
              debitCents: 0,
              creditCents: 1000,
            },
          ],
        },
      },
    })
  } finally {
    await prisma.$disconnect()
  }

  await page.context().addCookies([
    { name: 'currentAssociationId', value: associationId, path: '/', domain: '127.0.0.1' },
    { name: 'currentExerciceId', value: fiscalYearId, path: '/', domain: '127.0.0.1' },
  ])

  await page.goto('/saisie')

  const row = page.locator('tr', { hasText: 'Test annulation saisie' }).first()
  await expect(row).toBeVisible()

  await row.locator('button[title="Annuler"]').click()

  const dialog = page.locator('dialog[open]')
  await expect(dialog.getByRole('heading', { name: 'Annuler l’écriture' })).toBeVisible()

  // Boutons d'actions: wording distinct.
  await expect(dialog.getByRole('button', { name: 'Fermer' }).last()).toBeVisible()
  await expect(dialog.getByRole('button', { name: "Valider l’annulation" })).toBeVisible()

  // Double click should not create two reversals.
  await dialog.getByRole('button', { name: "Valider l’annulation" }).dblclick()

  // La modal doit se fermer après l'annulation.
  await expect(page.locator('dialog[open]')).toHaveCount(0)

  // Une seule contrepassation doit être créée (pas de double soumission).
  const prismaCheck = new PrismaClient({ datasources: { db: { url: getTestDbUrl() } } })
  try {
    const reversals = await prismaCheck.entry.count({
      where: { fiscalYearId, description: 'REVERSAL: Test annulation saisie' },
    })
    expect(reversals).toBe(1)
  } finally {
    await prismaCheck.$disconnect()
  }
})

