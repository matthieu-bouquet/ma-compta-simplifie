'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { HandCoins, TrendingUp } from 'lucide-react'
import AppSearchableSelect from '@/components/forms/AppSearchableSelect'
import forms from '@/components/forms/forms.module.css'
import { NumberInput } from '@/components/forms/NumberInput'
import { formatEurosFromCents, normalizeEurosAmount } from '@/lib/money'
import styles from './saisieForm.module.css'
import { useSaisieFormContext } from './saisieFormContext'

export default function SaisieFormTreasuryPanel() {
  const {
    typeOperation,
    setTypeOperation,
    supplierId,
    setSupplierId,
    customerId,
    setCustomerId,
    supplierOptions,
    customerOptions,
    paiementOptions,
    comptePaiementId,
    setComptePaiementId,
    montant,
    setMontant,
    treasuryOpenItems,
    treasuryAllocationsByLineId,
    setTreasuryAllocationsByLineId,
    setTreasuryOpenItems,
    showTreasuryAllocationBanner,
    treasuryAllocationMatchesAmount,
    treasuryAllocationRemainderEuros,
  } = useSaisieFormContext()

  return (
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
  )
}
