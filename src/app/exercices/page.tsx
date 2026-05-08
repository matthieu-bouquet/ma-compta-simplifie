// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { getExercices } from '@/actions/exerciceActions'
import Link from 'next/link'
import ExerciceForm from './ExerciceForm'
import DeleteExerciceButton from './DeleteExerciceButton'
import { getValidatedCurrentAssociationId } from '@/lib/currentAssociationIdValidated'
import EntityRequiredEmptyState from '@/components/EntityRequiredEmptyState'
import { prisma } from '@/lib/prisma'
import { AlertTriangle } from 'lucide-react'
import styles from './page.module.css'

export default async function ExercicesPage() {
  const associationId = await getValidatedCurrentAssociationId()

  if (!associationId) {
    return (
      <div>
        <h1 className="page-title">Exercices Comptables</h1>
        <EntityRequiredEmptyState purpose="exercices" />
      </div>
    )
  }

  const association = await prisma.association.findUnique({
    where: { id: associationId },
    select: { isClosed: true },
  })
  const canCreateFiscalYear = Boolean(association && !association.isClosed)

  const exercices = await getExercices(associationId)

  return (
    <div>
      <h1 className="page-title">Exercices Comptables</h1>

      {!canCreateFiscalYear ? (
        <div className={styles.closedBanner} role="status" aria-live="polite">
          <AlertTriangle size={18} aria-hidden="true" className={styles.closedBannerIcon} />
          <div>
            <p className={styles.closedBannerTitle}>Entité clôturée</p>
            <p className={styles.closedBannerText}>
              La création d’un nouvel exercice est désactivée. Vous pouvez consulter les exercices existants.
            </p>
          </div>
        </div>
      ) : null}
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
        {/* Formulaire de création */}
        <div className="card">
          <h2 className="card-title">Nouvel Exercice</h2>
          {canCreateFiscalYear ? (
            <ExerciceForm associationId={associationId} />
          ) : (
            <div className={styles.disabledNotice}>
              Cette entité est clôturée : la création d’un nouvel exercice est désactivée.
            </div>
          )}
          <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Note: Lors de la création, le plan comptable associatif standard sera automatiquement copié et affecté à ce nouvel exercice.
          </p>
        </div>

        {/* Liste des exercices */}
        <div className="card">
          <h2 className="card-title">Exercices Existants</h2>
          {exercices.length === 0 ? (
            <p>Aucun exercice comptable n&apos;a été créé.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '0.75rem 0' }}>Période</th>
                  <th>Statut</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {exercices.map((ex) => (
                  <tr key={ex.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem 0' }}>
                      {new Date(ex.startDate).toLocaleDateString('fr-FR')} - {new Date(ex.endDate).toLocaleDateString('fr-FR')}
                    </td>
                    <td>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '1rem',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        backgroundColor: ex.status === 'OPEN' ? 'rgba(151, 206, 102, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                        color: ex.status === 'OPEN' ? 'var(--success)' : 'var(--text-secondary)'
                      }}>
                        {ex.status}
                      </span>
                    </td>
                    <td style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center' }}>
                      <Link
                        href={`/exercices/${ex.id}`}
                        className="btn"
                        style={{
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'transparent',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path
                            d="M11.983 13.522a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M20.12 13.09a8.23 8.23 0 0 0 .043-1.09 8.23 8.23 0 0 0-.043-1.09l2.02-1.57a.5.5 0 0 0 .12-.64l-1.91-3.3a.5.5 0 0 0-.6-.22l-2.38.96c-.56-.43-1.17-.79-1.82-1.06l-.36-2.53A.5.5 0 0 0 14.7 2h-3.8a.5.5 0 0 0-.49.42l-.36 2.53c-.65.27-1.26.63-1.82 1.06l-2.38-.96a.5.5 0 0 0-.6.22l-1.91 3.3a.5.5 0 0 0 .12.64l2.02 1.57c-.03.36-.05.73-.05 1.09s.02.73.05 1.09l-2.02 1.57a.5.5 0 0 0-.12.64l1.91 3.3a.5.5 0 0 0 .6.22l2.38-.96c.56.43 1.17.79 1.82 1.06l.36 2.53a.5.5 0 0 0 .49.42h3.8a.5.5 0 0 0 .49-.42l.36-2.53c.65-.27 1.26-.63 1.82-1.06l2.38.96a.5.5 0 0 0 .6-.22l1.91-3.3a.5.5 0 0 0-.12-.64l-2.02-1.57Z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span>Configurer</span>
                      </Link>
                      {ex.status === 'OPEN' && (
                        <DeleteExerciceButton id={ex.id} dateTexte={`${new Date(ex.startDate).getFullYear()}-${new Date(ex.endDate).getFullYear()}`} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
