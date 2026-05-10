'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { FileDown } from 'lucide-react'
import styles from './bilan.module.css'
import {
  defaultBilanPdfFileName,
  downloadCompteResultatStylePdf,
  type CompteResultatPdfBody,
  type CompteResultatPdfCompte,
  type CompteResultatPdfCvnRow,
} from '@/lib/compteResultatPdf'

interface DownloadPdfButtonProps {
  associationName: string
  includeClass8CvnSection: boolean
  comptesCharges: CompteResultatPdfCompte[]
  comptesProduits: CompteResultatPdfCompte[]
  totalCharges: number
  totalProduits: number
  resultat: number
  dateDebut: string
  dateFin: string
  cvnEmploisRows: CompteResultatPdfCvnRow[]
  cvnContributionRows: CompteResultatPdfCvnRow[]
  totalCvnEmplois: number
  totalCvnContributions: number
  cvnIsBalanced: boolean
}

export default function DownloadPdfButton({
  associationName,
  includeClass8CvnSection,
  comptesCharges,
  comptesProduits,
  totalCharges,
  totalProduits,
  resultat,
  dateDebut,
  dateFin,
  cvnEmploisRows,
  cvnContributionRows,
  totalCvnEmplois,
  totalCvnContributions,
  cvnIsBalanced,
}: DownloadPdfButtonProps) {
  const handleDownload = () => {
    const body: CompteResultatPdfBody = {
      includeClass8CvnSection,
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
    }
    downloadCompteResultatStylePdf(
      { type: 'bilan', associationName, dateDebutIso: dateDebut, dateFinIso: dateFin },
      body,
      defaultBilanPdfFileName(associationName, dateDebut, dateFin),
    )
  }

  return (
    <button
      type="button"
      className={`btn btn-primary ${styles.downloadPdfButton}`}
      onClick={handleDownload}
      title={
        includeClass8CvnSection
          ? 'Télécharger le compte de résultat (classes 6, 7 et 8) en PDF'
          : 'Télécharger le compte de résultat (classes 6 et 7) en PDF'
      }
      aria-label={
        includeClass8CvnSection
          ? 'Télécharger le compte de résultat (classes 6, 7 et 8) en PDF'
          : 'Télécharger le compte de résultat (classes 6 et 7) en PDF'
      }
    >
      <FileDown size={18} className={styles.downloadPdfIcon} aria-hidden />
      Télécharger en PDF
    </button>
  )
}
