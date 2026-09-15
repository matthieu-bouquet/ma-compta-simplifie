'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import Link from 'next/link'
import { Pencil } from 'lucide-react'
import styles from '../vie-asso.module.css'
import { formatEurosFromCents } from '@/lib/money'

export default function AdhesionsTableClient({
  seasonId,
  unpaidCount,
  adhesions,
}: {
  seasonId: string
  unpaidCount: number
  adhesions: {
    id: string
    memberId: string
    firstName: string
    lastName: string
    email: string | null
    categoryName: string
    status: string
    amountCents: number
  }[]
}) {
  return (
    <>
      <div className={styles.kpiGrid}>
        <div className="card">
          <p className={styles.lead}>Adhésions</p>
          <p className={styles.kpiValue}>{adhesions.length}</p>
        </div>
        <div className="card">
          <p className={styles.lead}>Impayées</p>
          <p className={styles.kpiValue}>{unpaidCount}</p>
        </div>
      </div>
      <div className="card">
        <a className="btn" href={`/api/adhesions/relances.csv?seasonId=${encodeURIComponent(seasonId)}`}>
          Exporter les impayés (CSV)
        </a>
        <p className={styles.lead}>
          Publipostage : ouvrez le CSV dans un tableur. Aucun e-mail n’est envoyé par l’application.
        </p>
      </div>
      {adhesions.length === 0 ? (
        <div className="card">
          <p>Aucune adhésion pour cette saison.</p>
        </div>
      ) : (
        <div className="card">
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Nom</th>
                  <th className={styles.th}>Tarif</th>
                  <th className={styles.th}>Statut</th>
                  <th className={`${styles.th} ${styles.actionsCell}`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {adhesions.map((a) => (
                  <tr key={a.id}>
                    <td className={styles.td}>
                      {a.lastName.toUpperCase()} {a.firstName}
                      {a.email ? (
                        <>
                          <br />
                          <span className={styles.lead}>{a.email}</span>
                        </>
                      ) : null}
                    </td>
                    <td className={styles.td}>
                      {a.categoryName} ({formatEurosFromCents(a.amountCents)})
                    </td>
                    <td className={styles.td}>
                      {a.status === 'PAID' ? (
                        <span className={styles.statusPaid}>Payée</span>
                      ) : (
                        <span className={styles.statusDue}>Impayée</span>
                      )}
                    </td>
                    <td className={`${styles.td} ${styles.actionsCell}`}>
                      <Link
                        href={`/adherents/${a.memberId}`}
                        className={styles.iconBtn}
                        title="Fiche adhérent"
                        aria-label={`Fiche de ${a.firstName} ${a.lastName}`}
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </Link>
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
