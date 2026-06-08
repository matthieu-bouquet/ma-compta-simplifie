// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { PRODUCT_DISPLAY_NAME } from '@/lib/productDisplayName'

type PdfCell = string | { content: string; styles: object; colSpan?: number }
type PdfTableRow = PdfCell[]

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
  /** Class 8 (86/87 CVN) applies to associations (ANC) — omit from PDF for other legal forms. */
  includeClass8CvnSection: boolean
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

const PDF_COLORS = {
  header: [200, 200, 200] as [number, number, number],
  header2: [220, 220, 220] as [number, number, number],
  category: [240, 240, 240] as [number, number, number],
  total: [230, 230, 230] as [number, number, number],
  grid: [200, 200, 200] as [number, number, number],
}

function totalCellStyle() {
  return {
    fontStyle: 'bold' as const,
    fillColor: PDF_COLORS.total,
    fontSize: 10,
  }
}

function categoryTitleCellStyle() {
  return {
    fontStyle: 'bold' as const,
    fillColor: PDF_COLORS.category,
    halign: 'center' as const,
  }
}

/** Grand totals including class 8 benevolat (86 emplois / 87 contributions). */
export function compteResultatGrandTotals(body: CompteResultatPdfBody): {
  totalCharges: number
  totalProduits: number
  resultat: number
} {
  if (!body.includeClass8CvnSection) {
    return {
      totalCharges: body.totalCharges,
      totalProduits: body.totalProduits,
      resultat: body.resultat,
    }
  }

  const totalCharges = body.totalCharges + body.totalCvnEmplois
  const totalProduits = body.totalProduits + body.totalCvnContributions
  return {
    totalCharges,
    totalProduits,
    resultat: totalProduits - totalCharges,
  }
}

function buildSideRows(
  comptes: CompteResultatPdfCompte[],
  categories: Record<string, string>,
): [PdfCell, PdfCell][] {
  const groups = groupByCategory(comptes, categories)
  const rows: [PdfCell, PdfCell][] = []

  groups.forEach((group) => {
    rows.push([
      {
        content: `${group.category} - ${group.categoryLabel}`,
        styles: { fontStyle: 'bold' as const, fillColor: PDF_COLORS.category },
      },
      {
        content: '',
        styles: { fontStyle: 'bold' as const, fillColor: PDF_COLORS.category },
      },
    ])
    group.comptes.forEach((compte) => {
      rows.push([`   ${compte.numero} - ${compte.libelle}`, compte.solde.toFixed(2)])
    })
  })

  return rows
}

function alignSideRows(left: [PdfCell, PdfCell][], right: [PdfCell, PdfCell][]): PdfTableRow[] {
  const maxLen = Math.max(left.length, right.length)
  const rows: PdfTableRow[] = []

  for (let i = 0; i < maxLen; i++) {
    const l = left[i] ?? ['', '']
    const r = right[i] ?? ['', '']
    rows.push([l[0], l[1], r[0], r[1]])
  }

  return rows
}

/** Builds main P&L table rows (charges/produits, optional class 8, summary). */
export function buildCompteResultatPdfTableBody(body: CompteResultatPdfBody): PdfTableRow[] {
  const { includeClass8CvnSection, comptesCharges, comptesProduits, cvnEmploisRows, cvnContributionRows } = body

  const combinedBody = alignSideRows(
    buildSideRows(comptesCharges, CATEGORIES_CHARGES),
    buildSideRows(comptesProduits, CATEGORIES_PRODUITS),
  )

  if (includeClass8CvnSection) {
    combinedBody.push([
      {
        content: 'Bénévolat',
        colSpan: 4,
        styles: categoryTitleCellStyle(),
      },
    ])

    const maxCvn = Math.max(cvnEmploisRows.length, cvnContributionRows.length, 1)
    for (let i = 0; i < maxCvn; i++) {
      const emploi = cvnEmploisRows[i]
      const contribution = cvnContributionRows[i]
      const noEmploi = cvnEmploisRows.length === 0
      const noContribution = cvnContributionRows.length === 0

      combinedBody.push([
        emploi
          ? `   ${emploi.numero} - ${emploi.libelle}`
          : noEmploi && i === 0
            ? '— Aucun mouvement'
            : '',
        emploi ? emploi.montant.toFixed(2) : '',
        contribution
          ? `   ${contribution.numero} - ${contribution.libelle}`
          : noContribution && i === 0
            ? '— Aucun mouvement'
            : '',
        contribution ? contribution.montant.toFixed(2) : '',
      ])
    }
  }

  const grandTotals = compteResultatGrandTotals(body)
  combinedBody.push([
    {
      content: 'TOTAL DES CHARGES',
      styles: totalCellStyle(),
    },
    {
      content: grandTotals.totalCharges.toFixed(2),
      styles: totalCellStyle(),
    },
    {
      content: 'TOTAL DES PRODUITS',
      styles: totalCellStyle(),
    },
    {
      content: grandTotals.totalProduits.toFixed(2),
      styles: totalCellStyle(),
    },
  ])

  return combinedBody
}

export function downloadCompteResultatStylePdf(
  header: CompteResultatPdfHeader,
  body: CompteResultatPdfBody,
  fileName: string,
): void {
  const COLORS = PDF_COLORS

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

  const { includeClass8CvnSection, cvnIsBalanced } = body
  const { resultat } = compteResultatGrandTotals(body)
  const combinedBody = buildCompteResultatPdfTableBody(body)

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

  let resultY = afterPlTableY + 13

  if (includeClass8CvnSection && !cvnIsBalanced) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(180, 0, 0)
    doc.text(
      'Totaux non équilibrés (86 ≠ 87). Vérifiez les écritures de classe 8.',
      margin,
      afterPlTableY + 8,
      { maxWidth: availableWidth },
    )
    doc.setTextColor(0)
    resultY = afterPlTableY + 16
  }

  doc.setDrawColor(0)
  doc.setFillColor(245, 245, 245)
  doc.roundedRect(pageWidth / 2 - 60, resultY - 8, 120, 14, 2, 2, 'FD')

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0)
  doc.text(
    `Résultat Net : ${resultat >= 0 ? '+' : ''}${resultat.toFixed(2)} €`,
    pageWidth / 2,
    resultY,
    { align: 'center' },
  )

  const footerNote =
    header.type === 'budget' ? 'Prévisionnel (non comptabilisé) — ' : ''
  const footer = `${footerNote}Document généré le ${new Date().toLocaleDateString('fr-FR')} — ${PRODUCT_DISPLAY_NAME}`
  drawFooterOnAllPages(doc, footer)

  doc.save(fileName)
}
