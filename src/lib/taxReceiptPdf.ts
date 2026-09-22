// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import jsPDF from 'jspdf'
import { formatEurosFromCents } from '@/lib/money'
import { amountInFrenchEuros } from '@/lib/amountInFrench'
import { donationPaymentMethodLabel } from '@/lib/membership'
import { PRODUCT_DISPLAY_NAME } from '@/lib/productDisplayName'
import { entityNameForFilename } from '@/lib/compteResultatPdf'

export const CERFA_FORM_NUMBER = '11580*06'

export type TaxReceiptPdfOrganisme = {
  name: string
  address?: string | null
  postalCode?: string | null
  city?: string | null
  siret?: string | null
  rna?: string | null
  socialObject?: string | null
  signatoryName?: string | null
  signatoryRole?: string | null
}

export type TaxReceiptPdfDonor = {
  name: string
  address?: string | null
  postalCode?: string | null
  city?: string | null
}

export type TaxReceiptPdfPayload = {
  number: string
  issuedAt: Date
  donationDate: Date
  amountCents: number
  paymentMethod: string
  organisme: TaxReceiptPdfOrganisme
  donor: TaxReceiptPdfDonor
}

function formatDateFr(d: Date) {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function cityLine(postalCode?: string | null, city?: string | null) {
  return [postalCode, city].filter(Boolean).join(' ')
}

export function taxReceiptLegalMentions(): string[] {
  return [
    `Cerfa n° ${CERFA_FORM_NUMBER} — Reçu au titre des dons à certains organismes d’intérêt général.`,
    'Le bénéficiaire atteste qu’il est un organisme d’intérêt général visé aux articles 200 et 238 bis du CGI. Ce logiciel ne vérifie pas l’éligibilité : la responsabilité de l’attestation incombe à l’association.',
    'Le don ouvre droit à une réduction d’impôt dans les conditions prévues par ces articles, sous réserve que le donateur remplisse lui-même les conditions légales.',
    'Ce reçu ne peut pas être émis pour une cotisation avec contrepartie (compte 7562). Il concerne uniquement un don (compte 754).',
  ]
}

export function assertOrganismeReadyForTaxReceipt(organisme: TaxReceiptPdfOrganisme): void {
  if (!organisme.name.trim()) throw new Error('Le nom de l’association est requis pour le reçu fiscal.')
  if (!organisme.address?.trim() || !organisme.postalCode?.trim() || !organisme.city?.trim()) {
    throw new Error('Complétez l’adresse de l’association (Paramètres → Associations) avant d’émettre un reçu fiscal.')
  }
  if (!organisme.siret?.trim() && !organisme.rna?.trim()) {
    throw new Error('Indiquez le SIRET ou le numéro RNA (Paramètres → Associations) avant d’émettre un reçu fiscal.')
  }
  if (!organisme.signatoryName?.trim() || !organisme.signatoryRole?.trim()) {
    throw new Error('Indiquez le signataire du reçu (nom et qualité) dans Paramètres → Associations.')
  }
}

export function defaultTaxReceiptPdfFileName(number: string, donorName: string): string {
  const donor = entityNameForFilename(donorName)
  const num = number.replace(/[/\\:*?"<>|]+/g, '-')
  return `recu_fiscal_${num}_${donor}.pdf`
}

export function buildTaxReceiptPdfArrayBuffer(payload: TaxReceiptPdfPayload): ArrayBuffer {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 16
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = margin

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(`CERFA n° ${CERFA_FORM_NUMBER}`, margin, y)
  doc.setFontSize(14)
  doc.text('Reçu au titre des dons', pageWidth - margin, y, { align: 'right' })
  y += 8
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Articles 200 et 238 bis du code général des impôts', pageWidth - margin, y, { align: 'right' })
  y += 10

  doc.setFont('helvetica', 'bold')
  doc.text(`N° d’ordre : ${payload.number}`, margin, y)
  doc.setFont('helvetica', 'normal')
  doc.text(`Date d’émission : ${formatDateFr(payload.issuedAt)}`, pageWidth - margin, y, { align: 'right' })
  y += 10

  doc.setFont('helvetica', 'bold')
  doc.text('Organisme bénéficiaire', margin, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  const orgLines = [
    payload.organisme.name,
    payload.organisme.address,
    cityLine(payload.organisme.postalCode, payload.organisme.city),
    payload.organisme.rna ? `RNA : ${payload.organisme.rna}` : null,
    payload.organisme.siret ? `SIRET : ${payload.organisme.siret}` : null,
    payload.organisme.socialObject ? `Objet : ${payload.organisme.socialObject}` : null,
  ].filter((l): l is string => Boolean(l))
  for (const line of orgLines) {
    const wrapped = doc.splitTextToSize(line, pageWidth - margin * 2) as string[]
    for (const w of wrapped) {
      doc.text(w, margin, y)
      y += 5
    }
  }

  y += 4
  doc.setFont('helvetica', 'bold')
  doc.text('Donateur', margin, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  const donorLines = [
    payload.donor.name,
    payload.donor.address,
    cityLine(payload.donor.postalCode, payload.donor.city),
  ].filter((l): l is string => Boolean(l))
  for (const line of donorLines) {
    doc.text(line, margin, y)
    y += 5
  }

  y += 6
  doc.setFont('helvetica', 'bold')
  doc.text('Don', margin, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.text(`Date du don : ${formatDateFr(payload.donationDate)}`, margin, y)
  y += 5
  doc.text(`Montant : ${formatEurosFromCents(payload.amountCents)}`, margin, y)
  y += 5
  doc.text(`Soit en lettres : ${amountInFrenchEuros(payload.amountCents)}`, margin, y)
  y += 5
  doc.text(`Forme du don : numéraire (${donationPaymentMethodLabel(payload.paymentMethod)})`, margin, y)
  y += 5
  doc.text('Nature du don : don manuel', margin, y)

  y += 10
  doc.setFont('helvetica', 'bold')
  doc.text('Attestation', margin, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  const attest = doc.splitTextToSize(
    'Le bénéficiaire reconnaît avoir reçu, au titre des dons ouvrant droit à réduction d’impôt, la somme indiquée ci-dessus. L’association atteste qu’elle est un organisme d’intérêt général au sens des articles 200 et 238 bis du CGI.',
    pageWidth - margin * 2,
  ) as string[]
  for (const line of attest) {
    doc.text(line, margin, y)
    y += 5
  }

  y += 8
  doc.text(
    `Fait à ${payload.organisme.city ?? '—'}, le ${formatDateFr(payload.issuedAt)}`,
    margin,
    y,
  )
  y += 8
  doc.setFont('helvetica', 'bold')
  doc.text(
    `${payload.organisme.signatoryRole ?? ''} ${payload.organisme.signatoryName ?? ''}`.trim(),
    pageWidth - margin,
    y,
    { align: 'right' },
  )

  y += 14
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  for (const paragraph of taxReceiptLegalMentions()) {
    const wrapped = doc.splitTextToSize(paragraph, pageWidth - margin * 2) as string[]
    for (const line of wrapped) {
      doc.text(line, margin, y)
      y += 3.6
    }
    y += 1.5
  }

  y += 4
  doc.setTextColor(150, 150, 150)
  doc.text(`${PRODUCT_DISPLAY_NAME} — document généré le ${formatDateFr(new Date())}`, margin, y)

  return doc.output('arraybuffer')
}

export function buildTaxReceiptPdfBuffer(payload: TaxReceiptPdfPayload): Buffer {
  return Buffer.from(buildTaxReceiptPdfArrayBuffer(payload))
}
