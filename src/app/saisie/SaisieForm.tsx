'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useEffect, useId, useMemo, useState } from 'react'
import { createEcriture } from '@/actions/ecritureActions'
import { getCustomer411Preview, getSupplier401Preview } from '@/actions/counterpartyActions'
import {
  calendarDateInTimeZone,
  ENTRY_DATE_TIMEZONE,
  isEntryDateAfterToday,
} from '@/lib/entryDateValidation'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import CounterpartyCreateDialog from '@/components/CounterpartyCreateDialog'
import forms from '@/components/forms/forms.module.css'
import styles from './saisieForm.module.css'
import {
  COUNTERPARTY_KIND_CUSTOMER,
  COUNTERPARTY_KIND_SUPPLIER,
} from '@/lib/counterparty'
import { normalizeEurosAmount } from '@/lib/money'
import { splitTtcToHtAndVatEuros } from '@/lib/vatSplit'
import type { QuickVatInput } from '@/lib/vatQuickEntry'
import {
  createCustomerReceipt,
  createSupplierSettlement,
  listOpenCustomerReceivables,
  listOpenSupplierPayables,
} from '@/actions/treasuryActions'
import {
  type Compte,
  type CounterpartyLite,
  type Journal,
  type LigneForm,
  type TypeOperation,
} from './saisieFormTypes'
import {
  buildAdvancedSubmitPayload,
  buildOperationsSubmitPayload,
  buildQuickDocumentsByLine,
} from './saisieFormSubmit'
import SaisieFormModeBar from './SaisieFormModeBar'
import { SaisieFormProvider, type SaisieFormContextValue } from './saisieFormContext'
import SaisieFormCommonHeader from './SaisieFormCommonHeader'
import SaisieFormOperationsPanel from './SaisieFormOperationsPanel'
import SaisieFormTreasuryPanel from './SaisieFormTreasuryPanel'
import SaisieFormAdvancedPanel from './SaisieFormAdvancedPanel'
import SaisieFormSubmitRow from './SaisieFormSubmitRow'

