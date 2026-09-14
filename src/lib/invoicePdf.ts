// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatEurosFromCents } from '@/lib/money'
import { entityNameForFilename } from '@/lib/compteResultatPdf'
import { PRODUCT_DISPLAY_NAME } from '@/lib/productDisplayName'
import {
  formatEmitterSiretOrRnaLine,
  invoiceLegalFooterLines,
} from '@/lib/invoicePdfLegal'

export type InvoicePdfEmitter = {
  name: string
  address?: string | null
  postalCode?: string | null
  city?: string | null
  email?: string | null
  phone?: string | null
  siret?: string | null
  vatLiable: boolean
}

export type InvoicePdfRecipient = {
  name: string
  address?: string | null
  postalCode?: string | null
  city?: string | null
  email?: string | null
  siret?: string | null
}

export type InvoicePdfLine = {
  description: string
  quantityLabel?: string | null
  unitPriceLabel?: string | null
  amountCents: number
}

export type InvoicePdfPayload = {
  number: string
  issueDate: Date
  dueDate: Date
  emitter: InvoicePdfEmitter
  recipient: InvoicePdfRecipient
  lines: InvoicePdfLine[]
  totalCents: number
  logoImage?: { dataUrl: string; format: 'PNG' | 'JPEG' | 'WEBP' } | null
}

function formatDateFr(d: Date) {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function emitterBlockLines(emitter: InvoicePdfEmitter): string[] {
  const lines = [emitter.name]
  if (emitter.address) lines.push(emitter.address)
  const cityLine = [emitter.postalCode, emitter.city].filter(Boolean).join(' ')
  if (cityLine) lines.push(cityLine)
  lines.push(formatEmitterSiretOrRnaLine(emitter.siret))
  if (emitter.email) lines.push(emitter.email)
  if (emitter.phone) lines.push(`Tél. : ${emitter.phone}`)
  return lines
}

function recipientBlockLines(recipient: InvoicePdfRecipient): string[] {
  const lines = [recipient.name]
  if (recipient.address) lines.push(recipient.address)
  const cityLine = [recipient.postalCode, recipient.city].filter(Boolean).join(' ')
  if (cityLine) lines.push(cityLine)
  if (recipient.siret) lines.push(`SIRET : ${recipient.siret}`)
  if (recipient.email) lines.push(recipient.email)
  return lines
}

export function defaultInvoicePdfFileName(number: string, recipientName: string): string {
  const recipient = entityNameForFilename(recipientName)
  const num = number.replace(/[/\\:*?"<>|]+/g, '-')
  return `facture_${num}_${recipient}.pdf`
}

export function buildInvoicePdfArrayBuffer(payload: InvoicePdfPayload): ArrayBuffer {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 14
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  let y = margin

  if (payload.logoImage) {
    try {
      doc.addImage(payload.logoImage.dataUrl, payload.logoImage.format, margin, y, 40, 20)
    } catch {
      // Skip invalid logo data
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('FACTURE', pageWidth - margin, y + 6, { align: 'right' })
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`N° ${payload.number}`, pageWidth - margin, y + 12, { align: 'right' })
  doc.text(`Date de facture : ${formatDateFr(payload.issueDate)}`, pageWidth - margin, y + 17, {
    align: 'right',
  })
  doc.text(`Date d’échéance : ${formatDateFr(payload.dueDate)}`, pageWidth - margin, y + 22, {
    align: 'right',
  })

  y += 32

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Émetteur', margin, y)
  doc.text('Destinataire', pageWidth / 2 + 4, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)

  const emitterLines = emitterBlockLines(payload.emitter)
  const recipientLines = recipientBlockLines(payload.recipient)
  const blockHeight = Math.max(emitterLines.length, recipientLines.length) * 4.5
  emitterLines.forEach((line, i) => {
    doc.text(line, margin, y + 5 + i * 4.5)
  })
  recipientLines.forEach((line, i) => {
    doc.text(line, pageWidth / 2 + 4, y + 5 + i * 4.5)
  })

  y += blockHeight + 12

  const tableBody = payload.lines.map((line) => [
    line.description,
    line.quantityLabel ?? '',
    line.unitPriceLabel ?? '',
    formatEurosFromCents(line.amountCents),
  ])

  autoTable(doc, {
    startY: y,
    head: [['Description', 'Qté', 'P.U.', 'Montant TTC']],
    body: tableBody,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9 },
    headStyles: { fillColor: [45, 55, 72] },
  })

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(`Total TTC : ${formatEurosFromCents(payload.totalCents)}`, pageWidth - margin, finalY + 10, {
    align: 'right',
  })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  let legalY = finalY + 18
  const footerLines = invoiceLegalFooterLines(payload.emitter.vatLiable)
  const maxWidth = pageWidth - margin * 2

  for (const paragraph of footerLines) {
    const wrapped = doc.splitTextToSize(paragraph, maxWidth) as string[]
    for (const line of wrapped) {
      if (legalY > pageHeight - margin) {
        doc.addPage()
        legalY = margin
      }
      doc.text(line, margin, legalY)
      legalY += 3.5
    }
    legalY += 1
  }

  legalY += 2
  if (legalY > pageHeight - margin) {
    doc.addPage()
    legalY = margin
  }
  doc.setTextColor(150, 150, 150)
  doc.text(`${PRODUCT_DISPLAY_NAME} — document généré le ${formatDateFr(new Date())}`, margin, legalY)

  return doc.output('arraybuffer')
}

export function buildInvoicePdfBuffer(payload: InvoicePdfPayload): Buffer {
  return Buffer.from(buildInvoicePdfArrayBuffer(payload))
}
