'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2, Lock, Mail, MapPin, Pencil, Phone, Plus, Trash2 } from 'lucide-react'
import { Association } from '@prisma/client'
import ParametreLayout from '@/components/ParametreLayout'
import ConfirmDialog from '@/components/ConfirmDialog'
import { cloturerAssociation, createAssociation, deleteAssociation, getAssociations } from '@/actions/associationActions'
import { LEGAL_FORM_OPTIONS } from '@/lib/legalForms'
import FormSection from '@/components/forms/FormSection'
import forms from '@/components/forms/forms.module.css'
import styles from './entites.module.css'

type EntityRow = Association & {
  nom?: string
  cloturee?: boolean
  adresse?: string | null
  codePostal?: string | null
  ville?: string | null
  telephone?: string | null
  _count?: { exercices: number }
}

export default function EntitiesPage() {
  const [entities, setEntities] = useState<EntityRow[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    nom: '',
    siret: '',
    legalFormCode: '',
    legalFormOther: '',
    adresse: '',
    codePostal: '',
    ville: '',
    email: '',
    telephone: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadEntities()
  }, [])

  async function loadEntities() {
    try {
      const data = await getAssociations()
      setEntities(data)
    } catch {
      setError('Erreur lors du chargement des entités')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const form = new FormData()
      Object.entries(formData).forEach(([key, value]) => form.append(key, value))

      await createAssociation(form)
      setSuccess('Entité créée avec succès')
      setFormData({
        nom: '',
        siret: '',
        legalFormCode: '',
        legalFormOther: '',
        adresse: '',
        codePostal: '',
        ville: '',
        email: '',
        telephone: '',
      })
      setShowForm(false)
      loadEntities()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création')
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setFormData((prev) => {
      const next = { ...prev, [name]: value }
      if (name === 'legalFormCode' && value !== 'OTHER') {
        next.legalFormOther = ''
      }
      return next
    })
  }

  if (loading) return <div>Chargement...</div>

  return (
    <ParametreLayout title="Entités" description="Gérer les entités pour lesquelles vous faites la comptabilité">
      <div className={styles.headerActions}>
        <button type="button" onClick={() => setShowForm(!showForm)} className={`btn btn-primary ${forms.btnWithLeadingIcon}`}>
          <Plus size={18} aria-hidden="true" />
          Nouvelle entité
        </button>
      </div>

      {error && <div className={`card ${forms.alertError}`}>{error}</div>}
      {success && <div className={`card ${forms.alertSuccess}`}>{success}</div>}

      {showForm && (
        <div className={`card ${forms.cardForm}`}>
          <div className={forms.formTitleRow}>
            <div className="card-title">Créer une entité</div>
          </div>
          <div className={forms.formSubtitle}>Renseignez l’identité, la forme juridique et les coordonnées de contact.</div>
          <form onSubmit={handleSubmit}>
            <div className={forms.sections}>
              <FormSection
                icon={Building2}
                title="Identité"
                description="Nom, forme juridique et identifiants si disponibles."
              >
                <div className={forms.sectionGrid}>
                  <div>
                    <label className={forms.label} htmlFor="entity-name">
                      Nom *
                    </label>
                    <input
                      id="entity-name"
                      type="text"
                      name="nom"
                      value={formData.nom}
                      onChange={handleInputChange}
                      required
                      className={forms.input}
                    />
                  </div>

                  <div>
                    <label className={forms.label} htmlFor="entity-siret">
                      SIRET
                    </label>
                    <input
                      id="entity-siret"
                      type="text"
                      name="siret"
                      value={formData.siret}
                      onChange={handleInputChange}
                      className={forms.input}
                    />
                  </div>

                  <div>
                    <label className={forms.label} htmlFor="entity-legal-form">
                      Forme juridique
                    </label>
                    <select
                      id="entity-legal-form"
                      name="legalFormCode"
                      value={formData.legalFormCode}
                      onChange={handleInputChange}
                      className={forms.select}
                    >
                      <option value="">—</option>
                      {LEGAL_FORM_OPTIONS.map((o) => (
                        <option key={o.code} value={o.code}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {formData.legalFormCode === 'OTHER' ? (
                    <div>
                      <label className={forms.label} htmlFor="entity-legal-form-other">
                        Autre (préciser) *
                      </label>
                      <input
                        id="entity-legal-form-other"
                        type="text"
                        name="legalFormOther"
                        value={formData.legalFormOther}
                        onChange={handleInputChange}
                        required
                        className={forms.input}
                      />
                    </div>
                  ) : null}
                </div>
              </FormSection>

              <FormSection icon={MapPin} title="Coordonnées" description="Adresse, ville et contact.">
                <div className={forms.sectionGrid}>
                  <div>
                    <label className={forms.label} htmlFor="entity-address">
                      Adresse
                    </label>
                    <input
                      id="entity-address"
                      type="text"
                      name="adresse"
                      value={formData.adresse}
                      onChange={handleInputChange}
                      className={forms.input}
                    />
                  </div>

                  <div>
                    <label className={forms.label} htmlFor="entity-postalCode">
                      Code postal
                    </label>
                    <input
                      id="entity-postalCode"
                      type="text"
                      name="codePostal"
                      value={formData.codePostal}
                      onChange={handleInputChange}
                      className={forms.input}
                    />
                  </div>

                  <div>
                    <label className={forms.label} htmlFor="entity-city">
                      Ville
                    </label>
                    <input
                      id="entity-city"
                      type="text"
                      name="ville"
                      value={formData.ville}
                      onChange={handleInputChange}
                      className={forms.input}
                    />
                  </div>

                  <div>
                    <label className={forms.label} htmlFor="entity-email">
                      Email
                    </label>
                    <div className="sr-only" aria-hidden="true">
                      <Mail />
                    </div>
                    <input
                      id="entity-email"
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className={forms.input}
                    />
                  </div>

                  <div>
                    <label className={forms.label} htmlFor="entity-phone">
                      Téléphone
                    </label>
                    <div className="sr-only" aria-hidden="true">
                      <Phone />
                    </div>
                    <input
                      id="entity-phone"
                      type="tel"
                      name="telephone"
                      value={formData.telephone}
                      onChange={handleInputChange}
                      className={forms.input}
                    />
                  </div>

                  <div />
                </div>
              </FormSection>
            </div>

            <div className={forms.formActions}>
              <button type="button" onClick={() => setShowForm(false)} className={`btn ${forms.btnSecondary}`}>
                Annuler
              </button>
              <button type="submit" className={`btn btn-primary ${forms.btnWithLeadingIcon}`}>
                <Plus size={18} aria-hidden="true" />
                Créer
              </button>
            </div>
          </form>
        </div>
      )}

      <div className={`card ${styles.tableCard}`}>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Nom</th>
                <th className={styles.th}>Forme</th>
                <th className={styles.th}>SIRET</th>
                <th className={styles.th}>Contact</th>
                <th className={styles.th}>Exercices</th>
                <th className={`${styles.th} ${styles.thRight}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entities.map((entity) => (
                <tr key={entity.id} className={styles.tr}>
                  <td className={`${styles.td} ${styles.tdName}`}>
                    <div className={styles.nameRow}>
                      <Link href={`/parametres/entites/${entity.id}`} className={styles.entityLink}>
                        {entity.nom}
                      </Link>
                      {entity.cloturee && <span className={styles.badgeClosed}>Clôturée</span>}
                    </div>
                  </td>

                  <td className={`${styles.td} ${styles.tdMuted}`}>{entity.legalFormCode || '-'}</td>
                  <td className={`${styles.td} ${styles.tdMuted}`}>{entity.siret || '-'}</td>
                  <td className={`${styles.td} ${styles.tdMuted}`}>
                    <div>
                      {entity.email && <div>{entity.email}</div>}
                      {entity.telephone && <div>{entity.telephone}</div>}
                      {!entity.email && !entity.telephone && '-'}
                    </div>
                  </td>
                  <td className={`${styles.td} ${styles.tdMuted}`}>{entity._count?.exercices ?? '-'}</td>
                  <td className={`${styles.td} ${styles.actionsCell}`}>
                    <div className={styles.iconActions}>
                      <Link
                        href={`/parametres/entites/${entity.id}/edit`}
                        className={`btn ${styles.iconButton}`}
                        title="Modifier"
                        aria-label="Modifier"
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </Link>

                      {(entity._count?.exercices ?? 0) === 0 ? (
                        <ConfirmDialog
                          title="Supprimer l'entité"
                          description="Êtes-vous sûr de vouloir supprimer ?"
                          confirmText="Supprimer"
                          confirmTone="danger"
                          trigger={({ open }) => (
                            <button
                              type="button"
                              onClick={open}
                              className={`btn ${styles.iconButtonDanger}`}
                              title="Supprimer"
                              aria-label="Supprimer"
                            >
                              <Trash2 size={16} aria-hidden="true" />
                            </button>
                          )}
                          onConfirm={async ({ close }) => {
                            setError('')
                            setSuccess('')
                            try {
                              await deleteAssociation(entity.id)
                              setSuccess('Entité supprimée')
                              await loadEntities()
                              close()
                            } catch (err: unknown) {
                              setError(err instanceof Error ? err.message : 'Erreur lors de la suppression')
                            }
                          }}
                        />
                      ) : (
                        <ConfirmDialog
                          title="Clôturer l'entité"
                          description="Êtes-vous sûr de vouloir clôturer ?"
                          confirmText="Clôturer"
                          confirmTone="primary"
                          disabled={entity.cloturee}
                          trigger={({ open }) => (
                            <button
                              type="button"
                              onClick={open}
                              className={`btn ${styles.iconButton} ${entity.cloturee ? styles.iconButtonDisabled : ''}`}
                              disabled={entity.cloturee}
                              title={entity.cloturee ? 'Entité déjà clôturée' : 'Clôturer'}
                              aria-label="Clôturer"
                            >
                              <Lock size={16} aria-hidden="true" />
                            </button>
                          )}
                          onConfirm={async ({ close }) => {
                            setError('')
                            setSuccess('')
                            try {
                              await cloturerAssociation(entity.id)
                              setSuccess('Entité clôturée')
                              await loadEntities()
                              close()
                            } catch (err: unknown) {
                              setError(err instanceof Error ? err.message : 'Erreur lors de la clôture')
                            }
                          }}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {entities.length === 0 && <div className={styles.emptyState}>Aucune entité créée</div>}
      </div>
    </ParametreLayout>
  )
}

