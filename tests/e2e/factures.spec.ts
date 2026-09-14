import { test, expect } from '@playwright/test'
import { createE2EPrisma } from './helpers/db'

test('emit invoice with accounting posts receivable', async ({ page }) => {
  const prisma = createE2EPrisma()
  let associationId: string
  let fiscalYearId: string
  let customerName: string

  try {
    const assoc = await prisma.association.create({
      data: {
        name: 'Association Factures E2E',
        address: '1 place de la République',
        postalCode: '75001',
        city: 'Paris',
        siret: '98765432109876',
        chartTemplateId: '00000000-0000-0000-0000-000000000001',
      },
    })
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

    await prisma.$transaction([
      prisma.account.create({ data: { fiscalYearId, number: '411', name: 'Clients' } }),
      prisma.account.create({ data: { fiscalYearId, number: '706', name: 'Prestations' } }),
    ])

    customerName = 'Client E2E stage'
    await prisma.counterparty.create({
      data: { associationId, kind: 'CUSTOMER', name: customerName },
    })
  } finally {
    await prisma.$disconnect()
  }

  await page.context().addCookies([
    { name: 'currentAssociationId', value: associationId, path: '/', domain: '127.0.0.1' },
    { name: 'currentExerciceId', value: fiscalYearId, path: '/', domain: '127.0.0.1' },
  ])

  await page.goto('/factures/new')

  await page.getByLabel('Client (tiers)').click()
  await page.getByText(customerName, { exact: true }).click()
  await page.getByLabel('Nom affiché *').fill(customerName)
  await page.getByLabel('Description ligne 1 *').fill('Stage week-end E2E')
  await page.getByLabel('Montant TTC (€)').fill('120')
  await page.getByLabel('Compte produit *').click()
  await page.getByText('706 - Prestations', { exact: true }).click()
  await page.getByLabel('Envoyer en compta (créance client, non réglée)').check()

  await page.getByRole('button', { name: 'Émettre la facture' }).click()
  await expect(page).toHaveURL(/\/factures$/)

  await expect(page.getByText('2026-0001')).toBeVisible()
  await expect(page.getByText(customerName)).toBeVisible()
  await expect(page.locator('tbody').getByText('En compta', { exact: true })).toBeVisible()
})
