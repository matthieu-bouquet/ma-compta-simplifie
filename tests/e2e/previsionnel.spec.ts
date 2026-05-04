import { test, expect } from '@playwright/test'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

function getTestDbUrl() {
  const p = path.join(process.cwd(), '.tmp', 'e2e.db')
  return `file:${p}`
}

test('budget prévisionnel: pré-remplir, comparer, modifier, supprimer', async ({ page }) => {
  const prisma = new PrismaClient({
    datasources: { db: { url: getTestDbUrl() } },
  })

  let associationId: string
  let fiscalYearId: string
  let budgetId: string

  try {
    const association = await prisma.association.create({ data: { name: 'Association Prévisionnel E2E' } })
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

    const acc606 = await prisma.account.create({
      data: { fiscalYearId, number: '606', name: 'Achats non stockés' },
    })
    const acc512 = await prisma.account.create({
      data: { fiscalYearId, number: '512', name: 'Banque' },
    })

    await prisma.entry.create({
      data: {
        fiscalYearId,
        journalId: journal.id,
        date: new Date('2026-02-15'),
        description: 'Charge prévisionnel test',
        lines: {
          create: [
            {
              accountId: acc606.id,
              accountNumber: acc606.number,
              accountName: acc606.name,
              debitCents: 10000,
              creditCents: 0,
            },
            {
              accountId: acc512.id,
              accountNumber: acc512.number,
              accountName: acc512.name,
              debitCents: 0,
              creditCents: 10000,
            },
          ],
        },
      },
    })

    for (const row of [
      { number: '606', name: 'Achats non stockés' },
      { number: '740', name: 'Subventions' },
    ]) {
      await prisma.globalChartAccount.upsert({
        where: { number: row.number },
        update: { name: row.name },
        create: row,
      })
    }

    const budget = await prisma.budget.create({
      data: {
        associationId,
        name: 'Budget saison test',
      },
    })
    budgetId = budget.id
  } finally {
    await prisma.$disconnect()
  }

  await page.context().addCookies([
    { name: 'currentAssociationId', value: associationId!, path: '/', domain: '127.0.0.1' },
  ])

  await page.goto(`/previsionnel/${budgetId}`)

  await expect(page.getByRole('heading', { name: 'Budget saison test' })).toBeVisible()

  await page.getByRole('button', { name: 'Pré-remplir depuis un exercice' }).click()

  await page.locator('#prefill-source-exercice').selectOption(fiscalYearId!)
  await page.locator('#prefill-coefficient').fill('100')

  await page.getByRole('button', { name: 'Appliquer' }).click()

  // Ne pas utiliser getByText('606 — …') : ça matche aussi les <option> du select (hidden) et les dialogs.
  const chargesCard = page.locator('.card').filter({ has: page.getByRole('heading', { name: 'Charges (classe 6)' }) })
  const firstChargeRow = chargesCard.locator('tbody tr').first()
  await expect(firstChargeRow).toBeVisible()
  await expect(firstChargeRow).toContainText('606')
  await expect(firstChargeRow).toContainText('Achats non stockés')

  await page.locator('#compare-exercice').selectOption(fiscalYearId!)
  await expect(page.getByRole('columnheader', { name: 'Réalisé' }).first()).toBeVisible()

  const amountInput = chargesCard.getByLabel(/Montant prévisionnel/).first()
  await amountInput.fill('150')
  await page.getByRole('button', { name: 'Enregistrer' }).first().click()

  await expect(amountInput).toHaveValue(/150/)

  await page.goto('/previsionnel')

  // Le libellé apparaît aussi dans les <dialog> (ConfirmDialog), éviter getByText trop large.
  const budgetLink = page.getByRole('link', { name: 'Budget saison test' })
  await expect(budgetLink).toBeVisible()

  await page.getByRole('button', { name: 'Supprimer' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click()

  await expect(budgetLink).toHaveCount(0)
})
