'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { forwardRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { createPortal } from 'react-dom'
import { PhoneCall, User } from 'lucide-react'
import FormSection from '@/components/forms/FormSection'
import PageBackLink from '@/components/PageBackLink'
import forms from '@/components/forms/forms.module.css'
import styles from '../vie-asso.module.css'
import { createMember, updateMember } from '@/actions/memberActions'
import { calendarDateInTimeZone, ENTRY_DATE_TIMEZONE } from '@/lib/entryDateValidation'
import { appToast } from '@/lib/appToast'

const DateInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function DateInput(
  props,
  ref,
) {
  return <input ref={ref} {...props} className={`${forms.input} ${props.className ?? ''}`} />
})

function PopperToBody({ children }: { children?: React.ReactNode }) {
  if (typeof document === 'undefined') return children
  return createPortal(children, document.body)
}

export default function MemberForm({
  member,
}: {
  member?: {
    id: string
    firstName: string
    lastName: string
    email: string | null
    phone: string | null
    address: string | null
    postalCode: string | null
    city: string | null
    licenseNumber: string | null
    birthDate: Date | null
    notes: string | null
    emergencyContactName: string | null
    emergencyContactPhone: string | null
    emergencyContactRelation: string | null
  }
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [firstName, setFirstName] = useState(member?.firstName ?? '')
  const [lastName, setLastName] = useState(member?.lastName ?? '')
  const [email, setEmail] = useState(member?.email ?? '')
  const [phone, setPhone] = useState(member?.phone ?? '')
  const [address, setAddress] = useState(member?.address ?? '')
  const [postalCode, setPostalCode] = useState(member?.postalCode ?? '')
  const [city, setCity] = useState(member?.city ?? '')
  const [licenseNumber, setLicenseNumber] = useState(member?.licenseNumber ?? '')
  const [birthDate, setBirthDate] = useState<Date | null>(
    member?.birthDate ? new Date(member.birthDate) : null,
  )
  const [notes, setNotes] = useState(member?.notes ?? '')
  const [emergencyContactName, setEmergencyContactName] = useState(member?.emergencyContactName ?? '')
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(member?.emergencyContactPhone ?? '')
  const [emergencyContactRelation, setEmergencyContactRelation] = useState(member?.emergencyContactRelation ?? '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    try {
      const payload = {
        firstName,
        lastName,
        email,
        phone,
        address,
        postalCode,
        city,
        licenseNumber,
        birthDate: birthDate ? calendarDateInTimeZone(birthDate, ENTRY_DATE_TIMEZONE) : null,
        notes,
        emergencyContactName,
        emergencyContactPhone,
        emergencyContactRelation,
      }
      if (member) {
        await updateMember(member.id, payload)
        appToast.success('Adhérent enregistré.')
        router.push(`/adherents/${member.id}`)
      } else {
        const created = await createMember(payload)
        appToast.success('Adhérent créé.')
        router.push(`/adherents/${created.id}`)
      }
      router.refresh()
    } catch (err) {
      appToast.error(err instanceof Error ? err.message : 'Erreur lors de l’enregistrement.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={styles.formPage}>
      <header className={styles.formHeader}>
        <PageBackLink href="/adherents" aria-label="Retour à la liste des adhérents" />
        <h1 className="page-title no-topbar-pad">{member ? 'Modifier l’adhérent' : 'Nouvel adhérent'}</h1>
      </header>

      <div className="card">
        <form onSubmit={handleSubmit} className={forms.formStack}>
          <div className={forms.sections}>
            <FormSection
              icon={User}
              title="Identité"
              description="La personne, indépendante des saisons. Les adhésions et tarifs se gèrent dans Adhésions et Saisons."
            >
              <div className={forms.sectionGrid}>
                <div className={forms.field}>
                  <label className={forms.label} htmlFor="member-last-name">
                    Nom *
                  </label>
                  <input
                    id="member-last-name"
                    className={forms.input}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
                <div className={forms.field}>
                  <label className={forms.label} htmlFor="member-first-name">
                    Prénom *
                  </label>
                  <input
                    id="member-first-name"
                    className={forms.input}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className={forms.field}>
                  <label className={forms.label} htmlFor="member-email">
                    E-mail
                  </label>
                  <input
                    id="member-email"
                    type="email"
                    className={forms.input}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className={forms.field}>
                  <label className={forms.label} htmlFor="member-phone">
                    Téléphone
                  </label>
                  <input
                    id="member-phone"
                    className={forms.input}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className={forms.field}>
                  <label className={forms.label} htmlFor="member-license">
                    N° de licence
                  </label>
                  <input
                    id="member-license"
                    className={forms.input}
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                  />
                </div>
                <div className={forms.field}>
                  <label className={forms.label} htmlFor="member-birth-date">
                    Date de naissance
                  </label>
                  <DatePicker
                    selected={birthDate}
                    onChange={(d: Date | null) => setBirthDate(d)}
                    dateFormat="dd/MM/yyyy"
                    maxDate={new Date()}
                    isClearable
                    placeholderText="—"
                    customInput={<DateInput id="member-birth-date" aria-label="Date de naissance" />}
                    popperContainer={PopperToBody}
                  />
                </div>
                <div className={forms.field}>
                  <label className={forms.label} htmlFor="member-address">
                    Adresse
                  </label>
                  <input
                    id="member-address"
                    className={forms.input}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
                <div className={forms.field}>
                  <label className={forms.label} htmlFor="member-postal">
                    Code postal
                  </label>
                  <input
                    id="member-postal"
                    className={forms.input}
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                  />
                </div>
                <div className={forms.field}>
                  <label className={forms.label} htmlFor="member-city">
                    Ville
                  </label>
                  <input
                    id="member-city"
                    className={forms.input}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
                <div className={forms.field}>
                  <label className={forms.label} htmlFor="member-notes">
                    Notes
                  </label>
                  <textarea
                    id="member-notes"
                    className={forms.textarea}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </FormSection>
            <FormSection
              icon={PhoneCall}
              title="Personne à contacter en cas d’urgence"
              description="Facultatif. Non repris sur l’adhésion ni dans les relances de cotisation."
            >
              <div className={forms.sectionGrid}>
                <div className={forms.field}>
                  <label className={forms.label} htmlFor="member-emergency-name">
                    Nom et prénom
                  </label>
                  <input
                    id="member-emergency-name"
                    className={forms.input}
                    value={emergencyContactName}
                    onChange={(e) => setEmergencyContactName(e.target.value)}
                  />
                </div>
                <div className={forms.field}>
                  <label className={forms.label} htmlFor="member-emergency-phone">
                    Téléphone
                  </label>
                  <input
                    id="member-emergency-phone"
                    className={forms.input}
                    value={emergencyContactPhone}
                    onChange={(e) => setEmergencyContactPhone(e.target.value)}
                  />
                </div>
                <div className={forms.field}>
                  <label className={forms.label} htmlFor="member-emergency-relation">
                    Lien avec l’adhérent
                  </label>
                  <input
                    id="member-emergency-relation"
                    className={forms.input}
                    value={emergencyContactRelation}
                    onChange={(e) => setEmergencyContactRelation(e.target.value)}
                    placeholder="Parent, conjoint…"
                  />
                </div>
              </div>
            </FormSection>
          </div>
          <div className={forms.formActionsBar}>
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {member ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
