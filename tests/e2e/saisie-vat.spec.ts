import { test, expect } from '@playwright/test'
import { createE2EPrisma } from './helpers/db'

test('saisie rapide: aperçu HT/TVA et écriture 3 lignes (DEPENSE TTC)', async ({ page }) => {
  const prisma = createE2EPrisma()

  let associationId: string
  let fiscalYearId: string

  try {
    const assoc = await prisma.association.create({
      data: {
        name: 'Association TVA E2E',
        vatLiable: true,
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
      },
    })
    fiscalYearId = fy.id

    await prisma.$transaction([
      prisma.journal.upsert({
        where: { code: 'AC' },
        update: { name: 'Achats' },
        create: { code: 'AC', name: 'Achats' },
      }),
      prisma.journal.upsert({
        where: { code: 'BQ' },
        update: { name: 'Banque' },
        create: { code: 'BQ', name: 'Banque' },
      }),
    ])

    await prisma.account.create({
      data: { fiscalYearId, number: '606', name: 'Achats non stockés' },
    })
    await prisma.account.create({
      data: { fiscalYearId, number: '512', name: 'Banque' },
    })
  } finally {
    await prisma.$disconnect()
  }

  await page.context().addCookies([
    { name: 'currentAssociationId', value: associationId, path: '/', domain: '127.0.0.1' },
    { name: 'currentExerciceId', value: fiscalYearId, path: '/', domain: '127.0.0.1' },
  ])

  await page.goto('/saisie')

  // Default mode is RAPIDE + DEPENSE.
  await expect(page.getByLabel('Montant TTC (€)')).toBeVisible()

  await page.locator('#saisie-libelle').fill('Achat TTC TVA E2E')
  await page.locator('#saisie-montant').fill('100')

  await page.locator('#saisie-taux-tva').selectOption('10')
  await expect(page.getByText('HT : 90.91 € · TVA : 9.09 €')).toBeVisible()

  // react-select inputs
  await page.locator('#saisie-compte-paiement').click()
  await page.keyboard.type('512')
  await page.keyboard.press('Enter')

  await page.locator('#saisie-compte-operation').click()
  await page.keyboard.type('606')
  await page.keyboard.press('Enter')

  await page.getByRole('button', { name: "Enregistrer l'écriture" }).click()
  await expect(page.getByText('Écriture enregistrée avec succès.')).toBeVisible()

  const prismaCheck = createE2EPrisma()
  try {
    const entry = await prismaCheck.entry.findFirst({
      where: { fiscalYearId, description: 'Achat TTC TVA E2E' },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
    })
    expect(entry).not.toBeNull()
    expect(entry!.lines).toHaveLength(3)

    const nums = entry!.lines.map((l) => l.accountNumber).sort()
    expect(nums).toContain('606')
    expect(nums).toContain('512')
    expect(nums).toContain('44566')

    const byNum = Object.fromEntries(entry!.lines.map((l) => [l.accountNumber, l]))
    expect(byNum['606']?.debitCents).toBe(9091)
    expect(byNum['44566']?.debitCents).toBe(909)
    expect(byNum['512']?.creditCents).toBe(10000)
  } finally {
    await prismaCheck.$disconnect()
  }
})

