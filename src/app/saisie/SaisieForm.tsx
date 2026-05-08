'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { forwardRef, useId, useState } from 'react'
import { createEcriture } from '@/actions/ecritureActions'
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
import forms from '@/components/forms/forms.module.css'
import styles from './saisieForm.module.css'

type Journal = { id: string; code: string; nom: string }
type Compte = { id: string; numero: string; libelle: string }
type LigneForm = { compteId: string; debit: number; credit: number }

const DateInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function DateInput(
  props,
  ref
) {
  return <input ref={ref} {...props} />
})

export default function SaisieForm({
  journaux,
  comptes,
  exerciceId,
  exerciceStartDate,
  exerciceEndDate,
}: {
  journaux: Journal[]
  comptes: Compte[]
  exerciceId: string
  exerciceStartDate: string
  exerciceEndDate: string
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
  const [typeOperation, setTypeOperation] = useState<'DEPENSE' | 'RECETTE' | 'TRANSFERT'>('DEPENSE')
  const [montant, setMontant] = useState<number>(0)

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

  const journalOptions = journaux.map((j) => ({ value: j.id, label: `${j.code} — ${j.nom}` }))
  const journalValue =
    journaux.find((j) => j.id === selectedJournalId) != null
      ? {
          value: selectedJournalId,
          label: `${journaux.find((j) => j.id === selectedJournalId)!.code} — ${journaux.find((j) => j.id === selectedJournalId)!.nom}`,
        }
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

    const journalByCode = (code: string) => journaux.find((j) => j.code === code)?.id || null
    const autoJournalId =
      typeOperation === 'TRANSFERT'
        ? journalByCode('OD')
        : typeOperation === 'DEPENSE'
          ? journalByCode('AC')
          : journalByCode('VE')

    const journalId = (mode === 'RAPIDE' ? autoJournalId : null) || selectedJournalId || journaux[0]?.id

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
      if (!comptePaiementId || !compteOperationId) {
        setError('Veuillez remplir les deux comptes.')
        return
      }
      if (typeOperation === 'TRANSFERT' && comptePaiementId === compteOperationId) {
        setError('Le compte source et destination doivent être différents.')
        return
      }
      if (montant <= 0) {
        setError('Le montant doit être strictement supérieur à 0.')
        return
      }

      if (typeOperation === 'DEPENSE' || typeOperation === 'TRANSFERT') {
        lignesToSubmit = [
          { compteId: compteOperationId, debit: montant, credit: 0 },
          { compteId: comptePaiementId, debit: 0, credit: montant },
        ]
      } else {
        lignesToSubmit = [
          { compteId: comptePaiementId, debit: montant, credit: 0 },
          { compteId: compteOperationId, debit: 0, credit: montant },
        ]
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
              const docs = quickDocuments.filter((d): d is File => d != null)
              if (docs.length === 0) return undefined

              // In quick mode we attach docs to the "operation" line (category line),
              // not the payment method line.
              const operationLineIndex = typeOperation === 'RECETTE' ? 1 : 0
              return lignesToSubmit.map((_, idx) => (idx === operationLineIndex ? docs : []))
            })()

      await createEcriture({
        date: dateStr,
        libelle,
        journalId,
        exerciceId,
        lignes: lignesToSubmit,
        documentFile: null,
        documentsByLine,
      })
      setSuccess('Écriture enregistrée avec succès.')
      setLibelle('')
      setQuickDocuments([null])
      setFileInputsResetKey((k) => k + 1)
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

  return (
    <div className={styles.root}>
      <div className={styles.modeBar}>
        <button
          type="button"
          className={`btn ${mode === 'RAPIDE' ? 'btn-primary' : ''} ${mode === 'RAPIDE' ? styles.modeBtnActive : styles.modeBtn}`}
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
          className={`btn ${mode === 'AVANCE' ? 'btn-primary' : ''} ${mode === 'AVANCE' ? styles.modeBtnActive : styles.modeBtn}`}
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
              <div className={forms.field}>
                <span className={forms.label}>Type d&apos;opération</span>
                <div className={styles.operationStrip} role="group" aria-label="Type d'opération">
                  <button
                    type="button"
                    className={`${styles.operationBtn} ${typeOperation === 'DEPENSE' ? styles.operationBtnDepenseActive : ''}`}
                    onClick={() => {
                      setTypeOperation('DEPENSE')
                      setCompteOperationId(null)
                    }}
                  >
                    Dépense
                  </button>
                  <button
                    type="button"
                    className={`${styles.operationBtn} ${styles.operationBtnBorder} ${typeOperation === 'RECETTE' ? styles.operationBtnRecetteActive : ''}`}
                    onClick={() => {
                      setTypeOperation('RECETTE')
                      setCompteOperationId(null)
                    }}
                  >
                    Recette
                  </button>
                  <button
                    type="button"
                    className={`${styles.operationBtn} ${styles.operationBtnBorder} ${typeOperation === 'TRANSFERT' ? styles.operationBtnTransfertActive : ''}`}
                    onClick={() => {
                      setTypeOperation('TRANSFERT')
                      setCompteOperationId(null)
                    }}
                  >
                    Virement
                  </button>
                </div>
              </div>

              <div className={forms.field}>
                <label className={forms.label} htmlFor="saisie-montant">
                  Montant (€)
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

            <div className={styles.quickGridAccounts}>
              <div className={forms.field}>
                <label className={forms.label} htmlFor="saisie-compte-paiement">
                  {typeOperation === 'TRANSFERT' ? 'De (Compte source)' : 'Moyen de paiement'}
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
                  {typeOperation === 'DEPENSE'
                    ? 'Catégorie (Charge)'
                    : typeOperation === 'RECETTE'
                      ? 'Catégorie (Produit)'
                      : 'Vers (Compte destination)'}
                </label>
                <AppSearchableSelect
                  id="saisie-compte-operation"
                  inputId="saisie-compte-operation"
                  options={operationOptions}
                  value={operationOptions.find((o) => o.value === compteOperationId) ?? null}
                  onChange={(v) => setCompteOperationId(v)}
                  placeholder={typeOperation === 'TRANSFERT' ? 'Ex: Caisse' : 'Ex: Achats...'}
                  noOptionsMessage={() => 'Aucun compte trouvé'}
                  elevatedZIndex
                />
              </div>
            </div>

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
                Les justificatifs seront rattachés à la ligne de catégorie de l’écriture.
              </p>
            </div>
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
          <button type="submit" className="btn btn-primary" disabled={mode === 'AVANCE' && (!isEquilibre || totalDebit <= 0)}>
            Enregistrer l&apos;écriture
          </button>
        </div>
      </form>
    </div>
  )
}
