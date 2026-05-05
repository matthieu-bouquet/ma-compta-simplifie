// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { RowInput } from 'jspdf-autotable'
import { PRODUCT_DISPLAY_NAME } from '@/lib/productDisplayName'

const CATEGORIES_CHARGES: Record<string, string> = {
  '60': 'Achat',
  '61': 'Charges externes',
  '62': 'Autres services extérieurs',
  '63': 'Impôts et taxes',
  '64': 'Charges de personnel',
  '65': 'Autres charges de gestion courante',
  '66': 'Charges financières',
  '67': 'Charges exceptionnelles',
  '68': 'Dotation aux amortissements',
}

const CATEGORIES_PRODUITS: Record<string, string> = {
  '70': 'Vente de produits finis, prestations de services, marchandises',
  '74': "Subventions d'exploitation",
  '75': 'Autres produits de gestion courante',
  '76': 'Produits financiers',
  '77': 'Produits exceptionnels',
  '78': 'Reprise sur amortissements et provisions',
}

export type CompteResultatPdfCompte = { numero: string; libelle: string; solde: number }

export type CompteResultatPdfCvnRow = { numero: string; libelle: string; montant: number }

export type CompteResultatPdfBody = {
  comptesCharges: CompteResultatPdfCompte[]
  comptesProduits: CompteResultatPdfCompte[]
  totalCharges: number
  totalProduits: number
  resultat: number
  cvnEmploisRows: CompteResultatPdfCvnRow[]
  cvnContributionRows: CompteResultatPdfCvnRow[]
  totalCvnEmplois: number
  totalCvnContributions: number
  cvnIsBalanced: boolean
}

export type CompteResultatPdfHeader =
  | { type: 'bilan'; associationName: string; dateDebutIso: string; dateFinIso: string }
  | { type: 'budget'; associationName: string; budgetName: string; updatedAtIso: string }

function groupByCategory(
  comptes: CompteResultatPdfCompte[],
  categories: Record<string, string>,
): { category: string; categoryLabel: string; comptes: CompteResultatPdfCompte[] }[] {
  const groups: Record<string, CompteResultatPdfCompte[]> = {}

  comptes.forEach((compte) => {
    const prefix = compte.numero.substring(0, 2)
    if (!groups[prefix]) {
      groups[prefix] = []
    }
    groups[prefix].push(compte)
  })

  return Object.keys(categories)
    .sort()
    .map((cat) => ({
      category: cat,
      categoryLabel: categories[cat],
      comptes: groups[cat] || [],
    }))
}

