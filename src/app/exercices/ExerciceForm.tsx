'use client'

import { useState, useEffect } from 'react'
import { createExercice } from '@/actions/exerciceActions'
import { getAssociations } from '@/actions/associationActions'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { Association } from '@prisma/client'
import { Building2, CalendarRange, Plus } from 'lucide-react'
import AppSearchableSelect from '@/components/forms/AppSearchableSelect'
import FormSection from '@/components/forms/FormSection'
import forms from '@/components/forms/forms.module.css'
import styles from './exerciceForm.module.css'

export default function ExerciceForm({ associationId }: { associationId?: string }) {
  const [mounted, setMounted] = useState(false)
  const [dateDebut, setDateDebut] = useState<Date | null>(null)
  const [dateFin, setDateFin] = useState<Date | null>(null)
  const [selectedAssociationId, setSelectedAssociationId] = useState<string>(() => associationId ?? '')
  const [associations, setAssociations] = useState<Association[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadAssociations()

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    let startYear = currentYear
    if (currentMonth < 8) {
      startYear = currentYear - 1
    }

    setDateDebut(new Date(startYear, 8, 1))
    setDateFin(new Date(startYear + 1, 7, 31))
    setMounted(true)
  }, [])

  useEffect(() => {
    if (associationId) {
      setSelectedAssociationId(associationId)
    }
  }, [associationId])

  async function loadAssociations() {
    try {
      const data = await getAssociations()
      setAssociations(data as Association[])
    } catch {
      setError('Erreur lors du chargement des associations')
    }
  }

  if (!mounted) return null

  const associationOptions = associations.map((a: Association & { nom?: string }) => ({
    value: a.id,
    label: a.nom ?? a.name,
  }))

  const associationValue =
    selectedAssociationId && associations.some((a) => a.id === selectedAssociationId)
      ? {
          value: selectedAssociationId,
          label:
            (associations.find((a) => a.id === selectedAssociationId) as Association & { nom?: string })?.nom ??
            associations.find((a) => a.id === selectedAssociationId)!.name,
        }
      : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!dateDebut || !dateFin) return
    if (!selectedAssociationId) {
      setError('Veuillez sélectionner une association')
      return
    }
    setLoading(true)
    setError('')

    const formData = new FormData()
    formData.append('dateDebut', dateDebut.toISOString().split('T')[0])
    formData.append('dateFin', dateFin.toISOString().split('T')[0])
    formData.append('associationId', selectedAssociationId)

    try {
      await createExercice(formData)
      window.location.href = '/exercices'
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors de la création de l'exercice")
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {error ? <div className={`card ${forms.alertError}`}>{error}</div> : null}

      {!associationId ? (
        <FormSection
          icon={Building2}
          title="Entité"
          description="Sélectionnez l’entité pour laquelle cet exercice comptable est ouvert."
        >
          <div className={forms.sectionGrid}>
            <div className={forms.field}>
              <label className={forms.label} htmlFor="exercice-new-association">
                Association *
              </label>
              <AppSearchableSelect
                id="exercice-new-association"
                inputId="exercice-new-association"
                options={associationOptions}
                value={associationValue}
                onChange={(v) => setSelectedAssociationId(v ?? '')}
                placeholder="Sélectionner une association"
                isClearable={false}
                noOptionsMessage={() => 'Aucune entité'}
              />
            </div>
          </div>
        </FormSection>
      ) : null}

      <FormSection
        icon={CalendarRange}
        title="Période de l’exercice"
        description="Dates de début et de fin incluses pour cet exercice comptable."
      >
        <div className={forms.sectionGrid}>
          <div className={forms.field}>
            <label className={forms.label} htmlFor="exercice-date-debut">
              Date de début
            </label>
            <DatePicker
              selected={dateDebut}
              onChange={(d: Date | null) => setDateDebut(d)}
              dateFormat="dd/MM/yyyy"
              customInput={<input id="exercice-date-debut" className={forms.input} required />}
              wrapperClassName="w-full"
            />
          </div>
          <div className={forms.field}>
            <label className={forms.label} htmlFor="exercice-date-fin">
              Date de fin
            </label>
            <DatePicker
              selected={dateFin}
              onChange={(d: Date | null) => setDateFin(d)}
              dateFormat="dd/MM/yyyy"
              customInput={<input id="exercice-date-fin" className={forms.input} required />}
              wrapperClassName="w-full"
            />
          </div>
        </div>
      </FormSection>

      <div className={forms.formActions}>
        <button type="submit" disabled={loading} className={`btn btn-primary ${forms.btnWithLeadingIcon}`}>
          <Plus size={18} aria-hidden="true" />
          Créer l&apos;exercice{' '}
          {dateDebut && dateFin ? `(${dateDebut.getFullYear()}-${dateFin.getFullYear()})` : ''}
        </button>
      </div>
    </form>
  )
}
