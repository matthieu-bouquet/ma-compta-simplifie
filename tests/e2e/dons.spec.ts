import { test, expect } from '@playwright/test'
import { createE2EPrisma, setContextCookies } from './helpers/db'

test('record donation issues tax receipt', async ({ page }) => {
  const prisma = createE2EPrisma()
  let associationId: string
  let fiscalYearId: string

  try {
    const assoc = await prisma.association.create({
      data: {
        name: 'Asso Dons E2E',
        legalFormCode: 'ASSOCIATION',
        address: '1 rue du Don',
        postalCode: '75001',
        city: 'Paris',
        rna: 'W751111111',
        receiptSignatoryName: 'Claire Trésor',
        receiptSignatoryRole: 'Trésorière',
        taxReceiptEligibilityAttested: true,
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
      prisma.account.create({ data: { fiscalYearId, number: '512', name: 'Banque' } }),
      prisma.account.create({ data: { fiscalYearId, number: '7541', name: 'Dons manuels' } }),
    ])
  } finally {
    await prisma.$disconnect()
  }

  await setContextCookies(page, { associationId: associationId!, fiscalYearId: fiscalYearId! })

  await page.goto('/dons/new')
  await page.getByLabel('Nom *').fill('Paul Mécène')
  await page.getByLabel('Adresse *').fill('5 boulevard Test')
  await page.getByLabel('Code postal *').fill('75003')
  await page.getByLabel('Ville *').fill('Paris')
  await page.getByLabel('Montant (€) *').fill('50')
  await page.getByLabel(
    'J’atteste que ce versement est un don (pas une cotisation avec contrepartie) et que l’association est un organisme d’intérêt général (art. 200 et 238 bis CGI).',
  ).check()
  await page.getByRole('button', { name: 'Enregistrer et émettre le reçu' }).click()

  await expect(page).toHaveURL(/\/dons$/)
  await expect(page.getByRole('cell', { name: 'RF-2026-0001', exact: true })).toBeVisible()
  await expect(page.getByText('Paul Mécène')).toBeVisible()

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Télécharger le reçu RF-2026-0001' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/recu_fiscal_RF-2026-0001/i)
})