export default function SaisieForm({
  journaux,
  comptes,
  fournisseurs,
  clients,
  exerciceId,
  exerciceStartDate,
  exerciceEndDate,
  vatLiable,
  initialTab = 'OPERATIONS',
}: {
  journaux: Journal[]
  comptes: Compte[]
  fournisseurs: CounterpartyLite[]
  clients: CounterpartyLite[]
  exerciceId: string
  exerciceStartDate: string
  exerciceEndDate: string
  vatLiable: boolean
  initialTab?: 'OPERATIONS' | 'TREASURY'
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const componentId = useId()
  const [mode, setMode] = useState<'OPERATIONS' | 'TREASURY' | 'AVANCE'>(
    initialTab === 'TREASURY' ? 'TREASURY' : 'OPERATIONS'
  )
  const [date, setDate] = useState<Date | null>(() => new Date())
  const [libelle, setLibelle] = useState('')
  const [selectedJournalId, setSelectedJournalId] = useState<string>(journaux[0]?.id || '')

  const [lignes, setLignes] = useState<LigneForm[]>([
    { compteId: '', debit: 0, credit: 0 },
    { compteId: '', debit: 0, credit: 0 },
  ])

  const [comptePaiementId, setComptePaiementId] = useState<string | null>(null)
  const [compteOperationId, setCompteOperationId] = useState<string | null>(null)
  const [typeOperation, setTypeOperation] = useState<TypeOperation>(
    initialTab === 'TREASURY' ? 'REGLEMENT_FOURNISSEUR' : 'DEPENSE'
  )
  const [montant, setMontant] = useState<number>(0)
  const [vatRatePercent, setVatRatePercent] = useState<number>(20)
  const [dejaRegle, setDejaRegle] = useState(true)

  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [showSupplierCreate, setShowSupplierCreate] = useState(false)
  const [showCustomerCreate, setShowCustomerCreate] = useState(false)

  const [settlementPreview, setSettlementPreview] = useState<Awaited<
    ReturnType<typeof getSupplier401Preview>
  > | null>(null)
  const [encaissementPreview, setEncaissementPreview] = useState<Awaited<
    ReturnType<typeof getCustomer411Preview>
  > | null>(null)

  const [treasuryOpenItems, setTreasuryOpenItems] = useState<
    Awaited<ReturnType<typeof listOpenSupplierPayables>> | Awaited<ReturnType<typeof listOpenCustomerReceivables>> | null
  >(null)
  const [treasuryAllocationsByLineId, setTreasuryAllocationsByLineId] = useState<Record<string, number>>({})

  const [quickDocuments, setQuickDocuments] = useState<(File | null)[]>([null])
  const [advancedEntryDocuments, setAdvancedEntryDocuments] = useState<(File | null)[]>([null])
  const [fileInputsResetKey, setFileInputsResetKey] = useState(0)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const setTabParam = (tab: 'ops' | 'treasury') => {
    const next = new URLSearchParams(searchParams?.toString() ?? '')
    next.set('tab', tab)
    router.replace(`${pathname}?${next.toString()}`)
  }

  const exerciceStart = new Date(exerciceStartDate)
  const exerciceEnd = new Date(exerciceEndDate)
  const calendarMaxDate = new Date(Math.min(new Date().getTime(), exerciceEnd.getTime()))

  const totalDebit = lignes.reduce((s, l) => s + (l.debit || 0), 0)
  const totalCredit = lignes.reduce((s, l) => s + (l.credit || 0), 0)
  const isEquilibre = Math.abs(totalDebit - totalCredit) < 0.01

  const compteOptions = comptes.map((c) => ({ value: c.id, label: `${c.numero} - ${c.libelle}` }))
  const paiementOptions = compteOptions.filter((o) => o.label.startsWith('5'))

  const operationOptions = compteOptions.filter((o) => {
    if (typeOperation === 'DEPENSE') return o.label.startsWith('6')
    if (typeOperation === 'RECETTE') return o.label.startsWith('7')
    return o.label.startsWith('5')
  })

  const supplierOptions = useMemo(
    () => fournisseurs.map((f) => ({ value: f.id, label: f.name })),
    [fournisseurs]
  )
  const customerOptions = useMemo(() => clients.map((c) => ({ value: c.id, label: c.name })), [clients])

  const journalOptions = journaux.map((j) => ({ value: j.id, label: `${j.code} — ${j.nom}` }))
  const journalValue =
    journaux.find((j) => j.id === selectedJournalId) != null
      ? {
          value: selectedJournalId,
          label: `${journaux.find((j) => j.id === selectedJournalId)!.code} — ${journaux.find((j) => j.id === selectedJournalId)!.nom}`,
        }
      : null

  const journalByCode = (code: string) => journaux.find((j) => j.code === code)?.id || null
  const compteById = (id: string | null) => comptes.find((c) => c.id === id)

  useEffect(() => {
    if (mode !== 'OPERATIONS' || typeOperation !== 'REGLEMENT_FOURNISSEUR' || !supplierId) {
      return
    }
    let cancelled = false
    getSupplier401Preview(exerciceId, supplierId)
      .then((p) => {
        if (!cancelled) setSettlementPreview(p)
      })
      .catch(() => {
        if (!cancelled) setSettlementPreview(null)
      })
    return () => {
      cancelled = true
    }
  }, [mode, typeOperation, supplierId, exerciceId])

  useEffect(() => {
    if (mode !== 'OPERATIONS' || typeOperation !== 'ENCAISSEMENT_CLIENT' || !customerId) {
      return
    }
    let cancelled = false
    getCustomer411Preview(exerciceId, customerId)
      .then((p) => {
        if (!cancelled) setEncaissementPreview(p)
      })
      .catch(() => {
        if (!cancelled) setEncaissementPreview(null)
      })
    return () => {
      cancelled = true
    }
  }, [mode, typeOperation, customerId, exerciceId])

  useEffect(() => {
    if (mode !== 'TREASURY') return

    if (typeOperation === 'REGLEMENT_FOURNISSEUR' && supplierId) {
      let cancelled = false
      listOpenSupplierPayables({ fiscalYearId: exerciceId, counterpartyId: supplierId, take: 200 })
        .then((rows) => {
          if (cancelled) return
          setTreasuryOpenItems(rows)
          setTreasuryAllocationsByLineId({})
        })
        .catch(() => {
          if (!cancelled) setTreasuryOpenItems([])
        })
      return () => {
        cancelled = true
      }
    }

    if (typeOperation === 'ENCAISSEMENT_CLIENT' && customerId) {
      let cancelled = false
      listOpenCustomerReceivables({ fiscalYearId: exerciceId, counterpartyId: customerId, take: 200 })
        .then((rows) => {
          if (cancelled) return
          setTreasuryOpenItems(rows)
          setTreasuryAllocationsByLineId({})
        })
        .catch(() => {
          if (!cancelled) setTreasuryOpenItems([])
        })
      return () => {
        cancelled = true
      }
    }
  }, [mode, typeOperation, supplierId, customerId, exerciceId])

  const showPaidQuestion =
    typeOperation === 'DEPENSE' || typeOperation === 'RECETTE'

  const showVatUi =
    vatLiable && (typeOperation === 'DEPENSE' || typeOperation === 'RECETTE')

  const vatPreview =
    showVatUi && vatRatePercent > 0 && montant > 0
      ? splitTtcToHtAndVatEuros(montant, vatRatePercent)
      : null

  const treasuryAllocationSum = Object.values(treasuryAllocationsByLineId).reduce((s, v) => s + (Number(v) || 0), 0)
  const treasuryAllocationMatchesAmount = Math.abs(treasuryAllocationSum - montant) < 0.0001
  const treasuryAllocationRemainderEuros = normalizeEurosAmount(montant - treasuryAllocationSum)

  const treasuryCounterpartySelected =
    typeOperation === 'REGLEMENT_FOURNISSEUR' ? supplierId != null : customerId != null
  const showTreasuryAllocationBanner = treasuryCounterpartySelected && montant >= 0.0001

  const addLigne = () => {
    setLignes([...lignes, { compteId: '', debit: 0, credit: 0 }])
  }

  const removeLigne = (index: number) => {
    if (lignes.length <= 2) return
    const newLignes = [...lignes]
    newLignes.splice(index, 1)
    setLignes(newLignes)
  }

  const updateLigne = (index: number, field: keyof LigneForm, value: string | number) => {
    const newLignes = [...lignes]
    if (field === 'debit' && Number(value) > 0) newLignes[index].credit = 0
    if (field === 'credit' && Number(value) > 0) newLignes[index].debit = 0
    newLignes[index][field] = value as never
    setLignes(newLignes)
  }

  const addAdvancedDocumentInput = () => {
    setAdvancedEntryDocuments((prev) => [...prev, null])
  }

  const updateAdvancedDocument = (docIndex: number, file: File | null) => {
    setAdvancedEntryDocuments((prev) => {
      const next = [...prev]
      next[docIndex] = file
      return next
    })
  }

  const removeAdvancedDocument = (docIndex: number) => {
    setAdvancedEntryDocuments((prev) => {
      if (prev.length <= 1) return [null]
      const next = [...prev]
      next.splice(docIndex, 1)
      return next.length > 0 ? next : [null]
    })
  }

  const addQuickDocumentInput = () => {
    setQuickDocuments((prev) => [...prev, null])
  }

  const updateQuickDocument = (docIndex: number, file: File | null) => {
    setQuickDocuments((prev) => {
      const next = [...prev]
      next[docIndex] = file
      return next
    })
  }

  const removeQuickDocument = (docIndex: number) => {
    setQuickDocuments((prev) => {
      if (prev.length <= 1) return [null]
      const next = [...prev]
      next.splice(docIndex, 1)
      return next.length > 0 ? next : [null]
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (mode === 'TREASURY') {
      setError("Utilisez le bouton « Enregistrer » de l'onglet Règlement / Encaissement.")
      return
    }

    // Normalize to 2 decimals to avoid floating glitches (e.g. 4.999999 → 5.00).
    const normalizedAmount = normalizeEurosAmount(montant)

    let lignesToSubmit: LigneForm[] = []
    let counterpartyId: string | null = null
    let quickVatPayload: QuickVatInput | undefined

    let journalId = selectedJournalId || journaux[0]?.id || ''

    if (!date) {
      setError('Veuillez choisir une date.')
      return
    }

    const dateStr = calendarDateInTimeZone(date, ENTRY_DATE_TIMEZONE)
    if (isEntryDateAfterToday(dateStr)) {
      setError("La date d'écriture ne peut pas être dans le futur.")
      return
    }

    if (mode === 'OPERATIONS') {
      const built = buildOperationsSubmitPayload({
        typeOperation,
        normalizedAmount,
        comptes,
        comptePaiementId,
        compteOperationId,
        supplierId,
        customerId,
        dejaRegle,
        vatLiable,
        vatRatePercent,
        journalByCode,
        fallbackJournalId: journalId,
        compteById,
      })
      if (!built.ok) {
        setError(built.error)
        return
      }
      lignesToSubmit = built.lignesToSubmit
      counterpartyId = built.counterpartyId
      quickVatPayload = built.quickVatPayload
      journalId = built.journalId
    } else {
      const builtAdvanced = buildAdvancedSubmitPayload({ lignes, isEquilibre, totalDebit })
      if (!builtAdvanced.ok) {
        setError(builtAdvanced.error)
        return
      }
      lignesToSubmit = builtAdvanced.lignesToSubmit
    }

    try {
      const documentsByLine = buildQuickDocumentsByLine({
        mode,
        typeOperation,
        quickDocuments,
        quickVatPayload,
        lignesToSubmit,
      })

      await createEcriture({
        date: dateStr,
        libelle,
        journalId,
        exerciceId,
        counterpartyId,
        lignes: quickVatPayload ? [] : lignesToSubmit,
        documentFile: null,
        entryDocuments:
          mode === 'AVANCE'
            ? advancedEntryDocuments.filter((d): d is File => d != null)
            : undefined,
        documentsByLine,
        quickVat: quickVatPayload ?? null,
      })
      setSuccess('Écriture enregistrée avec succès.')
      setLibelle('')
      setQuickDocuments([null])
      setFileInputsResetKey((k) => k + 1)
      setSupplierId(null)
      setCustomerId(null)
      setSettlementPreview(null)
      if (mode === 'AVANCE') {
        setLignes([
          { compteId: '', debit: 0, credit: 0 },
          { compteId: '', debit: 0, credit: 0 },
        ])
        setAdvancedEntryDocuments([null])
      } else {
        setMontant(0)
        setComptePaiementId(null)
        setCompteOperationId(null)
      }
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur')
    }
  }

  const handleTreasurySave = async () => {
    try {
      setError('')
      setSuccess('')
      if (!date) throw new Error('Veuillez choisir une date.')
      const dateStr = calendarDateInTimeZone(date, ENTRY_DATE_TIMEZONE)
      if (isEntryDateAfterToday(dateStr)) throw new Error("La date d'écriture ne peut pas être dans le futur.")
      if (!comptePaiementId) throw new Error('Veuillez choisir un compte de trésorerie.')

      const allocations = Object.entries(treasuryAllocationsByLineId)
        .filter(([, v]) => Number(v) > 0)
        .map(([payableLineId, amountEuros]) => ({ payableLineId, amountEuros: Number(amountEuros) }))

      if (typeOperation === 'REGLEMENT_FOURNISSEUR') {
        if (!supplierId) throw new Error('Veuillez choisir un fournisseur.')
        await createSupplierSettlement({
          fiscalYearId: exerciceId,
          date: dateStr,
          counterpartyId: supplierId,
          treasuryAccountId: comptePaiementId,
          description: libelle.trim() || 'Règlement fournisseur',
          amountEuros: montant,
          allocations,
        })
      } else {
        if (!customerId) throw new Error('Veuillez choisir un client.')
        await createCustomerReceipt({
          fiscalYearId: exerciceId,
          date: dateStr,
          counterpartyId: customerId,
          treasuryAccountId: comptePaiementId,
          description: libelle.trim() || 'Encaissement client',
          amountEuros: montant,
          allocations,
        })
      }

      setSuccess('Opération enregistrée.')
      setTreasuryAllocationsByLineId({})
      setTreasuryOpenItems(null)
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur.')
    }
  }

  const switchTypeOperation = (t: TypeOperation) => {
    setTypeOperation(t)
    setCompteOperationId(null)
    if (t === 'TRANSFERT' || t === 'REGLEMENT_FOURNISSEUR' || t === 'ENCAISSEMENT_CLIENT') {
      setDejaRegle(true)
    }
    if (t === 'REGLEMENT_FOURNISSEUR' || t === 'ENCAISSEMENT_CLIENT') {
      setQuickDocuments([null])
      setFileInputsResetKey((k) => k + 1)
    }
  }

  const showQuickJustificatifs =
    typeOperation !== 'REGLEMENT_FOURNISSEUR' && typeOperation !== 'ENCAISSEMENT_CLIENT'
  const formContext: SaisieFormContextValue = {
    componentId,
    mode,
    typeOperation,
    date,
    setDate,
    libelle,
    setLibelle,
    exerciceStart,
    calendarMaxDate,
    montant,
    setMontant,
    vatRatePercent,
    setVatRatePercent,
    dejaRegle,
    setDejaRegle,
    comptePaiementId,
    setComptePaiementId,
    compteOperationId,
    setCompteOperationId,
    supplierId,
    setSupplierId,
    customerId,
    setCustomerId,
    setShowSupplierCreate,
    setShowCustomerCreate,
    switchTypeOperation,
    showVatUi,
    vatPreview,
    showPaidQuestion,
    showQuickJustificatifs,
    settlementPreview,
    encaissementPreview,
    supplierOptions,
    customerOptions,
    paiementOptions,
    operationOptions,
    quickDocuments,
    fileInputsResetKey,
    addQuickDocumentInput,
    updateQuickDocument,
    removeQuickDocument,
    treasuryOpenItems,
    treasuryAllocationsByLineId,
    setTreasuryAllocationsByLineId,
    setTypeOperation,
    setTreasuryOpenItems,
    showTreasuryAllocationBanner,
    treasuryAllocationMatchesAmount,
    treasuryAllocationRemainderEuros,
    lignes,
    journaux,
    setSelectedJournalId,
    journalOptions,
    journalValue,
    compteOptions,
    totalDebit,
    totalCredit,
    isEquilibre,
    addLigne,
    removeLigne,
    updateLigne,
    advancedEntryDocuments,
    addAdvancedDocumentInput,
    updateAdvancedDocument,
    removeAdvancedDocument,
    handleTreasurySave,
  }

  return (
    <div className={styles.root}>
      <CounterpartyCreateDialog
        kind={COUNTERPARTY_KIND_SUPPLIER}
        title="Nouveau fournisseur"
        isOpen={showSupplierCreate}
        onClose={() => setShowSupplierCreate(false)}
        onCreated={(row) => {
          setSupplierId(row.id)
          router.refresh()
        }}
      />
      <CounterpartyCreateDialog
        kind={COUNTERPARTY_KIND_CUSTOMER}
        title="Nouveau client"
        isOpen={showCustomerCreate}
        onClose={() => setShowCustomerCreate(false)}
        onCreated={(row) => {
          setCustomerId(row.id)
          router.refresh()
        }}
      />

      <SaisieFormModeBar
        mode={mode}
        setMode={setMode}
        setTypeOperation={setTypeOperation}
        setError={setError}
        setSuccess={setSuccess}
        setTreasuryAllocationsByLineId={setTreasuryAllocationsByLineId}
        setTreasuryOpenItems={setTreasuryOpenItems}
        setTabParam={setTabParam}
      />

      <SaisieFormProvider value={formContext}>
        <form onSubmit={handleSubmit} className={styles.form}>
          {error ? <div className={`card ${forms.alertError}`}>{error}</div> : null}
          {success ? <div className={`card ${forms.alertSuccess}`}>{success}</div> : null}

          <SaisieFormCommonHeader />

          {mode === 'OPERATIONS' ? <SaisieFormOperationsPanel /> : null}
          {mode === 'TREASURY' ? <SaisieFormTreasuryPanel /> : null}
          {mode === 'AVANCE' ? <SaisieFormAdvancedPanel /> : null}

          <SaisieFormSubmitRow />
        </form>
      </SaisieFormProvider>
    </div>
  )
}
