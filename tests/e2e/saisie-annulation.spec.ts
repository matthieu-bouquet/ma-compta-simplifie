import { test, expect } from '@playwright/test'
import { createE2EPrisma, setContextCookies } from './helpers/db'
import { seedBalancedExpenseEntry, seedSaisieBase } from './helpers/fixtures'

test("annuler une écriture: wording distinct et fermeture de modal", async ({ page }) => {
  const prisma = createE2EPrisma()

  let associationId: string
  let fiscalYearId: string

  try {
    const seeded = await seedSaisieBase(prisma, { name: 'Association SAISIE E2E' })
    associationId = seeded.associationId
    fiscalYearId = seeded.fiscalYearId

    const debitAccount = await prisma.account.create({
      data: { fiscalYearId, number: '601', name: 'Achats' },
    })

    await seedBalancedExpenseEntry(prisma, {
      fiscalYearId,
      description: 'Test annulation saisie',
      debitAccount: { id: debitAccount.id, number: debitAccount.number, name: debitAccount.name },
      creditAccount: {
        id: seeded.accounts.bank512.id,
        number: seeded.accounts.bank512.number,
        name: 'Banque',
      },
    })
  } finally {
    await prisma.$disconnect()
  }

  await setContextCookies(page, { associationId: associationId!, fiscalYearId: fiscalYearId! })

  await page.goto('/saisie')

  const row = page.locator('tr', { hasText: 'Test annulation saisie' }).first()
  await expect(row).toBeVisible()

  await row.locator('button[title="Annuler"]').click()

  const dialog = page.locator('dialog[open]')
  await expect(dialog.getByRole('heading', { name: 'Annuler l’écriture' })).toBeVisible()

  // Boutons d'actions: wording distinct.
  await expect(dialog.getByRole('button', { name: 'Fermer' }).last()).toBeVisible()
  await expect(dialog.getByRole('button', { name: "Valider l’annulation" })).toBeVisible()

  // Double click should not create two reversals.
  await dialog.getByRole('button', { name: "Valider l’annulation" }).dblclick()

  // La modal doit se fermer après l'annulation.
  await expect(page.locator('dialog[open]')).toHaveCount(0)

  // Une seule contrepassation doit être créée (pas de double soumission).
  const prismaCheck = createE2EPrisma()
  try {
    const reversals = await prismaCheck.entry.count({
      where: { fiscalYearId, description: 'REVERSAL: Test annulation saisie' },
    })
    expect(reversals).toBe(1)

    const originalLines = await prismaCheck.entryLine.findMany({
      where: { entry: { fiscalYearId, description: 'Test annulation saisie' } },
    })
    const reversalLines = await prismaCheck.entryLine.findMany({
      where: { entry: { fiscalYearId, description: 'REVERSAL: Test annulation saisie' } },
    })
    expect(originalLines.length).toBeGreaterThan(0)
    expect(reversalLines.length).toBeGreaterThan(0)

    const originalDebit = originalLines.reduce((s, l) => s + l.debitCents, 0)
    const reversalCredit = reversalLines.reduce((s, l) => s + l.creditCents, 0)
    expect(reversalCredit).toBe(originalDebit)
  } finally {
    await prismaCheck.$disconnect()
  }
})

