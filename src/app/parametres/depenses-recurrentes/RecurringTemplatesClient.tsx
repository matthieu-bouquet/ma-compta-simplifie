'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import AppSearchableSelect from '@/components/forms/AppSearchableSelect'
import forms from '@/components/forms/forms.module.css'
import { NumberInput } from '@/components/forms/NumberInput'
import {
  createRecurringExpenseTemplate,
  deleteRecurringExpenseTemplate,
  importEntryTemplatePackAction,
  updateRecurringExpenseTemplate,
  type EntryTemplatePackSummaryDto,
  type RecurringExpenseTemplateDto,
} from '@/actions/recurringExpenseTemplateActions'
import { appToast } from '@/lib/appToast'
import { getPackDisplayName } from '@/lib/entryTemplatePresets'
import { formatEurosFromCents, normalizeEurosAmount } from '@/lib/money'
import type { TypeOperation } from '@/app/saisie/saisieFormTypes'
import styles from './depensesRecurrentes.module.css'

type SelectOption = { value: string; label: string }

const OPERATION_LABELS: Record<TypeOperation, string> = {
  DEPENSE: 'Dépense',
  RECETTE: 'Recette',
  TRANSFERT: 'Virement',
  REGLEMENT_FOURNISSEUR: 'Règlement fournisseur',
  ENCAISSEMENT_CLIENT: 'Encaissement client',
}

type FormState = {
  title: string
  operationType: TypeOperation
  amountEuros: number | null
  counterpartyId: string | null
  operationAccountId: string | null
  treasuryAccountId: string | null
}

const emptyForm = (): FormState => ({
  title: '',
  operationType: 'DEPENSE',
  amountEuros: null,
  counterpartyId: null,
  operationAccountId: null,
  treasuryAccountId: null,
})

