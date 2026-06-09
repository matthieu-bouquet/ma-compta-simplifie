// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, expect, it } from 'vitest'
import {
  buildCompteResultatPdfTableBody,
  compteResultatGrandTotals,
  type CompteResultatPdfBody,
} from '@/lib/compteResultatPdf'

function cellContent(cell: unknown): string {
  if (typeof cell === 'string') return cell
  if (cell && typeof cell === 'object' && 'content' in cell) {
    return String((cell as { content: string }).content)
  }
  return ''
}

function baseBody(overrides: Partial<CompteResultatPdfBody> = {}): CompteResultatPdfBody {
  return {
    includeClass8CvnSection: false,
    comptesCharges: [{ numero: '606', libelle: 'Achats', solde: 100 }],
    comptesProduits: [{ numero: '740', libelle: 'Subvention', solde: 250 }],
    totalCharges: 100,
    totalProduits: 250,
    resultat: 150,
    cvnEmploisRows: [],
    cvnContributionRows: [],
    totalCvnEmplois: 0,
    totalCvnContributions: 0,
    cvnIsBalanced: true,
    ...overrides,
  }
}

describe('buildCompteResultatPdfTableBody', () => {
  it('shows benevolat before class 8 accounts and grand totals at the bottom', () => {
    const body = baseBody({
      includeClass8CvnSection: true,
      cvnEmploisRows: [{ numero: '8641', libelle: 'CVN emploi', montant: 10 }],
      cvnContributionRows: [{ numero: '8751', libelle: 'CVN contrib', montant: 12 }],
      totalCvnEmplois: 10,
      totalCvnContributions: 12,
      cvnIsBalanced: false,
    })
    const rows = buildCompteResultatPdfTableBody(body)

    const labels = rows.map((row) => row.map(cellContent))
    const benevolatIdx = labels.findIndex((row) => row[0] === 'Bénévolat')
    const cvnIdx = labels.findIndex((row) => row[0].includes('8641'))
    const totalsIdx = labels.findIndex((row) => row.includes('TOTAL DES CHARGES'))

    expect(benevolatIdx).toBeGreaterThanOrEqual(0)
    expect(cvnIdx).toBe(benevolatIdx + 1)
    expect(totalsIdx).toBeGreaterThan(cvnIdx)
    expect(labels[totalsIdx][1]).toBe('110.00')
    expect(labels[totalsIdx][3]).toBe('262.00')
    expect(labels[cvnIdx][2]).toContain('8751')
    expect(compteResultatGrandTotals(body).resultat).toBe(152)
  })

  it('omits class 8 rows when the section is disabled', () => {
    const rows = buildCompteResultatPdfTableBody(baseBody())
    const labels = rows.map((row) => row.map(cellContent))

    expect(labels.some((row) => row[0] === 'Bénévolat')).toBe(false)
    expect(labels.some((row) => row[0].includes('864'))).toBe(false)
    expect(labels.at(-1)?.[1]).toBe('100.00')
    expect(labels.at(-1)?.[3]).toBe('250.00')
  })
})
