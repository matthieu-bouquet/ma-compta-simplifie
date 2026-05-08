import { test, expect } from '@playwright/test'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

function getTestDbUrl() {
  const p = path.join(process.cwd(), '.tmp', 'e2e.db')
  return `file:${p}`
}

test("créer une entité avec 'Autre' et conserver à l'édition", async ({ page }) => {
  await page.goto('/parametres/entites')

  await page.getByRole('button', { name: 'Nouvelle entité' }).click()

  const entityName = 'Entité OTHER E2E'
  await page.getByLabel('Nom *').fill(entityName)
  await page.getByLabel('Forme juridique').selectOption('OTHER')
  await page.getByLabel('Autre (préciser) *').fill('Fondation')

  await page.getByRole('button', { name: 'Créer' }).click()

  await expect(page.getByText('Entité créée avec succès')).toBeVisible()

  const row = page.locator('tr', { hasText: entityName })
  await expect(row).toBeVisible()
  await row.getByLabel('Modifier').click()

  await expect(page).toHaveURL(/\/parametres\/entites\/.+\/edit$/)
  await expect(page.getByLabel('Forme juridique')).toHaveValue('OTHER')
  await expect(page.getByLabel('Autre (préciser) *')).toHaveValue('Fondation')
})

test("bénévolat n'est pas accessible pour une entité non-association", async ({ page }) => {
  const prisma = new PrismaClient({ datasources: { db: { url: getTestDbUrl() } } })

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
  await expect(page.getByLabel('Bénévolat')).toHaveCount(0)

  await page.goto('/benevolat')
  await expect(page.getByText('Le bénévolat est disponible uniquement pour une entité de type association.')).toBeVisible()
})

