'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { createPortal } from 'react-dom'
import { forwardRef } from 'react'
import { ClipboardList, Mail, Plus } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import FormSection from '@/components/forms/FormSection'
import AppSearchableSelect from '@/components/forms/AppSearchableSelect'
import forms from '@/components/forms/forms.module.css'
import {
  membershipTariffSelectOptions,
  treasuryAccountSelectOptions,
} from '@/lib/vieAssoSelectOptions'
import styles from '../vie-asso.module.css'
import {
  createMembershipForSeason,
  markMembershipFeePaid,
  reverseMembershipFeePayment,
  updateMembership,
} from '@/actions/memberActions'
import { unpaidDuesMailtoHref } from '@/lib/duesReminder'
import { formatEurosFromCents } from '@/lib/money'
import { calendarDateInTimeZone, ENTRY_DATE_TIMEZONE } from '@/lib/entryDateValidation'
import { appToast } from '@/lib/appToast'
import {
  DEFAULT_MEMBERSHIP_OPTIONS,
  MEMBERSHIP_FEE_STATUS_DUE,
  MEMBERSHIP_FEE_STATUS_PAID,
  type MembershipSeasonOptions,
} from '@/lib/membership'
import MembershipOptionsFields from './MembershipOptionsFields'

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

export type MembershipFeePanelFee = {
  id: string
  status: string
  amountCents: number
  duesAccountNumber: string
  entryId: string | null
  categoryId: string | null
  tariffId: string
  snapshotFirstName: string
  snapshotLastName: string
  snapshotEmail: string | null
  snapshotPhone: string | null
  snapshotAddress: string | null
  snapshotPostalCode: string | null
  snapshotCity: string | null
  snapshotLicenseNumber: string | null
  imageRightsConsent: boolean
  internalRulesAccepted: boolean
  emailCommunicationsConsent: boolean
}

