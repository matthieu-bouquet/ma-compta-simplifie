'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Pencil, Trash2, Upload } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import forms from '@/components/forms/forms.module.css'
import styles from '../vie-asso.module.css'
import { deleteMember, importMembersFromCsv } from '@/actions/memberActions'
import { formatEurosFromCents } from '@/lib/money'
import { appToast } from '@/lib/appToast'

export type MemberListRow = {
  id: string
  firstName: string
  lastName: string
  email: string | null
  licenseNumber: string | null
  categoryName: string | null
  feeStatus: string | null
  feeAmountCents: number | null
}

export default function MembersTableClient({ members }: { members: MemberListRow[] }) {
  const router = useRouter()
  const [csvText, setCsvText] = useState('')
  const [pending, setPending] = useState(false)

  async function handleImport(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    try {
      const res = await importMembersFromCsv({ csvText })
      appToast.success(`${res.createdCount} adhérent(s) importé(s).`)
      setCsvText('')
      router.refresh()
    } catch (err) {
      appToast.error(err instanceof Error ? err.message : 'Erreur lors de l’import.')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <div className={styles.kpiGrid}>
        <div className="card">
          <p className={styles.lead}>Adhérents</p>
          <p className={styles.kpiValue}>{members.length}</p>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleImport}>
          <div className={forms.field}>
            <label className={forms.label} htmlFor="members-csv">
              Import CSV (nom;prenom;email;telephone;categorie;numero_licence)
            </label>
            <textarea
              id="members-csv"
              className={forms.textarea}
              rows={5}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              required
            />
          </div>
          <button type="submit" className={`btn btn-primary ${forms.btnWithLeadingIcon}`} disabled={pending}>
            <Upload size={18} aria-hidden="true" />
            Importer
          </button>
        </form>
      </div>

      {members.length === 0 ? (
        <div className="card">
          <p>Aucun adhérent pour le moment.</p>
        </div>
      ) : (
        <div className="card">
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Nom</th>
                  <th className={styles.th}>Catégorie</th>
                  <th className={styles.th}>Licence</th>
                  <th className={styles.th}>Adhésion</th>
                  <th className={`${styles.th} ${styles.actionsCell}`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td className={styles.td}>
                      {m.lastName.toUpperCase()} {m.firstName}
                      {m.email ? (
                        <>
                          <br />
                          <span className={styles.lead}>{m.email}</span>
                        </>
                      ) : null}
                    </td>
                    <td className={styles.td}>{m.categoryName ?? '—'}</td>
                    <td className={styles.td}>{m.licenseNumber ?? '—'}</td>
                    <td className={styles.td}>
                      {m.feeStatus === 'PAID' ? (
                        <span className={styles.statusPaid}>Payée</span>
                      ) : m.feeStatus === 'DUE' ? (
                        <span className={styles.statusDue}>
                          Impayée
                          {m.feeAmountCents != null ? ` (${formatEurosFromCents(m.feeAmountCents)})` : ''}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className={`${styles.td} ${styles.actionsCell}`}>
                      <Link
                        href={`/adherents/${m.id}`}
                        className={styles.iconBtn}
                        title="Fiche adhérent"
                        aria-label={`Fiche de ${m.firstName} ${m.lastName}`}
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </Link>
                      <ConfirmDialog
                        title="Supprimer cet adhérent ?"
                        description="Les adhésions non comptabilisées seront aussi supprimées."
                        confirmText="Supprimer"
                        onConfirm={async () => {
                          await deleteMember(m.id)
                          appToast.success('Adhérent supprimé.')
                          router.refresh()
                        }}
                        trigger={({ open }) => (
                          <button
                            type="button"
                            className={styles.iconBtn}
                            onClick={open}
                            title="Supprimer"
                            aria-label={`Supprimer ${m.firstName} ${m.lastName}`}
                          >
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        )}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
