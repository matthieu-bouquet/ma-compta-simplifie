import { test, expect } from '@playwright/test'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import fsp from 'node:fs/promises'

function getTestDbUrl() {
  const p = path.join(process.cwd(), '.tmp', 'e2e.db')
  return `file:${p}`
}

test('document viewer works from list and link page', async ({ page }) => {
  const prisma = new PrismaClient({ datasources: { db: { url: getTestDbUrl() } } })
  let associationId: string
  let fiscalYearId: string
  let documentId: string

  try {
    const assoc = await prisma.association.create({ data: { name: 'Association DOC E2E' } })
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

    const fileName = 'test.pdf'
    const pdfBytes = Buffer.from('%PDF-1.4\n% E2E\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n', 'utf8')
    const storedName = '2026-04-30T000000Z_test__e2e.pdf'
    const relativePath = path.posix.join('uploads', associationId, fiscalYearId, storedName)

    const documentsDir = path.join(process.cwd(), '.tmp', 'documents')
    const absolutePath = path.join(documentsDir, relativePath)
    await fsp.mkdir(path.dirname(absolutePath), { recursive: true })
    await fsp.writeFile(absolutePath, pdfBytes)

    const doc = await prisma.document.create({
      data: {
        fiscalYearId,
        originalName: fileName,
        storedName,
        mimeType: 'application/pdf',
        sizeBytes: pdfBytes.byteLength,
        relativePath,
        uploadedAt: new Date(),
      },
      select: { id: true },
    })
    documentId = doc.id
  } finally {
    await prisma.$disconnect()
  }

  await page.context().addCookies([
    { name: 'currentAssociationId', value: associationId, path: '/', domain: '127.0.0.1' },
    { name: 'currentExerciceId', value: fiscalYearId, path: '/', domain: '127.0.0.1' },
  ])

  await page.goto('/documents')

  // Document should appear in the list.
  await expect(page.locator('tbody tr').first().locator('td').first().getByText('test.pdf', { exact: true })).toBeVisible()

  // Viewer (modal) should open from the list.
  await page.getByRole('button', { name: 'Voir' }).click()
  const dialog = page.getByRole('dialog', { name: 'test.pdf' })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('iframe')).toHaveAttribute('src', /inline=1/)
  await dialog.getByRole('button', { name: 'Fermer' }).click()
  await expect(dialog).toBeHidden()

  // Link page should show split view (viewer + lines list).
  await page.getByRole('link', { name: 'Lier le document' }).click()
  await expect(page.getByText('test.pdf', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Rechercher une ligne', { exact: true })).toBeVisible()

  // ZIP download route should return 200 (must include cookies for auth).
  const downloadPromise = page.waitForEvent('download')
  await page.evaluate((id) => {
    window.location.href = `/api/exercices/${encodeURIComponent(id)}/documents.zip`
  }, fiscalYearId)
  const dl = await downloadPromise
  expect(dl.suggestedFilename()).toContain('.zip')
})

