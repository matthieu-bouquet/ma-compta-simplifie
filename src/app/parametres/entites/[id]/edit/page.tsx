'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useCallback, useEffect, useState, startTransition } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Building2, Mail, MapPin, Phone } from 'lucide-react'
import ParametreLayout from '@/components/ParametreLayout'
import FormSection from '@/components/forms/FormSection'
import forms from '@/components/forms/forms.module.css'
import { getAssociation, updateAssociation, type AssociationDetail } from '@/actions/associationActions'
import { LEGAL_FORM_OPTIONS } from '@/lib/legalForms'

export default function EditEntityPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
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

  const load = useCallback(async (entityId: string) => {
    setLoading(true)
    setError('')
    try {
      const a: AssociationDetail | null = await getAssociation(entityId)
      if (!a) {
        setError('Entité introuvable')
        return
      }
      setFormData({
        nom: a.nom || '',
        siret: a.siret || '',
        legalFormCode: a.legalFormCode || '',
        legalFormOther: a.legalFormOther || '',
        adresse: a.adresse || '',
        codePostal: a.codePostal || '',
        ville: a.ville || '',
        email: a.email || '',
        telephone: a.telephone || '',
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!id) return
    startTransition(() => {
      void load(id)
    })
  }, [id, load])

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!id) {
      setError("Identifiant d'entité manquant dans l’URL")
      return
    }
    setError('')
    setSuccess('')
    try {
      const form = new FormData()
      Object.entries(formData).forEach(([key, value]) => form.append(key, value))
      await updateAssociation(id, form)
      setSuccess('Entité modifiée')
      router.push('/parametres/entites')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la modification')
    }
  }

  if (loading) {
    return (
      <ParametreLayout title="Modifier l'entité">
        <div>Chargement...</div>
      </ParametreLayout>
    )
  }

  return (
    <ParametreLayout title="Modifier l'entité" description="Mettre à jour les informations">
      {error && <div className={`card ${forms.alertError}`}>{error}</div>}
      {success && <div className={`card ${forms.alertSuccess}`}>{success}</div>}

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className={forms.sections}>
            <FormSection
              icon={Building2}
              title="Identité"
              description="Nom, forme juridique et identifiants si disponibles."
            >
              <div className={forms.sectionGrid}>
                <div>
                  <label className={forms.label} htmlFor="entity-edit-name">
                    Nom *
                  </label>
                  <input
                    id="entity-edit-name"
                    name="nom"
                    value={formData.nom}
                    onChange={handleInputChange}
                    required
                    className={forms.input}
                  />
                </div>

                <div>
                  <label className={forms.label} htmlFor="entity-edit-siret">
                    SIRET
                  </label>
                  <input
                    id="entity-edit-siret"
                    name="siret"
                    value={formData.siret}
                    onChange={handleInputChange}
                    className={forms.input}
                  />
                </div>

                <div>
                  <label className={forms.label} htmlFor="entity-edit-legal-form">
                    Forme juridique
                  </label>
                  <select
                    id="entity-edit-legal-form"
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
                    <label className={forms.label} htmlFor="entity-edit-legal-form-other">
                      Autre (préciser) *
                    </label>
                    <input
                      id="entity-edit-legal-form-other"
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
                  <label className={forms.label} htmlFor="entity-edit-address">
                    Adresse
                  </label>
                  <input
                    id="entity-edit-address"
                    name="adresse"
                    value={formData.adresse}
                    onChange={handleInputChange}
                    className={forms.input}
                  />
                </div>

                <div>
                  <label className={forms.label} htmlFor="entity-edit-postalCode">
                    Code postal
                  </label>
                  <input
                    id="entity-edit-postalCode"
                    name="codePostal"
                    value={formData.codePostal}
                    onChange={handleInputChange}
                    className={forms.input}
                  />
                </div>

                <div>
                  <label className={forms.label} htmlFor="entity-edit-city">
                    Ville
                  </label>
                  <input
                    id="entity-edit-city"
                    name="ville"
                    value={formData.ville}
                    onChange={handleInputChange}
                    className={forms.input}
                  />
                </div>

                <div>
                  <label className={forms.label} htmlFor="entity-edit-email">
                    Email
                  </label>
                  <div className="sr-only" aria-hidden="true">
                    <Mail />
                  </div>
                  <input
                    id="entity-edit-email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={forms.input}
                  />
                </div>

                <div>
                  <label className={forms.label} htmlFor="entity-edit-phone">
                    Téléphone
                  </label>
                  <div className="sr-only" aria-hidden="true">
                    <Phone />
                  </div>
                  <input
                    id="entity-edit-phone"
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
            <button type="button" className={`btn ${forms.btnSecondary}`} onClick={() => router.push('/parametres/entites')}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary">
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </ParametreLayout>
  )
}