export default function MemberFeePanel({
  memberId,
  seasonId,
  member,
  associationName,
  seasonLabel,
  fee,
  tariffs,
  treasuryAccounts,
  canWrite,
  canPay,
}: {
  memberId: string
  seasonId: string
  member: { firstName: string; lastName: string; email: string | null; categoryId: string | null }
  associationName: string
  seasonLabel: string
  fee: MembershipFeePanelFee | null
  tariffs: { id: string; categoryName: string; amountCents: number }[]
  treasuryAccounts: { number: string; name: string }[]
  canWrite: boolean
  canPay: boolean
}) {
  const router = useRouter()
  const [paidOn, setPaidOn] = useState<Date | null>(new Date())
  const [treasury, setTreasury] = useState(treasuryAccounts[0]?.number ?? '')
  const [pending, setPending] = useState(false)
  const [createTariffId, setCreateTariffId] = useState(tariffs[0]?.id ?? '')
  const [createOptions, setCreateOptions] = useState(DEFAULT_MEMBERSHIP_OPTIONS)
  const [snapshotFirstName, setSnapshotFirstName] = useState(fee?.snapshotFirstName ?? '')
  const [snapshotLastName, setSnapshotLastName] = useState(fee?.snapshotLastName ?? '')
  const [snapshotEmail, setSnapshotEmail] = useState(fee?.snapshotEmail ?? '')
  const [snapshotPhone, setSnapshotPhone] = useState(fee?.snapshotPhone ?? '')
  const [snapshotAddress, setSnapshotAddress] = useState(fee?.snapshotAddress ?? '')
  const [snapshotPostalCode, setSnapshotPostalCode] = useState(fee?.snapshotPostalCode ?? '')
  const [snapshotCity, setSnapshotCity] = useState(fee?.snapshotCity ?? '')
  const [snapshotLicenseNumber, setSnapshotLicenseNumber] = useState(fee?.snapshotLicenseNumber ?? '')
  const [tariffId, setTariffId] = useState(fee?.tariffId ?? '')
  const [options, setOptions] = useState<MembershipSeasonOptions>({
    imageRightsConsent: fee?.imageRightsConsent ?? false,
    internalRulesAccepted: fee?.internalRulesAccepted ?? false,
    emailCommunicationsConsent: fee?.emailCommunicationsConsent ?? false,
  })

  const tariffOptions = useMemo(() => membershipTariffSelectOptions(tariffs), [tariffs])
  const treasuryOptions = useMemo(() => treasuryAccountSelectOptions(treasuryAccounts), [treasuryAccounts])
  const createTariffValue = tariffOptions.find((o) => o.value === createTariffId) ?? null
  const editTariffValue = tariffOptions.find((o) => o.value === tariffId) ?? null
  const treasuryValue = treasuryOptions.find((o) => o.value === treasury) ?? null

  async function handlePay(e: React.FormEvent) {
    e.preventDefault()
    if (!fee) return
    if (!paidOn) {
      appToast.error('Date de paiement requise.')
      return
    }
    setPending(true)
    try {
      await markMembershipFeePaid({
        feeId: fee.id,
        paidOn: calendarDateInTimeZone(paidOn, ENTRY_DATE_TIMEZONE),
        treasuryAccountNumber: treasury,
      })
      appToast.success('Cotisation encaissée et écrite en compta (756).')
      router.refresh()
    } catch (err) {
      appToast.error(err instanceof Error ? err.message : 'Erreur lors de l’encaissement.')
    } finally {
      setPending(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    try {
      await createMembershipForSeason({
        memberId,
        seasonId,
        tariffId: createTariffId,
        ...createOptions,
      })
      appToast.success('Adhésion créée pour cette saison.')
      router.refresh()
    } catch (err) {
      appToast.error(err instanceof Error ? err.message : 'Erreur lors de la création de l’adhésion.')
    } finally {
      setPending(false)
    }
  }

  async function handleSaveMembership(e: React.FormEvent) {
    e.preventDefault()
    if (!fee) return
    setPending(true)
    try {
      await updateMembership({
        membershipId: fee.id,
        snapshotFirstName,
        snapshotLastName,
        snapshotEmail,
        snapshotPhone,
        snapshotAddress,
        snapshotPostalCode,
        snapshotCity,
        snapshotLicenseNumber,
        tariffId: tariffId || null,
        ...options,
      })
      appToast.success('Adhésion enregistrée.')
      router.refresh()
    } catch (err) {
      appToast.error(err instanceof Error ? err.message : 'Erreur lors de l’enregistrement.')
    } finally {
      setPending(false)
    }
  }

  if (!fee) {
    return (
      <div className="card">
        <div className={forms.formStack}>
          <div className={forms.sections}>
            <FormSection
              icon={ClipboardList}
              title={`Adhésion ${seasonLabel}`}
              description="Aucune adhésion pour cette saison. La fiche personne reste inchangée."
            >
              {canWrite ? (
                <form onSubmit={handleCreate} className={forms.formStack}>
                  <div className={forms.sectionGrid}>
                    <div className={forms.field}>
                      <label className={forms.label} htmlFor="create-membership-tariff">
                        Tarif *
                      </label>
                      <AppSearchableSelect
                        inputId="create-membership-tariff"
                        aria-label="Tarif"
                        options={tariffOptions}
                        value={createTariffValue}
                        onChange={(next) => setCreateTariffId(next ?? '')}
                        placeholder="Choisir un tarif…"
                        isClearable={false}
                        isDisabled={tariffs.length === 0}
                        noOptionsMessage={() => 'Aucun tarif sur cette saison'}
                      />
                    </div>
                    <MembershipOptionsFields
                      idPrefix="create-membership"
                      value={createOptions}
                      onChange={setCreateOptions}
                    />
                  </div>
                  <div className={forms.formActionsBar}>
                    <button
                      type="submit"
                      className={`btn btn-primary ${forms.btnWithLeadingIcon}`}
                      disabled={pending || tariffs.length === 0}
                    >
                      <Plus size={18} aria-hidden="true" />
                      Créer l’adhésion
                    </button>
                  </div>
                </form>
              ) : (
                <p className={forms.fieldHint}>Aucune adhésion pour cette saison.</p>
              )}
            </FormSection>
          </div>
        </div>
      </div>
    )
  }

  const mailto =
    member.email && fee.status === MEMBERSHIP_FEE_STATUS_DUE
      ? unpaidDuesMailtoHref({
          email: member.email,
          member: { firstName: snapshotFirstName || member.firstName, lastName: snapshotLastName || member.lastName },
          amountCents: fee.amountCents,
          associationName,
          fiscalYearLabel: seasonLabel,
        })
      : null
  const tariffLocked = fee.status === MEMBERSHIP_FEE_STATUS_PAID || Boolean(fee.entryId)

  return (
    <div className="card">
      <div className={forms.formStack}>
        <div className={forms.sections}>
          <FormSection
            icon={ClipboardList}
            title={`Adhésion ${seasonLabel}`}
            description="Identité et options figées pour cette saison. Modifier l’adhérent ci-dessus ne les remplace pas."
          >
            <div className={forms.formInsetPanel}>
              <strong>{formatEurosFromCents(fee.amountCents)}</strong> — compte {fee.duesAccountNumber} —{' '}
              <span className={fee.status === MEMBERSHIP_FEE_STATUS_PAID ? styles.statusPaid : styles.statusDue}>
                {fee.status === MEMBERSHIP_FEE_STATUS_PAID ? 'Payée' : 'Impayée'}
              </span>
            </div>
            {mailto ? (
              <div className={forms.formActionsBar}>
                <a href={mailto} className={`btn ${forms.btnWithLeadingIcon}`}>
                  <Mail size={18} aria-hidden="true" />
                  Relancer par e-mail
                </a>
              </div>
            ) : null}

            <form onSubmit={handleSaveMembership} className={forms.formStack}>
              <div className={forms.sectionGrid}>
            <div className={forms.field}>
              <label className={forms.label} htmlFor="membership-last-name">
                Nom (adhésion) *
              </label>
              <input
                id="membership-last-name"
                className={forms.input}
                value={snapshotLastName}
                onChange={(e) => setSnapshotLastName(e.target.value)}
                required
                disabled={!canWrite}
              />
            </div>
            <div className={forms.field}>
              <label className={forms.label} htmlFor="membership-first-name">
                Prénom (adhésion) *
              </label>
              <input
                id="membership-first-name"
                className={forms.input}
                value={snapshotFirstName}
                onChange={(e) => setSnapshotFirstName(e.target.value)}
                required
                disabled={!canWrite}
              />
            </div>
            <div className={forms.field}>
              <label className={forms.label} htmlFor="membership-email">
                E-mail (adhésion)
              </label>
              <input
                id="membership-email"
                type="email"
                className={forms.input}
                value={snapshotEmail}
                onChange={(e) => setSnapshotEmail(e.target.value)}
                disabled={!canWrite}
              />
            </div>
            <div className={forms.field}>
              <label className={forms.label} htmlFor="membership-phone">
                Téléphone (adhésion)
              </label>
              <input
                id="membership-phone"
                className={forms.input}
                value={snapshotPhone}
                onChange={(e) => setSnapshotPhone(e.target.value)}
                disabled={!canWrite}
              />
            </div>
            <div className={forms.field}>
              <label className={forms.label} htmlFor="membership-license">
                N° de licence (adhésion)
              </label>
              <input
                id="membership-license"
                className={forms.input}
                value={snapshotLicenseNumber}
                onChange={(e) => setSnapshotLicenseNumber(e.target.value)}
                disabled={!canWrite}
              />
            </div>
            <div className={forms.field}>
              <label className={forms.label} htmlFor="membership-tariff">
                Tarif (adhésion)
              </label>
              <AppSearchableSelect
                inputId="membership-tariff"
                aria-label="Tarif (adhésion)"
                options={tariffOptions}
                value={editTariffValue}
                onChange={(next) => setTariffId(next ?? '')}
                placeholder="Choisir un tarif…"
                isClearable={false}
                isDisabled={!canWrite || tariffLocked}
                noOptionsMessage={() => 'Aucun tarif'}
              />
              {tariffLocked ? (
                <p className={forms.fieldHint}>Le tarif d’une adhésion déjà comptabilisée ne peut plus changer.</p>
              ) : null}
            </div>
            <div className={forms.field}>
              <label className={forms.label} htmlFor="membership-address">
                Adresse (adhésion)
              </label>
              <input
                id="membership-address"
                className={forms.input}
                value={snapshotAddress}
                onChange={(e) => setSnapshotAddress(e.target.value)}
                disabled={!canWrite}
              />
            </div>
            <div className={forms.field}>
              <label className={forms.label} htmlFor="membership-postal">
                Code postal (adhésion)
              </label>
              <input
                id="membership-postal"
                className={forms.input}
                value={snapshotPostalCode}
                onChange={(e) => setSnapshotPostalCode(e.target.value)}
                disabled={!canWrite}
              />
            </div>
            <div className={forms.field}>
              <label className={forms.label} htmlFor="membership-city">
                Ville (adhésion)
              </label>
              <input
                id="membership-city"
                className={forms.input}
                value={snapshotCity}
                onChange={(e) => setSnapshotCity(e.target.value)}
                disabled={!canWrite}
              />
            </div>
            <MembershipOptionsFields
              idPrefix="membership"
              value={options}
              onChange={setOptions}
              disabled={!canWrite}
            />
              </div>
              {canWrite ? (
                <div className={forms.formActionsBar}>
                  <button type="submit" className="btn btn-primary" disabled={pending}>
                    Enregistrer l’adhésion
                  </button>
                </div>
              ) : null}
            </form>

            {canPay && fee.status === MEMBERSHIP_FEE_STATUS_DUE ? (
              <div className={forms.formSubsection}>
                <h3 className={forms.subsectionTitle}>Encaissement</h3>
                <form onSubmit={handlePay} className={forms.formStack}>
                  <div className={forms.sectionGrid}>
                    <div className={forms.field}>
                      <label className={forms.label} htmlFor="fee-paid-on">
                        Date d’encaissement *
                      </label>
                      <DatePicker
                        selected={paidOn}
                        onChange={(d: Date | null) => setPaidOn(d)}
                        dateFormat="dd/MM/yyyy"
                        customInput={<DateInput id="fee-paid-on" required />}
                        popperContainer={PopperToBody}
                      />
                    </div>
                    <div className={forms.field}>
                      <label className={forms.label} htmlFor="fee-treasury">
                        Compte de trésorerie *
                      </label>
                      <AppSearchableSelect
                        inputId="fee-treasury"
                        aria-label="Compte de trésorerie"
                        options={treasuryOptions}
                        value={treasuryValue}
                        onChange={(next) => setTreasury(next ?? '')}
                        placeholder="Choisir un compte…"
                        isClearable={false}
                        isDisabled={treasuryAccounts.length === 0}
                        noOptionsMessage={() => 'Aucun compte de trésorerie'}
                        elevatedZIndex
                      />
                    </div>
                  </div>
                  <div className={forms.formActionsBar}>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={pending || treasuryAccounts.length === 0}
                    >
                      Marquer payée (écriture 756)
                    </button>
                  </div>
                </form>
              </div>
            ) : null}

            {canPay && fee.status === MEMBERSHIP_FEE_STATUS_PAID && fee.entryId ? (
              <div className={forms.formSubsection}>
                <ConfirmDialog
                  title="Contrepasser l’encaissement ?"
                  description="Une écriture inverse sera créée. L’adhésion repassera impayée."
                  confirmText="Contrepasser"
                  onConfirm={async () => {
                    await reverseMembershipFeePayment(fee.id)
                    appToast.success('Encaissement contrepassé.')
                    router.refresh()
                  }}
                  trigger={({ open }) => (
                    <button type="button" className="btn" onClick={open}>
                      Annuler l’encaissement
                    </button>
                  )}
                />
              </div>
            ) : null}
          </FormSection>
        </div>
      </div>
    </div>
  )
}
