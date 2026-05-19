import { test, expect } from '@playwright/test'
import { createE2EPrisma, setContextCookies } from './helpers/db'
import { seedAssociationWithFiscalYear, seedStandardJournals } from './helpers/fixtures'

test('exercices: clôture verrouille l\'exercice', async ({ page }) => {
  const prisma = createE2EPrisma()
  let associationId: string
  let fiscalYearId: string

  try {
    const seeded = await seedAssociationWithFiscalYear(prisma, { name: 'Association Close FY E2E' })
    associationId = seeded.associationId
    fiscalYearId = seeded.fiscalYearId
    await seedStandardJournals(prisma)
    await prisma.account.create({
      data: { fiscalYearId, number: '512', name: 'Banque' },
    })
  } finally {
    await prisma.$disconnect()
  }

  await setContextCookies(page, { associationId: associationId!, fiscalYearId: fiscalYearId! })

  await page.goto(`/exercices/${fiscalYearId}`)
  await page.getByText(/Plan comptable de l.exercice/).click()
  await expect(page.getByTestId('exercice-plan-account-row-512')).toBeVisible()

  page.once('dialog', (dialog) => dialog.accept())

  await page.getByRole('button', { name: 'Clôturer cet exercice' }).click()
  const dialog = page.locator('dialog[open]')
  await expect(dialog.getByRole('heading', { name: 'Clôturer cet exercice ?' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Clôturer définitivement' }).click()

  await page.goto('/exercices')
  await expect(page.getByText('CLOSED')).toBeVisible()

  const prismaCheck = createE2EPrisma()
  try {
    const fy = await prismaCheck.fiscalYear.findUnique({ where: { id: fiscalYearId! } })
    expect(fy?.status).toBe('CLOSED')
  } finally {
    await prismaCheck.$disconnect()
  }
})

test('exercices: suppression avec confirmation', async ({ page }) => {
  const prisma = createE2EPrisma()
  let associationId: string
  let fiscalYearId: string

  try {
    const seeded = await seedAssociationWithFiscalYear(prisma, { name: 'Association Delete FY E2E' })
    associationId = seeded.associationId
    fiscalYearId = seeded.fiscalYearId
  } finally {
    await prisma.$disconnect()
  }

  await setContextCookies(page, { associationId: associationId!, fiscalYearId: fiscalYearId! })

  await page.goto('/exercices')
  const row = page.locator('tr', { has: page.getByText('OPEN') }).first()
  await row.getByRole('button', { name: 'Supprimer' }).click()

  const dialog = page.locator('dialog[open]')
  await expect(dialog.getByRole('heading', { name: /Supprimer l'exercice/ })).toBeVisible()
  await dialog.getByRole('button', { name: 'Supprimer définitivement' }).click()

  await expect(page.getByText('Aucun exercice comptable n\'a été créé.')).toBeVisible()

  const prismaCheck = createE2EPrisma()
  try {
    const fy = await prismaCheck.fiscalYear.findUnique({ where: { id: fiscalYearId! } })
    expect(fy).toBeNull()
  } finally {
    await prismaCheck.$disconnect()
  }
})
