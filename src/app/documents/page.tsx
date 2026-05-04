import { prisma } from '@/lib/prisma'
import { getCurrentAssociationId } from '@/lib/associationContext'
import { getCurrentExerciceId } from '@/lib/exerciceContext'
import UploadDocumentForm from './UploadDocumentForm'
import DocumentsTableClient from './DocumentsTableClient'
import styles from './page.module.css'

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ exerciceId?: string }>
}) {
  const { exerciceId: spExerciceId } = (await searchParams) ?? {}
  const associationId = await getCurrentAssociationId()
  const cookieExerciceId = await getCurrentExerciceId()

  if (!associationId) {
    return (
      <div>
        <h1 className="page-title">Documents</h1>
        <div className="card">
          <p className="text-warning">Sélectionnez une association (menu en haut à droite) pour accéder aux documents.</p>
        </div>
      </div>
    )
  }

  const fiscalYears = await prisma.fiscalYear.findMany({
    where: { associationId },
    orderBy: { startDate: 'desc' },
  })

  if (fiscalYears.length === 0) {
    return (
      <div>
        <h1 className="page-title">Documents</h1>
        <div className="card">
          <p>Aucun exercice disponible pour cette association.</p>
        </div>
      </div>
    )
  }

  const selectedFiscalYearId =
    (spExerciceId && fiscalYears.some((e) => e.id === spExerciceId)
      ? spExerciceId
      : cookieExerciceId && fiscalYears.some((e) => e.id === cookieExerciceId)
        ? cookieExerciceId
        : fiscalYears.find((e) => e.status === 'OPEN')?.id || fiscalYears[0]?.id) || null

  const fiscalYear = selectedFiscalYearId ? fiscalYears.find((e) => e.id === selectedFiscalYearId) : null

  if (!fiscalYear) {
    return (
      <div>
        <h1 className="page-title">Documents</h1>
        <div className="card">
          <p className="text-warning">Impossible de charger l’exercice sélectionné.</p>
        </div>
      </div>
    )
  }

  const documents = await prisma.document.findMany({
    where: { fiscalYearId: fiscalYear.id },
    orderBy: { uploadedAt: 'desc' },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      uploadedAt: true,
      storedName: true,
      lines: {
        where: {
          entryLine: {
            OR: [{ accountNumber: { startsWith: '5' } }, { accountNumber: { startsWith: '6' } }],
          },
        },
        select: { id: true },
      },
    },
  })

  const zipHref = `/api/exercices/${encodeURIComponent(fiscalYear.id)}/documents.zip`

  return (
    <div>
      <div className={styles.header}>
        <h1 className={`page-title no-topbar-pad ${styles.title}`}>
          Documents — {new Date(fiscalYear.startDate).getFullYear()}
        </h1>
        <a className={`btn btn-primary ${styles.zipButton}`} href={zipHref}>
          Télécharger l’archive (ZIP)
        </a>
      </div>

      <div className={`card ${styles.uploadCard}`}>
        <h2 className="card-title">Uploader une pièce justificative</h2>
        <UploadDocumentForm exerciceId={fiscalYear.id} />
        <p className={styles.uploadHelp}>Formats acceptés: PDF, JPG, PNG, WEBP. Taille max: 20 Mo.</p>
      </div>

      <div className="card">
        <h2 className="card-title">Documents de l’exercice</h2>
        {documents.length === 0 ? (
          <p>Aucun document uploadé pour l’instant.</p>
        ) : (
          <DocumentsTableClient
            documents={documents.map((d) => ({
              id: d.id,
              originalName: d.originalName,
              mimeType: d.mimeType,
              sizeBytes: d.sizeBytes,
              uploadedAt: d.uploadedAt.toISOString(),
              lignesCount: d.lines.length,
            }))}
          />
        )}
      </div>
    </div>
  )
}

