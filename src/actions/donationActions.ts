'use server'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentAssociationId } from '@/lib/associationContext'
import { assertFiscalYearWritable } from '@/lib/accountingGuards'
import { writeAuditEvent } from '@/lib/audit'
import { createCashIncomeEntryInTransaction } from '@/lib/cashIncomeAccountingPost'
import { DONATION_INCOME_ACCOUNT, isDonationPaymentMethod } from '@/lib/membership'
import { allocateTaxReceiptNumber } from '@/lib/taxReceiptNumbering'
import {
  assertOrganismeReadyForTaxReceipt,
  buildTaxReceiptPdfBuffer,
  defaultTaxReceiptPdfFileName,
} from '@/lib/taxReceiptPdf'
import { saveBufferToUpload } from '@/lib/documentsStorage'
import { eurosToCents } from '@/lib/money'
import {
  assertEntryDateNotAfterToday,
  assertEntryDateWithinFiscalYear,
} from '@/lib/entryDateValidation'

function safeRevalidate(path: string) {
  try {
    revalidatePath(path)
  } catch {
    // tests / non-Next
  }
}

export type CreateDonationInput = {
  fiscalYearId: string
  donorName: string
  donorAddress?: string | null
  donorPostalCode?: string | null
  donorCity?: string | null
  donorEmail?: string | null
  amountEuros: number
  date: string
  paymentMethod: string
  treasuryAccountNumber: string
  eligibilityAttested: boolean
}

export async function createDonationWithTaxReceipt(input: CreateDonationInput) {
  const associationId = await getCurrentAssociationId()
  if (!associationId) throw new Error('Association non sélectionnée.')
  await assertFiscalYearWritable({ fiscalYearId: input.fiscalYearId, associationId })

  const donorName = input.donorName.trim()
  if (!donorName) throw new Error('Le nom du donateur est requis.')
  if (!input.donorAddress?.trim() || !input.donorPostalCode?.trim() || !input.donorCity?.trim()) {
    throw new Error('L’adresse complète du donateur est requise pour le reçu fiscal.')
  }
  if (!input.eligibilityAttested) {
    throw new Error('Vous devez attester que ce versement est un don (pas une cotisation avec contrepartie).')
  }
  if (!isDonationPaymentMethod(input.paymentMethod)) {
    throw new Error('Moyen de paiement invalide.')
  }
  const amountCents = eurosToCents(input.amountEuros)
  if (amountCents <= 0) throw new Error('Le montant du don doit être strictement supérieur à 0.')
  if (!input.date) throw new Error('Date du don requise.')
  assertEntryDateNotAfterToday(input.date)

  const fy = await prisma.fiscalYear.findFirst({
    where: { id: input.fiscalYearId, associationId },
  })
  if (!fy) throw new Error('Exercice introuvable.')
  assertEntryDateWithinFiscalYear(input.date, fy.startDate, fy.endDate)

  const association = await prisma.association.findUnique({ where: { id: associationId } })
  if (!association) throw new Error('Association introuvable.')
  if (!association.taxReceiptEligibilityAttested) {
    throw new Error(
      'Attestez l’intérêt général de l’association (Paramètres → Associations) avant d’émettre un reçu fiscal.',
    )
  }

  const organisme = {
    name: association.name,
    address: association.address,
    postalCode: association.postalCode,
    city: association.city,
    siret: association.siret,
    rna: association.rna,
    socialObject: association.socialObject,
    signatoryName: association.receiptSignatoryName,
    signatoryRole: association.receiptSignatoryRole,
  }
  assertOrganismeReadyForTaxReceipt(organisme)

  const donationDate = new Date(`${input.date}T12:00:00`)
  const calendarYear = donationDate.getFullYear()
  const treasury = input.treasuryAccountNumber.trim()
  if (!treasury) throw new Error('Compte de trésorerie requis.')

  const created = await prisma.$transaction(async (tx) => {
    const { sequence, number } = await allocateTaxReceiptNumber(tx, { associationId, calendarYear })
    const issuedAt = new Date()
    const pdfBuffer = buildTaxReceiptPdfBuffer({
      number,
      issuedAt,
      donationDate,
      amountCents,
      paymentMethod: input.paymentMethod,
      organisme,
      donor: {
        name: donorName,
        address: input.donorAddress,
        postalCode: input.donorPostalCode,
        city: input.donorCity,
      },
    })
    const pdfOriginalName = defaultTaxReceiptPdfFileName(number, donorName)
    const storedPdf = await saveBufferToUpload({
      buffer: pdfBuffer,
      mimeType: 'application/pdf',
      originalBaseName: pdfOriginalName,
      associationId,
      exerciceId: input.fiscalYearId,
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
        uploadedAt: issuedAt,
      },
      select: { id: true },
    })

    const posted = await createCashIncomeEntryInTransaction(tx, {
      associationId,
      fiscalYearId: input.fiscalYearId,
      date: donationDate,
      description: `Don ${number} — ${donorName}`,
      amountCents,
      treasuryAccountNumber: treasury,
      incomeAccountNumber: DONATION_INCOME_ACCOUNT,
      pdfDocumentId: pdfDoc.id,
    })

    const donation = await tx.donation.create({
      data: {
        associationId,
        fiscalYearId: input.fiscalYearId,
        donorName,
        donorAddress: input.donorAddress?.trim() || null,
        donorPostalCode: input.donorPostalCode?.trim() || null,
        donorCity: input.donorCity?.trim() || null,
        donorEmail: input.donorEmail?.trim() || null,
        amountCents,
        date: donationDate,
        paymentMethod: input.paymentMethod,
        treasuryAccountNumber: posted.treasuryNumber,
        eligibilityAttested: true,
        entryId: posted.entryId,
      },
    })

    await tx.taxReceipt.create({
      data: {
        associationId,
        donationId: donation.id,
        calendarYear,
        sequence,
        number,
        issuedAt,
        pdfDocumentId: pdfDoc.id,
      },
    })

    await writeAuditEvent(
      {
        associationId,
        fiscalYearId: input.fiscalYearId,
        action: 'DONATION_CREATE',
        entityType: 'Donation',
        entityId: donation.id,
        data: { taxReceiptNumber: number, entryId: posted.entryId },
      },
      tx,
    )

    return { donationId: donation.id, taxReceiptNumber: number }
  })

  safeRevalidate('/dons')
  safeRevalidate('/ecritures')
  return created
}

export async function listDonations(fiscalYearId: string) {
  const associationId = await getCurrentAssociationId()
  if (!associationId) return []
  return prisma.donation.findMany({
    where: { associationId, fiscalYearId },
    include: { taxReceipt: true },
    orderBy: { date: 'desc' },
  })
}
