import { test, expect } from '@playwright/test'
import { createE2EPrisma, setContextCookies } from './helpers/db'
import {
  seedBalancedExpenseEntry,
  seedSaisieBase,
} from './helpers/fixtures'

test('bilan: compte de résultat reflète une charge enregistrée', async ({ page }) => {
  const prisma = createE2EPrisma()
  let associationId: string
  let fiscalYearId: string

  try {
    const seeded = await seedSaisieBase(prisma, { name: 'Association Bilan E2E' })
    associationId = seeded.associationId
    fiscalYearId = seeded.fiscalYearId

    await prisma.account.create({
      data: { fiscalYearId, number: '601', name: 'Achats' },
    })

    await seedBalancedExpenseEntry(prisma, {
      fiscalYearId,
      description: 'Charge bilan E2E',
      debitAccount: { id: seeded.accounts.expense606.id, number: '606', name: 'Achats non stockés' },
      creditAccount: { id: seeded.accounts.bank512.id, number: '512', name: 'Banque' },
      amountCents: 5000,
    })
  } finally {
    await prisma.$disconnect()
  }

  await setContextCookies(page, { associationId: associationId!, fiscalYearId: fiscalYearId! })

  await page.goto('/bilan')

  await expect(page.getByRole('heading', { name: 'Compte de Résultat Détaillé' })).toBeVisible()
  await expect(page.getByText('Synthèse de l\'exercice')).toBeVisible()
  await expect(page.getByText('Charges : 50.00 €')).toBeVisible()
  await expect(page.getByText('606 - Achats non stockés')).toBeVisible()
})
