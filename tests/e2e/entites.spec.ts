import { test, expect } from '@playwright/test'
import { createE2EPrisma } from './helpers/db'

test("créer une association et conserver le nom à l'édition", async ({ page }) => {
  await page.goto('/parametres/entites')

  await page.getByRole('button', { name: 'Nouvelle association' }).click()

  const entityName = 'Association E2E récente'
  await page.getByLabel('Nom *').fill(entityName)

  await page.getByRole('button', { name: 'Créer' }).click()

  await expect(page.getByText('Association créée avec succès')).toBeVisible()

  const row = page.locator('tr', { hasText: entityName })
  await expect(row).toBeVisible()
  await row.getByLabel('Modifier').click()

  await expect(page).toHaveURL(/\/parametres\/entites\/.+\/edit$/)
  await expect(page.getByLabel('Forme juridique')).toHaveValue('ASSOCIATION')
  await expect(page.getByLabel('Nom *', { exact: true })).toHaveValue(entityName)
})

test("bénévolat reste accessible même pour une entité legacy non-association", async ({ page }) => {
  const prisma = createE2EPrisma()

  let associationId: string
  try {
    const assoc = await prisma.association.create({
      data: {
        name: 'Entreprise SAS E2E',
        legalFormCode: 'SAS',
        chartTemplateId: '00000000-0000-0000-0000-000000000002',
      },
    })
    associationId = assoc.id
  } finally {
    await prisma.$disconnect()
  }

  await page.context().addCookies([{ name: 'currentAssociationId', value: associationId!, path: '/', domain: '127.0.0.1' }])

  await page.goto('/')
  await page.getByRole('button', { name: 'Vie associative' }).hover()
  await expect(page.getByRole('menuitem', { name: 'Bénévolat' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Adhésions' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Saisons' })).toBeVisible()

  await page.goto('/benevolat')
  await expect(page.getByText('Le bénévolat est disponible uniquement pour une entité de type association.')).toBeVisible()
})

