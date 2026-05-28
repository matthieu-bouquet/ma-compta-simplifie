import { test, expect } from '@playwright/test'
import { createE2EPrisma } from './helpers/db'

test('benevolat: entity selected but no fiscal year shows empty state', async ({ page }) => {
  const prisma = createE2EPrisma()
  let associationId: string

  try {
    const assoc = await prisma.association.create({
      data: {
        name: 'Association BENEVOLAT NO FY E2E',
        legalFormCode: 'ASSOCIATION',
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

  await page.goto('/benevolat')
  await expect(page.getByRole('heading', { name: 'Aucun exercice' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Créer un exercice' })).toBeVisible()
})

test('saisir du bénévolat et comptabiliser en classe 8', async ({ page }) => {
  const prisma = createE2EPrisma()

  let associationId: string
  let fiscalYearId: string

  try {
    const assoc = await prisma.association.create({
      data: {
        name: 'Association BENEVOLAT E2E',
        legalFormCode: 'ASSOCIATION',
        chartTemplateId: '00000000-0000-0000-0000-000000000001',
      },
    })
    associationId = assoc.id

    const fy = await prisma.fiscalYear.create({
      data: {
        associationId,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        status: 'OPEN',
        accounts: {
          create: [
            { number: '864', name: 'Personnel bénévole' },
            { number: '875', name: 'Bénévolat' },
          ],
        },
      },
    })
    fiscalYearId = fy.id
  } finally {
    await prisma.$disconnect()
  }

  await page.context().addCookies([
    { name: 'currentAssociationId', value: associationId!, path: '/', domain: '127.0.0.1' },
    { name: 'currentExerciceId', value: fiscalYearId!, path: '/', domain: '127.0.0.1' },
  ])

  await page.goto('/benevolat/new')

  await page.getByLabel('Date *').fill('10/02/2026')
  await page.getByLabel('Bénévole (optionnel)').fill('Alice')
  await page.getByLabel('Description *').fill('Encadrement entraînement')
  await page.getByLabel('Heures *').fill('1.50')
  await page.getByLabel('Taux (€/h) *').fill('20')
  await page.getByLabel('Méthode de valorisation *').fill('Taux interne documenté')

  await page.getByLabel('Essentiel à la compréhension de l’activité').check()
  await page.getByLabel('Recensable et valorisable de manière fiable').check()
  await page.getByLabel('Comptabiliser en classe 8 (864/875)').check()

  await page.getByRole('button', { name: 'Enregistrer' }).click()

  await expect(page).toHaveURL('/benevolat')
  await expect(page.locator('table')).toContainText('Encadrement entraînement')

  const prismaCheck = createE2EPrisma()
  try {
    const contribution = await prismaCheck.inKindContribution.findFirst({
      where: { associationId, fiscalYearId, kind: 'VOLUNTEERING', description: 'Encadrement entraînement' },
    })
    expect(contribution).toBeTruthy()
    expect(contribution?.entryId).toBeTruthy()

    const entry = await prismaCheck.entry.findUnique({
      where: { id: contribution!.entryId! },
      include: { lines: true },
    })
    expect(entry).toBeTruthy()
    expect(entry?.lines).toHaveLength(2)
    const nums = entry!.lines.map((l) => l.accountNumber).sort()
    expect(nums).toEqual(['864', '875'])
  } finally {
    await prismaCheck.$disconnect()
  }
})

