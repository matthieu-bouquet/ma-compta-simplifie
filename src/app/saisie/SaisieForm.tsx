'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { forwardRef, useEffect, useId, useMemo, useState } from 'react'
import { createEcriture } from '@/actions/ecritureActions'
import { getCustomer411Preview, getSupplier401Preview } from '@/actions/counterpartyActions'
import {
  calendarDateInTimeZone,
  ENTRY_DATE_TIMEZONE,
  isEntryDateAfterToday,
} from '@/lib/entryDateValidation'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { ArrowLeftRight, HandCoins, List, Plus, ShoppingCart, TrendingUp, X } from 'lucide-react'
import AppSearchableSelect from '@/components/forms/AppSearchableSelect'
import FormSection from '@/components/forms/FormSection'
import CounterpartyCreateDialog from '@/components/CounterpartyCreateDialog'
import forms from '@/components/forms/forms.module.css'
import { NumberInput } from '@/components/forms/NumberInput'
import styles from './saisieForm.module.css'
import {
  COUNTERPARTY_KIND_CUSTOMER,
  COUNTERPARTY_KIND_SUPPLIER,
} from '@/lib/counterparty'
import { formatEurosFromCents, normalizeEurosAmount } from '@/lib/money'
import { splitTtcToHtAndVatEuros } from '@/lib/vatSplit'
import { VAT_RATE_OPTIONS } from '@/lib/vatRates'
import type { QuickVatInput } from '@/lib/vatQuickEntry'
import {
  createCustomerReceipt,
  createSupplierSettlement,
  listOpenCustomerReceivables,
  listOpenSupplierPayables,
} from '@/actions/treasuryActions'

type Journal = { id: string; code: string; nom: string }
type Compte = { id: string; numero: string; libelle: string }
type LigneForm = { compteId: string; debit: number; credit: number }

type CounterpartyLite = { id: string; name: string; kind: string }

type TypeOperation =
  | 'DEPENSE'
  | 'RECETTE'
  | 'TRANSFERT'
  | 'REGLEMENT_FOURNISSEUR'
  | 'ENCAISSEMENT_CLIENT'

const DateInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function DateInput(
  props,
  ref
) {
  return <input ref={ref} {...props} />
})

function findThirdPartyAccount(comptes: Compte[], rootPrefix: string): Compte | undefined {
  const exact = comptes.find((c) => c.numero === rootPrefix)
  if (exact) return exact
  return comptes.find((c) => c.numero.startsWith(rootPrefix))
}

function journalCodeForPayment(compte: Compte | undefined): 'BQ' | 'CA' {
  if (!compte) return 'BQ'
  return compte.numero.startsWith('53') ? 'CA' : 'BQ'
}

