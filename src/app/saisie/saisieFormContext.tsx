'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { createContext, useContext, type Dispatch, type SetStateAction } from 'react'
import type { getCustomer411Preview, getSupplier401Preview } from '@/actions/counterpartyActions'
import type { listOpenCustomerReceivables, listOpenSupplierPayables } from '@/actions/treasuryActions'
import type { splitTtcToHtAndVatEuros } from '@/lib/vatSplit'
import type { Journal, LigneForm, TypeOperation } from './saisieFormTypes'

export type SaisieFormMode = 'OPERATIONS' | 'TREASURY' | 'AVANCE'

export type SelectOption = { value: string; label: string }

export type TreasuryOpenItems =
  | Awaited<ReturnType<typeof listOpenSupplierPayables>>
  | Awaited<ReturnType<typeof listOpenCustomerReceivables>>
  | null

export type SaisieFormContextValue = {
  componentId: string
  mode: SaisieFormMode
  typeOperation: TypeOperation
  date: Date | null
  setDate: (d: Date | null) => void
  libelle: string
  setLibelle: (v: string) => void
  exerciceStart: Date
  calendarMaxDate: Date
  montant: number
  setMontant: (v: number) => void
  vatRatePercent: number
  setVatRatePercent: (v: number) => void
  dejaRegle: boolean
  setDejaRegle: (v: boolean) => void
  comptePaiementId: string | null
  setComptePaiementId: (v: string | null) => void
  compteOperationId: string | null
  setCompteOperationId: (v: string | null) => void
  supplierId: string | null
  setSupplierId: (v: string | null) => void
  customerId: string | null
  setCustomerId: (v: string | null) => void
  setShowSupplierCreate: (v: boolean) => void
  setShowCustomerCreate: (v: boolean) => void
  switchTypeOperation: (t: TypeOperation) => void
  showVatUi: boolean
  vatPreview: ReturnType<typeof splitTtcToHtAndVatEuros> | null
  showPaidQuestion: boolean
  showQuickJustificatifs: boolean
  settlementPreview: Awaited<ReturnType<typeof getSupplier401Preview>> | null
  encaissementPreview: Awaited<ReturnType<typeof getCustomer411Preview>> | null
  supplierOptions: SelectOption[]
  customerOptions: SelectOption[]
  paiementOptions: SelectOption[]
  operationOptions: SelectOption[]
  quickDocuments: (File | null)[]
  fileInputsResetKey: number
  addQuickDocumentInput: () => void
  updateQuickDocument: (docIndex: number, file: File | null) => void
  removeQuickDocument: (docIndex: number) => void
  treasuryOpenItems: TreasuryOpenItems
  treasuryAllocationsByLineId: Record<string, number>
  setTreasuryAllocationsByLineId: Dispatch<SetStateAction<Record<string, number>>>
  setTypeOperation: (t: TypeOperation) => void
  setTreasuryOpenItems: Dispatch<SetStateAction<TreasuryOpenItems>>
  showTreasuryAllocationBanner: boolean
  treasuryAllocationMatchesAmount: boolean
  treasuryAllocationRemainderEuros: number
  lignes: LigneForm[]
  journaux: Journal[]
  setSelectedJournalId: (v: string) => void
  journalOptions: SelectOption[]
  journalValue: { value: string; label: string } | null
  compteOptions: SelectOption[]
  totalDebit: number
  totalCredit: number
  isEquilibre: boolean
  addLigne: () => void
  removeLigne: (index: number) => void
  updateLigne: (index: number, field: keyof LigneForm, value: string | number) => void
  advancedEntryDocuments: (File | null)[]
  addAdvancedDocumentInput: () => void
  updateAdvancedDocument: (docIndex: number, file: File | null) => void
  removeAdvancedDocument: (docIndex: number) => void
  handleTreasurySave: () => Promise<void>
}

const SaisieFormContext = createContext<SaisieFormContextValue | null>(null)

export function SaisieFormProvider({
  value,
  children,
}: {
  value: SaisieFormContextValue
  children: React.ReactNode
}) {
  return <SaisieFormContext.Provider value={value}>{children}</SaisieFormContext.Provider>
}

export function useSaisieFormContext(): SaisieFormContextValue {
  const ctx = useContext(SaisieFormContext)
  if (!ctx) {
    throw new Error('useSaisieFormContext must be used within SaisieFormProvider')
  }
  return ctx
}
