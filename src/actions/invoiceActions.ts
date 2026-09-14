'use server'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import fsp from 'fs/promises'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentAssociationId } from '@/lib/associationContext'
import { assertFiscalYearWritable } from '@/lib/accountingGuards'
import { writeAuditEvent } from '@/lib/audit'
import { assertEntryDateNotAfterToday, assertEntryDateWithinFiscalYear } from '@/lib/entryDateValidation'
import { allocateInvoiceNumber } from '@/lib/invoiceNumbering'
import {
  buildCustomerReceivableEntryLines,
  findReceivable411Account,
} from '@/lib/customerReceivableEntryLines'
import { allocateEntryReferenceNumber } from '@/lib/journalNumbering'
import { getOrCreateJournalByCode } from '@/lib/journals'
import {
  buildInvoicePdfBuffer,
  defaultInvoicePdfFileName,
  type InvoicePdfPayload,
} from '@/lib/invoicePdf'
import { assertAssociationReadyForInvoice } from '@/lib/invoicePdfLegal'
import { saveBufferToUpload, toAbsolutePath } from '@/lib/documentsStorage'
import { COUNTERPARTY_KIND_CUSTOMER } from '@/lib/counterparty'
import { formatEurosFromCents } from '@/lib/money'

export type InvoiceLineInput = {
  description: string
  quantityMilliUnits?: number | null
  unitPriceCents?: number | null
  amountCents: number
  accountId: string
}

export type CreateInvoiceInput = {
  fiscalYearId: string
  issueDate: string
  dueDate: string
  recipientName: string
  recipientAddress?: string | null
  recipientPostalCode?: string | null
  recipientCity?: string | null
  recipientEmail?: string | null
  recipientSiret?: string | null
  counterpartyId?: string | null
  postToAccounting: boolean
  lines: InvoiceLineInput[]
}

function logoFormatForPdf(mimeType: string): 'PNG' | 'JPEG' | null {
  if (mimeType === 'image/png') return 'PNG'
  if (mimeType === 'image/jpeg') return 'JPEG'
  return null
}

async function loadLogoDataUrl(relativePath: string, mimeType: string) {
  const format = logoFormatForPdf(mimeType)
  if (!format) return null
  try {
    const buf = await fsp.readFile(toAbsolutePath(relativePath))
    const dataUrl = `data:${mimeType};base64,${buf.toString('base64')}`
    return { dataUrl, format } as const
  } catch {
    return null
  }
}

function quantityLabel(milli: number | null | undefined): string | null {
  if (milli == null) return null
  const n = milli / 1000
  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/\.?0+$/, '')
}

export async function listInvoices(fiscalYearId: string) {
  const associationId = await getCurrentAssociationId()
  if (!associationId) throw new Error('Association non sélectionnée.')

  const rows = await prisma.invoice.findMany({
    where: { fiscalYearId, associationId },
    orderBy: [{ issueDate: 'desc' }, { sequence: 'desc' }],
    select: {
      id: true,
      number: true,
      issueDate: true,
      recipientName: true,
      totalCents: true,
      entryId: true,
    },
  })

  return rows
}

