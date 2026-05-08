// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { prisma } from '@/lib/prisma'
import { getValidatedCurrentAssociationId } from '@/lib/currentAssociationIdValidated'
import LinkDocumentToLignesForm from './LinkDocumentToLignesForm'
import DocumentViewer from '@/components/DocumentViewer'
import PageBackLink from '@/components/PageBackLink'
import { Download } from 'lucide-react'
import styles from './page.module.css'

export default async function LierDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: documentId } = await params
  const associationId = await getValidatedCurrentAssociationId()

  if (!associationId) {
    return (
      <div>
        <div className={styles.pageHeader}>
          <PageBackLink href="/documents" aria-label="Retour à la liste des documents" />
          <h1 className="page-title no-topbar-pad">Lier un document</h1>
        </div>
        <div className="card">
          <p className="text-warning">Sélectionnez une association (menu en haut à droite).</p>
        </div>
      </div>
    )
  }

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      originalName: true,
      uploadedAt: true,
      mimeType: true,
      fiscalYearId: true,
      fiscalYear: { select: { associationId: true, startDate: true } },
      lines: { select: { entryLineId: true } },
    },
  })

  if (!doc || doc.fiscalYear.associationId !== associationId) {
    return (
      <div>
        <div className={styles.pageHeader}>
          <PageBackLink href="/documents" aria-label="Retour à la liste des documents" />
          <h1 className="page-title no-topbar-pad">Lier un document</h1>
        </div>
        <div className="card">
          <p>Document introuvable.</p>
        </div>
      </div>
    )
  }

  const linkedIds = new Set(doc.lines.map((l) => l.entryLineId))

  const lignes = await prisma.entryLine.findMany({
    where: {
      entry: { fiscalYearId: doc.fiscalYearId },
      OR: [{ accountNumber: { startsWith: '6' } }, { accountNumber: { startsWith: '7' } }],
    },
    include: { entry: { include: { journal: true } } },
    orderBy: [{ entry: { date: 'desc' } }, { id: 'desc' }],
    take: 1000,
  })

  return (
    <div>
      <div className={styles.pageHeader}>
        <PageBackLink href="/documents" aria-label="Retour à la liste des documents" />
        <h1 className="page-title no-topbar-pad">Lier un document</h1>
      </div>

      <div className={`card ${styles.docMetaCard}`}>
        <div className={styles.docName}>{doc.originalName}</div>
        <div className={styles.docSub}>
          Exercice {new Date(doc.fiscalYear.startDate).getFullYear()} — Uploadé le {new Date(doc.uploadedAt).toLocaleDateString('fr-FR')}
        </div>
      </div>

      <div className={styles.split}>
        <div className="card">
          <DocumentViewer
            documentId={doc.id}
            mimeType={doc.mimeType}
            title={doc.originalName}
            actions={
              <a
                className={`btn ${styles.downloadBtn}`}
                href={`/api/documents/${encodeURIComponent(doc.id)}/download`}
                title="Télécharger"
                aria-label="Télécharger"
              >
                <Download size={16} aria-hidden="true" />
                Télécharger
              </a>
            }
          />
        </div>

        <div className="card">
          <LinkDocumentToLignesForm
            documentId={doc.id}
            initialLinkedLigneIds={[...linkedIds]}
            lignes={lignes.map((l) => ({
              id: l.id,
              date: l.entry.date.toISOString(),
              journalCode: l.entry.journal.code,
              libelle: l.entry.description,
              compteNumero: l.accountNumber,
              compteLibelle: l.accountName,
              debit: l.debitCents / 100,
              credit: l.creditCents / 100,
              linked: linkedIds.has(l.id),
            }))}
          />
          <p className={styles.note}>Affichage limité aux 1000 lignes les plus récentes de l’exercice.</p>
        </div>
      </div>
    </div>
  )
}

