import { test, expect } from '@playwright/test'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

function getTestDbUrl() {
  const p = path.join(process.cwd(), '.tmp', 'e2e.db')
  return `file:${p}`
}

test('saisie rapide: plusieurs justificatifs au submit (liés à la ligne catégorie)', async ({ page }) => {
  const prisma = new PrismaClient({ datasources: { db: { url: getTestDbUrl() } } })

  let associationId: string
  let fiscalYearId: string

  try {
    const assoc = await prisma.association.create({ data: { name: 'Association QUICK MULTI DOCS E2E' } })
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
      where: { code: 'AC' },
      update: { name: 'Achats' },
      create: { code: 'AC', name: 'Achats' },
    })

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
  await page.locator('#saisie-date').fill('12/03/2026')
  await page.locator('#saisie-libelle').fill('E2E quick multi docs')
  await page.locator('#saisie-montant').fill('45')

  // react-select inputs
  await page.locator('#saisie-compte-paiement').click()
  await page.keyboard.type('512')
  await page.keyboard.press('Enter')

  await page.locator('#saisie-compte-operation').click()
  await page.keyboard.type('606')
  await page.keyboard.press('Enter')

  const pdf1 = Buffer.from('%PDF-1.4\n% E2E 1\n%%EOF\n', 'utf8')
  const pdf2 = Buffer.from('%PDF-1.4\n% E2E 2\n%%EOF\n', 'utf8')

  await page.getByLabel('Pièce justificative — fichier 1').setInputFiles({
    name: 'quick-justif-1.pdf',
    mimeType: 'application/pdf',
    buffer: pdf1,
  })

  await page.getByRole('button', { name: 'Ajouter un justificatif' }).click()

  await page.getByLabel('Pièce justificative — fichier 2').setInputFiles({
    name: 'quick-justif-2.pdf',
    mimeType: 'application/pdf',
    buffer: pdf2,
  })

  await page.getByRole('button', { name: "Enregistrer l'écriture" }).click()
  await expect(page.getByText('Écriture enregistrée avec succès.')).toBeVisible()

  const prismaCheck = new PrismaClient({ datasources: { db: { url: getTestDbUrl() } } })
  try {
    const entry = await prismaCheck.entry.findFirst({
      where: { fiscalYearId, description: 'E2E quick multi docs' },
      select: { lines: { select: { id: true, accountNumber: true } } },
    })
    expect(entry).not.toBeNull()
    const categoryLine = entry!.lines.find((l) => l.accountNumber === '606')
    expect(categoryLine).toBeTruthy()

    const links = await prismaCheck.documentEntryLine.findMany({
      where: { entryLineId: categoryLine!.id },
      select: { documentId: true },
    })
    expect(links).toHaveLength(2)

    const docs = await prismaCheck.document.findMany({
      where: { id: { in: links.map((l) => l.documentId) } },
      select: { originalName: true },
      orderBy: { originalName: 'asc' },
    })
    expect(docs.map((d) => d.originalName)).toEqual(['quick-justif-1.pdf', 'quick-justif-2.pdf'])
  } finally {
    await prismaCheck.$disconnect()
  }
})

