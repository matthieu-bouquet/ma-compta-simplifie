'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList, User } from 'lucide-react'
import FormSection from '@/components/forms/FormSection'
import PageBackLink from '@/components/PageBackLink'
import AppSearchableSelect from '@/components/forms/AppSearchableSelect'
import forms from '@/components/forms/forms.module.css'
import styles from '../../vie-asso.module.css'
import { createMemberAndMembershipForSeason } from '@/actions/memberActions'
import { DEFAULT_MEMBERSHIP_OPTIONS } from '@/lib/membership'
import { membershipTariffSelectOptions } from '@/lib/vieAssoSelectOptions'
import { appToast } from '@/lib/appToast'
import MembershipOptionsFields from '../../adherents/MembershipOptionsFields'

type PersonMode = 'existing' | 'new'

export default function NewAdhesionForm({
  seasonId,
  members,
  tariffs,
}: {
  seasonId: string
  members: { id: string; firstName: string; lastName: string }[]
  tariffs: { id: string; categoryName: string; amountCents: number }[]
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [personMode, setPersonMode] = useState<PersonMode>(members.length > 0 ? 'existing' : 'new')
  const [memberId, setMemberId] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [tariffId, setTariffId] = useState(tariffs[0]?.id ?? '')
  const [options, setOptions] = useState(DEFAULT_MEMBERSHIP_OPTIONS)

  const canSubmit =
    Boolean(tariffId) &&
    (personMode === 'existing' ? Boolean(memberId) : Boolean(firstName.trim() && lastName.trim()))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    try {
      await createMemberAndMembershipForSeason({
        seasonId,
        tariffId,
        ...(personMode === 'existing'
          ? { memberId }
          : {
              member: {
                firstName,
                lastName,
                email: email || null,
                phone: phone || null,
                licenseNumber: licenseNumber || null,
              },
            }),
        ...options,
      })
      appToast.success('Adhésion créée.')
      router.push('/adhesions')
      router.refresh()
    } catch (err) {
      appToast.error(err instanceof Error ? err.message : 'Erreur lors de la création.')
    } finally {
      setPending(false)
    }
  }

  const memberOptions = members.map((m) => ({
    value: m.id,
    label: `${m.lastName.toUpperCase()} ${m.firstName}`,
  }))
  const memberValue = memberOptions.find((o) => o.value === memberId) ?? null
  const tariffOptions = useMemo(() => membershipTariffSelectOptions(tariffs), [tariffs])
  const tariffValue = tariffOptions.find((o) => o.value === tariffId) ?? null

  return (
    <div className={styles.formPage}>
      <header className={styles.formHeader}>
        <PageBackLink href="/adhesions" aria-label="Retour aux adhésions" />
        <h1 className="page-title no-topbar-pad">Nouvelle adhésion</h1>
      </header>
      <div className="card">
        <form onSubmit={handleSubmit} className={forms.formStack}>
          <div className={forms.sections}>
            <FormSection
              icon={User}
              title="Adhérent"
              description="Personne déjà enregistrée ou nouvelle fiche créée avec l’adhésion."
            >
              <div className={forms.choicePanel}>
                <fieldset className={forms.radioGroup}>
                  <legend className={forms.choicePanelLegend}>Personne</legend>
                  <div className={forms.radioRow}>
                    <input
                      type="radio"
                      id="adhesion-person-existing"
                      name="adhesion-person-mode"
                      value="existing"
                      checked={personMode === 'existing'}
                      onChange={() => setPersonMode('existing')}
                      disabled={members.length === 0}
                    />
                    <label htmlFor="adhesion-person-existing">Adhérent existant</label>
                  </div>
                  <div className={forms.radioRow}>
                    <input
                      type="radio"
                      id="adhesion-person-new"
                      name="adhesion-person-mode"
                      value="new"
                      checked={personMode === 'new'}
                      onChange={() => setPersonMode('new')}
                    />
                    <label htmlFor="adhesion-person-new">Nouvel adhérent</label>
                  </div>
                </fieldset>
              </div>
              {personMode === 'existing' ? (
                <div className={forms.field}>
                  <label className={forms.label} htmlFor="adhesion-member">
                    Adhérent *
                  </label>
                  <AppSearchableSelect
                    inputId="adhesion-member"
                    aria-label="Adhérent"
                    options={memberOptions}
                    value={memberValue}
                    onChange={(next) => setMemberId(next ?? '')}
                    placeholder="Choisir…"
                    isClearable={false}
                  />
                  {members.length === 0 ? (
                    <p className={forms.fieldHint}>Aucune personne sans adhésion sur cette saison. Choisissez « Nouvel adhérent ».</p>
                  ) : null}
                </div>
              ) : (
                <div className={forms.sectionGrid}>
                  <div className={forms.field}>
                    <label className={forms.label} htmlFor="adhesion-last-name">
                      Nom *
                    </label>
                    <input
                      id="adhesion-last-name"
                      className={forms.input}
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required={personMode === 'new'}
                    />
                  </div>
                  <div className={forms.field}>
                    <label className={forms.label} htmlFor="adhesion-first-name">
                      Prénom *
                    </label>
                    <input
                      id="adhesion-first-name"
                      className={forms.input}
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required={personMode === 'new'}
                    />
                  </div>
                  <div className={forms.field}>
                    <label className={forms.label} htmlFor="adhesion-email">
                      E-mail
                    </label>
                    <input
                      id="adhesion-email"
                      type="email"
                      className={forms.input}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className={forms.field}>
                    <label className={forms.label} htmlFor="adhesion-phone">
                      Téléphone
                    </label>
                    <input
                      id="adhesion-phone"
                      className={forms.input}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div className={forms.field}>
                    <label className={forms.label} htmlFor="adhesion-license">
                      N° de licence
                    </label>
                    <input
                      id="adhesion-license"
                      className={forms.input}
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </FormSection>
            <FormSection
              icon={ClipboardList}
              title="Tarif et options"
              description="Tarif de la saison en cours."
            >
              <div className={forms.sectionGrid}>
                <div className={forms.field}>
                  <label className={forms.label} htmlFor="adhesion-tariff">
                    Tarif *
                  </label>
                  <AppSearchableSelect
                    inputId="adhesion-tariff"
                    aria-label="Tarif"
                    options={tariffOptions}
                    value={tariffValue}
                    onChange={(next) => setTariffId(next ?? '')}
                    placeholder="Choisir un tarif…"
                    isClearable={false}
                    isDisabled={tariffs.length === 0}
                    noOptionsMessage={() => 'Aucun tarif sur cette saison'}
                  />
                  {tariffs.length === 0 ? (
                    <p className={forms.fieldHint}>Ajoutez des tarifs dans Saisons → modifier la saison.</p>
                  ) : null}
                </div>
                <MembershipOptionsFields idPrefix="new-adhesion" value={options} onChange={setOptions} />
              </div>
            </FormSection>
          </div>
          <div className={forms.formActionsBar}>
            <button type="submit" className="btn btn-primary" disabled={pending || !canSubmit}>
              Créer
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
