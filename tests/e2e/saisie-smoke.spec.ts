import { test, expect } from '@playwright/test'
import { createE2EPrisma, setContextCookies } from './helpers/db'
import { seedSaisieBase } from './helpers/fixtures'

test.describe('saisie smoke', () => {
  test('dépense rapide (montant TTC)', async ({ page }) => {
    const prisma = createE2EPrisma()
    let associationId: string
    let fiscalYearId: string

    try {
      const seeded = await seedSaisieBase(prisma, { name: 'Smoke Depense E2E' })
      associationId = seeded.associationId
      fiscalYearId = seeded.fiscalYearId
    } finally {
      await prisma.$disconnect()
    }

    await setContextCookies(page, { associationId: associationId!, fiscalYearId: fiscalYearId! })
    await page.goto('/saisie')

    await page.locator('#saisie-libelle').fill('Smoke depense E2E')
    await page.locator('#saisie-montant').fill('25')
    await page.locator('#saisie-compte-paiement').click()
    await page.keyboard.type('512')
    await page.keyboard.press('Enter')
    await page.locator('#saisie-compte-operation').click()
    await page.keyboard.type('606')
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: "Enregistrer l'écriture" }).click()
    await expect(page.getByText('Écriture enregistrée avec succès.')).toBeVisible()
    await expect(
      page.locator('[data-testid="saisie-ops-row"][data-entry-description="Smoke depense E2E"]'),
    ).toBeVisible()
  })

  test('recette rapide', async ({ page }) => {
    const prisma = createE2EPrisma()
    let associationId: string
    let fiscalYearId: string

    try {
      const seeded = await seedSaisieBase(prisma, { name: 'Smoke Recette E2E' })
      associationId = seeded.associationId
      fiscalYearId = seeded.fiscalYearId
      await prisma.account.create({
        data: { fiscalYearId, number: '706', name: 'Prestations de services' },
      })
    } finally {
      await prisma.$disconnect()
    }

    await setContextCookies(page, { associationId: associationId!, fiscalYearId: fiscalYearId! })
    await page.goto('/saisie')

    await page.getByTestId('saisie-operation-recette').click()
    await page.locator('#saisie-libelle').fill('Smoke recette E2E')
    await page.locator('#saisie-montant').fill('40')
    await page.locator('#saisie-compte-paiement').click()
    await page.keyboard.type('512')
    await page.keyboard.press('Enter')
    await page.locator('#saisie-compte-operation').click()
    await page.keyboard.type('706')
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: "Enregistrer l'écriture" }).click()
    await expect(page.getByText('Écriture enregistrée avec succès.')).toBeVisible()
    await expect(
      page.locator('[data-testid="saisie-ops-row"][data-entry-description="Smoke recette E2E"]'),
    ).toBeVisible()
  })
})
