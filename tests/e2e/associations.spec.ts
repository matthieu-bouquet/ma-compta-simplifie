import { test, expect } from '@playwright/test'

test('create association shows its name in list', async ({ page }) => {
  // /parametres/associations redirects to /parametres/entités (UI: "entité")
  await page.goto('/parametres/entites')

  await page.getByRole('button', { name: 'Nouvelle entité' }).click()

  await page.locator('input[name="nom"]').waitFor({ state: 'visible' })
  await page.locator('input[name="nom"]').fill('Association E2E')
  await page.getByRole('button', { name: 'Créer' }).click()

  await expect(page.getByText('Entité créée avec succès')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Association E2E' })).toBeVisible()
})