export default function RecurringTemplatesClient({
  initialRows,
  initialPackSummaries,
  supplierOptions,
  customerOptions,
  chargeOptions,
  productOptions,
  treasuryOptions,
  accountIdByNumber,
}: {
  initialRows: RecurringExpenseTemplateDto[]
  initialPackSummaries: EntryTemplatePackSummaryDto[]
  supplierOptions: SelectOption[]
  customerOptions: SelectOption[]
  chargeOptions: SelectOption[]
  productOptions: SelectOption[]
  treasuryOptions: SelectOption[]
  accountIdByNumber: Record<string, string>
}) {
  const [rows, setRows] = useState(initialRows)
  const [packSummaries, setPackSummaries] = useState(initialPackSummaries)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [importingPackCode, setImportingPackCode] = useState<string | null>(null)
  const router = useRouter()

  const operationAccountOptions = useMemo(() => {
    if (form.operationType === 'RECETTE') return productOptions
    if (form.operationType === 'TRANSFERT') return treasuryOptions
    return chargeOptions
  }, [form.operationType, chargeOptions, productOptions, treasuryOptions])

  const counterpartyOptions =
    form.operationType === 'RECETTE' ? customerOptions : supplierOptions

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm())
    setShowForm(true)
  }

  const openEdit = (row: RecurringExpenseTemplateDto) => {
    const op = row.operationType as TypeOperation
    setEditingId(row.id)
    setForm({
      title: row.title,
      operationType: op,
      amountEuros: row.amountCents === null ? null : row.amountCents / 100,
      counterpartyId: row.counterpartyId,
      operationAccountId: accountIdByNumber[row.operationAccountNumber] ?? null,
      treasuryAccountId: row.treasuryAccountNumber
        ? accountIdByNumber[row.treasuryAccountNumber] ?? null
        : null,
    })
    setShowForm(true)
  }

  const cancelForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm())
  }

  const numberByAccountId = useMemo(() => {
    const map: Record<string, string> = {}
    for (const [num, id] of Object.entries(accountIdByNumber)) {
      map[id] = num
    }
    return map
  }, [accountIdByNumber])

  const saveForm = async () => {
    setSaving(true)
    try {
      const operationAccountNumber = form.operationAccountId
        ? numberByAccountId[form.operationAccountId]
        : null
      const treasuryAccountNumber = form.treasuryAccountId
        ? numberByAccountId[form.treasuryAccountId]
        : null

      if (!operationAccountNumber) {
        appToast.error('Veuillez choisir un compte.')
        return
      }

      const amountCents =
        form.amountEuros === null || form.amountEuros <= 0
          ? null
          : Math.round(normalizeEurosAmount(form.amountEuros) * 100)

      const payload = {
        title: form.title.trim(),
        operationType: form.operationType,
        amountCents,
        counterpartyId: form.operationType === 'TRANSFERT' ? null : form.counterpartyId,
        operationAccountNumber,
        treasuryAccountNumber:
          form.operationType === 'TRANSFERT' || form.treasuryAccountId
            ? treasuryAccountNumber
            : null,
      }

      if (editingId) {
        const updated = await updateRecurringExpenseTemplate({ id: editingId, payload })
        setRows((prev) =>
          prev
            .map((r) => (r.id === updated.id ? updated : r))
            .sort((a, b) =>
              (a.packCode ?? '').localeCompare(b.packCode ?? '') || a.title.localeCompare(b.title),
            ),
        )
        appToast.success('Modèle mis à jour.')
      } else {
        const created = await createRecurringExpenseTemplate(payload)
        setRows((prev) =>
          [...prev, created].sort(
            (a, b) =>
              (a.packCode ?? '').localeCompare(b.packCode ?? '') || a.title.localeCompare(b.title),
          ),
        )
        appToast.success('Modèle créé.')
      }
      cancelForm()
    } catch (e: unknown) {
      appToast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, close: () => void) => {
    try {
      await deleteRecurringExpenseTemplate(id)
      setRows((prev) => prev.filter((r) => r.id !== id))
      appToast.success('Modèle supprimé.')
      close()
    } catch (e: unknown) {
      appToast.error(e instanceof Error ? e.message : 'Erreur')
    }
  }

  const handleImportPack = async (packCode: string) => {
    setImportingPackCode(packCode)
    try {
      const result = await importEntryTemplatePackAction(packCode)
      const packName = packSummaries.find((p) => p.code === packCode)?.name ?? packCode
      if (result.imported === 0 && result.skipped > 0) {
        appToast.warning(`Le pack « ${packName} » est déjà entièrement importé.`)
      } else {
        appToast.success(
          `Pack « ${packName} » : ${result.imported} modèle(s) importé(s)${result.skipped > 0 ? `, ${result.skipped} déjà présent(s)` : ''}.`,
        )
      }
      setPackSummaries((prev) =>
        prev.map((p) => (p.code === packCode ? { ...p, imported: true } : p)),
      )
      router.refresh()
    } catch (e: unknown) {
      appToast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setImportingPackCode(null)
    }
  }

  const manualImportPacks = packSummaries.filter((p) => !p.imported)

  return (
    <div>
      {packSummaries.length > 0 ? (
        <div className={`card ${styles.panel}`}>
          <h2 className="card-title">Importer un pack</h2>
          <p className={styles.packIntro}>
            Ajoutez des modèles prédéfinis (comptes préremplis, montant à saisir à l’usage).
          </p>
          <ul className={styles.packList}>
            {packSummaries.map((pack) => (
              <li key={pack.code} className={styles.packItem}>
                <div className={styles.packItemBody}>
                  <div className={styles.packItemTitle}>{pack.name}</div>
                  <p className={styles.packItemDescription}>{pack.description}</p>
                </div>
                {pack.imported ? (
                  <span className={styles.packImportedBadge}>Importé</span>
                ) : (
                  <button
                    type="button"
                    className={`btn btn-secondary ${forms.btnWithLeadingIcon}`}
                    disabled={importingPackCode !== null}
                    onClick={() => void handleImportPack(pack.code)}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Importer
                  </button>
                )}
              </li>
            ))}
          </ul>
          {manualImportPacks.length === 0 && packSummaries.every((p) => p.imported) ? (
            <p className={styles.packAllImported}>Tous les packs disponibles sont importés.</p>
          ) : null}
        </div>
      ) : null}

      <div className={styles.toolbar}>
        <button
          type="button"
          className={`btn btn-primary ${forms.btnWithLeadingIcon}`}
          onClick={openCreate}
        >
          <Plus size={16} aria-hidden="true" />
          Nouveau modèle
        </button>
      </div>

      {showForm ? (
        <div className={`card ${styles.panel}`}>
          <h2 className="card-title">{editingId ? 'Modifier le modèle' : 'Nouveau modèle'}</h2>
          <div className={styles.formGrid}>
            <div className={forms.field}>
              <label className={forms.label} htmlFor="ret-title">
                Titre
              </label>
              <input
                id="ret-title"
                className={forms.input}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
              />
            </div>

            <div className={forms.field}>
              <span className={forms.label}>Type d&apos;opération</span>
              <div className={styles.typeStrip} role="group" aria-label="Type d'opération">
                {(['DEPENSE', 'RECETTE', 'TRANSFERT'] as const).map((op) => (
                  <button
                    key={op}
                    type="button"
                    className={`btn btn-secondary ${form.operationType === op ? styles.typeBtnActive : ''}`}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        operationType: op,
                        counterpartyId: null,
                        operationAccountId: null,
                        treasuryAccountId: null,
                      }))
                    }
                  >
                    {OPERATION_LABELS[op]}
                  </button>
                ))}
              </div>
            </div>

            <div className={forms.field}>
              <label className={forms.label} htmlFor="ret-amount">
                Montant (€)
              </label>
              <NumberInput
                id="ret-amount"
                className={forms.input}
                min="0.01"
                step="0.01"
                value={form.amountEuros ?? ''}
                onChange={(e) => {
                  const raw = e.target.value.trim()
                  setForm((f) => ({
                    ...f,
                    amountEuros: raw === '' ? null : normalizeEurosAmount(parseFloat(raw) || 0),
                  }))
                }}
              />
              <p className={styles.fieldHint}>
                Laisser vide si le montant est saisi à chaque utilisation.
              </p>
            </div>

            {form.operationType !== 'TRANSFERT' ? (
              <div className={forms.field}>
                <label className={forms.label} htmlFor="ret-counterparty">
                  {form.operationType === 'RECETTE' ? 'Client' : 'Fournisseur'}
                </label>
                <AppSearchableSelect
                  inputId="ret-counterparty"
                  options={counterpartyOptions}
                  value={
                    counterpartyOptions.find((o) => o.value === form.counterpartyId) ?? null
                  }
                  onChange={(v) => setForm((f) => ({ ...f, counterpartyId: v }))}
                  isClearable
                  placeholder="—"
                />
              </div>
            ) : null}

            <div className={forms.field}>
              <label className={forms.label} htmlFor="ret-operation-account">
                {form.operationType === 'TRANSFERT'
                  ? 'Compte destination'
                  : form.operationType === 'RECETTE'
                    ? 'Compte produit'
                    : 'Compte charge'}
              </label>
              <AppSearchableSelect
                inputId="ret-operation-account"
                options={operationAccountOptions}
                value={
                  operationAccountOptions.find((o) => o.value === form.operationAccountId) ??
                  null
                }
                onChange={(v) => setForm((f) => ({ ...f, operationAccountId: v }))}
                placeholder="Choisir…"
              />
            </div>

            <div className={forms.field}>
              <label className={forms.label} htmlFor="ret-treasury">
                {form.operationType === 'TRANSFERT'
                  ? 'Compte source'
                  : 'Moyen de paiement (optionnel si à payer)'}
              </label>
              <AppSearchableSelect
                inputId="ret-treasury"
                options={treasuryOptions}
                value={
                  treasuryOptions.find((o) => o.value === form.treasuryAccountId) ?? null
                }
                onChange={(v) => setForm((f) => ({ ...f, treasuryAccountId: v }))}
                isClearable={form.operationType !== 'TRANSFERT'}
                placeholder={form.operationType === 'TRANSFERT' ? 'Choisir…' : '— (facture à payer)'}
              />
            </div>

            <div className={forms.formActions}>
              <button type="button" className="btn btn-secondary" onClick={cancelForm} disabled={saving}>
                Annuler
              </button>
              <button type="button" className="btn btn-primary" onClick={saveForm} disabled={saving}>
                {editingId ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className={`card ${styles.tableCard}`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Titre</th>
              <th className={styles.th}>Type</th>
              <th className={styles.th}>Montant</th>
              <th className={styles.th}>Pack</th>
              <th className={styles.th}>Tiers</th>
              <th className={styles.th}>Comptes</th>
              <th className={`${styles.th} ${styles.thActions}`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.tdEmpty}>
                  Aucun modèle pour cette entité.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className={styles.td}>{row.title}</td>
                  <td className={styles.td}>
                    {OPERATION_LABELS[row.operationType as TypeOperation] ?? row.operationType}
                  </td>
                  <td className={styles.td}>
                    {row.amountCents === null
                      ? 'À saisir'
                      : formatEurosFromCents(row.amountCents)}
                  </td>
                  <td className={styles.td}>
                    {row.packCode ? (getPackDisplayName(row.packCode) ?? row.packCode) : 'Personnalisé'}
                  </td>
                  <td className={styles.td}>{row.counterpartyName ?? '—'}</td>
                  <td className={`${styles.td} ${styles.tdAccounts}`}>
                    {row.operationAccountNumber}
                    {row.treasuryAccountNumber ? ` → ${row.treasuryAccountNumber}` : ''}
                  </td>
                  <td className={`${styles.td} ${styles.actionsCell}`}>
                    <div className={styles.iconActions}>
                      <button
                        type="button"
                        className={`btn ${styles.iconButton}`}
                        title="Modifier"
                        aria-label={`Modifier ${row.title}`}
                        onClick={() => openEdit(row)}
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                      <ConfirmDialog
                        title="Supprimer le modèle"
                        description={`Supprimer le modèle « ${row.title} » ?`}
                        confirmText="Supprimer"
                        confirmTone="danger"
                        onConfirm={({ close }) => handleDelete(row.id, close)}
                        trigger={({ open }) => (
                          <button
                            type="button"
                            className={`btn ${styles.iconButton}`}
                            onClick={open}
                            title="Supprimer"
                            aria-label={`Supprimer ${row.title}`}
                          >
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        )}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
