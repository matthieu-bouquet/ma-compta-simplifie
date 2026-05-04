'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import DeleteDocumentButton from './DeleteDocumentButton'
import { Download, Eye, Link2, Search } from 'lucide-react'
import DocumentViewerDialog from '@/components/DocumentViewerDialog'
import FloatingTooltipHost from '@/components/FloatingTooltipHost'
import styles from './DocumentsTableClient.module.css'

type DocRow = {
  id: string
  originalName: string
  mimeType: string
  sizeBytes: number
  uploadedAt: string
  lignesCount: number
}

export default function DocumentsTableClient({ documents }: { documents: DocRow[] }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return documents
    return documents.filter((d) => d.originalName.toLowerCase().includes(q))
  }, [documents, query])

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon} aria-hidden="true">
            <Search size={16} />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher par nom de fichier…"
            className={styles.searchInput}
            aria-label="Rechercher un document"
          />
        </div>
        <div className={styles.count}>
          {filtered.length}/{documents.length}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className={styles.empty}>Aucun document ne correspond à votre recherche.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr className={styles.theadRow}>
                <th className={styles.th}>Nom</th>
                <th className={`${styles.th} ${styles.nowrap}`}>Date</th>
                <th className={`${styles.th} ${styles.nowrap}`}>Taille</th>
                <th className={`${styles.th} ${styles.nowrap}`}>Lignes liées</th>
                <th className={styles.thRight}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => {
                const downloadHref = `/api/documents/${encodeURIComponent(d.id)}/download`
                return (
                  <tr key={d.id} className={styles.tr}>
                    <td className={styles.td}>
                      <div className={styles.docName}>{d.originalName}</div>
                      <div className={styles.docMeta}>{d.mimeType}</div>
                    </td>
                    <td className={`${styles.td} ${styles.nowrap}`}>
                      {new Date(d.uploadedAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className={`${styles.td} ${styles.nowrap}`}>
                      {(d.sizeBytes / (1024 * 1024)).toFixed(2)} Mo
                    </td>
                    <td className={`${styles.td} ${styles.nowrap}`}>{d.lignesCount}</td>
                    <td className={styles.tdRight}>
                      <DocumentViewerDialog
                        documentId={d.id}
                        mimeType={d.mimeType}
                        title={d.originalName}
                        trigger={({ open }) => (
                          <FloatingTooltipHost label="Voir le document">
                            <button
                              type="button"
                              className={`btn ${styles.iconBtn}`}
                              onClick={open}
                              aria-label="Voir le document"
                            >
                              <Eye size={16} aria-hidden="true" />
                            </button>
                          </FloatingTooltipHost>
                        )}
                      />
                      <FloatingTooltipHost label="Télécharger">
                        <a className={`btn ${styles.iconBtn}`} href={downloadHref} aria-label="Télécharger">
                          <Download size={16} aria-hidden="true" />
                        </a>
                      </FloatingTooltipHost>
                      <FloatingTooltipHost label="Lier le document">
                        <Link
                          className={`btn ${styles.iconBtn}`}
                          href={`/documents/${encodeURIComponent(d.id)}/lier`}
                          aria-label="Lier le document"
                        >
                          <Link2 size={16} aria-hidden="true" />
                        </Link>
                      </FloatingTooltipHost>
                      <DeleteDocumentButton documentId={d.id} documentLabel={d.originalName} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

