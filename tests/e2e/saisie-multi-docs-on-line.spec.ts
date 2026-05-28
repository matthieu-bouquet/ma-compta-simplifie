import { test, expect } from '@playwright/test'
import { createE2EPrisma } from './helpers/db'

test('saisie avancée: plusieurs justificatifs globaux à l’écriture au submit', async ({ page }) => {
  const prisma = createE2EPrisma()

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
  await page.locator('#saisie-libelle').fill('E2E multi docs écriture')

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

  await page.getByLabel('Pièce justificative — fichier 1').setInputFiles({
    name: 'justif-1.pdf',
    mimeType: 'application/pdf',
    buffer: pdf1,
  })

  await page.getByRole('button', { name: 'Ajouter un justificatif' }).click()

  await page.getByLabel('Pièce justificative — fichier 2').setInputFiles({
    name: 'justif-2.pdf',
    mimeType: 'application/pdf',
    buffer: pdf2,
  })

  await page.getByRole('button', { name: "Enregistrer l'écriture" }).click()

  await expect(page.getByText('Écriture enregistrée avec succès.')).toBeVisible()

  const prismaCheck = createE2EPrisma()
  try {
    const entry = await prismaCheck.entry.findFirst({
      where: { fiscalYearId, description: 'E2E multi docs écriture' },
      select: { lines: { select: { id: true, accountId: true, accountNumber: true } } },
    })
    expect(entry).not.toBeNull()
    const debitLine = entry!.lines.find((l) => l.accountNumber.startsWith('6'))
    const creditLine = entry!.lines.find((l) => l.accountNumber.startsWith('5'))
    expect(debitLine).toBeTruthy()
    expect(creditLine).toBeTruthy()

    const debitLinks = await prismaCheck.documentEntryLine.findMany({
      where: { entryLineId: debitLine!.id },
      select: { documentId: true },
    })
    const creditLinks = await prismaCheck.documentEntryLine.findMany({
      where: { entryLineId: creditLine!.id },
      select: { documentId: true },
    })
    expect(debitLinks).toHaveLength(2)
    expect(creditLinks).toHaveLength(2)
    expect(new Set(debitLinks.map((l) => l.documentId))).toEqual(
      new Set(creditLinks.map((l) => l.documentId)),
    )

    const docs = await prismaCheck.document.findMany({
      where: { id: { in: debitLinks.map((l) => l.documentId) } },
      select: { originalName: true, fiscalYearId: true },
      orderBy: { originalName: 'asc' },
    })
    expect(docs.map((d) => d.originalName)).toEqual(['justif-1.pdf', 'justif-2.pdf'])
    expect(new Set(docs.map((d) => d.fiscalYearId))).toEqual(new Set([fiscalYearId]))
  } finally {
    await prismaCheck.$disconnect()
  }
})

