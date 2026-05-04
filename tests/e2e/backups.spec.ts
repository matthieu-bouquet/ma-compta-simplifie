import { test, expect } from '@playwright/test'
import path from 'node:path'
import fsp from 'node:fs/promises'
import { PrismaClient } from '@prisma/client'
import JSZip from 'jszip'

function getTestDbUrl() {
  const p = path.join(process.cwd(), '.tmp', 'e2e.db')
  return `file:${p}`
}

test('export zip from settings backup page', async ({ page }) => {
  const prisma = new PrismaClient({ datasources: { db: { url: getTestDbUrl() } } })
  let associationId: string
  let fiscalYearId: string

  try {
    const assoc = await prisma.association.create({ data: { name: 'Association BACKUP E2E' } })
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

    const pdfBytes = Buffer.from('%PDF-1.4\n% E2E\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n', 'utf8')
    const storedName = '2026-04-30T000000Z_backup__e2e.pdf'
    const relativePath = path.posix.join('uploads', associationId, fiscalYearId, storedName)
    const documentsDir = path.join(process.cwd(), '.tmp', 'documents')
    const absolutePath = path.join(documentsDir, relativePath)
    await fsp.mkdir(path.dirname(absolutePath), { recursive: true })
    await fsp.writeFile(absolutePath, pdfBytes)

    await prisma.document.create({
      data: {
        fiscalYearId,
        originalName: 'backup.pdf',
        storedName,
        mimeType: 'application/pdf',
        sizeBytes: pdfBytes.byteLength,
        relativePath,
        uploadedAt: new Date(),
      },
    })

    await prisma.budget.create({
      data: {
        associationId,
        name: 'Budget BACKUP E2E',
        lines: {
          create: [{ accountNumber: '6061', accountName: 'Charges E2E', amountCents: 12_000 }],
        },
      },
    })
  } finally {
    await prisma.$disconnect()
  }

  await page.goto('/parametres/sauvegarde')

  // Expand the entity, select the fiscal year and the prévisionnel, then export.
  await page.getByLabel('Déplier').first().click()
  await page.getByLabel(/Sélectionner l’exercice/i).first().check()
  await page.getByLabel(/Sélectionner le prévisionnel « Budget BACKUP E2E »/i).check()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Télécharger la sauvegarde' }).click()
  const dl = await downloadPromise
  expect(dl.suggestedFilename()).toContain('.zip')

  const zipPath = await dl.path()
  expect(zipPath).toBeTruthy()
  const buf = await fsp.readFile(zipPath!)
  const zip = await JSZip.loadAsync(buf)
  const budgetsEntry = zip.file('data/budgets.json')
  expect(budgetsEntry).toBeTruthy()
  const budgetsJson = JSON.parse(await budgetsEntry!.async('string')) as { name: string }[]
  expect(budgetsJson.some((b) => b.name === 'Budget BACKUP E2E')).toBe(true)
  const linesEntry = zip.file('data/budgetLines.json')
  expect(linesEntry).toBeTruthy()
})

