import { test, expect } from '@playwright/test'
import { createE2EPrisma, setContextCookies } from './helpers/db'
import { seedBalancedExpenseEntry, seedSaisieBase } from './helpers/fixtures'

test('changer d’exercice depuis la saisie recharge la page avec les données du nouvel exercice', async ({
  page,
}) => {
  const prisma = createE2EPrisma()
  let associationId: string
  let fiscalYear2026Id: string
  let fiscalYear2025Id: string

  try {
    const seeded = await seedSaisieBase(prisma, { name: 'Switcher Exercice E2E' })
    associationId = seeded.associationId
    fiscalYear2026Id = seeded.fiscalYearId

    const fy2025 = await prisma.fiscalYear.create({
      data: {
        associationId,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
        status: 'OPEN',
      },
    })
    fiscalYear2025Id = fy2025.id

    const [expense2025, bank2025] = await Promise.all([
      prisma.account.create({
        data: { fiscalYearId: fiscalYear2025Id, number: '606', name: 'Achats non stockés' },
      }),
      prisma.account.create({
        data: { fiscalYearId: fiscalYear2025Id, number: '512', name: 'Banque' },
      }),
    ])

    await seedBalancedExpenseEntry(prisma, {
      fiscalYearId: fiscalYear2026Id,
      description: 'Ecriture exercice 2026',
      debitAccount: {
        id: seeded.accounts.expense606.id,
        number: seeded.accounts.expense606.number,
        name: 'Achats non stockés',
      },
      creditAccount: {
        id: seeded.accounts.bank512.id,
        number: seeded.accounts.bank512.number,
        name: 'Banque',
      },
    })

    await seedBalancedExpenseEntry(prisma, {
      fiscalYearId: fiscalYear2025Id,
      description: 'Ecriture exercice 2025',
      debitAccount: { id: expense2025.id, number: expense2025.number, name: expense2025.name },
      creditAccount: { id: bank2025.id, number: bank2025.number, name: bank2025.name },
      date: new Date('2025-03-15'),
    })
  } finally {
    await prisma.$disconnect()
  }

  await setContextCookies(page, { associationId: associationId!, fiscalYearId: fiscalYear2026Id! })
  await page.goto('/saisie')

  await expect(
    page.locator('[data-testid="saisie-ops-row"][data-entry-description="Ecriture exercice 2026"]'),
  ).toBeVisible()
  await expect(
    page.locator('[data-testid="saisie-ops-row"][data-entry-description="Ecriture exercice 2025"]'),
  ).toHaveCount(0)

  const exerciceSelect = page.getByLabel('Sélectionner un exercice')
  await expect(exerciceSelect).toBeEnabled()
  await exerciceSelect.click()
  await page.getByRole('option', { name: /01\/01\/2025/ }).click()

  await expect(
    page.locator('[data-testid="saisie-ops-row"][data-entry-description="Ecriture exercice 2025"]'),
  ).toBeVisible()
  await expect(
    page.locator('[data-testid="saisie-ops-row"][data-entry-description="Ecriture exercice 2026"]'),
  ).toHaveCount(0)
  await expect(page.getByLabel('Sélectionner un exercice')).toBeEnabled()

  const cookies = await page.context().cookies()
  expect(cookies.find((c) => c.name === 'currentExerciceId')?.value).toBe(fiscalYear2025Id)
})
