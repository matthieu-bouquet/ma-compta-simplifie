'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { BookCheck, FileDown } from 'lucide-react'
import { postInvoiceToAccounting } from '@/actions/invoiceActions'
import { appToast } from '@/lib/appToast'
import { formatEurosFromCents } from '@/lib/money'
import styles from './factures.module.css'

export type InvoiceListRow = {
  id: string
  number: string
  issueDate: Date
  recipientName: string
  totalCents: number
  entryId: string | null
  counterpartyId: string | null
}

function formatDateFr(d: Date) {
  return new Date(d).toLocaleDateString('fr-FR')
}

export default function InvoicesTableClient({
  rows,
  canPostToAccounting,
}: {
  rows: InvoiceListRow[]
  canPostToAccounting: boolean
}) {
  const router = useRouter()
  const [postingId, setPostingId] = useState<string | null>(null)

  async function handlePostToAccounting(row: InvoiceListRow) {
    setPostingId(row.id)
    try {
      await postInvoiceToAccounting(row.id)
      appToast.success(`Facture ${row.number} envoyée en compta.`)
      router.refresh()
    } catch (err) {
      appToast.error(err instanceof Error ? err.message : 'Erreur lors de l’envoi en compta.')
    } finally {
      setPostingId(null)
    }
  }

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
              <th className={`${styles.th} ${styles.actionsCell}`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const showPostButton =
                canPostToAccounting && !row.entryId && Boolean(row.counterpartyId)

              return (
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
                    <div className={styles.rowActions}>
                      {showPostButton ? (
                        <button
                          type="button"
                          className={`btn ${styles.iconBtn}`}
                          title="Envoyer en compta (créance client, non réglée)"
                          aria-label={`Envoyer la facture ${row.number} en compta`}
                          disabled={postingId === row.id}
                          onClick={() => void handlePostToAccounting(row)}
                        >
                          <BookCheck size={18} aria-hidden="true" />
                        </button>
                      ) : null}
                      <Link
                        href={`/api/factures/${row.id}/pdf`}
                        className={`btn ${styles.iconBtn}`}
                        title="Télécharger le PDF"
                        aria-label={`Télécharger la facture ${row.number}`}
                      >
                        <FileDown size={18} aria-hidden="true" />
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
