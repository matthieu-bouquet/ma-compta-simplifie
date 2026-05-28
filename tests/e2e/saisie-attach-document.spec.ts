import { test, expect } from '@playwright/test'
import { createE2EPrisma } from './helpers/db'

test('attach document from a saisie line via the faded paperclip', async ({ page }) => {
  const prisma = createE2EPrisma()

  let associationId: string
  let fiscalYearId: string
  let chargeLineId: string

  try {
    const assoc = await prisma.association.create({
      data: {
        name: 'Association ATTACH E2E',
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

    const journal = await prisma.journal.upsert({
      where: { code: 'AC' },
      update: { name: 'Achats' },
      create: { code: 'AC', name: 'Achats' },
    })

    const debitAccount = await prisma.account.create({
      data: { fiscalYearId, number: '606', name: 'Achats non stockés' },
    })
    const creditAccount = await prisma.account.create({
      data: { fiscalYearId, number: '512', name: 'Banque' },
    })

    const entry = await prisma.entry.create({
      data: {
        fiscalYearId,
        journalId: journal.id,
        date: new Date('2026-03-12'),
        description: 'Test attache pièce justificative',
        referenceNumber: 'AC-000001',
        referenceSequence: 1,
        lines: {
          create: [
            {
              accountId: debitAccount.id,
              accountNumber: debitAccount.number,
              accountName: debitAccount.name,
              debitCents: 4500,
              creditCents: 0,
            },
            {
              accountId: creditAccount.id,
              accountNumber: creditAccount.number,
              accountName: creditAccount.name,
              debitCents: 0,
              creditCents: 4500,
            },
          ],
        },
      },
      select: { id: true, lines: { select: { id: true, accountNumber: true } } },
    })

    const charge = entry.lines.find((l) => l.accountNumber.startsWith('6'))
    if (!charge) throw new Error('Seed: missing 6xx line')
    chargeLineId = charge.id
  } finally {
    await prisma.$disconnect()
  }

  await page.context().addCookies([
    { name: 'currentAssociationId', value: associationId, path: '/', domain: '127.0.0.1' },
    { name: 'currentExerciceId', value: fiscalYearId, path: '/', domain: '127.0.0.1' },
  ])

  await page.goto('/saisie')

  const row = page.locator('tr', { hasText: 'Test attache pièce justificative' }).first()
  await expect(row).toBeVisible()

  await row.locator('button[title="Ajouter une pièce justificative"]').click()

  const dialog = page.locator('dialog[open]')
  await expect(dialog.getByRole('heading', { name: 'Ajouter une pièce justificative' })).toBeVisible()

  const pdfBytes = Buffer.from('%PDF-1.4\n% E2E\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n', 'utf8')
  await dialog.getByLabel('Fichier').setInputFiles({
    name: 'justif.pdf',
    mimeType: 'application/pdf',
    buffer: pdfBytes,
  })

  await dialog.getByRole('button', { name: 'Uploader' }).click()

  await expect(page.locator('dialog[open]')).toHaveCount(0)

  const updatedRow = page.locator('tr', { hasText: 'Test attache pièce justificative' }).first()
  await expect(updatedRow.getByRole('button', { name: 'Voir le document' })).toBeVisible()

  const prismaCheck = createE2EPrisma()
  try {
    const links = await prismaCheck.documentEntryLine.findMany({
      where: { entryLineId: chargeLineId },
      select: { documentId: true },
    })
    expect(links).toHaveLength(1)

    const doc = await prismaCheck.document.findUnique({
      where: { id: links[0].documentId },
      select: { fiscalYearId: true, originalName: true },
    })
    expect(doc?.fiscalYearId).toBe(fiscalYearId)
    expect(doc?.originalName).toBe('justif.pdf')
  } finally {
    await prismaCheck.$disconnect()
  }
})
