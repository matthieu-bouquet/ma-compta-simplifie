'use server'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import fsp from 'fs/promises'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentAssociationId } from '@/lib/associationContext'
import { assertFiscalYearWritable } from '@/lib/accountingGuards'
import { writeAuditEvent } from '@/lib/audit'
import { assertEntryDateNotAfterToday, assertEntryDateWithinFiscalYear, calendarDateInTimeZone, ENTRY_DATE_TIMEZONE } from '@/lib/entryDateValidation'
import { allocateInvoiceNumber } from '@/lib/invoiceNumbering'
import { prepareInvoiceAccountingPost, createInvoiceReceivableEntryInTransaction } from '@/lib/invoiceAccountingPost'
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
      counterpartyId: true,
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

  let preparedAccounting: Awaited<ReturnType<typeof prepareInvoiceAccountingPost>> | null = null

  if (input.postToAccounting) {
    preparedAccounting = await prepareInvoiceAccountingPost(prisma, {
      associationId,
      entryId: null,
      counterpartyId,
      fiscalYearId: input.fiscalYearId,
      totalCents,
      lines: lineCreates.map((l) => ({
        amountCents: l.amountCents,
        accountId: l.accountId,
        accountNumber: l.accountNumber,
        accountName: l.accountName,
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

    if (input.postToAccounting && preparedAccounting && counterpartyId) {
      const entryId = await createInvoiceReceivableEntryInTransaction(tx, {
        fiscalYearId: input.fiscalYearId,
        issueDate,
        invoiceNumber: number,
        counterpartyId,
        journalId: veJournal.id,
        pdfDocumentId: pdfDoc.id,
        entryLinesPayload: preparedAccounting.entryLinesPayload,
      })

      await tx.invoice.update({
        where: { id: invoice.id },
        data: { entryId },
      })

      return { invoiceId: invoice.id, number, entryId, pdfDocumentId: pdfDoc.id }
    }

    return { invoiceId: invoice.id, number, entryId: null as string | null, pdfDocumentId: pdfDoc.id }
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

export async function postInvoiceToAccounting(invoiceId: string) {
  const associationId = await getCurrentAssociationId()
  if (!associationId) throw new Error('Association non sélectionnée.')

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { lines: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!invoice || invoice.associationId !== associationId) {
    throw new Error('Facture introuvable.')
  }

  await assertFiscalYearWritable({ fiscalYearId: invoice.fiscalYearId, associationId })

  const fiscalYear = await prisma.fiscalYear.findUnique({
    where: { id: invoice.fiscalYearId },
  })
  if (!fiscalYear || fiscalYear.associationId !== associationId) {
    throw new Error('Exercice introuvable.')
  }

  const issueDateStr = calendarDateInTimeZone(invoice.issueDate, ENTRY_DATE_TIMEZONE)
  assertEntryDateNotAfterToday(issueDateStr)
  assertEntryDateWithinFiscalYear(issueDateStr, fiscalYear.startDate, fiscalYear.endDate)

  const prepared = await prepareInvoiceAccountingPost(prisma, {
    associationId,
    entryId: invoice.entryId,
    counterpartyId: invoice.counterpartyId,
    fiscalYearId: invoice.fiscalYearId,
    totalCents: invoice.totalCents,
    lines: invoice.lines.map((l) => ({
      amountCents: l.amountCents,
      accountId: l.accountId,
      accountNumber: l.accountNumber,
      accountName: l.accountName,
    })),
  })

  const veJournal = await getOrCreateJournalByCode(prisma, { code: 'VE', name: 'Ventes' })

  const posted = await prisma.$transaction(async (tx) => {
    const current = await tx.invoice.findUnique({
      where: { id: invoiceId },
      select: { entryId: true },
    })
    if (current?.entryId) throw new Error('Cette facture est déjà en compta.')

    const entryId = await createInvoiceReceivableEntryInTransaction(tx, {
      fiscalYearId: invoice.fiscalYearId,
      issueDate: invoice.issueDate,
      invoiceNumber: invoice.number,
      counterpartyId: prepared.counterpartyId,
      journalId: veJournal.id,
      pdfDocumentId: invoice.pdfDocumentId,
      entryLinesPayload: prepared.entryLinesPayload,
    })

    await tx.invoice.update({
      where: { id: invoiceId },
      data: { entryId },
    })

    return { entryId }
  })

  await writeAuditEvent({
    associationId,
    fiscalYearId: invoice.fiscalYearId,
    actor: associationId,
    action: 'INVOICE_POST_TO_ACCOUNTING',
    entityType: 'Invoice',
    entityId: invoiceId,
    data: { number: invoice.number, entryId: posted.entryId },
  })

  await writeAuditEvent({
    associationId,
    fiscalYearId: invoice.fiscalYearId,
    actor: associationId,
    action: 'ENTRY_CREATE',
    entityType: 'Entry',
    entityId: posted.entryId,
    data: { description: `Facture ${invoice.number}`, invoiceId },
  })

  revalidatePath('/factures')
  revalidatePath('/saisie')
  revalidatePath('/documents')

  return { entryId: posted.entryId }
}
