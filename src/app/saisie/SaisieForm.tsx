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
import { useRouter } from 'next/navigation'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { List, Plus, X } from 'lucide-react'
import AppSearchableSelect from '@/components/forms/AppSearchableSelect'
import FormSection from '@/components/forms/FormSection'
import CounterpartyCreateDialog from '@/components/CounterpartyCreateDialog'
import forms from '@/components/forms/forms.module.css'
import styles from './saisieForm.module.css'
import {
  COUNTERPARTY_KIND_CUSTOMER,
  COUNTERPARTY_KIND_SUPPLIER,
} from '@/lib/counterparty'
import { formatEurosFromCents } from '@/lib/money'
import { splitTtcToHtAndVatEuros } from '@/lib/vatSplit'
import { VAT_RATE_OPTIONS } from '@/lib/vatRates'
import type { QuickVatInput } from '@/lib/vatQuickEntry'

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
}: {
  journaux: Journal[]
  comptes: Compte[]
  fournisseurs: CounterpartyLite[]
  clients: CounterpartyLite[]
  exerciceId: string
  exerciceStartDate: string
  exerciceEndDate: string
  vatLiable: boolean
}) {
  const router = useRouter()
  const componentId = useId()
  const [mode, setMode] = useState<'RAPIDE' | 'AVANCE'>('RAPIDE')
  const [date, setDate] = useState<Date | null>(() => new Date())
  const [libelle, setLibelle] = useState('')
  const [selectedJournalId, setSelectedJournalId] = useState<string>(journaux[0]?.id || '')

  const [lignes, setLignes] = useState<LigneForm[]>([
    { compteId: '', debit: 0, credit: 0 },
    { compteId: '', debit: 0, credit: 0 },
  ])

  const [comptePaiementId, setComptePaiementId] = useState<string | null>(null)
  const [compteOperationId, setCompteOperationId] = useState<string | null>(null)
  const [typeOperation, setTypeOperation] = useState<TypeOperation>('DEPENSE')
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

  const [quickDocuments, setQuickDocuments] = useState<(File | null)[]>([null])
  const [lineDocuments, setLineDocuments] = useState<(File | null)[][]>([[null], [null]])
  const [fileInputsResetKey, setFileInputsResetKey] = useState(0)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const exerciceStart = new Date(exerciceStartDate)
  const exerciceEnd = new Date(exerciceEndDate)
  const calendarMaxDate = new Date(Math.min(new Date().getTime(), exerciceEnd.getTime()))

  const totalDebit = lignes.reduce((s, l) => s + (l.debit || 0), 0)
  const totalCredit = lignes.reduce((s, l) => s + (l.credit || 0), 0)
  const isEquilibre = Math.abs(totalDebit - totalCredit) < 0.01

  const compteOptions = comptes.map((c) => ({ value: c.id, label: `${c.numero} - ${c.libelle}` }))
  const paiementOptions = compteOptions.filter((o) => o.label.startsWith('5'))

  const operationOptions = compteOptions.filter((o) => {
    if (typeOperation === 'DEPENSE') return o.label.startsWith('6') || o.label.startsWith('2')
    if (typeOperation === 'RECETTE') return o.label.startsWith('7') || o.label.startsWith('1')
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
    if (typeOperation !== 'REGLEMENT_FOURNISSEUR' || !supplierId) {
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
  }, [typeOperation, supplierId, exerciceId])

  useEffect(() => {
    if (typeOperation !== 'ENCAISSEMENT_CLIENT' || !customerId) {
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
  }, [typeOperation, customerId, exerciceId])

  const showPaidQuestion =
    typeOperation === 'DEPENSE' || typeOperation === 'RECETTE'

  const showVatUi =
    vatLiable && (typeOperation === 'DEPENSE' || typeOperation === 'RECETTE')

  const vatPreview =
    showVatUi && vatRatePercent > 0 && montant > 0
      ? splitTtcToHtAndVatEuros(montant, vatRatePercent)
      : null

  const addLigne = () => {
    setLignes([...lignes, { compteId: '', debit: 0, credit: 0 }])
    setLineDocuments((prev) => [...prev, [null]])
  }

  const removeLigne = (index: number) => {
    if (lignes.length <= 2) return
    const newLignes = [...lignes]
    newLignes.splice(index, 1)
    setLignes(newLignes)
    setLineDocuments((prev) => {
      const next = [...prev]
      next.splice(index, 1)
      return next
    })
  }

  const updateLigne = (index: number, field: keyof LigneForm, value: string | number) => {
    const newLignes = [...lignes]
    if (field === 'debit' && Number(value) > 0) newLignes[index].credit = 0
    if (field === 'credit' && Number(value) > 0) newLignes[index].debit = 0
    newLignes[index][field] = value as never
    setLignes(newLignes)
  }

  const addDocumentInputForLine = (lineIndex: number) => {
    setLineDocuments((prev) => {
      const next = [...prev]
      next[lineIndex] = [...(next[lineIndex] ?? [null]), null]
      return next
    })
  }

  const updateDocumentForLine = (lineIndex: number, docIndex: number, file: File | null) => {
    setLineDocuments((prev) => {
      const next = [...prev]
      const docs = [...(next[lineIndex] ?? [null])]
      docs[docIndex] = file
      next[lineIndex] = docs
      return next
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

    let journalId = (mode === 'RAPIDE' ? autoJournalId : null) || selectedJournalId || journaux[0]?.id

    if (!date) {
      setError('Veuillez choisir une date.')
      return
    }

    const dateStr = calendarDateInTimeZone(date, ENTRY_DATE_TIMEZONE)
    if (isEntryDateAfterToday(dateStr)) {
      setError("La date d'écriture ne peut pas être dans le futur.")
      return
    }

    if (mode === 'RAPIDE') {
      if (montant <= 0) {
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
          { compteId: c401.id, debit: montant, credit: 0 },
          { compteId: comptePaiementId, debit: 0, credit: montant },
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
          { compteId: comptePaiementId, debit: montant, credit: 0 },
          { compteId: c411.id, debit: 0, credit: montant },
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
          { compteId: compteOperationId, debit: montant, credit: 0 },
          { compteId: comptePaiementId, debit: 0, credit: montant },
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
            amountTtcEuros: montant,
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
            amountTtcEuros: montant,
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
            amountTtcEuros: montant,
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
            amountTtcEuros: montant,
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
            { compteId: compteOperationId, debit: montant, credit: 0 },
            { compteId: comptePaiementId, debit: 0, credit: montant },
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
            { compteId: compteOperationId, debit: montant, credit: 0 },
            { compteId: c401.id, debit: 0, credit: montant },
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
            { compteId: comptePaiementId, debit: montant, credit: 0 },
            { compteId: compteOperationId, debit: 0, credit: montant },
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
            { compteId: c411.id, debit: montant, credit: 0 },
            { compteId: compteOperationId, debit: 0, credit: montant },
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
          ? lineDocuments.map((docs) => docs.filter((d): d is File => d != null))
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
        setLineDocuments([[null], [null]])
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
          className={`btn ${mode === 'RAPIDE' ? 'btn-primary' : ''} ${mode === 'RAPIDE' ? styles.modeBtnActive : ''} ${styles.modeBtn}`}
          onClick={() => {
            setMode('RAPIDE')
            setError('')
            setSuccess('')
          }}
        >
          Saisie Rapide (Recommandé)
        </button>
        <button
          type="button"
          className={`btn ${mode === 'AVANCE' ? 'btn-primary' : ''} ${mode === 'AVANCE' ? styles.modeBtnActive : ''} ${styles.modeBtn}`}
          onClick={() => {
            setMode('AVANCE')
            setError('')
            setSuccess('')
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
              {mode === 'RAPIDE'
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

        {mode === 'RAPIDE' ? (
          <div className={styles.quickPanel}>
            <div className={styles.quickGridTop}>
              <div className={`${forms.field} ${styles.operationField}`}>
                <span className={forms.label}>Type d&apos;opération</span>
                <div className={styles.operationStripWrap} role="group" aria-label="Type d'opération">
                  <button
                    type="button"
                    className={`${styles.operationBtn} ${typeOperation === 'DEPENSE' ? styles.operationBtnDepenseActive : ''}`}
                    onClick={() => switchTypeOperation('DEPENSE')}
                  >
                    Dépense
                  </button>
                  <button
                    type="button"
                    className={`${styles.operationBtn} ${styles.operationBtnBorder} ${typeOperation === 'RECETTE' ? styles.operationBtnRecetteActive : ''}`}
                    onClick={() => switchTypeOperation('RECETTE')}
                  >
                    Recette
                  </button>
                  <button
                    type="button"
                    className={`${styles.operationBtn} ${styles.operationBtnBorder} ${typeOperation === 'TRANSFERT' ? styles.operationBtnTransfertActive : ''}`}
                    onClick={() => switchTypeOperation('TRANSFERT')}
                  >
                    Virement
                  </button>
                  <button
                    type="button"
                    className={`${styles.operationBtn} ${styles.operationBtnBorder} ${typeOperation === 'REGLEMENT_FOURNISSEUR' ? styles.operationBtnReglementActive : ''}`}
                    onClick={() => switchTypeOperation('REGLEMENT_FOURNISSEUR')}
                  >
                    Règlement fournisseur
                  </button>
                  <button
                    type="button"
                    className={`${styles.operationBtn} ${styles.operationBtnBorder} ${typeOperation === 'ENCAISSEMENT_CLIENT' ? styles.operationBtnEncaissementActive : ''}`}
                    onClick={() => switchTypeOperation('ENCAISSEMENT_CLIENT')}
                  >
                    Encaissement client
                  </button>
                </div>
              </div>

              <div className={forms.field}>
                <label className={forms.label} htmlFor="saisie-montant">
                  {showVatUi ? 'Montant TTC (€)' : 'Montant (€)'}
                </label>
                <input
                  id="saisie-montant"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={montant || ''}
                  onChange={(e) => setMontant(parseFloat(e.target.value) || 0)}
                  required
                  className={forms.input}
                />
              </div>
            </div>

            {showVatUi ? (
              <div className={styles.quickGridAccounts}>
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
                  {vatPreview ? (
                    <p className={forms.fieldHint}>
                      HT : {vatPreview.htEuros.toFixed(2)} € · TVA : {vatPreview.vatEuros.toFixed(2)} €
                    </p>
                  ) : null}
                </div>
                <div aria-hidden="true" />
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
              <div className={styles.quickGridAccounts}>
                {(typeOperation === 'DEPENSE' && !dejaRegle) || (typeOperation === 'RECETTE' && !dejaRegle) ? (
                  <div className={forms.field}>
                    <label className={forms.label} htmlFor="saisie-tiers-dette">
                      {typeOperation === 'DEPENSE' ? 'Fournisseur' : 'Client'}{' '}
                      <span className={styles.requiredMark}>(obligatoire)</span>
                    </label>
                    <div className={styles.tiersRow}>
                      <div className={styles.tiersSelect}>
                        <AppSearchableSelect
                          id="saisie-tiers-dette"
                          inputId="saisie-tiers-dette"
                          options={typeOperation === 'DEPENSE' ? supplierOptions : customerOptions}
                          value={
                            typeOperation === 'DEPENSE'
                              ? supplierOptions.find((o) => o.value === supplierId) ?? null
                              : customerOptions.find((o) => o.value === customerId) ?? null
                          }
                          onChange={(v) => (typeOperation === 'DEPENSE' ? setSupplierId(v) : setCustomerId(v))}
                          placeholder={typeOperation === 'DEPENSE' ? 'Fournisseur' : 'Client'}
                          noOptionsMessage={() => 'Aucun résultat'}
                          elevatedZIndex
                        />
                      </div>
                      <button
                        type="button"
                        className={`btn btn-primary ${forms.btnWithLeadingIcon}`}
                        onClick={() =>
                          typeOperation === 'DEPENSE' ? setShowSupplierCreate(true) : setShowCustomerCreate(true)
                        }
                        title={typeOperation === 'DEPENSE' ? 'Créer un fournisseur' : 'Créer un client'}
                        aria-label={typeOperation === 'DEPENSE' ? 'Créer un fournisseur' : 'Créer un client'}
                      >
                        <Plus size={18} aria-hidden="true" />
                        {typeOperation === 'DEPENSE' ? 'Nouveau fournisseur' : 'Nouveau client'}
                      </button>
                    </div>
                  </div>
                ) : null}

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
                ) : null}

                {typeOperation === 'DEPENSE' && dejaRegle ? (
                  <div className={forms.field}>
                    <label className={forms.label} htmlFor="saisie-fournisseur-optionnel">
                      Fournisseur (optionnel)
                    </label>
                    <div className={styles.tiersRow}>
                      <div className={styles.tiersSelect}>
                        <AppSearchableSelect
                          id="saisie-fournisseur-optionnel"
                          inputId="saisie-fournisseur-optionnel"
                          options={supplierOptions}
                          value={supplierOptions.find((o) => o.value === supplierId) ?? null}
                          onChange={(v) => setSupplierId(v)}
                          placeholder="—"
                          isClearable
                          noOptionsMessage={() => 'Aucun résultat'}
                          elevatedZIndex
                        />
                      </div>
                      <button
                        type="button"
                        className={`btn btn-primary ${forms.btnWithLeadingIcon}`}
                        onClick={() => setShowSupplierCreate(true)}
                        title="Créer un fournisseur"
                        aria-label="Créer un fournisseur"
                      >
                        <Plus size={18} aria-hidden="true" />
                        Nouveau
                      </button>
                    </div>
                  </div>
                ) : null}

                {typeOperation === 'RECETTE' && dejaRegle ? (
                  <div className={forms.field}>
                    <label className={forms.label} htmlFor="saisie-client-optionnel">
                      Client (optionnel)
                    </label>
                    <div className={styles.tiersRow}>
                      <div className={styles.tiersSelect}>
                        <AppSearchableSelect
                          id="saisie-client-optionnel"
                          inputId="saisie-client-optionnel"
                          options={customerOptions}
                          value={customerOptions.find((o) => o.value === customerId) ?? null}
                          onChange={(v) => setCustomerId(v)}
                          placeholder="—"
                          isClearable
                          noOptionsMessage={() => 'Aucun résultat'}
                          elevatedZIndex
                        />
                      </div>
                      <button
                        type="button"
                        className={`btn btn-primary ${forms.btnWithLeadingIcon}`}
                        onClick={() => setShowCustomerCreate(true)}
                        title="Créer un client"
                        aria-label="Créer un client"
                      >
                        <Plus size={18} aria-hidden="true" />
                        Nouveau
                      </button>
                    </div>
                  </div>
                ) : null}

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
        ) : (
          <FormSection
            icon={List}
            title="Lignes de l'écriture (mode avancé)"
            description="Choisissez le journal, puis au moins deux lignes avec débit et crédit équilibrés."
          >
            <div className={styles.advancedHeader}>
              <h3 className={styles.advancedTitle}>Journal et lignes</h3>
              <div className={styles.journalField}>
                <label className={forms.label} htmlFor="saisie-journal">
                  Journal
                </label>
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
                  <th className={styles.thDocs}>Justificatifs</th>
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
                      <input
                        id={`saisie-ligne-debit-${i}`}
                        type="number"
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
                      <input
                        id={`saisie-ligne-credit-${i}`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={ligne.credit || ''}
                        onChange={(e) => updateLigne(i, 'credit', parseFloat(e.target.value) || 0)}
                        className={forms.input}
                      />
                    </td>
                    <td className={styles.tdDocs}>
                      <div className={styles.docsCell}>
                        {(lineDocuments[i] ?? [null]).map((file, docIndex) => {
                          const inputId = `${componentId}-saisie-ligne-doc-${i}-${docIndex}`
                          return (
                            <div key={docIndex} className={styles.docRow}>
                              <label className="sr-only" htmlFor={inputId}>
                                Pièce justificative ligne {i + 1} — fichier {docIndex + 1}
                              </label>
                              <input
                                key={`${fileInputsResetKey}-${inputId}`}
                                id={inputId}
                                type="file"
                                accept="application/pdf,image/jpeg,image/png,image/webp"
                                onChange={(e) => updateDocumentForLine(i, docIndex, e.target.files?.[0] ?? null)}
                                className={forms.fileInput}
                              />
                              {file?.name ? <span className={styles.docFileName}>{file.name}</span> : null}
                            </div>
                          )
                        })}

                        <button
                          type="button"
                          className={styles.addDocBtn}
                          onClick={() => addDocumentInputForLine(i)}
                          title="Ajouter un justificatif"
                          aria-label="Ajouter un justificatif"
                        >
                          <Plus size={16} aria-hidden="true" />
                        </button>
                      </div>
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
          </FormSection>
        )}

        <div className={styles.submitRow}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={mode === 'AVANCE' && (!isEquilibre || totalDebit <= 0)}
          >
            Enregistrer l&apos;écriture
          </button>
        </div>
      </form>
    </div>
  )
}
