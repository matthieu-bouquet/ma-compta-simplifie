// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

/** Franchise en base (associations non assujetties à la TVA). */
export const INVOICE_FRANCHISE_VAT_MENTION = 'TVA non applicable, art. 293 B du CGI'

/** Pénalités de retard (B2B — art. L441-10 et D441-5 C. com.). */
export const INVOICE_LATE_PAYMENT_MENTIONS: readonly string[] = [
  'Conditions de règlement : paiement à la date d’échéance indiquée ci-dessus.',
  'En cas de retard de paiement, des pénalités de retard au taux de 3 fois le taux d’intérêt légal seront exigibles,',
  ' ainsi qu’une indemnité forfaitaire de 40 € pour frais de recouvrement (art. L441-10 et D441-5 du Code de commerce).',
]

export type AssociationInvoiceEmitterFields = {
  name: string
  address?: string | null
  postalCode?: string | null
  city?: string | null
  siret?: string | null
}

export function formatEmitterSiretOrRnaLine(siret: string | null | undefined): string {
  const value = siret?.trim()
  if (!value) return 'SIRET / RNA : —'
  return `SIRET / RNA : ${value}`
}

export function assertAssociationReadyForInvoice(association: AssociationInvoiceEmitterFields): void {
  if (!association.name?.trim()) {
    throw new Error('Le nom de l’entité est requis pour émettre une facture.')
  }
  if (!association.address?.trim() || !association.postalCode?.trim() || !association.city?.trim()) {
    throw new Error(
      'Complétez l’adresse de l’entité (Paramètres → Entités) avant d’émettre une facture conforme.',
    )
  }
  if (!association.siret?.trim()) {
    throw new Error(
      'Indiquez le SIRET ou le numéro RNA de l’entité (Paramètres → Entités) avant d’émettre une facture conforme.',
    )
  }
}

export function invoiceLegalFooterLines(vatLiable: boolean): string[] {
  const lines: string[] = []
  if (!vatLiable) {
    lines.push(INVOICE_FRANCHISE_VAT_MENTION)
  }
  lines.push(...INVOICE_LATE_PAYMENT_MENTIONS)
  return lines
}
