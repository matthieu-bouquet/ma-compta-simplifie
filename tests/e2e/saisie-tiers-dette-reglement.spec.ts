import { test, expect } from '@playwright/test'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

function getTestDbUrl() {
  const p = path.join(process.cwd(), '.tmp', 'e2e.db')
  return `file:${p}`
}

test('saisie rapide: dépense à crédit puis règlement fournisseur', async ({ page }) => {
  const prisma = new PrismaClient({ datasources: { db: { url: getTestDbUrl() } } })

  let associationId: string
  let fiscalYearId: string
  let supplierId: string

  try {
    const assoc = await prisma.association.create({
      data: {
        name: 'Association TIERS E2E',
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
      data: { fiscalYearId, number: '401', name: 'Fournisseurs' },
    })
    await prisma.account.create({
      data: { fiscalYearId, number: '512', name: 'Banque' },
    })

    const supplier = await prisma.counterparty.create({
      data: {
        associationId,
        kind: 'SUPPLIER',
        name: 'Transport Dupont E2E',
      },
    })
    supplierId = supplier.id
  } finally {
    await prisma.$disconnect()
  }

  await page.context().addCookies([
    { name: 'currentAssociationId', value: associationId, path: '/', domain: '127.0.0.1' },
    { name: 'currentExerciceId', value: fiscalYearId, path: '/', domain: '127.0.0.1' },
  ])

  await page.goto('/saisie')

  await page.locator('#saisie-libelle').fill('Facture transport E2E')
  await page.locator('#saisie-montant').fill('120')

  await page.getByRole('button', { name: 'Non (dette / créance)' }).click()

  await page.locator('#saisie-tiers-dette').click()
  await page.keyboard.type('Dupont')
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
    expect(debtEntry).not.toBeNull()
    const nums = debtEntry!.lines.map((l) => l.accountNumber).sort()
    expect(nums).toContain('401')
    expect(nums).toContain('606')
  } finally {
    await prismaCheck.$disconnect()
  }

  await page.locator('#saisie-libelle').fill('Paiement facture E2E')
  await page.locator('#saisie-montant').fill('120')
  await page.getByRole('button', { name: 'Règlement fournisseur' }).click()

  await page.locator('#saisie-tiers').click()
  await page.keyboard.type('Dupont')
  await page.keyboard.press('Enter')

  await page.locator('#saisie-compte-paiement-reglement').click()
  await page.keyboard.type('512')
  await page.keyboard.press('Enter')

  await page.getByRole('button', { name: "Enregistrer l'écriture" }).click()
  await expect(page.getByText('Écriture enregistrée avec succès.')).toBeVisible()

  const prismaCheck2 = new PrismaClient({ datasources: { db: { url: getTestDbUrl() } } })
  try {
    const payEntry = await prismaCheck2.entry.findFirst({
      where: { fiscalYearId, description: { contains: 'Paiement facture E2E' } },
      include: { lines: true },
    })
    expect(payEntry).not.toBeNull()
    const byNum: Record<string, { debit: number; credit: number }> = {}
    for (const l of payEntry!.lines) {
      byNum[l.accountNumber] = { debit: l.debitCents, credit: l.creditCents }
    }
    expect(byNum['401']?.debit).toBe(12000)
    expect(byNum['512']?.credit).toBe(12000)
  } finally {
    await prismaCheck2.$disconnect()
  }
})
