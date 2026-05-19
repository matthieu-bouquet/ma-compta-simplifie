'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useCallback, useEffect, useState, startTransition } from 'react'
import { useParams } from 'next/navigation'
import { Plus } from 'lucide-react'
import ParametreLayout from '@/components/ParametreLayout'
import forms from '@/components/forms/forms.module.css'
import { getAssociation, type AssociationDetail } from '@/actions/associationActions'
import styles from './entityDetail.module.css'

export default function EntityDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const [entity, setEntity] = useState<AssociationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadEntity = useCallback(async () => {
    if (!id) {
      setError('Identifiant entité manquant')
      setLoading(false)
      return
    }
    try {
      const data = await getAssociation(id)
      setEntity(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    startTransition(() => {
      void loadEntity()
    })
  }, [loadEntity])

  if (loading) return <div>Chargement...</div>
  if (error) return <div className="text-danger">{error}</div>
  if (!entity) return <div>Entité non trouvée</div>

  return (
    <ParametreLayout title={entity.name} description="Informations et exercices de l'entité">
      <div className={styles.topActions}>
        <a href={`/parametres/entites/${entity.id}/edit`} className={`btn ${styles.btnSecondary}`}>
          Modifier
        </a>
        {!entity.isClosed && (
          <a href={`/exercices/new?associationId=${entity.id}`} className={`btn btn-primary ${forms.btnWithLeadingIcon}`}>
            <Plus size={18} aria-hidden="true" />
            Nouvel exercice
          </a>
        )}
      </div>

      {entity.isClosed && (
        <div className={`card ${styles.closedCard}`}>
          <strong>Entité clôturée.</strong> Vous ne pouvez plus créer de nouvel exercice, mais vous pouvez consulter les exercices existants.
        </div>
      )}

      <div className="card">
        <div className="card-title">Informations générales</div>
        <div className={styles.infoGrid}>
          <div>
            <span className={styles.label}>Forme:</span> {entity.legalFormCode || 'Non renseignée'}
            {entity.legalFormCode === 'OTHER' && entity.legalFormOther ? ` (${entity.legalFormOther})` : ''}
          </div>
          <div>
            <span className={styles.label}>SIRET:</span> {entity.siret || 'Non renseigné'}
          </div>
          <div>
            <span className={styles.label}>Email:</span> {entity.email || 'Non renseigné'}
          </div>
          <div>
            <span className={styles.label}>Téléphone:</span> {entity.phone || 'Non renseigné'}
          </div>
          <div>
            <span className={styles.label}>Adresse:</span> {entity.address || 'Non renseigné'}
          </div>
          <div>
            <span className={styles.label}>Code postal:</span> {entity.postalCode || 'Non renseigné'}
          </div>
          <div>
            <span className={styles.label}>Ville:</span> {entity.city || 'Non renseigné'}
          </div>
        </div>
      </div>

      <div className={`card ${styles.exercicesCard}`}>
        <div className="card-title">Exercices comptables</div>
        {entity.fiscalYears.length === 0 ? (
          <div className={styles.emptyExercices}>
            Aucun exercice comptable pour cette entité
            <div className={styles.emptyCta}>
              <a href={`/exercices/new?associationId=${entity.id}`} className={`btn btn-primary ${forms.btnWithLeadingIcon}`}>
                <Plus size={18} aria-hidden="true" />
                Créer le premier exercice
              </a>
            </div>
          </div>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.theadRow}>
                  <th className={styles.th}>Période</th>
                  <th className={styles.th}>Statut</th>
                  <th className={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {entity.fiscalYears.map((fy) => (
                  <tr key={fy.id} className={styles.tr}>
                    <td className={styles.td}>
                      {new Date(fy.startDate).toLocaleDateString('fr-FR')} - {new Date(fy.endDate).toLocaleDateString('fr-FR')}
                    </td>
                    <td className={styles.td}>
                      <span
                        className={`${styles.statusBadge} ${fy.status === 'OPEN' ? styles.statusOpen : styles.statusClosed}`}
                      >
                        {fy.status}
                      </span>
                    </td>
                    <td className={styles.td}>
                      <a href={`/exercices/${fy.id}`} className={styles.linkPrimary}>
                        Voir
                      </a>
                      {fy.status === 'OPEN' && (
                        <a href={`/exercices/${fy.id}/ecritures`} className={styles.linkDefault}>
                          Saisir
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ParametreLayout>
  )
}

