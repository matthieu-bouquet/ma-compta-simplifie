import { test, expect } from '@playwright/test'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

function getTestDbUrl() {
  const p = path.join(process.cwd(), '.tmp', 'e2e.db')
  return `file:${p}`
}

test('treasury tab: supplier settlement allocates payable and marks charge as paid', async ({ page }) => {
  const prisma = new PrismaClient({ datasources: { db: { url: getTestDbUrl() } } })

  let associationId: string
  let fiscalYearId: string
  let payableEntryDescription: string
  let payableLineId: string

  try {
    const assoc = await prisma.association.create({
      data: {
        name: 'Association Treasury Tab E2E',
        vatLiable: true,
        chartTemplateId: '00000000-0000-0000-0000-000000000001',
      },
      select: { id: true },
    })
    associationId = assoc.id

    const fy = await prisma.fiscalYear.create({
      data: {
        associationId,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        status: 'OPEN',
      },
      select: { id: true },
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

    const [acc601, acc401, acc512] = await prisma.$transaction([
      prisma.account.create({ data: { fiscalYearId, number: '601', name: 'Achats' } }),
      prisma.account.create({ data: { fiscalYearId, number: '401', name: 'Fournisseurs' } }),
      prisma.account.create({ data: { fiscalYearId, number: '512', name: 'Banque' } }),
    ])

    const supplier = await prisma.counterparty.create({
      data: { associationId, kind: 'SUPPLIER', name: 'Supplier Treasury E2E' },
      select: { id: true, name: true },
    })
    expect(supplier.name).toBeTruthy()

    payableEntryDescription = 'Facture fournisseur tab trésorerie'
    const payableEntry = await prisma.entry.create({
      data: {
        fiscalYearId,
        journalId: (await prisma.journal.findUnique({ where: { code: 'AC' }, select: { id: true } }))!.id,
        date: new Date('2026-02-10'),
        description: payableEntryDescription,
        counterpartyId: supplier.id,
        referenceNumber: 'AC-000001',
        referenceSequence: 1,
        lines: {
          create: [
            {
              accountId: acc601.id,
              accountNumber: acc601.number,
              accountName: acc601.name,
              debitCents: 10000,
              creditCents: 0,
            },
            {
              accountId: acc401.id,
              accountNumber: acc401.number,
              accountName: acc401.name,
              debitCents: 0,
              creditCents: 10000,
            },
          ],
        },
      },
      include: { lines: true },
    })
    payableLineId = payableEntry.lines.find((l) => l.accountNumber === '401')!.id

    // silence unused var warning for account 512 creation
    expect(acc512.number).toBe('512')
  } finally {
    await prisma.$disconnect()
  }

  await page.context().addCookies([
    { name: 'currentAssociationId', value: associationId, path: '/', domain: '127.0.0.1' },
    { name: 'currentExerciceId', value: fiscalYearId, path: '/', domain: '127.0.0.1' },
  ])

  await page.goto('/saisie?tab=treasury')

  // Default is "Règlement fournisseur"
  await expect(page.getByRole('button', { name: /Règlement fournisseur/i })).toBeVisible()

  await page
    .locator('#react-select-tresorerie-fournisseur-placeholder')
    .locator('..')
    .locator('..')
    .click({ force: true })
  await page.keyboard.type('Supplier Treasury')
  await page.keyboard.press('Enter')

  await page
    .locator('#react-select-tresorerie-compte-placeholder')
    .locator('..')
    .locator('..')
    .click({ force: true })
  await page.keyboard.type('512')
  await page.keyboard.press('Enter')

  await page.getByLabel('Montant (€)').fill('100')

  const row = page.locator('tr', { hasText: payableEntryDescription })
  await expect(row).toBeVisible()
  await row.locator(`input#alloc-${payableLineId}`).fill('100')

  await page.getByRole('button', { name: "Enregistrer l'écriture" }).click()
  await expect(page.getByText('Opération enregistrée.')).toBeVisible()

  await page.goto('/saisie?tab=ops')
  const opsRow = page.locator('tr', { hasText: payableEntryDescription }).first()
  await expect(opsRow).toBeVisible()
  await expect(opsRow).toContainText('Payé')
})

test('treasury tab: customer receipt allocates receivable and marks product as received', async ({ page }) => {
  const prisma = new PrismaClient({ datasources: { db: { url: getTestDbUrl() } } })

  let associationId: string
  let fiscalYearId: string
  let invoiceDescription: string
  let receivableLineId: string

  try {
    const assoc = await prisma.association.create({
      data: {
        name: 'Association Treasury Receipt E2E',
        vatLiable: true,
        chartTemplateId: '00000000-0000-0000-0000-000000000001',
      },
      select: { id: true },
    })
    associationId = assoc.id

    const fy = await prisma.fiscalYear.create({
      data: {
        associationId,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        status: 'OPEN',
      },
      select: { id: true },
    })
    fiscalYearId = fy.id

    await prisma.$transaction([
      prisma.journal.upsert({
        where: { code: 'VE' },
        update: { name: 'Ventes' },
        create: { code: 'VE', name: 'Ventes' },
      }),
      prisma.journal.upsert({
        where: { code: 'BQ' },
        update: { name: 'Banque' },
        create: { code: 'BQ', name: 'Banque' },
      }),
    ])

    const [acc411, acc706, acc512] = await prisma.$transaction([
      prisma.account.create({ data: { fiscalYearId, number: '411', name: 'Clients' } }),
      prisma.account.create({ data: { fiscalYearId, number: '706', name: 'Prestations' } }),
      prisma.account.create({ data: { fiscalYearId, number: '512', name: 'Banque' } }),
    ])

    const customer = await prisma.counterparty.create({
      data: { associationId, kind: 'CUSTOMER', name: 'Customer Treasury E2E' },
      select: { id: true, name: true },
    })
    expect(customer.name).toBeTruthy()

    invoiceDescription = 'Facture client tab trésorerie'
    const invoice = await prisma.entry.create({
      data: {
        fiscalYearId,
        journalId: (await prisma.journal.findUnique({ where: { code: 'VE' }, select: { id: true } }))!.id,
        date: new Date('2026-03-05'),
        description: invoiceDescription,
        counterpartyId: customer.id,
        referenceNumber: 'VE-000001',
        referenceSequence: 1,
        lines: {
          create: [
            {
              accountId: acc411.id,
              accountNumber: acc411.number,
              accountName: acc411.name,
              debitCents: 12000,
              creditCents: 0,
            },
            {
              accountId: acc706.id,
              accountNumber: acc706.number,
              accountName: acc706.name,
              debitCents: 0,
              creditCents: 12000,
            },
          ],
        },
      },
      include: { lines: true },
    })
    receivableLineId = invoice.lines.find((l) => l.accountNumber === '411')!.id

    expect(acc512.number).toBe('512')
  } finally {
    await prisma.$disconnect()
  }

  await page.context().addCookies([
    { name: 'currentAssociationId', value: associationId, path: '/', domain: '127.0.0.1' },
    { name: 'currentExerciceId', value: fiscalYearId, path: '/', domain: '127.0.0.1' },
  ])

  await page.goto('/saisie?tab=treasury')

  await page.getByRole('button', { name: /Encaissement client/i }).click()

  await page.getByLabel('Client').click()
  await page.keyboard.type('Customer Treasury')
  await page.keyboard.press('Enter')

  await page.getByLabel('Compte de trésorerie').click()
  await page.keyboard.type('512')
  await page.keyboard.press('Enter')

  await page.getByLabel('Montant (€)').fill('120')

  const row = page.locator('tr', { hasText: invoiceDescription })
  await expect(row).toBeVisible()
  await row.locator(`input#alloc-${receivableLineId}`).fill('120')

  await page.getByRole('button', { name: "Enregistrer l'écriture" }).click()
  await expect(page.getByText('Opération enregistrée.')).toBeVisible()

  await page.goto('/saisie?tab=ops')
  const opsRow = page.locator('tr', { hasText: invoiceDescription }).first()
  await expect(opsRow).toBeVisible()
  await expect(opsRow).toContainText('Perçu')
})

