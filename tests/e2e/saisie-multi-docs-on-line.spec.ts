import { test, expect } from '@playwright/test'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

function getTestDbUrl() {
  const p = path.join(process.cwd(), '.tmp', 'e2e.db')
  return `file:${p}`
}

test('saisie avancée: plusieurs justificatifs sur une ligne au submit', async ({ page }) => {
  const prisma = new PrismaClient({ datasources: { db: { url: getTestDbUrl() } } })

  let associationId: string
  let fiscalYearId: string

  try {
    const assoc = await prisma.association.create({
      data: {
        name: 'Association MULTI DOCS E2E',
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

    await prisma.journal.upsert({
      where: { code: 'OD' },
      update: { name: 'Opérations Diverses' },
      create: { code: 'OD', name: 'Opérations Diverses' },
    })

    const debitAccount = await prisma.account.create({
      data: { fiscalYearId, number: '606', name: 'Achats non stockés' },
    })
    void debitAccount.id

    const creditAccount = await prisma.account.create({
      data: { fiscalYearId, number: '512', name: 'Banque' },
    })
    void creditAccount.id
  } finally {
    await prisma.$disconnect()
  }

  await page.context().addCookies([
    { name: 'currentAssociationId', value: associationId, path: '/', domain: '127.0.0.1' },
    { name: 'currentExerciceId', value: fiscalYearId, path: '/', domain: '127.0.0.1' },
  ])

  await page.goto('/saisie')

  await page.getByRole('button', { name: 'Saisie Avancée (Multiple)' }).click()

  await page.locator('#saisie-date').click()
  await page.locator('#saisie-date').fill('12/03/2026')
  await page.locator('#saisie-libelle').fill('E2E multi docs ligne')

  // Select accounts in both lines (react-select inputId is set).
  await page.locator('#saisie-ligne-compte-0').click()
  await page.keyboard.type('606')
  await page.keyboard.press('Enter')

  await page.locator('#saisie-ligne-compte-1').click()
  await page.keyboard.type('512')
  await page.keyboard.press('Enter')

  await page.getByLabel('Débit ligne 1').fill('45')
  await page.getByLabel('Crédit ligne 2').fill('45')

  const pdf1 = Buffer.from('%PDF-1.4\n% E2E 1\n%%EOF\n', 'utf8')
  const pdf2 = Buffer.from('%PDF-1.4\n% E2E 2\n%%EOF\n', 'utf8')

  await page.getByLabel('Pièce justificative ligne 1 — fichier 1').setInputFiles({
    name: 'justif-1.pdf',
    mimeType: 'application/pdf',
    buffer: pdf1,
  })

  await page.getByRole('button', { name: 'Ajouter un justificatif' }).first().click()

  await page.getByLabel('Pièce justificative ligne 1 — fichier 2').setInputFiles({
    name: 'justif-2.pdf',
    mimeType: 'application/pdf',
    buffer: pdf2,
  })

  await page.getByRole('button', { name: "Enregistrer l'écriture" }).click()

  await expect(page.getByText('Écriture enregistrée avec succès.')).toBeVisible()

  const prismaCheck = new PrismaClient({ datasources: { db: { url: getTestDbUrl() } } })
  try {
    const entry = await prismaCheck.entry.findFirst({
      where: { fiscalYearId, description: 'E2E multi docs ligne' },
      select: { lines: { select: { id: true, accountId: true, accountNumber: true } } },
    })
    expect(entry).not.toBeNull()
    const debitLine = entry!.lines.find((l) => l.accountNumber.startsWith('6'))
    expect(debitLine).toBeTruthy()

    const links = await prismaCheck.documentEntryLine.findMany({
      where: { entryLineId: debitLine!.id },
      select: { documentId: true },
    })
    expect(links).toHaveLength(2)

    const docs = await prismaCheck.document.findMany({
      where: { id: { in: links.map((l) => l.documentId) } },
      select: { originalName: true, fiscalYearId: true },
      orderBy: { originalName: 'asc' },
    })
    expect(docs.map((d) => d.originalName)).toEqual(['justif-1.pdf', 'justif-2.pdf'])
    expect(new Set(docs.map((d) => d.fiscalYearId))).toEqual(new Set([fiscalYearId]))
  } finally {
    await prismaCheck.$disconnect()
  }
})