export function entityNameForFilename(name: string): string {
  let s = name.trim() || 'entite'
  s = s.replace(/[/\\:*?"<>|]+/g, '-')
  s = s.replace(/\s+/g, '_')
  s = s.replace(/_+/g, '_').replace(/-+/g, '-')
  s = s.replace(/^[-_]+|[-_]+$/g, '')
  return s.slice(0, 80) || 'entite'
}

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

function formatDateShort(d: Date) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`
}

/** Draw header; returns Y position to start the main P&L table. */
function drawPdfHeader(doc: jsPDF, header: CompteResultatPdfHeader, pageWidth: number, margin: number): number {
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0)

  if (header.type === 'bilan') {
    const dDebut = new Date(header.dateDebutIso)
    const dFin = new Date(header.dateFinIso)
    doc.setFontSize(14)
    doc.text(
      `${header.associationName} (${formatDateShort(dDebut)} au ${formatDateShort(dFin)})`,
      pageWidth / 2,
      margin + 4,
      { align: 'center' },
    )
    doc.setFontSize(16)
    doc.text('COMPTE DE RÉSULTAT', pageWidth / 2, margin + 12, { align: 'center' })
    return margin + 20
  }

  doc.setFontSize(14)
  doc.text(header.associationName, pageWidth / 2, margin + 4, { align: 'center' })
  doc.setFontSize(11)
  doc.text(`Prévisionnel : ${header.budgetName}`, pageWidth / 2, margin + 9, { align: 'center' })
  return margin + 16
}

export function defaultBilanPdfFileName(associationName: string, dateDebutIso: string, dateFinIso: string): string {
  const dDebut = new Date(dateDebutIso)
  const dFin = new Date(dateFinIso)
  const entitySegment = entityNameForFilename(associationName)
  return `compte_de_resultat_${entitySegment}_${dDebut.getFullYear()}_${dFin.getFullYear()}.pdf`
}

export function defaultBudgetForecastPdfFileName(associationName: string, budgetName: string): string {
  const a = entityNameForFilename(associationName)
  const b = entityNameForFilename(budgetName)
  return `previsionnel_${a}_${b}.pdf`
}

export function downloadCompteResultatStylePdf(
  header: CompteResultatPdfHeader,
  body: CompteResultatPdfBody,
  fileName: string,
): void {
  const COLORS: Record<string, [number, number, number]> = {
    header: [200, 200, 200],
    header2: [220, 220, 220],
    category: [240, 240, 240],
    total: [230, 230, 230],
    grid: [200, 200, 200],
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 10
  const availableWidth = pageWidth - margin * 2
  const amountColWidth = 22
  const labelColWidth = (availableWidth - amountColWidth * 2) / 2

  const startY = drawPdfHeader(doc, header, pageWidth, margin)

  const {
    comptesCharges,
    comptesProduits,
    totalCharges,
    totalProduits,
    resultat,
    cvnEmploisRows,
    cvnContributionRows,
    totalCvnEmplois,
    totalCvnContributions,
    cvnIsBalanced,
  } = body

  const chargesGroups = groupByCategory(comptesCharges, CATEGORIES_CHARGES)
  const produitsGroups = groupByCategory(comptesProduits, CATEGORIES_PRODUITS)

  const chargesRows: (string | { content: string; styles: object })[][] = []
  chargesGroups.forEach((group) => {
    chargesRows.push([
      {
        content: `${group.category} - ${group.categoryLabel}`,
        styles: { fontStyle: 'bold' as const, fillColor: COLORS.category },
      },
      {
        content: '',
        styles: { fontStyle: 'bold' as const, fillColor: COLORS.category },
      },
    ])
    if (group.comptes.length > 0) {
      group.comptes.forEach((compte) => {
        chargesRows.push([`   ${compte.numero} - ${compte.libelle}`, compte.solde.toFixed(2)])
      })
    }
  })
  chargesRows.push([
    {
      content: 'TOTAL DES CHARGES',
      styles: {
        fontStyle: 'bold' as const,
        fillColor: COLORS.total,
        fontSize: 10,
      },
    },
    {
      content: totalCharges.toFixed(2),
      styles: {
        fontStyle: 'bold' as const,
        fillColor: COLORS.total,
        fontSize: 10,
      },
    },
  ])

  const produitsRows: (string | { content: string; styles: object })[][] = []
  produitsGroups.forEach((group) => {
    produitsRows.push([
      {
        content: `${group.category} - ${group.categoryLabel}`,
        styles: { fontStyle: 'bold' as const, fillColor: COLORS.category },
      },
      {
        content: '',
        styles: { fontStyle: 'bold' as const, fillColor: COLORS.category },
      },
    ])
    if (group.comptes.length > 0) {
      group.comptes.forEach((compte) => {
        produitsRows.push([`   ${compte.numero} - ${compte.libelle}`, compte.solde.toFixed(2)])
      })
    }
  })
  produitsRows.push([
    {
      content: 'TOTAL DES PRODUITS',
      styles: {
        fontStyle: 'bold' as const,
        fillColor: COLORS.total,
        fontSize: 10,
      },
    },
    {
      content: totalProduits.toFixed(2),
      styles: {
        fontStyle: 'bold' as const,
        fillColor: COLORS.total,
        fontSize: 10,
      },
    },
  ])

  const chargesTotalIdx = Math.max(0, chargesRows.length - 1)
  const produitsTotalIdx = Math.max(0, produitsRows.length - 1)
  const chargesDetailsLen = chargesTotalIdx
  const produitsDetailsLen = produitsTotalIdx
  const maxDetailsLen = Math.max(chargesDetailsLen, produitsDetailsLen)

  while (chargesDetailsLen + (chargesRows.length - 1 - chargesTotalIdx) < maxDetailsLen) {
    chargesRows.splice(chargesTotalIdx, 0, ['', ''])
  }
  while (produitsDetailsLen + (produitsRows.length - 1 - produitsTotalIdx) < maxDetailsLen) {
    produitsRows.splice(produitsTotalIdx, 0, ['', ''])
  }

  const combinedBody = chargesRows.map((chargeRow, i) => {
    const produitRow = produitsRows[i]
    return [chargeRow[0], chargeRow[1], produitRow[0], produitRow[1]]
  })

  autoTable(doc, {
    startY,
    margin: { left: margin, right: margin },
    head: [
      [
        {
          content: 'CHARGES',
          colSpan: 2,
          styles: {
            halign: 'center' as const,
            fillColor: COLORS.header,
            textColor: 0,
            fontSize: 11,
            fontStyle: 'bold' as const,
          },
        },
        {
          content: 'PRODUITS',
          colSpan: 2,
          styles: {
            halign: 'center' as const,
            fillColor: COLORS.header,
            textColor: 0,
            fontSize: 11,
            fontStyle: 'bold' as const,
          },
        },
      ],
      [
        {
          content: 'Compte',
          styles: { fillColor: COLORS.header2, textColor: 0 },
        },
        {
          content: 'Montant',
          styles: {
            halign: 'right' as const,
            fillColor: COLORS.header2,
            textColor: 0,
          },
        },
        {
          content: 'Compte',
          styles: { fillColor: COLORS.header2, textColor: 0 },
        },
        {
          content: 'Montant',
          styles: {
            halign: 'right' as const,
            fillColor: COLORS.header2,
            textColor: 0,
          },
        },
      ],
    ],
    body: combinedBody,
    columnStyles: {
      0: { cellWidth: labelColWidth },
      1: { cellWidth: amountColWidth, halign: 'right' as const },
      2: { cellWidth: labelColWidth },
      3: { cellWidth: amountColWidth, halign: 'right' as const },
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: COLORS.grid,
      lineWidth: 0.2,
      overflow: 'linebreak',
      textColor: 0,
    },
    headStyles: {
      fontSize: 9,
    },
    theme: 'grid',
    didParseCell: (data) => {
      if (data.column.index === 2 && data.section === 'body') {
        data.cell.styles.cellPadding = {
          top: 2,
          right: 2,
          bottom: 2,
          left: 4,
        }
      }
    },
  })

  type JsPdfWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } }
  const afterPlTableY = (doc as JsPdfWithAutoTable).lastAutoTable?.finalY ?? startY + 100

  doc.setDrawColor(0)
  doc.setFillColor(245, 245, 245)
  doc.roundedRect(pageWidth / 2 - 60, afterPlTableY + 5, 120, 14, 2, 2, 'FD')

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0)
  doc.text(
    `Résultat Net : ${resultat >= 0 ? '+' : ''}${resultat.toFixed(2)} €`,
    pageWidth / 2,
    afterPlTableY + 13,
    { align: 'center' },
  )

  const half = availableWidth / 2
  const colNum = 16
  const colAmt = 20
  const colLib = half - colNum - colAmt

  let cvnStartY = afterPlTableY + 24
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Contributions volontaires en nature (classe 8)', pageWidth / 2, cvnStartY, { align: 'center' })
  cvnStartY += 6

  if (!cvnIsBalanced) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(180, 0, 0)
    doc.text(
      'Totaux non équilibrés (86 ≠ 87). Vérifiez les écritures de classe 8.',
      margin,
      cvnStartY,
      { maxWidth: availableWidth },
    )
    doc.setTextColor(0)
    cvnStartY += 5
  }

  const maxCvn = Math.max(cvnEmploisRows.length, cvnContributionRows.length)
  const cvnBody: RowInput[] = []
  if (maxCvn === 0) {
    cvnBody.push(['—', 'Aucun mouvement', '', '—', 'Aucun mouvement', ''])
  } else {
    for (let i = 0; i < maxCvn; i++) {
      const e = cvnEmploisRows[i]
      const c = cvnContributionRows[i]
      cvnBody.push([
        e?.numero ?? '',
        e?.libelle ?? '',
        e ? { content: e.montant.toFixed(2), styles: { halign: 'right' as const } } : '',
        c?.numero ?? '',
        c?.libelle ?? '',
        c ? { content: c.montant.toFixed(2), styles: { halign: 'right' as const } } : '',
      ])
    }
  }

  cvnBody.push([
    {
      content: 'Total emplois (86)',
      colSpan: 2,
      styles: { fontStyle: 'bold', fillColor: COLORS.total },
    },
    {
      content: totalCvnEmplois.toFixed(2),
      styles: {
        fontStyle: 'bold',
        fillColor: COLORS.total,
        halign: 'right',
      },
    },
    {
      content: 'Total contributions (87)',
      colSpan: 2,
      styles: { fontStyle: 'bold', fillColor: COLORS.total },
    },
    {
      content: totalCvnContributions.toFixed(2),
      styles: {
        fontStyle: 'bold',
        fillColor: COLORS.total,
        halign: 'right',
      },
    },
  ])

  autoTable(doc, {
    startY: cvnStartY + 2,
    margin: { left: margin, right: margin },
    head: [
      [
        {
          content: 'EMPLOIS (86)',
          colSpan: 3,
          styles: {
            halign: 'center' as const,
            fillColor: COLORS.header,
            textColor: 0,
            fontSize: 10,
            fontStyle: 'bold' as const,
          },
        },
        {
          content: 'CONTRIBUTIONS (87)',
          colSpan: 3,
          styles: {
            halign: 'center' as const,
            fillColor: COLORS.header,
            textColor: 0,
            fontSize: 10,
            fontStyle: 'bold' as const,
          },
        },
      ],
      [
        { content: 'Compte', styles: { fillColor: COLORS.header2, textColor: 0 } },
        { content: 'Libellé', styles: { fillColor: COLORS.header2, textColor: 0 } },
        {
          content: 'Montant',
          styles: {
            halign: 'right' as const,
            fillColor: COLORS.header2,
            textColor: 0,
          },
        },
        { content: 'Compte', styles: { fillColor: COLORS.header2, textColor: 0 } },
        { content: 'Libellé', styles: { fillColor: COLORS.header2, textColor: 0 } },
        {
          content: 'Montant',
          styles: {
            halign: 'right' as const,
            fillColor: COLORS.header2,
            textColor: 0,
          },
        },
      ],
    ],
    body: cvnBody,
    columnStyles: {
      0: { cellWidth: colNum },
      1: { cellWidth: colLib },
      2: { cellWidth: colAmt, halign: 'right' as const },
      3: { cellWidth: colNum },
      4: { cellWidth: colLib },
      5: { cellWidth: colAmt, halign: 'right' as const },
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: COLORS.grid,
      lineWidth: 0.2,
      overflow: 'linebreak',
      textColor: 0,
    },
    headStyles: { fontSize: 8 },
    theme: 'grid',
  })

  const footerNote =
    header.type === 'budget' ? 'Prévisionnel (non comptabilisé) — ' : ''
  const footer = `${footerNote}Document généré le ${new Date().toLocaleDateString('fr-FR')} — ${PRODUCT_DISPLAY_NAME}`
  drawFooterOnAllPages(doc, footer)

  doc.save(fileName)
}
