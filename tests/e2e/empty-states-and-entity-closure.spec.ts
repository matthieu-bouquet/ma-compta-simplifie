import { test, expect } from '@playwright/test'
import { createE2EPrisma } from './helpers/db'

test('empty state: no entity exists shows CTA to create entity', async ({ page }) => {
  // Ensure DB is empty for this test.
  const prisma = createE2EPrisma()
  try {
    await prisma.documentEntryLine.deleteMany({})
    await prisma.document.deleteMany({})
    await prisma.entryLine.deleteMany({})
    await prisma.entry.deleteMany({})
    await prisma.account.deleteMany({})
    await prisma.fiscalYear.deleteMany({})
    await prisma.association.deleteMany({})
  } finally {
    await prisma.$disconnect()
  }

  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Aucune entité' })).toBeVisible()
  await page.getByRole('link', { name: 'Créer une entité' }).click()
  await expect(page).toHaveURL(/\/parametres\/entites\?create=1$/)
  await expect(page.getByText('Créer une entité')).toBeVisible()
})

test('empty state: stale entity cookie does not show fiscal year empty state', async ({ page }) => {
  // Ensure DB is empty for this test but cookie points to an entity id.
  const prisma = createE2EPrisma()
  try {
    await prisma.documentEntryLine.deleteMany({})
    await prisma.document.deleteMany({})
    await prisma.entryLine.deleteMany({})
    await prisma.entry.deleteMany({})
    await prisma.account.deleteMany({})
    await prisma.fiscalYear.deleteMany({})
    await prisma.association.deleteMany({})
  } finally {
    await prisma.$disconnect()
  }

  await page.context().addCookies([
    { name: 'currentAssociationId', value: 'stale-association-id', path: '/', domain: '127.0.0.1' },
  ])

  await page.goto('/saisie')

  await expect(page.getByRole('heading', { name: 'Aucune entité' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Aucun exercice' })).toHaveCount(0)
})

test('empty state: entity selected but no fiscal year shows CTA to create fiscal year', async ({ page }) => {
  const prisma = createE2EPrisma()
  let associationId: string
  try {
    const assoc = await prisma.association.create({
      data: {
        name: 'Association NO FY E2E',
        chartTemplateId: '00000000-0000-0000-0000-000000000001',
      },
    })
    associationId = assoc.id
  } finally {
    await prisma.$disconnect()
  }

  await page.context().addCookies([
    { name: 'currentAssociationId', value: associationId, path: '/', domain: '127.0.0.1' },
  ])

  await page.goto('/saisie')

  await expect(page.getByRole('heading', { name: 'Aucun exercice' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Créer un exercice' })).toBeVisible()

  await page.getByRole('link', { name: 'Créer un exercice' }).click()
  await expect(page).toHaveURL('/exercices')
})

test('closed entity: banners shown and creation CTAs disabled', async ({ page }) => {
  const prisma = createE2EPrisma()
  let associationId: string
  try {
    const assoc = await prisma.association.create({
      data: {
        name: 'Association CLOSED E2E',
        isClosed: true,
        chartTemplateId: '00000000-0000-0000-0000-000000000001',
      },
    })
    associationId = assoc.id
  } finally {
    await prisma.$disconnect()
  }

  await page.context().addCookies([
    { name: 'currentAssociationId', value: associationId, path: '/', domain: '127.0.0.1' },
  ])

  // Exercices page: banner + no create form.
  await page.goto('/exercices')
  await expect(page.getByText('Entité clôturée')).toBeVisible()
  await expect(
    page
      .getByRole('status')
      .getByText('La création d’un nouvel exercice est désactivée', { exact: false })
  ).toBeVisible()

  // Exercice creation form should not be present (it includes "Date de début").
  await expect(page.getByLabel('Date de début')).toHaveCount(0)

  // Prévisionnel page: banner + no "Nouveau prévisionnel" button.
  await page.goto('/previsionnel')
  await expect(page.getByText('Entité clôturée')).toBeVisible()
  await expect(
    page.getByText('La création de prévisionnels est désactivée', { exact: false })
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Nouveau prévisionnel' })).toHaveCount(0)
})

