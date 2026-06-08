// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

/**
 * JSON row shapes inside backup ZIP v1 (`data/*.json`).
 * Must stay aligned with `src/app/api/backups/export/route.ts`.
 */

export type BackupAssociationJson = {
  id: string
  name: string
  siret?: string | null
  address?: string | null
  postalCode?: string | null
  city?: string | null
  email?: string | null
  phone?: string | null
  legalFormCode?: string | null
  legalFormOther?: string | null
  /** Subject to French VAT (same semantics as Prisma `Association.vatLiable`). */
  vatLiable?: boolean
  chartTemplateId?: string | null
  isClosed?: boolean
  createdAt?: string | Date
  updatedAt?: string | Date
}

/** Third parties (suppliers / customers), scoped to an association. */
export type BackupCounterpartyJson = {
  id: string
  associationId: string
  kind: string
  name: string
  createdAt?: string | Date
  updatedAt?: string | Date
}

/** Quick-entry templates (modèles de saisie), scoped to an association. */
export type BackupRecurringExpenseTemplateJson = {
  id: string
  associationId: string
  title: string
  operationType: string
  amountCents?: number | null
  counterpartyId?: string | null
  operationAccountNumber: string
  treasuryAccountNumber?: string | null
  packCode?: string | null
  createdAt?: string | Date
  updatedAt?: string | Date
}

/** Links payable/receivable lines to settlement lines (treasury allocations). */
export type BackupCounterpartySettlementAllocationJson = {
  id: string
  payableLineId: string
  settlementLineId: string
  amountCents: number
  createdAt?: string | Date
}

export type BackupFiscalYearJson = {
  id: string
  associationId: string
  startDate: string
  endDate: string
  status: string
}

export type BackupBudgetJson = {
  id: string
  associationId: string
  name: string
  notes?: string | null
  sourceFiscalYearId?: string | null
  sourceCoefficientPercent?: number | null
  createdAt?: string | Date
  updatedAt?: string | Date
}

export type BackupBudgetLineJson = {
  id: string
  budgetId: string
  accountNumber: string
  accountName: string
  amountCents: number
  createdAt?: string | Date
  updatedAt?: string | Date
}

export type BackupJournalJson = {
  id: string
  code: string
  name: string
}

export type BackupAccountJson = {
  id: string
  number: string
  name: string
  fiscalYearId: string
}

export type BackupJournalSequenceJson = {
  id: string
  fiscalYearId: string
  journalId: string
  nextNumber: number
  createdAt?: string | Date
  updatedAt?: string | Date
}

export type BackupEntryJson = {
  id: string
  date: string | Date
  description: string
  journalId: string
  fiscalYearId: string
  counterpartyId?: string | null
  referenceNumber?: string | null
  referenceSequence?: number | null
  createdAt?: string | Date
  updatedAt?: string | Date
}

export type BackupEntryLineJson = {
  id: string
  entryId: string
  accountId?: string | null
  accountNumber: string
  accountName: string
  debitCents: number
  creditCents: number
  createdAt?: string | Date
  updatedAt?: string | Date
}

export type BackupDocumentJson = {
  id: string
  fiscalYearId: string
  originalName: string
  storedName: string
  mimeType: string
  sizeBytes: number
  sha256?: string | null
  relativePath: string
  uploadedAt?: string | Date
  createdAt?: string | Date
  updatedAt?: string | Date
}

export type BackupDocumentEntryLineJson = {
  id: string
  documentId: string
  entryLineId: string
  createdAt?: string | Date
}

export type BackupInKindContributionJson = {
  id: string
  associationId: string
  fiscalYearId: string
  kind: string
  date: string | Date
  description: string
  contributorName?: string | null
  quantityMilliUnits: number
  unit: string
  unitValueCents?: number | null
  totalValueCents: number
  valuationMethod: string
  meetsAnc2112Essential: boolean
  meetsAnc2112Measurable: boolean
  isRecorded: boolean
  entryId?: string | null
  documentId?: string | null
  createdAt?: string | Date
  updatedAt?: string | Date
}
