'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import Link from 'next/link'
import { FileDown } from 'lucide-react'
import { formatEurosFromCents } from '@/lib/money'
import styles from './factures.module.css'

export type InvoiceListRow = {
  id: string
  number: string
  issueDate: Date
  recipientName: string
  totalCents: number
  entryId: string | null
}

function formatDateFr(d: Date) {
  return new Date(d).toLocaleDateString('fr-FR')
}

export default function InvoicesTableClient({ rows }: { rows: InvoiceListRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="card">
        <p>Aucune facture émise pour cet exercice.</p>
      </div>
    )
  }

  return (
    <div className="card">
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr className={styles.theadRow}>
              <th className={styles.th}>N°</th>
              <th className={styles.th}>Date</th>
              <th className={styles.th}>Destinataire</th>
              <th className={styles.th}>Montant TTC</th>
              <th className={styles.th}>Compta</th>
              <th className={`${styles.th} ${styles.actionsCell}`}>PDF</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className={styles.td}>{row.number}</td>
                <td className={styles.td}>{formatDateFr(row.issueDate)}</td>
                <td className={styles.td}>{row.recipientName}</td>
                <td className={styles.td}>{formatEurosFromCents(row.totalCents)}</td>
                <td className={styles.td}>
                  {row.entryId ? (
                    <span className={`${styles.badge} ${styles.badgeOk}`}>En compta</span>
                  ) : (
                    <span className={styles.badge}>Hors compta</span>
                  )}
                </td>
                <td className={`${styles.td} ${styles.actionsCell}`}>
                  <Link
                    href={`/api/factures/${row.id}/pdf`}
                    className={`btn ${styles.iconBtn}`}
                    title="Télécharger le PDF"
                    aria-label={`Télécharger la facture ${row.number}`}
                  >
                    <FileDown size={18} aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
