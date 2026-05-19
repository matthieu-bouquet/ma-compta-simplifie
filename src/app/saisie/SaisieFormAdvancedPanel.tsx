'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { List, Plus, X } from 'lucide-react'
import AppSearchableSelect from '@/components/forms/AppSearchableSelect'
import FormSection from '@/components/forms/FormSection'
import forms from '@/components/forms/forms.module.css'
import { NumberInput } from '@/components/forms/NumberInput'
import styles from './saisieForm.module.css'
import { useSaisieFormContext } from './saisieFormContext'

export default function SaisieFormAdvancedPanel() {
  const {
    componentId,
    journaux,
    setSelectedJournalId,
    journalOptions,
    journalValue,
    lignes,
    compteOptions,
    updateLigne,
    removeLigne,
    addLigne,
    totalDebit,
    totalCredit,
    isEquilibre,
    advancedEntryDocuments,
    fileInputsResetKey,
    addAdvancedDocumentInput,
    updateAdvancedDocument,
    removeAdvancedDocument,
  } = useSaisieFormContext()

  return (
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
  )
}
