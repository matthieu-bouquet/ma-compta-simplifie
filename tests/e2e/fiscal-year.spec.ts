import { test, expect } from '@playwright/test'

test('create fiscal year from exercises page', async ({ page }) => {
  // Create an entity first (UI; /parametres/associations redirects here)
  await page.goto('/parametres/entites')
  await page.getByRole('button', { name: 'Nouvelle entité' }).click()
  await page.locator('input[name="nom"]').fill('Association FY E2E')
  await page.getByRole('button', { name: 'Créer' }).click()
  await expect(page.getByText('Entité créée avec succès')).toBeVisible()

  // Extract the association id from the edit link in the entity row
  const row = page.locator('tr', { hasText: 'Association FY E2E' })
  const editHref = await row.getByRole('link', { name: 'Modifier' }).getAttribute('href')
  expect(editHref).toBeTruthy()
  const associationId = editHref!.split('/').at(-2)!
  expect(associationId.length).toBeGreaterThan(10)

  // Set context cookie directly (mimics the TopBar selection)
  await page.context().addCookies([
    { name: 'currentAssociationId', value: associationId, path: '/', domain: '127.0.0.1' },
  ])

  // Create a fiscal year from /exercices (form has default dates)
  await page.goto('/exercices')
  await page.getByRole('button', { name: /Créer l'exercice/i }).click()

  // Verify at least one OPEN fiscal year row exists
  await expect(page.getByText('OPEN')).toBeVisible()
})

