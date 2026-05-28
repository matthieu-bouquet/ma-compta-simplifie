import { test } from '@playwright/test'
import { expectToastVisible } from './helpers/toast'

test('plan comptable: add account shows success toast', async ({ page }) => {
  await page.goto('/parametres/plan-comptable')

  await page.getByRole('button', { name: 'Ajouter un compte' }).click()
  await page.getByLabel(/^Numéro/).fill('88888')
  await page.getByLabel(/^Libellé/).fill('Compte toast E2E')
  await page.getByRole('button', { name: 'Ajouter' }).click()

  await expectToastVisible(page, 'Compte ajouté avec succès')
})

test('edit entity: save shows success toast before redirect', async ({ page }) => {
  await page.goto('/parametres/entites')

  await page.getByRole('button', { name: 'Nouvelle entité' }).click()
  const name = `Toast edit ${Date.now()}`
  await page.getByLabel('Nom *').fill(name)
  await page.getByRole('button', { name: 'Créer' }).click()
  await expectToastVisible(page, 'Entité créée avec succès')

  const row = page.locator('tr', { hasText: name })
  await row.getByLabel('Modifier').click()
  await page.getByLabel('Nom *').fill(`${name} modifiée`)
  await page.getByRole('button', { name: 'Enregistrer' }).click()

  await expectToastVisible(page, 'Entité modifiée')
  await page.waitForURL(/\/parametres\/entites$/)
})