function quickDocOperationLineIndex(op: TypeOperation): number {
  if (op === 'REGLEMENT_FOURNISSEUR') return 0
  if (op === 'ENCAISSEMENT_CLIENT') return 0
  if (op === 'TRANSFERT') return 0
  if (op === 'DEPENSE') return 0
  if (op === 'RECETTE') return 1
  return 0
}

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

    const autoJournalId =
      typeOperation === 'TRANSFERT'
        ? journalByCode('OD')
        : typeOperation === 'DEPENSE'
          ? journalByCode('AC')
          : typeOperation === 'RECETTE'
            ? journalByCode('VE')
            : typeOperation === 'REGLEMENT_FOURNISSEUR' || typeOperation === 'ENCAISSEMENT_CLIENT'
              ? null
              : journalByCode('OD')

    let journalId = (mode === 'OPERATIONS' ? autoJournalId : null) || selectedJournalId || journaux[0]?.id

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
      if (normalizedAmount <= 0) {
        setError('Le montant doit être strictement supérieur à 0.')
        return
      }

      if (typeOperation === 'REGLEMENT_FOURNISSEUR') {
        if (!supplierId || !comptePaiementId) {
          setError('Veuillez choisir le fournisseur et le compte de trésorerie.')
          return
        }
        const c401 = findThirdPartyAccount(comptes, '401')
        if (!c401) {
          setError('Le compte 401 (Fournisseurs) est absent du plan de cet exercice.')
          return
        }
        lignesToSubmit = [
          { compteId: c401.id, debit: normalizedAmount, credit: 0 },
          { compteId: comptePaiementId, debit: 0, credit: normalizedAmount },
        ]
        counterpartyId = supplierId
        const pay = compteById(comptePaiementId)
        const j = journalByCode(journalCodeForPayment(pay))
        journalId = j || journalByCode('BQ') || journalId
      } else if (typeOperation === 'ENCAISSEMENT_CLIENT') {
        if (!customerId || !comptePaiementId) {
          setError('Veuillez choisir le client et le compte de trésorerie.')
          return
        }
        const c411 = findThirdPartyAccount(comptes, '411')
        if (!c411) {
          setError('Le compte 411 (Clients) est absent du plan de cet exercice.')
          return
        }
        lignesToSubmit = [
          { compteId: comptePaiementId, debit: normalizedAmount, credit: 0 },
          { compteId: c411.id, debit: 0, credit: normalizedAmount },
        ]
        counterpartyId = customerId
        const pay = compteById(comptePaiementId)
        const j = journalByCode(journalCodeForPayment(pay))
        journalId = j || journalByCode('BQ') || journalId
      } else if (typeOperation === 'TRANSFERT') {
        if (!comptePaiementId || !compteOperationId) {
          setError('Veuillez remplir les deux comptes.')
          return
        }
        if (comptePaiementId === compteOperationId) {
          setError('Le compte source et destination doivent être différents.')
          return
        }
        lignesToSubmit = [
          { compteId: compteOperationId, debit: normalizedAmount, credit: 0 },
          { compteId: comptePaiementId, debit: 0, credit: normalizedAmount },
        ]
        journalId = journalByCode('OD') || journalId
      } else if (vatLiable && vatRatePercent > 0 && typeOperation === 'DEPENSE') {
        if (!compteOperationId) {
          setError('Veuillez choisir la catégorie (charge).')
          return
        }
        if (dejaRegle) {
          if (!comptePaiementId) {
            setError('Veuillez choisir le moyen de paiement.')
            return
          }
          quickVatPayload = {
            amountTtcEuros: normalizedAmount,
            vatRatePercent,
            flow: 'DEPENSE',
            settledImmediately: true,
            operationAccountId: compteOperationId,
            treasuryAccountId: comptePaiementId,
            thirdPartyAccountId: null,
          }
        } else {
          if (!supplierId) {
            setError('Veuillez choisir ou créer un fournisseur pour une dette fournisseur.')
            return
          }
          const c401 = findThirdPartyAccount(comptes, '401')
          if (!c401) {
            setError('Le compte 401 (Fournisseurs) est absent du plan de cet exercice.')
            return
          }
          quickVatPayload = {
            amountTtcEuros: normalizedAmount,
            vatRatePercent,
            flow: 'DEPENSE',
            settledImmediately: false,
            operationAccountId: compteOperationId,
            treasuryAccountId: null,
            thirdPartyAccountId: c401.id,
          }
        }
        counterpartyId = supplierId
        lignesToSubmit = []
        journalId = journalByCode('AC') || journalId
      } else if (vatLiable && vatRatePercent > 0 && typeOperation === 'RECETTE') {
        if (!compteOperationId) {
          setError('Veuillez choisir la catégorie (produit).')
          return
        }
        if (dejaRegle) {
          if (!comptePaiementId) {
            setError('Veuillez choisir le moyen de paiement.')
            return
          }
          quickVatPayload = {
            amountTtcEuros: normalizedAmount,
            vatRatePercent,
            flow: 'RECETTE',
            settledImmediately: true,
            operationAccountId: compteOperationId,
            treasuryAccountId: comptePaiementId,
            thirdPartyAccountId: null,
          }
        } else {
          if (!customerId) {
            setError('Veuillez choisir ou créer un client pour une créance.')
            return
          }
          const c411 = findThirdPartyAccount(comptes, '411')
          if (!c411) {
            setError('Le compte 411 (Clients) est absent du plan de cet exercice.')
            return
          }
          quickVatPayload = {
            amountTtcEuros: normalizedAmount,
            vatRatePercent,
            flow: 'RECETTE',
            settledImmediately: false,
            operationAccountId: compteOperationId,
            treasuryAccountId: null,
            thirdPartyAccountId: c411.id,
          }
        }
        counterpartyId = customerId
        lignesToSubmit = []
        journalId = journalByCode('VE') || journalId
      } else if (typeOperation === 'DEPENSE') {
        if (!compteOperationId) {
          setError('Veuillez choisir la catégorie (charge).')
          return
        }
        if (dejaRegle) {
          if (!comptePaiementId) {
            setError('Veuillez choisir le moyen de paiement.')
            return
          }
          lignesToSubmit = [
            { compteId: compteOperationId, debit: normalizedAmount, credit: 0 },
            { compteId: comptePaiementId, debit: 0, credit: normalizedAmount },
          ]
          counterpartyId = supplierId
        } else {
          if (!supplierId) {
            setError('Veuillez choisir ou créer un fournisseur pour une dette fournisseur.')
            return
          }
          const c401 = findThirdPartyAccount(comptes, '401')
          if (!c401) {
            setError('Le compte 401 (Fournisseurs) est absent du plan de cet exercice.')
            return
          }
          lignesToSubmit = [
            { compteId: compteOperationId, debit: normalizedAmount, credit: 0 },
            { compteId: c401.id, debit: 0, credit: normalizedAmount },
          ]
          counterpartyId = supplierId
          journalId = journalByCode('AC') || journalId
        }
      } else if (typeOperation === 'RECETTE') {
        if (!compteOperationId) {
          setError('Veuillez choisir la catégorie (produit).')
          return
        }
        if (dejaRegle) {
          if (!comptePaiementId) {
            setError('Veuillez choisir le moyen de paiement.')
            return
          }
          lignesToSubmit = [
            { compteId: comptePaiementId, debit: normalizedAmount, credit: 0 },
            { compteId: compteOperationId, debit: 0, credit: normalizedAmount },
          ]
          counterpartyId = customerId
        } else {
          if (!customerId) {
            setError('Veuillez choisir ou créer un client pour une créance.')
            return
          }
          const c411 = findThirdPartyAccount(comptes, '411')
          if (!c411) {
            setError('Le compte 411 (Clients) est absent du plan de cet exercice.')
            return
          }
          lignesToSubmit = [
            { compteId: c411.id, debit: normalizedAmount, credit: 0 },
            { compteId: compteOperationId, debit: 0, credit: normalizedAmount },
          ]
          counterpartyId = customerId
          journalId = journalByCode('VE') || journalId
        }
      }
    } else {
      if (!isEquilibre) {
        setError("L'écriture doit être équilibrée (Total Débit = Total Crédit).")
        return
      }
      if (totalDebit <= 0) {
        setError('Le montant doit être strictement supérieur à 0.')
        return
      }
      if (lignes.some((l) => !l.compteId)) {
        setError('Veuillez sélectionner un compte pour toutes les lignes.')
        return
      }
      lignesToSubmit = lignes
    }

    try {
      const documentsByLine: File[][] | undefined =
        mode === 'AVANCE'
          ? undefined
          : (() => {
              if (
                typeOperation === 'REGLEMENT_FOURNISSEUR' ||
                typeOperation === 'ENCAISSEMENT_CLIENT'
              ) {
                return undefined
              }
              const docs = quickDocuments.filter((d): d is File => d != null)
              if (docs.length === 0) return undefined

              if (quickVatPayload) {
                const operationLineIndex = quickDocOperationLineIndex(typeOperation)
                const rows: File[][] = [[], [], []]
                rows[operationLineIndex] = docs
                return rows
              }

              const operationLineIndex = quickDocOperationLineIndex(typeOperation)
              return lignesToSubmit.map((_, idx) => (idx === operationLineIndex ? docs : []))
            })()

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

      <div className={styles.modeBar}>
        <button
          type="button"
          className={`btn ${mode === 'OPERATIONS' ? 'btn-primary' : ''} ${mode === 'OPERATIONS' ? styles.modeBtnActive : ''} ${styles.modeBtn}`}
          onClick={() => {
            setMode('OPERATIONS')
            setTypeOperation('DEPENSE')
            setError('')
            setSuccess('')
            setTabParam('ops')
          }}
        >
          Dépense / recette
        </button>
        <button
          type="button"
          className={`btn ${mode === 'TREASURY' ? 'btn-primary' : ''} ${mode === 'TREASURY' ? styles.modeBtnActive : ''} ${styles.modeBtn}`}
          onClick={() => {
            setMode('TREASURY')
            setTypeOperation('REGLEMENT_FOURNISSEUR')
            setTreasuryAllocationsByLineId({})
            setTreasuryOpenItems(null)
            setError('')
            setSuccess('')
            setTabParam('treasury')
          }}
        >
          Règlement / Encaissement
        </button>
        <button
          type="button"
          className={`btn ${mode === 'AVANCE' ? 'btn-primary' : ''} ${mode === 'AVANCE' ? styles.modeBtnActive : ''} ${styles.modeBtn}`}
          onClick={() => {
            setMode('AVANCE')
            setError('')
            setSuccess('')
            /* Bottom list follows ops tab (classes 6 & 7), not treasury (class 5). */
            setTabParam('ops')
          }}
        >
          Saisie Avancée (Multiple)
        </button>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        {error ? <div className={`card ${forms.alertError}`}>{error}</div> : null}
        {success ? <div className={`card ${forms.alertSuccess}`}>{success}</div> : null}

        <div className={styles.commonHeaderGrid}>
          <div className={forms.field}>
            <label className={forms.label} htmlFor="saisie-date">
              Date
            </label>
            <DatePicker
              id="saisie-date"
              selected={date}
              onChange={(d: Date | null) => setDate(d)}
              dateFormat="dd/MM/yyyy"
              minDate={exerciceStart}
              maxDate={calendarMaxDate}
              customInput={<DateInput className={forms.input} />}
              wrapperClassName="w-full"
              required
            />
          </div>

          <div className={forms.field}>
            <label className={forms.label} htmlFor="saisie-libelle">
              Libellé{' '}
              {mode === 'OPERATIONS'
                ? typeOperation === 'TRANSFERT'
                  ? '(ex: Retrait caisse)'
                  : '(ex: Achat matériel)'
                : '(ex: Facture, don, virement...)'}
            </label>
            <input
              id="saisie-libelle"
              type="text"
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              required
              className={forms.input}
            />
          </div>
        </div>

        {mode === 'OPERATIONS' ? (
          <div className={styles.quickPanel}>
            <div
              className={`${styles.quickGridTop} ${showVatUi ? styles.quickGridTopWithVat : styles.quickGridTopNoVat}`}
            >
              <div className={`${forms.field} ${styles.operationField}`}>
                <span className={forms.label}>Type d&apos;opération</span>
                <div className={styles.operationStripWrap} role="group" aria-label="Type d'opération">
                  <button
                    type="button"
                    className={`${styles.operationBtn} ${typeOperation === 'DEPENSE' ? styles.operationBtnDepenseActive : ''}`}
                    onClick={() => switchTypeOperation('DEPENSE')}
                  >
                    <ShoppingCart size={16} aria-hidden="true" />
                    Dépense
                  </button>
                  <button
                    type="button"
                    className={`${styles.operationBtn} ${styles.operationBtnBorder} ${typeOperation === 'RECETTE' ? styles.operationBtnRecetteActive : ''}`}
                    onClick={() => switchTypeOperation('RECETTE')}
                  >
                    <TrendingUp size={16} aria-hidden="true" />
                    Recette
                  </button>
                  <button
                    type="button"
                    className={`${styles.operationBtn} ${styles.operationBtnBorder} ${typeOperation === 'TRANSFERT' ? styles.operationBtnTransfertActive : ''}`}
                    onClick={() => switchTypeOperation('TRANSFERT')}
                  >
                    <ArrowLeftRight size={16} aria-hidden="true" />
                    Virement
                  </button>
                </div>
              </div>

              <div className={forms.field}>
                <label className={forms.label} htmlFor="saisie-montant">
                  {showVatUi ? 'Montant TTC (€)' : 'Montant (€)'}
                </label>
                <NumberInput
                  id="saisie-montant"
                  step="0.01"
                  min="0.01"
                  value={montant || ''}
                  onChange={(e) => setMontant(normalizeEurosAmount(parseFloat(e.target.value) || 0))}
                  required
                  className={forms.input}
                />
              </div>

              {showVatUi ? (
                <div className={forms.field}>
                  <label className={forms.label} htmlFor="saisie-taux-tva">
                    Taux de TVA
                  </label>
                  <select
                    id="saisie-taux-tva"
                    className={forms.select}
                    value={vatRatePercent}
                    onChange={(e) => setVatRatePercent(parseFloat(e.target.value))}
                  >
                    {VAT_RATE_OPTIONS.map((o) => (
                      <option key={o.label} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>

            {vatPreview ? (
              <div className={styles.vatPreviewRow}>
                <p className={forms.fieldHint}>
                  HT : {vatPreview.htEuros.toFixed(2)} € · TVA : {vatPreview.vatEuros.toFixed(2)} €
                </p>
              </div>
            ) : null}

            {showPaidQuestion ? (
              <div className={styles.paidRow}>
                <span className={forms.label} id="paid-question-label">
                  Facture déjà payée ?
                </span>
                <div className={styles.paidToggle} role="group" aria-labelledby="paid-question-label">
                  <button
                    type="button"
                    className={`${styles.paidBtn} ${dejaRegle ? styles.paidBtnActive : ''}`}
                    onClick={() => setDejaRegle(true)}
                    aria-pressed={dejaRegle}
                  >
                    Oui
                  </button>
                  <button
                    type="button"
                    className={`${styles.paidBtn} ${!dejaRegle ? styles.paidBtnActive : ''}`}
                    onClick={() => setDejaRegle(false)}
                    aria-pressed={!dejaRegle}
                  >
                    Non (dette / créance)
                  </button>
                </div>
                <p className={forms.fieldHint}>
                  {typeOperation === 'DEPENSE'
                    ? dejaRegle
                      ? 'Charge réglée par la banque ou la caisse (sans compte fournisseur).'
                      : 'Dette fournisseurs : charge débitée, compte 401 crédité ; un second mouvement « Règlement fournisseur » soldera la dette.'
                    : dejaRegle
                      ? 'Produit encaissé immédiatement.'
                      : 'Créance client : compte 411 débité ; encaissement ultérieur via « Encaissement client ».'}
                </p>
              </div>
            ) : null}

            {typeOperation === 'REGLEMENT_FOURNISSEUR' || typeOperation === 'ENCAISSEMENT_CLIENT' ? (
              <div className={styles.quickGridAccounts}>
                <div className={forms.field}>
                  <label className={forms.label} htmlFor="saisie-tiers">
                    {typeOperation === 'REGLEMENT_FOURNISSEUR' ? 'Fournisseur' : 'Client'}
                  </label>
                  <div className={styles.tiersRow}>
                    <div className={styles.tiersSelect}>
                      <AppSearchableSelect
                        id="saisie-tiers"
                        inputId="saisie-tiers"
                        options={typeOperation === 'REGLEMENT_FOURNISSEUR' ? supplierOptions : customerOptions}
                        value={
                          typeOperation === 'REGLEMENT_FOURNISSEUR'
                            ? supplierOptions.find((o) => o.value === supplierId) ?? null
                            : customerOptions.find((o) => o.value === customerId) ?? null
                        }
                        onChange={(v) =>
                          typeOperation === 'REGLEMENT_FOURNISSEUR' ? setSupplierId(v) : setCustomerId(v)
                        }
                        placeholder={typeOperation === 'REGLEMENT_FOURNISSEUR' ? 'Fournisseur' : 'Client'}
                        noOptionsMessage={() => 'Aucun résultat'}
                        elevatedZIndex
                      />
                    </div>
                    <button
                      type="button"
                      className={`btn btn-primary ${forms.btnWithLeadingIcon}`}
                      onClick={() =>
                        typeOperation === 'REGLEMENT_FOURNISSEUR'
                          ? setShowSupplierCreate(true)
                          : setShowCustomerCreate(true)
                      }
                      title={
                        typeOperation === 'REGLEMENT_FOURNISSEUR' ? 'Créer un fournisseur' : 'Créer un client'
                      }
                      aria-label={
                        typeOperation === 'REGLEMENT_FOURNISSEUR' ? 'Créer un fournisseur' : 'Créer un client'
                      }
                    >
                      <Plus size={18} aria-hidden="true" />
                      {typeOperation === 'REGLEMENT_FOURNISSEUR' ? 'Nouveau fournisseur' : 'Nouveau client'}
                    </button>
                  </div>
                </div>
                <div className={forms.field}>
                  <label className={forms.label} htmlFor="saisie-compte-paiement-reglement">
                    Trésorerie (banque ou caisse)
                  </label>
                  <AppSearchableSelect
                    id="saisie-compte-paiement-reglement"
                    inputId="saisie-compte-paiement-reglement"
                    options={paiementOptions}
                    value={paiementOptions.find((o) => o.value === comptePaiementId) ?? null}
                    onChange={(v) => setComptePaiementId(v)}
                    placeholder="Ex: Banque"
                    noOptionsMessage={() => 'Aucun compte trouvé'}
                    elevatedZIndex
                  />
                </div>
              </div>
            ) : null}

            {typeOperation === 'REGLEMENT_FOURNISSEUR' && supplierId ? (
              <div className={styles.settlementPanel}>
                {settlementPreview ? (
                  <>
                    <p className={styles.settlementBalance}>
                      Solde fournisseurs (401) pour ce tiers :{' '}
                      <strong>{formatEurosFromCents(settlementPreview.balanceCents)}</strong>
                    </p>
                    {settlementPreview.orphan401Lines > 0 ? (
                      <p className={forms.alertError}>
                        Attention : {settlementPreview.orphan401Lines} ligne(s) sur le compte 401 sans
                        fournisseur sur cet exercice peuvent affecter les soldes par tiers.
                      </p>
                    ) : null}
                    {settlementPreview.movements.length > 0 ? (
                      <div className={styles.movementsBox}>
                        <div className={styles.movementsTitle}>Mouvements récents (401)</div>
                        <ul className={styles.movementsList}>
                          {settlementPreview.movements.slice(0, 8).map((m, idx) => (
                            <li key={`${m.entryId}-${idx}`} className={styles.movementsItem}>
                              <span>{new Date(m.entryDate).toLocaleDateString('fr-FR')}</span>
                              <span className={styles.movementsDesc}>{m.description}</span>
                              <span>{formatEurosFromCents(m.lineAmountSignedCents)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className={forms.fieldHint}>Chargement du solde fournisseur…</p>
                )}
              </div>
            ) : null}

            {typeOperation === 'ENCAISSEMENT_CLIENT' && customerId ? (
              <div className={styles.settlementPanel}>
                {encaissementPreview ? (
                  <>
                    <p className={styles.settlementBalance}>
                      Solde clients (411) pour ce tiers :{' '}
                      <strong>{formatEurosFromCents(encaissementPreview.balanceCents)}</strong>
                    </p>
                    {encaissementPreview.orphan411Lines > 0 ? (
                      <p className={forms.alertError}>
                        Attention : {encaissementPreview.orphan411Lines} ligne(s) sur le compte 411 sans client
                        sur cet exercice peuvent affecter les soldes par tiers.
                      </p>
                    ) : null}
                    {encaissementPreview.movements.length > 0 ? (
                      <div className={styles.movementsBox}>
                        <div className={styles.movementsTitle}>Mouvements récents (411)</div>
                        <ul className={styles.movementsList}>
                          {encaissementPreview.movements.slice(0, 8).map((m, idx) => (
                            <li key={`411-${m.entryId}-${idx}`} className={styles.movementsItem}>
                              <span>{new Date(m.entryDate).toLocaleDateString('fr-FR')}</span>
                              <span className={styles.movementsDesc}>{m.description}</span>
                              <span>{formatEurosFromCents(m.lineAmountSignedCents)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className={forms.fieldHint}>Chargement du solde client…</p>
                )}
              </div>
            ) : null}

            {typeOperation !== 'REGLEMENT_FOURNISSEUR' &&
            typeOperation !== 'ENCAISSEMENT_CLIENT' &&
            (typeOperation === 'DEPENSE' || typeOperation === 'RECETTE') ? (
              <div className={styles.quickGridAccountsThree}>
                <div className={forms.field}>
                  <label className={forms.label} htmlFor="saisie-tiers-main">
                    {typeOperation === 'DEPENSE' ? 'Fournisseur' : 'Client'}{' '}
                    {!dejaRegle ? <span className={styles.requiredMark}>(obligatoire)</span> : null}
                  </label>
                  <div className={styles.tiersRow}>
                    <div className={styles.tiersSelect}>
                      <AppSearchableSelect
                        id="saisie-tiers-main"
                        inputId="saisie-tiers-main"
                        options={typeOperation === 'DEPENSE' ? supplierOptions : customerOptions}
                        value={
                          typeOperation === 'DEPENSE'
                            ? supplierOptions.find((o) => o.value === supplierId) ?? null
                            : customerOptions.find((o) => o.value === customerId) ?? null
                        }
                        onChange={(v) => (typeOperation === 'DEPENSE' ? setSupplierId(v) : setCustomerId(v))}
                        placeholder="—"
                        isClearable={dejaRegle}
                        noOptionsMessage={() => 'Aucun résultat'}
                        elevatedZIndex
                      />
                    </div>
                    <button
                      type="button"
                      className={`btn btn-primary ${styles.iconOnlyBtn}`}
                      onClick={() => (typeOperation === 'DEPENSE' ? setShowSupplierCreate(true) : setShowCustomerCreate(true))}
                      title={typeOperation === 'DEPENSE' ? 'Créer un fournisseur' : 'Créer un client'}
                      aria-label={typeOperation === 'DEPENSE' ? 'Créer un fournisseur' : 'Créer un client'}
                    >
                      <Plus size={18} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className={forms.field}>
                  <label className={forms.label} htmlFor="saisie-compte-operation">
                    {typeOperation === 'DEPENSE' ? 'Catégorie (Charge)' : 'Catégorie (Produit)'}
                  </label>
                  <AppSearchableSelect
                    id="saisie-compte-operation"
                    inputId="saisie-compte-operation"
                    options={operationOptions}
                    value={operationOptions.find((o) => o.value === compteOperationId) ?? null}
                    onChange={(v) => setCompteOperationId(v)}
                    placeholder={typeOperation === 'RECETTE' ? 'Ex: Cotisations...' : 'Ex: Achats...'}
                    noOptionsMessage={() => 'Aucun compte trouvé'}
                    elevatedZIndex
                  />
                </div>

                {(typeOperation === 'DEPENSE' && dejaRegle) || (typeOperation === 'RECETTE' && dejaRegle) ? (
                  <div className={forms.field}>
                    <label className={forms.label} htmlFor="saisie-compte-paiement">
                      Moyen de paiement
                    </label>
                    <AppSearchableSelect
                      id="saisie-compte-paiement"
                      inputId="saisie-compte-paiement"
                      options={paiementOptions}
                      value={paiementOptions.find((o) => o.value === comptePaiementId) ?? null}
                      onChange={(v) => setComptePaiementId(v)}
                      placeholder="Ex: Banque"
                      noOptionsMessage={() => 'Aucun compte trouvé'}
                      elevatedZIndex
                    />
                  </div>
                ) : (
                  <div aria-hidden="true" />
                )}
              </div>
            ) : typeOperation === 'TRANSFERT' ? (
              <div className={styles.quickGridAccounts}>
                <div className={forms.field}>
                  <label className={forms.label} htmlFor="saisie-compte-paiement">
                    De (Compte source)
                  </label>
                  <AppSearchableSelect
                    id="saisie-compte-paiement"
                    inputId="saisie-compte-paiement"
                    options={paiementOptions}
                    value={paiementOptions.find((o) => o.value === comptePaiementId) ?? null}
                    onChange={(v) => setComptePaiementId(v)}
                    placeholder="Ex: Banque"
                    noOptionsMessage={() => 'Aucun compte trouvé'}
                    elevatedZIndex
                  />
                </div>
                <div className={forms.field}>
                  <label className={forms.label} htmlFor="saisie-compte-operation">
                    Vers (Compte destination)
                  </label>
                  <AppSearchableSelect
                    id="saisie-compte-operation"
                    inputId="saisie-compte-operation"
                    options={operationOptions}
                    value={operationOptions.find((o) => o.value === compteOperationId) ?? null}
                    onChange={(v) => setCompteOperationId(v)}
                    placeholder="Ex: Caisse"
                    noOptionsMessage={() => 'Aucun compte trouvé'}
                    elevatedZIndex
                  />
                </div>
              </div>
            ) : null}

            {showQuickJustificatifs ? (
              <div className={forms.field}>
                <div className={styles.quickDocsHeader}>
                  <label className={forms.label} htmlFor={`${componentId}-saisie-quick-doc-0`}>
                    Pièces justificatives (optionnel)
                  </label>
                  <button
                    type="button"
                    className={styles.addDocBtn}
                    onClick={addQuickDocumentInput}
                    title="Ajouter un justificatif"
                    aria-label="Ajouter un justificatif"
                  >
                    <Plus size={16} aria-hidden="true" />
                  </button>
                </div>

                <div className={styles.quickDocsCell}>
                  {quickDocuments.map((file, docIndex) => {
                    const inputId = `${componentId}-saisie-quick-doc-${docIndex}`
                    return (
                      <div key={docIndex} className={styles.quickDocRow}>
                        <label className="sr-only" htmlFor={inputId}>
                          Pièce justificative — fichier {docIndex + 1}
                        </label>
                        <input
                          key={`${fileInputsResetKey}-${inputId}`}
                          id={inputId}
                          type="file"
                          accept="application/pdf,image/jpeg,image/png,image/webp"
                          onChange={(e) => updateQuickDocument(docIndex, e.target.files?.[0] ?? null)}
                          className={forms.fileInput}
                        />
                        <button
                          type="button"
                          className={styles.removeDocBtn}
                          onClick={() => removeQuickDocument(docIndex)}
                          title="Retirer ce justificatif"
                          aria-label="Retirer ce justificatif"
                        >
                          <X size={16} aria-hidden="true" />
                        </button>
                        <div className={styles.quickDocFileNameRow}>
                          {file?.name ? <span className={styles.docFileName}>{file.name}</span> : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p className={styles.fileHint}>
                  Les justificatifs sont rattachés à la ligne principale de l’opération (charge, produit, ou 401).
                </p>
              </div>
            ) : null}
          </div>
        ) : mode === 'TREASURY' ? (
          <div className={styles.treasuryPanel}>
            <div className={styles.quickGridTop}>
              <div className={`${forms.field} ${styles.operationField}`}>
                <span className={forms.label}>Type d&apos;opération</span>
                <div className={styles.operationStripWrap} role="group" aria-label="Type d'opération">
                  <button
                    type="button"
                    className={`${styles.operationBtn} ${typeOperation === 'REGLEMENT_FOURNISSEUR' ? styles.operationBtnReglementActive : ''}`}
                    onClick={() => {
                      setTypeOperation('REGLEMENT_FOURNISSEUR')
                      setTreasuryAllocationsByLineId({})
                      setTreasuryOpenItems(null)
                    }}
                  >
                    <HandCoins size={16} aria-hidden="true" />
                    Règlement fournisseur
                  </button>
                  <button
                    type="button"
                    className={`${styles.operationBtn} ${styles.operationBtnBorder} ${typeOperation === 'ENCAISSEMENT_CLIENT' ? styles.operationBtnEncaissementActive : ''}`}
                    onClick={() => {
                      setTypeOperation('ENCAISSEMENT_CLIENT')
                      setTreasuryAllocationsByLineId({})
                      setTreasuryOpenItems(null)
                    }}
                  >
                    <TrendingUp size={16} aria-hidden="true" />
                    Encaissement client
                  </button>
                </div>
                <p className={forms.fieldHint}>
                  Sélectionnez un tiers, puis affectez le montant sur une ou plusieurs lignes ouvertes.
                </p>
              </div>
            </div>

            <div className={styles.quickGridAccounts}>
              {typeOperation === 'REGLEMENT_FOURNISSEUR' ? (
                <div className={`${forms.field} ${styles.cpField}`}>
                  <label className={forms.label} htmlFor="tresorerie-fournisseur">
                    Fournisseur
                  </label>
                  <AppSearchableSelect
                    id="tresorerie-fournisseur"
                    inputId="tresorerie-fournisseur"
                    aria-label="Fournisseur"
                    value={supplierOptions.find((o) => o.value === supplierId) ?? null}
                    options={supplierOptions}
                    onChange={(v) => {
                      setSupplierId(v)
                      setTreasuryAllocationsByLineId({})
                      setTreasuryOpenItems(null)
                    }}
                    placeholder="Choisir un fournisseur…"
                  />
                </div>
              ) : (
                <div className={`${forms.field} ${styles.cpField}`}>
                  <label className={forms.label} htmlFor="tresorerie-client">
                    Client
                  </label>
                  <AppSearchableSelect
                    id="tresorerie-client"
                    inputId="tresorerie-client"
                    aria-label="Client"
                    value={customerOptions.find((o) => o.value === customerId) ?? null}
                    options={customerOptions}
                    onChange={(v) => {
                      setCustomerId(v)
                      setTreasuryAllocationsByLineId({})
                      setTreasuryOpenItems(null)
                    }}
                    placeholder="Choisir un client…"
                  />
                </div>
              )}

              <div className={forms.field}>
                <label className={forms.label} htmlFor="tresorerie-compte">
                  Compte de trésorerie
                </label>
                <AppSearchableSelect
                  id="tresorerie-compte"
                  inputId="tresorerie-compte"
                  aria-label="Compte de trésorerie"
                  options={paiementOptions}
                  value={paiementOptions.find((o) => o.value === comptePaiementId) ?? null}
                  onChange={(v) => setComptePaiementId(v)}
                  placeholder="Ex: Banque"
                  noOptionsMessage={() => 'Aucun compte trouvé'}
                  elevatedZIndex
                />
              </div>
            </div>

            <div className={styles.treasuryAmountRow}>
              <div className={forms.field}>
                <label className={forms.label} htmlFor="tresorerie-montant">
                  Montant (€)
                </label>
                <NumberInput
                  id="tresorerie-montant"
                  step="0.01"
                  min="0"
                  value={montant ? montant : ''}
                  onChange={(e) => setMontant(normalizeEurosAmount(Number(e.target.value)))}
                  className={forms.input}
                  required
                />
              </div>
            </div>

            <div className={styles.allocationsBox}>
              <div className={styles.allocationsTitle}>
                {typeOperation === 'REGLEMENT_FOURNISSEUR'
                  ? 'Dettes fournisseurs à solder (401)'
                  : 'Créances clients à encaisser (411)'}
              </div>
              <div className={styles.allocationsTableWrap}>
                <table className={styles.allocationsTable}>
                  <thead>
                    <tr>
                      <th className={styles.allocationsTh}>Pièce</th>
                      <th className={styles.allocationsTh}>Reste</th>
                      <th className={styles.allocationsTh}>Affecter (€)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {treasuryOpenItems === null ? (
                      <tr>
                        <td className={styles.allocationsEmptyCell} colSpan={3}>
                          <div className={styles.allocationsEmptyText}>
                            Sélectionnez un fournisseur ou un client pour charger les lignes ouvertes.
                          </div>
                        </td>
                      </tr>
                    ) : treasuryOpenItems.length === 0 ? (
                      <tr>
                        <td className={styles.allocationsEmptyCell} colSpan={3}>
                          <div className={styles.allocationsEmptyText}>Aucune ligne ouverte à solder.</div>
                        </td>
                      </tr>
                    ) : (
                      treasuryOpenItems.map((row) => {
                        const value = treasuryAllocationsByLineId[row.payableLineId] ?? 0
                        return (
                          <tr key={row.payableLineId}>
                            <td className={styles.allocationsTd}>
                              <div className={styles.allocationsPieceTop}>
                                <span className={styles.allocationsDate}>{row.entryDate}</span>
                                {row.referenceNumber ? (
                                  <span className={styles.allocationsRef}>{row.referenceNumber}</span>
                                ) : null}
                              </div>
                              <div className={styles.allocationsDesc}>{row.description}</div>
                            </td>
                            <td className={`${styles.allocationsTd} ${styles.allocationsAmount}`}>
                              {formatEurosFromCents(row.remainingCents)}
                            </td>
                            <td className={styles.allocationsTd}>
                              <label htmlFor={`alloc-${row.payableLineId}`} className="sr-only">
                                Montant affecté (€)
                              </label>
                              <NumberInput
                                id={`alloc-${row.payableLineId}`}
                                step="0.01"
                                min="0"
                                max={(row.remainingCents / 100).toFixed(2)}
                                value={value ? value : ''}
                                onChange={(e) => {
                                  const next = normalizeEurosAmount(Number(e.target.value))
                                  setTreasuryAllocationsByLineId((prev) => ({
                                    ...prev,
                                    [row.payableLineId]: next,
                                  }))
                                }}
                                className={forms.input}
                              />
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className={styles.allocationsFooter}>
                <div className={styles.allocationsSumRow}>
                  <span>
                    {typeOperation === 'REGLEMENT_FOURNISSEUR'
                      ? 'Montant du règlement :'
                      : 'Montant de l’encaissement :'}
                  </span>
                  <strong>{montant.toFixed(2)} €</strong>
                </div>
                {showTreasuryAllocationBanner ? (
                  treasuryAllocationMatchesAmount ? (
                    <div className={`${styles.allocationsBanner} ${styles.allocationsBannerOk}`} role="status">
                      <p className={styles.allocationsBannerLead}>
                        {typeOperation === 'REGLEMENT_FOURNISSEUR'
                          ? 'La somme des affectations doit égaler le montant du règlement.'
                          : 'La somme des affectations doit égaler le montant de l’encaissement.'}
                      </p>
                      <p className={styles.allocationsBannerRemainderLine}>
                        Reste à affecter :{' '}
                        <span className={styles.allocationsRemainderValueOk}>0,00 €</span>
                      </p>
                    </div>
                  ) : (
                    <div
                      className={`${styles.allocationsBanner} ${
                        treasuryAllocationRemainderEuros < 0 ? styles.allocationsBannerOver : styles.allocationsBannerWarn
                      }`}
                      role="alert"
                    >
                      <p className={styles.allocationsBannerLead}>
                        {typeOperation === 'REGLEMENT_FOURNISSEUR'
                          ? 'La somme des affectations doit égaler le montant du règlement.'
                          : 'La somme des affectations doit égaler le montant de l’encaissement.'}
                      </p>
                      <p className={styles.allocationsBannerRemainderLine}>
                        {treasuryAllocationRemainderEuros > 0 ? (
                          <>
                            Reste à affecter :{' '}
                            <span className={styles.allocationsRemainderValueWarn}>
                              {treasuryAllocationRemainderEuros.toFixed(2)} €
                            </span>
                          </>
                        ) : (
                          <>
                            Montant dépassé de :{' '}
                            <span className={styles.allocationsRemainderValueOver}>
                              {Math.abs(treasuryAllocationRemainderEuros).toFixed(2)} €
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  )
                ) : null}
              </div>
            </div>

          </div>
        ) : (
          <FormSection
            icon={List}
            title="Lignes de l'écriture (mode avancé)"
            description="Choisissez le journal, puis au moins deux lignes avec débit et crédit équilibrés."
          >
            <div className={styles.advancedJournalField}>
              <label className={forms.label} htmlFor="saisie-journal">
                Journal
              </label>
              <div className={styles.advancedJournalSelect}>
                <AppSearchableSelect
                  id="saisie-journal"
                  inputId="saisie-journal"
                  options={journalOptions}
                  value={journalValue}
                  onChange={(v) => setSelectedJournalId(v || journaux[0]?.id || '')}
                  placeholder="Journal"
                  isClearable={false}
                  noOptionsMessage={() => 'Aucun journal'}
                />
              </div>
            </div>
            <table className={styles.table}>
              <thead>
                <tr className={styles.tableHeadRow}>
                  <th className={styles.thCompte}>Compte</th>
                  <th className={styles.thAmount}>Débit (€)</th>
                  <th className={styles.thAmount}>Crédit (€)</th>
                  <th className={styles.thActions} />
                </tr>
              </thead>
              <tbody>
                {lignes.map((ligne, i) => (
                  <tr key={i} className={styles.tableRow}>
                    <td className={styles.tdCompte}>
                      <AppSearchableSelect
                        id={`saisie-ligne-compte-${i}`}
                        inputId={`saisie-ligne-compte-${i}`}
                        options={compteOptions}
                        value={compteOptions.find((o) => o.value === ligne.compteId) ?? null}
                        onChange={(v) => updateLigne(i, 'compteId', v ?? '')}
                        placeholder="Rechercher un compte..."
                        noOptionsMessage={() => 'Aucun compte trouvé'}
                        elevatedZIndex
                      />
                    </td>
                    <td className={styles.tdAmount}>
                      <label className="sr-only" htmlFor={`saisie-ligne-debit-${i}`}>
                        Débit ligne {i + 1}
                      </label>
                      <NumberInput
                        id={`saisie-ligne-debit-${i}`}
                        step="0.01"
                        min="0"
                        value={ligne.debit || ''}
                        onChange={(e) => updateLigne(i, 'debit', parseFloat(e.target.value) || 0)}
                        className={forms.input}
                      />
                    </td>
                    <td className={styles.tdAmount}>
                      <label className="sr-only" htmlFor={`saisie-ligne-credit-${i}`}>
                        Crédit ligne {i + 1}
                      </label>
                      <NumberInput
                        id={`saisie-ligne-credit-${i}`}
                        step="0.01"
                        min="0"
                        value={ligne.credit || ''}
                        onChange={(e) => updateLigne(i, 'credit', parseFloat(e.target.value) || 0)}
                        className={forms.input}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.removeRowBtn}
                        onClick={() => removeLigne(i)}
                        disabled={lignes.length <= 2}
                        title="Supprimer la ligne"
                        aria-label="Supprimer la ligne"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className={styles.advancedFooter}>
              <button type="button" onClick={addLigne} className={`btn ${forms.btnSecondary}`}>
                + Ajouter une ligne
              </button>
              <div className={`${styles.totals} ${!isEquilibre ? styles.totalMismatch : ''}`}>
                <span>Total Débit : {totalDebit.toFixed(2)}</span>
                <span>Total Crédit : {totalCredit.toFixed(2)}</span>
              </div>
            </div>

            <div className={`${forms.field} ${styles.advancedEntryDocs}`}>
              <div className={styles.quickDocsHeader}>
                <label className={forms.label} htmlFor={`${componentId}-saisie-advanced-doc-0`}>
                  Pièces justificatives (optionnel)
                </label>
                <button
                  type="button"
                  className={styles.addDocBtn}
                  onClick={addAdvancedDocumentInput}
                  title="Ajouter un justificatif"
                  aria-label="Ajouter un justificatif"
                >
                  <Plus size={16} aria-hidden="true" />
                </button>
              </div>

              <div className={styles.quickDocsCell}>
                {advancedEntryDocuments.map((file, docIndex) => {
                  const inputId = `${componentId}-saisie-advanced-doc-${docIndex}`
                  return (
                    <div key={docIndex} className={styles.quickDocRow}>
                      <label className="sr-only" htmlFor={inputId}>
                        Pièce justificative — fichier {docIndex + 1}
                      </label>
                      <input
                        key={`${fileInputsResetKey}-${inputId}`}
                        id={inputId}
                        type="file"
                        accept="application/pdf,image/jpeg,image/png,image/webp"
                        onChange={(e) => updateAdvancedDocument(docIndex, e.target.files?.[0] ?? null)}
                        className={forms.fileInput}
                      />
                      <button
                        type="button"
                        className={styles.removeDocBtn}
                        onClick={() => removeAdvancedDocument(docIndex)}
                        title="Retirer ce justificatif"
                        aria-label="Retirer ce justificatif"
                      >
                        <X size={16} aria-hidden="true" />
                      </button>
                      <div className={styles.quickDocFileNameRow}>
                        {file?.name ? <span className={styles.docFileName}>{file.name}</span> : null}
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className={styles.fileHint}>
                Les justificatifs sont rattachés à l&apos;ensemble de l&apos;écriture.
              </p>
            </div>
          </FormSection>
        )}

        <div className={styles.submitRow}>
          {mode === 'TREASURY' ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={
                !treasuryOpenItems ||
                treasuryOpenItems.length === 0 ||
                !treasuryAllocationMatchesAmount ||
                montant <= 0
              }
              onClick={handleTreasurySave}
            >
              Enregistrer l&apos;écriture
            </button>
          ) : (
            <button
              type="submit"
              className="btn btn-primary"
              disabled={mode === 'AVANCE' && (!isEquilibre || totalDebit <= 0)}
            >
              Enregistrer l&apos;écriture
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
