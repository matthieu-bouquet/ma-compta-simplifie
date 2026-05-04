import styles from './DocumentViewer.module.css'
import type { ReactNode } from 'react'

function isPdf(mimeType: string | null | undefined) {
  return (mimeType ?? '').toLowerCase() === 'application/pdf'
}

function isImage(mimeType: string | null | undefined) {
  return (mimeType ?? '').toLowerCase().startsWith('image/')
}

export default function DocumentViewer({
  documentId,
  mimeType,
  title,
  actions,
  showHeader = true,
}: {
  documentId: string
  mimeType?: string | null
  title?: string
  actions?: ReactNode
  showHeader?: boolean
}) {
  const viewHref = `/api/documents/${encodeURIComponent(documentId)}/download?inline=1`

  return (
    <div className={styles.viewerRoot}>
      {showHeader ? (
        <div className={styles.viewerHeader}>
          <div className={styles.viewerTitle}>{title ?? 'Aperçu du document'}</div>
          {actions ? <div className={styles.viewerActions}>{actions}</div> : null}
        </div>
      ) : null}

      {isPdf(mimeType) ? (
        <div className={styles.frame}>
          <iframe className={styles.iframe} src={viewHref} title={title ?? 'Document'} />
        </div>
      ) : isImage(mimeType) ? (
        <div className={styles.frame}>
          <img className={styles.image} src={viewHref} alt={title ?? 'Document'} />
        </div>
      ) : (
        <div className={styles.unsupported}>
          <div className={styles.unsupportedTitle}>Aperçu non disponible</div>
          <div>Ce format ne peut pas être affiché ici. Téléchargez le document pour l’ouvrir.</div>
        </div>
      )}
    </div>
  )
}

