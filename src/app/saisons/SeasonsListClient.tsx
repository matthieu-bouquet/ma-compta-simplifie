'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2 } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import styles from '../vie-asso.module.css'
import { deleteMembershipSeason } from '@/actions/seasonActions'
import { appToast } from '@/lib/appToast'

export default function SeasonsListClient({
  seasons,
}: {
  seasons: { id: string; label: string; tariffCount: number; closed: boolean }[]
}) {
  const router = useRouter()
  if (seasons.length === 0) {
    return (
      <div className="card">
        <p>Aucune saison. Créez-en une pour ouvrir les adhésions.</p>
      </div>
    )
  }
  return (
    <div className="card">
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Saison</th>
              <th className={styles.th}>Statut</th>
              <th className={styles.th}>Tarifs</th>
              <th className={`${styles.th} ${styles.actionsCell}`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {seasons.map((s) => (
              <tr key={s.id}>
                <td className={styles.td}>{s.label}</td>
                <td className={styles.td}>
                  {s.closed ? <span className={styles.statusClosed}>Clôturée</span> : 'Ouverte'}
                </td>
                <td className={styles.td}>{s.tariffCount}</td>
                <td className={`${styles.td} ${styles.actionsCell}`}>
                  <Link
                    href={`/saisons/${s.id}/edit`}
                    className={styles.iconBtn}
                    title="Modifier la saison"
                    aria-label={`Modifier ${s.label}`}
                  >
                    <Pencil size={16} aria-hidden="true" />
                  </Link>
                  {!s.closed ? (
                    <ConfirmDialog
                      title="Supprimer cette saison ?"
                      description="Impossible s’il existe déjà des adhésions."
                      confirmText="Supprimer"
                      onConfirm={async () => {
                        await deleteMembershipSeason(s.id)
                        appToast.success('Saison supprimée.')
                        router.refresh()
                      }}
                      trigger={({ open }) => (
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={open}
                          title="Supprimer"
                          aria-label={`Supprimer ${s.label}`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      )}
                    />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
