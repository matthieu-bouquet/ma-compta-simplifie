// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { PRODUCT_DISPLAY_NAME } from '@/lib/productDisplayName'
import type { VatStatementPdfPayload } from '@/lib/vatStatementPayload'

type JsPdfWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } }

function drawFooterOnAllPages(doc: jsPDF, footerText: string) {
  const pageCount = doc.getNumberOfPages()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(150, 150, 150)
    doc.text(footerText, pageWidth / 2, pageHeight - 5, { align: 'center' })
  }
}

function formatShort(isoYmd: string): string {
  const [y, m, d] = isoYmd.split('-').map(Number)
  if (!y || !m || !d) return isoYmd
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${String(y)}`
}

export function downloadVatStatementPdf(payload: VatStatementPdfPayload): void {
  const COLORS = {
    header: [200, 200, 200] as [number, number, number],
    grid: [200, 200, 200] as [number, number, number],
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 10

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0)
  doc.setFontSize(14)
  doc.text(payload.associationName, pageWidth / 2, margin + 4, { align: 'center' })
  doc.setFontSize(16)
  doc.text('ÉTAT DE LA TVA', pageWidth / 2, margin + 11, { align: 'center' })
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `Période du ${formatShort(payload.dateDebutIso)} au ${formatShort(payload.dateFinIso)}`,
    pageWidth / 2,
    margin + 17,
    { align: 'center' },
  )

  let y = margin + 24

  doc.setFontSize(9)
  doc.text(
    `TVA collectée (44571), net période : ${payload.netCollectedEuros.toFixed(2)} €`,
    margin,
    y,
  )
  y += 5
  doc.text(
    `TVA déductible (44566), net période : ${payload.netDeductibleEuros.toFixed(2)} €`,
    margin,
    y,
  )
  y += 5
  doc.setFont('helvetica', 'bold')
  doc.text(`Net indicatif (collectée − déductible) : ${payload.netVatPositionEuros.toFixed(2)} €`, margin, y)
  doc.setFont('helvetica', 'normal')
  y += 10

  autoTable(doc, {
    startY: y,
    head: [['Compte', 'Libellé', 'Total débit', 'Total crédit']],
    body: payload.summaries.map((s) => [
      s.accountNumber,
      s.accountName,
      s.totalDebitEuros.toFixed(2),
      s.totalCreditEuros.toFixed(2),
    ]),
    theme: 'grid',
    headStyles: { fillColor: COLORS.header, fontSize: 9 },
    styles: { fontSize: 9, lineColor: COLORS.grid, textColor: 0 },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right' },
    },
  })

  const afterSummary = (doc as JsPdfWithAutoTable).lastAutoTable?.finalY
  y = (afterSummary ?? y + 40) + 10

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Détail des lignes TVA', margin, y)
  y += 6
  doc.setFont('helvetica', 'normal')

  autoTable(doc, {
    startY: y,
    head: [['Date', 'Journal', 'N° pièce', 'Libellé', 'Compte', 'Débit', 'Crédit']],
    body: payload.detailRows.map((r) => [
      formatShort(r.dateIso),
      r.journalCode,
      r.referenceNumber,
      r.description,
      `${r.accountNumber} ${r.accountName}`.trim(),
      r.debitEuros > 0 ? r.debitEuros.toFixed(2) : '',
      r.creditEuros > 0 ? r.creditEuros.toFixed(2) : '',
    ]),
    theme: 'grid',
    headStyles: { fillColor: COLORS.header, fontSize: 7 },
    styles: { fontSize: 7, lineColor: COLORS.grid, textColor: 0, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 14 },
      2: { cellWidth: 18 },
      3: { cellWidth: 42 },
      4: { cellWidth: 35 },
      5: { cellWidth: 18, halign: 'right' },
      6: { cellWidth: 18, halign: 'right' },
    },
  })

  const footer = `Document généré le ${new Date().toLocaleDateString('fr-FR')} — ${PRODUCT_DISPLAY_NAME}`
  drawFooterOnAllPages(doc, footer)

  doc.save(payload.fileName)
}