export async function createInvoice(input: CreateInvoiceInput) {
  const associationId = await getCurrentAssociationId()
  if (!associationId) throw new Error('Association non sélectionnée.')

  const recipientName = input.recipientName.trim()
  if (!recipientName) throw new Error('Le nom du destinataire est obligatoire.')

  if (!input.lines.length) throw new Error('Ajoutez au moins une ligne à la facture.')

  await assertFiscalYearWritable({ fiscalYearId: input.fiscalYearId, associationId })

  const fiscalYear = await prisma.fiscalYear.findUnique({
    where: { id: input.fiscalYearId },
    include: { association: true },
  })
  if (!fiscalYear || fiscalYear.associationId !== associationId) {
    throw new Error('Exercice introuvable.')
  }

  assertEntryDateNotAfterToday(input.issueDate)
  assertEntryDateWithinFiscalYear(input.issueDate, fiscalYear.startDate, fiscalYear.endDate)

  assertAssociationReadyForInvoice(fiscalYear.association)

  const issueDate = new Date(input.issueDate)
  const dueDate = new Date(input.dueDate)
  if (Number.isNaN(dueDate.getTime())) {
    throw new Error('Date d’échéance invalide.')
  }
  if (dueDate < issueDate) {
    throw new Error('La date d’échéance ne peut pas être antérieure à la date de facture.')
  }
  assertEntryDateWithinFiscalYear(input.dueDate, fiscalYear.startDate, fiscalYear.endDate)

  const counterpartyId: string | null = input.counterpartyId?.trim() || null
  if (input.postToAccounting) {
    if (!counterpartyId) throw new Error('Veuillez choisir un client pour envoyer la facture en compta.')
  }

  if (counterpartyId) {
    const cp = await prisma.counterparty.findUnique({
      where: { id: counterpartyId },
      select: { associationId: true, kind: true },
    })
    if (!cp || cp.associationId !== associationId) throw new Error('Client introuvable.')
    if (cp.kind !== COUNTERPARTY_KIND_CUSTOMER) throw new Error('Le tiers sélectionné doit être un client.')
  }

  const accountIds = input.lines.map((l) => l.accountId)
  const accounts = await prisma.account.findMany({
    where: { fiscalYearId: input.fiscalYearId, id: { in: accountIds } },
  })
  if (accounts.length !== new Set(accountIds).size) {
    throw new Error('Compte produit introuvable pour une ligne.')
  }

  const lineCreates: {
    sortOrder: number
    description: string
    quantityMilliUnits: number | null
    unitPriceCents: number | null
    amountCents: number
    accountId: string
    accountNumber: string
    accountName: string
  }[] = []

  let totalCents = 0
  for (let idx = 0; idx < input.lines.length; idx++) {
    const line = input.lines[idx]!
    const description = line.description.trim()
    if (!description) throw new Error(`Ligne ${idx + 1} : description obligatoire.`)
    if (!Number.isInteger(line.amountCents) || line.amountCents <= 0) {
      throw new Error(`Ligne ${idx + 1} : montant invalide.`)
    }
    const account = accounts.find((a) => a.id === line.accountId)
    if (!account || !account.number.startsWith('7')) {
      throw new Error(`Ligne ${idx + 1} : choisissez un compte de produit (classe 7).`)
    }
    totalCents += line.amountCents
    lineCreates.push({
      sortOrder: idx,
      description,
      quantityMilliUnits: line.quantityMilliUnits ?? null,
      unitPriceCents: line.unitPriceCents ?? null,
      amountCents: line.amountCents,
      accountId: account.id,
      accountNumber: account.number,
      accountName: account.name,
    })
  }

  let receivable411: { id: string; number: string; name: string } | null = null
  let entryLinesPayload: Awaited<ReturnType<typeof buildCustomerReceivableEntryLines>> | null = null

  if (input.postToAccounting) {
    receivable411 = await findReceivable411Account(prisma, input.fiscalYearId)
    if (!receivable411) throw new Error('Le compte 411 (Clients) est absent du plan de cet exercice.')
    entryLinesPayload = await buildCustomerReceivableEntryLines(prisma, {
      fiscalYearId: input.fiscalYearId,
      receivableAccountId: receivable411.id,
      receivableAccountNumber: receivable411.number,
      receivableAccountName: receivable411.name,
      productLines: lineCreates.map((l) => ({
        accountId: l.accountId,
        accountNumber: l.accountNumber,
        accountName: l.accountName,
        amountCents: l.amountCents,
      })),
    })
  }

  const association = fiscalYear.association
  const logoImage =
    association.logoRelativePath && association.logoMimeType
      ? await loadLogoDataUrl(association.logoRelativePath, association.logoMimeType)
      : null

  const pdfPayload: InvoicePdfPayload = {
    number: 'PROFORMA',
    issueDate,
    dueDate,
    emitter: {
      name: association.name,
      address: association.address,
      postalCode: association.postalCode,
      city: association.city,
      email: association.email,
      phone: association.phone,
      siret: association.siret,
      vatLiable: association.vatLiable,
    },
    recipient: {
      name: recipientName,
      address: input.recipientAddress?.trim() || null,
      postalCode: input.recipientPostalCode?.trim() || null,
      city: input.recipientCity?.trim() || null,
      email: input.recipientEmail?.trim() || null,
      siret: input.recipientSiret?.trim() || null,
    },
    lines: lineCreates.map((l) => ({
      description: l.description,
      quantityLabel: quantityLabel(l.quantityMilliUnits),
      unitPriceLabel: l.unitPriceCents != null ? formatEurosFromCents(l.unitPriceCents) : null,
      amountCents: l.amountCents,
    })),
    totalCents,
    logoImage,
  }

  const veJournal = await getOrCreateJournalByCode(prisma, { code: 'VE', name: 'Ventes' })

  const created = await prisma.$transaction(async (tx) => {
    const { sequence, number } = await allocateInvoiceNumber(tx, {
      fiscalYearId: input.fiscalYearId,
      issueDate,
    })

    pdfPayload.number = number

    const pdfBuffer = buildInvoicePdfBuffer(pdfPayload)
    const pdfOriginalName = defaultInvoicePdfFileName(number, recipientName)
    const storedPdf = await saveBufferToUpload({
      buffer: pdfBuffer,
      mimeType: 'application/pdf',
      originalBaseName: pdfOriginalName,
      associationId,
      exerciceId: input.fiscalYearId,
    })

    const invoice = await tx.invoice.create({
      data: {
        associationId,
        fiscalYearId: input.fiscalYearId,
        sequence,
        number,
        issueDate,
        dueDate,
        recipientName,
        recipientAddress: input.recipientAddress?.trim() || null,
        recipientPostalCode: input.recipientPostalCode?.trim() || null,
        recipientCity: input.recipientCity?.trim() || null,
        recipientEmail: input.recipientEmail?.trim() || null,
        recipientSiret: input.recipientSiret?.trim() || null,
        counterpartyId,
        totalCents,
        lines: { create: lineCreates },
      },
      select: { id: true },
    })

    const pdfDoc = await tx.document.create({
      data: {
        fiscalYearId: input.fiscalYearId,
        originalName: pdfOriginalName,
        storedName: storedPdf.storedName,
        mimeType: storedPdf.mimeType,
        sizeBytes: storedPdf.sizeBytes,
        sha256: storedPdf.sha256,
        relativePath: storedPdf.relativePath,
        uploadedAt: new Date(),
      },
      select: { id: true },
    })

    await tx.invoice.update({
      where: { id: invoice.id },
      data: { pdfDocumentId: pdfDoc.id },
    })

    let entryId: string | null = null

    if (input.postToAccounting && entryLinesPayload && receivable411 && counterpartyId) {
      let descriptionFinal = `Facture ${number}`
      const cp = await tx.counterparty.findUnique({
        where: { id: counterpartyId },
        select: { name: true },
      })
      if (cp && !descriptionFinal.includes(cp.name)) {
        descriptionFinal = `${descriptionFinal} — ${cp.name}`
      }

      const { referenceNumber, referenceSequence } = await allocateEntryReferenceNumber(tx, {
        fiscalYearId: input.fiscalYearId,
        journalId: veJournal.id,
      })

      const entry = await tx.entry.create({
        data: {
          date: issueDate,
          description: descriptionFinal,
          journalId: veJournal.id,
          fiscalYearId: input.fiscalYearId,
          counterpartyId,
          referenceNumber,
          referenceSequence,
          lines: {
            create: entryLinesPayload.lines.map((l) => ({
              accountId: l.accountId,
              accountNumber: l.accountNumber,
              accountName: l.accountName,
              debitCents: l.debitCents,
              creditCents: l.creditCents,
            })),
          },
        },
        select: { id: true, lines: { select: { id: true } } },
      })

      if (entry.lines.length > 0) {
        await tx.documentEntryLine.createMany({
          data: entry.lines.map((l) => ({ documentId: pdfDoc.id, entryLineId: l.id })),
        })
      }

      entryId = entry.id
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { entryId },
      })
    }

    return { invoiceId: invoice.id, number, entryId, pdfDocumentId: pdfDoc.id }
  })

  await writeAuditEvent({
    associationId,
    fiscalYearId: input.fiscalYearId,
    actor: associationId,
    action: 'INVOICE_CREATE',
    entityType: 'Invoice',
    entityId: created.invoiceId,
    data: {
      number: created.number,
      totalCents,
      postToAccounting: input.postToAccounting,
      entryId: created.entryId,
    },
  })

  if (created.entryId) {
    await writeAuditEvent({
      associationId,
      fiscalYearId: input.fiscalYearId,
      actor: associationId,
      action: 'ENTRY_CREATE',
      entityType: 'Entry',
      entityId: created.entryId,
      data: { description: `Facture ${created.number}`, invoiceId: created.invoiceId },
    })
  }

  revalidatePath('/factures')
  revalidatePath('/saisie')
  revalidatePath('/documents')

  return { id: created.invoiceId, number: created.number }
}
