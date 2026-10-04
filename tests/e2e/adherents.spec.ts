import { test, expect } from '@playwright/test'
import { createE2EPrisma, setContextCookies } from './helpers/db'

test('create member, mark dues paid, posting visible', async ({ page }) => {
  const prisma = createE2EPrisma()
  let associationId: string
  let fiscalYearId: string
  let seasonId: string

  try {
    const assoc = await prisma.association.create({
      data: { name: 'Asso Adhérents E2E', legalFormCode: 'ASSOCIATION' },
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
      prisma.account.create({
        data: { fiscalYearId, number: '7562', name: 'Cotisations avec contrepartie' },
      }),
    ])
    const category = await prisma.membershipCategory.create({
      data: {
        associationId,
        name: 'Adulte E2E',
        amountCents: 5000,
        duesAccountNumber: '7562',
      },
    })
    const season = await prisma.membershipSeason.create({
      data: {
        associationId,
        name: '2026-2027',
        startDate: new Date('2026-09-01T12:00:00'),
        endDate: new Date('2027-08-31T12:00:00'),
        tariffs: {
          create: {
            categoryId: category.id,
            amountCents: 5000,
            duesAccountNumber: '7562',
          },
        },
      },
    })
    seasonId = season.id
  } finally {
    await prisma.$disconnect()
  }

  await setContextCookies(page, {
    associationId: associationId!,
    fiscalYearId: fiscalYearId!,
    seasonId: seasonId!,
  })

  await page.goto('/adhesions/new')
  await page.getByLabel('Nouvel adhérent', { exact: true }).check()
  await page.getByLabel('Nom *', { exact: true }).fill('Martin')
  await page.getByLabel('Prénom *', { exact: true }).fill('Léa')
  await page.getByLabel('E-mail', { exact: true }).fill('lea.martin@example.org')
  await page.getByLabel('Tarif *', { exact: true }).selectOption({ label: /Adulte E2E/ })
  await page.getByRole('button', { name: 'Créer' }).click()

  await expect(page.getByText('Publipostage')).toBeVisible()
  await page.getByRole('link', { name: 'Fiche de Léa Martin' }).click()
  await expect(page.getByRole('heading', { name: 'Modifier l’adhérent' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Relancer par e-mail' })).toHaveAttribute(
    'href',
    /mailto:lea\.martin%40example\.org\?subject=.*body=/,
  )

  const csvResponse = await page.request.get(`/api/adhesions/relances.csv?seasonId=${seasonId}`)
  expect(csvResponse.ok()).toBeTruthy()
  const csv = await csvResponse.text()
  expect(csv.split('\n')[0]).toBe('Nom;Prenom;Email;Categorie;Montant;Saison')
  expect(csv).toContain('Martin')
  expect(csv).toContain('lea.martin@example.org')

  await page.getByRole('link', { name: 'Fiche de Léa Martin' }).click()
  await page.getByRole('button', { name: 'Marquer payée (écriture 756)' }).click()

  await expect(page.getByText('compte 7562 — payée')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Annuler l’encaissement' })).toBeVisible()

  await page.goto('/ecritures')
  await expect(page.getByText('Cotisation 2026-2027 — MARTIN Léa')).toBeVisible()
})
