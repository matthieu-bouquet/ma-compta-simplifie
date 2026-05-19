import { test, expect } from '@playwright/test'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

function getTestDbUrl() {
  const p = path.join(process.cwd(), '.tmp', 'e2e.db')
  return `file:${p}`
}

async function seedOpsListBase(prisma: PrismaClient) {
  const assoc = await prisma.association.create({
    data: {
      name: 'Association OPS LIST E2E',
      chartTemplateId: '00000000-0000-0000-0000-000000000001',
    },
  })

  const fy = await prisma.fiscalYear.create({
    data: {
      associationId: assoc.id,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      status: 'OPEN',
    },
  })

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

  await prisma.account.createMany({
    data: [
      { fiscalYearId: fy.id, number: '606', name: 'Achats non stockés' },
      { fiscalYearId: fy.id, number: '401', name: 'Fournisseurs' },
      { fiscalYearId: fy.id, number: '512', name: 'Banque' },
      { fiscalYearId: fy.id, number: '53', name: 'Caisse' },
    ],
  })

  const supplier = await prisma.counterparty.create({
    data: {
      associationId: assoc.id,
      kind: 'SUPPLIER',
      name: 'Fournisseur Ops List E2E',
    },
  })

  return { associationId: assoc.id, fiscalYearId: fy.id, supplierId: supplier.id }
}

test('ops list: colonne compte de paiement et filtres client', async ({ page }) => {
  const prisma = new PrismaClient({ datasources: { db: { url: getTestDbUrl() } } })
  let associationId: string
  let fiscalYearId: string

  try {
    const seeded = await seedOpsListBase(prisma)
    associationId = seeded.associationId
    fiscalYearId = seeded.fiscalYearId
  } finally {
    await prisma.$disconnect()
  }

  await page.context().addCookies([
    { name: 'currentAssociationId', value: associationId, path: '/', domain: '127.0.0.1' },
    { name: 'currentExerciceId', value: fiscalYearId, path: '/', domain: '127.0.0.1' },
  ])

  await page.goto('/saisie')

  async function createPaidExpense(libelle: string, montant: string, comptePaiement: string) {
    await page.locator('#saisie-libelle').fill(libelle)
    await page.locator('#saisie-montant').fill(montant)
    await page.locator('#saisie-compte-paiement').click()
    await page.keyboard.type(comptePaiement)
    await page.keyboard.press('Enter')
    await page.locator('#saisie-compte-operation').click()
    await page.keyboard.type('606')
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: "Enregistrer l'écriture" }).click()
    await expect(page.getByText('Écriture enregistrée avec succès.')).toBeVisible()
  }

  await createPaidExpense('Achat banque OpsList E2E', '40', '512')
  await createPaidExpense('Achat caisse OpsList E2E', '25', '53')

  const opsTable = page.getByRole('table').filter({
    has: page.getByRole('columnheader', { name: 'Compte de paiement' }),
  })

  await expect(page.getByRole('columnheader', { name: 'Compte de paiement' })).toBeVisible()
  await expect(opsTable.getByRole('cell', { name: '512 - Banque' })).toBeVisible()
  await expect(opsTable.getByRole('cell', { name: '53 - Caisse' })).toBeVisible()

  await page.locator('#saisie-ops-filtre-paiement').click()
  await page.keyboard.type('53')
  await page.keyboard.press('Enter')

  await expect(opsTable.getByRole('cell', { name: 'Achat caisse OpsList E2E' })).toBeVisible()
  await expect(opsTable.getByRole('cell', { name: 'Achat banque OpsList E2E' })).toHaveCount(0)
  await expect(page.getByText('1/2', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Réinitialiser' }).click()
  await page.locator('#saisie-ops-filtre-libelle').fill('banque OpsList')

  await expect(opsTable.getByRole('cell', { name: 'Achat banque OpsList E2E' })).toBeVisible()
  await expect(opsTable.getByRole('cell', { name: 'Achat caisse OpsList E2E' })).toHaveCount(0)
})

test('ops list: compte de paiement affiché après règlement différé', async ({ page }) => {
  const prisma = new PrismaClient({ datasources: { db: { url: getTestDbUrl() } } })

  let associationId: string
  let fiscalYearId: string
  let supplierId: string
  let payableLineId: string
  const payableDescription = 'Facture OpsList crédit E2E'

  try {
    const seeded = await seedOpsListBase(prisma)
    associationId = seeded.associationId
    fiscalYearId = seeded.fiscalYearId
    supplierId = seeded.supplierId
  } finally {
    await prisma.$disconnect()
  }

  await page.context().addCookies([
    { name: 'currentAssociationId', value: associationId, path: '/', domain: '127.0.0.1' },
    { name: 'currentExerciceId', value: fiscalYearId, path: '/', domain: '127.0.0.1' },
  ])

  await page.goto('/saisie')

  await page.locator('#saisie-libelle').fill(payableDescription)
  await page.locator('#saisie-montant').fill('80')
  await page.getByRole('button', { name: 'Non (dette / créance)' }).click()
  await page.locator('#saisie-tiers-main').click()
  await page.keyboard.type('Fournisseur Ops')
  await page.keyboard.press('Enter')
  await page.locator('#saisie-compte-operation').click()
  await page.keyboard.type('606')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: "Enregistrer l'écriture" }).click()
  await expect(page.getByText('Écriture enregistrée avec succès.')).toBeVisible()

  const prismaCheck = new PrismaClient({ datasources: { db: { url: getTestDbUrl() } } })
  try {
    const debtEntry = await prismaCheck.entry.findFirst({
      where: { fiscalYearId, counterpartyId: supplierId },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
    })
    payableLineId = debtEntry!.lines.find((l) => l.accountNumber === '401')!.id
  } finally {
    await prismaCheck.$disconnect()
  }

  const opsTable = page.getByRole('table').filter({
    has: page.getByRole('columnheader', { name: 'Compte de paiement' }),
  })
  const creditRow = opsTable.locator('tbody tr').filter({ hasText: payableDescription })
  await expect(creditRow).toBeVisible()
  await expect(creditRow.locator('[class*="paymentEmpty"]')).toBeVisible()

  await page.getByRole('button', { name: 'Règlement / Encaissement' }).click()
  await page.getByLabel('Fournisseur').click()
  await page.keyboard.type('Fournisseur Ops')
  await page.keyboard.press('Enter')
  await page.getByLabel('Compte de trésorerie').click()
  await page.keyboard.type('512')
  await page.keyboard.press('Enter')
  await page.getByLabel('Montant (€)').fill('80')

  const allocationsTable = page.getByRole('table').filter({
    has: page.getByRole('columnheader', { name: 'Affecter (€)' }),
  })
  const allocRow = allocationsTable.locator('tbody tr').filter({ hasText: payableDescription })
  await allocRow.locator(`input#alloc-${payableLineId}`).fill('80')
  await page.getByRole('button', { name: "Enregistrer l'écriture" }).click()
  await expect(page.getByText('Opération enregistrée.')).toBeVisible()

  await page.getByRole('button', { name: 'Dépense / recette' }).click()

  const settledRow = opsTable.locator('tbody tr').filter({ hasText: payableDescription })
  await expect(settledRow.getByRole('cell', { name: '512 - Banque' })).toBeVisible()
})
