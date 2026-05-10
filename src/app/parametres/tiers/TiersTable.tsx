'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useMemo, useState } from 'react'
import type { Counterparty } from '@prisma/client'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import CounterpartyCreateDialog from '@/components/CounterpartyCreateDialog'
import { deleteCounterparty, updateCounterparty } from '@/actions/counterpartyActions'
import {
  COUNTERPARTY_KIND_CUSTOMER,
  COUNTERPARTY_KIND_SUPPLIER,
} from '@/lib/counterparty'
import forms from '@/components/forms/forms.module.css'
import styles from './tiers.module.css'

export default function TiersTable({ initialRows }: { initialRows: Counterparty[] }) {
  const [rows, setRows] = useState(initialRows)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [error, setError] = useState('')
  const [showSupplierCreate, setShowSupplierCreate] = useState(false)
  const [showCustomerCreate, setShowCustomerCreate] = useState(false)
  const [saving, setSaving] = useState(false)

  const startEdit = (r: Counterparty) => {
    setEditingId(r.id)
    setEditName(r.name)
    setError('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
  }

  const saveEdit = async () => {
    if (!editingId) return
    setSaving(true)
    setError('')
    try {
      const updated = await updateCounterparty({ id: editingId, name: editName })
      setRows((prev) =>
        prev.map((x) => (x.id === updated.id ? { ...x, name: updated.name } : x)).sort(nameKindSort)
      )
      cancelEdit()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    await deleteCounterparty(id)
    setRows((prev) => prev.filter((x) => x.id !== id))
  }

  const confirmDelete = async (id: string, close: () => void) => {
    await handleDelete(id)
    close()
  }

  const suppliers = useMemo(
    () =>
      rows
        .filter((r) => r.kind === COUNTERPARTY_KIND_SUPPLIER)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [rows]
  )

  const customers = useMemo(
    () =>
      rows
        .filter((r) => r.kind === COUNTERPARTY_KIND_CUSTOMER)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [rows]
  )

  const tierSections: {
    key: string
    title: string
    rows: Counterparty[]
    emptyLabel: string
  }[] = [
    {
      key: 'suppliers',
      title: 'Fournisseurs',
      rows: suppliers,
      emptyLabel: 'Aucun fournisseur pour cette entité.',
    },
    {
      key: 'customers',
      title: 'Clients',
      rows: customers,
      emptyLabel: 'Aucun client pour cette entité.',
    },
  ]

  return (
    <div>
      <CounterpartyCreateDialog
        kind={COUNTERPARTY_KIND_SUPPLIER}
        title="Nouveau fournisseur"
        isOpen={showSupplierCreate}
        onClose={() => setShowSupplierCreate(false)}
        onCreated={(row) => {
          setRows((prev) => [...prev, row].sort(nameKindSort))
        }}
      />
      <CounterpartyCreateDialog
        kind={COUNTERPARTY_KIND_CUSTOMER}
        title="Nouveau client"
        isOpen={showCustomerCreate}
        onClose={() => setShowCustomerCreate(false)}
        onCreated={(row) => {
          setRows((prev) => [...prev, row].sort(nameKindSort))
        }}
      />

      <div className={styles.toolbar}>
        <button
          type="button"
          className={`btn btn-primary ${forms.btnWithLeadingIcon}`}
          onClick={() => setShowSupplierCreate(true)}
        >
          <Plus size={18} aria-hidden="true" />
          Nouveau fournisseur
        </button>
        <button
          type="button"
          className={`btn btn-primary ${forms.btnWithLeadingIcon}`}
          onClick={() => setShowCustomerCreate(true)}
        >
          <Plus size={18} aria-hidden="true" />
          Nouveau client
        </button>
      </div>

      {error ? <div className={`card ${forms.alertError}`}>{error}</div> : null}

      {tierSections.map((section) => (
        <section key={section.key} className={styles.section} aria-labelledby={`tiers-${section.key}-heading`}>
          <h2 id={`tiers-${section.key}-heading`} className={styles.sectionTitle}>
            {section.title}
          </h2>
          <div className={`card ${styles.tableCard}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Nom</th>
                  <th className={`${styles.th} ${styles.thActions}`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {section.rows.length === 0 ? (
                  <tr>
                    <td colSpan={2} className={styles.tdEmpty}>
                      {section.emptyLabel}
                    </td>
                  </tr>
                ) : (
                  section.rows.map((r) => (
                    <tr key={r.id}>
                      <td className={styles.td}>
                        {editingId === r.id ? (
                          <input
                            type="text"
                            className={forms.input}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            aria-label={`Nom du tiers ${r.name}`}
                            id={`tier-name-${r.id}`}
                          />
                        ) : (
                          r.name
                        )}
                      </td>
                      <td className={`${styles.td} ${styles.actionsCell}`}>
                        <div className={styles.iconActions}>
                          {editingId === r.id ? (
                            <>
                              <button
                                type="button"
                                className={`btn ${forms.btnSecondary}`}
                                onClick={cancelEdit}
                                disabled={saving}
                              >
                                Annuler
                              </button>
                              <button type="button" className="btn btn-primary" onClick={saveEdit} disabled={saving}>
                                Enregistrer
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className={`btn ${styles.iconButton}`}
                                onClick={() => startEdit(r)}
                                title="Modifier"
                                aria-label="Modifier"
                              >
                                <Pencil size={16} aria-hidden="true" />
                              </button>
                              <ConfirmDialog
                                title="Supprimer le tiers"
                                description={`Supprimer « ${r.name} » ? Impossible s'il est lié à des écritures.`}
                                confirmText="Supprimer"
                                confirmTone="danger"
                                trigger={({ open }) => (
                                  <button
                                    type="button"
                                    className={`btn ${styles.iconButton}`}
                                    onClick={open}
                                    title="Supprimer"
                                    aria-label="Supprimer"
                                  >
                                    <Trash2 size={16} aria-hidden="true" />
                                  </button>
                                )}
                                onConfirm={({ close }) => confirmDelete(r.id, close)}
                              />
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  )
}

function nameKindSort(a: Counterparty, b: Counterparty) {
  const k = a.kind.localeCompare(b.kind)
  if (k !== 0) return k
  return a.name.localeCompare(b.name)
}
