'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { ArrowLeftRight, Plus, ShoppingCart, TrendingUp, X } from 'lucide-react'
import AppSearchableSelect from '@/components/forms/AppSearchableSelect'
import forms from '@/components/forms/forms.module.css'
import { NumberInput } from '@/components/forms/NumberInput'
import { formatEurosFromCents, normalizeEurosAmount } from '@/lib/money'
import { VAT_RATE_OPTIONS } from '@/lib/vatRates'
import styles from './saisieForm.module.css'
import { useSaisieFormContext } from './saisieFormContext'

export default function SaisieFormOperationsPanel() {
  const {
    componentId,
    typeOperation,
    switchTypeOperation,
    montant,
    setMontant,
    showVatUi,
    vatRatePercent,
    setVatRatePercent,
    vatPreview,
    showPaidQuestion,
    dejaRegle,
    setDejaRegle,
    supplierId,
    setSupplierId,
    customerId,
    setCustomerId,
    setShowSupplierCreate,
    setShowCustomerCreate,
    settlementPreview,
    encaissementPreview,
    supplierOptions,
    customerOptions,
    paiementOptions,
    operationOptions,
    comptePaiementId,
    setComptePaiementId,
    compteOperationId,
    setCompteOperationId,
    showQuickJustificatifs,
    quickDocuments,
    fileInputsResetKey,
    addQuickDocumentInput,
    updateQuickDocument,
    removeQuickDocument,
  } = useSaisieFormContext()

  return (
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
                    data-testid="saisie-operation-recette"
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
  )
}
