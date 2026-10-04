'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { createPortal } from 'react-dom'
import { forwardRef } from 'react'
import { HeartHandshake } from 'lucide-react'
import FormSection from '@/components/forms/FormSection'
import AppSearchableSelect from '@/components/forms/AppSearchableSelect'
import { treasuryAccountSelectOptions } from '@/lib/vieAssoSelectOptions'
import PageBackLink from '@/components/PageBackLink'
import forms from '@/components/forms/forms.module.css'
import styles from '../../vie-asso.module.css'
import { createDonationWithTaxReceipt } from '@/actions/donationActions'
import { DONATION_PAYMENT_METHODS, donationPaymentMethodLabel } from '@/lib/membership'
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

export default function DonationForm({
  fiscalYearId,
  treasuryAccounts,
}: {
  fiscalYearId: string
  treasuryAccounts: { number: string; name: string }[]
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [date, setDate] = useState<Date | null>(new Date())
  const [donorName, setDonorName] = useState('')
  const [donorAddress, setDonorAddress] = useState('')
  const [donorPostalCode, setDonorPostalCode] = useState('')
  const [donorCity, setDonorCity] = useState('')
  const [donorEmail, setDonorEmail] = useState('')
  const [amountEuros, setAmountEuros] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<(typeof DONATION_PAYMENT_METHODS)[number]>('VIREMENT')
  const [treasury, setTreasury] = useState(treasuryAccounts[0]?.number ?? '')
  const [eligibilityAttested, setEligibilityAttested] = useState(false)

  const treasuryOptions = useMemo(() => treasuryAccountSelectOptions(treasuryAccounts), [treasuryAccounts])
  const treasuryValue = treasuryOptions.find((o) => o.value === treasury) ?? null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!date) {
      appToast.error('Date du don requise.')
      return
    }
    setPending(true)
    try {
      const res = await createDonationWithTaxReceipt({
        fiscalYearId,
        donorName,
        donorAddress,
        donorPostalCode,
        donorCity,
        donorEmail,
        amountEuros: Number(amountEuros.replace(',', '.')),
        date: calendarDateInTimeZone(date, ENTRY_DATE_TIMEZONE),
        paymentMethod,
        treasuryAccountNumber: treasury,
        eligibilityAttested,
      })
      appToast.success(`Don enregistré, reçu ${res.taxReceiptNumber} émis.`)
      router.push('/dons')
      router.refresh()
    } catch (err) {
      appToast.error(err instanceof Error ? err.message : 'Erreur lors de l’enregistrement du don.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={styles.formPage}>
      <header className={styles.formHeader}>
        <PageBackLink href="/dons" aria-label="Retour à la liste des dons" />
        <h1 className="page-title no-topbar-pad">Enregistrer un don</h1>
        <p className={styles.lead}>
          Écriture automatique 512/531 contre 7541 et génération du reçu Cerfa 11580. Ce n’est pas une cotisation.
        </p>
      </header>

      <div className="card">
        <form onSubmit={handleSubmit} className={forms.formStack}>
          <div className={forms.sections}>
            <FormSection icon={HeartHandshake} title="Donateur" description="Identité reproduite sur le reçu fiscal.">
              <div className={forms.sectionGrid}>
                <div className={forms.field}>
                  <label className={forms.label} htmlFor="donor-name">
                    Nom *
                  </label>
                  <input
                    id="donor-name"
                    className={forms.input}
                    value={donorName}
                    onChange={(e) => setDonorName(e.target.value)}
                    required
                  />
                </div>
                <div className={forms.field}>
                  <label className={forms.label} htmlFor="donor-address">
                    Adresse *
                  </label>
                  <input
                    id="donor-address"
                    className={forms.input}
                    value={donorAddress}
                    onChange={(e) => setDonorAddress(e.target.value)}
                    required
                  />
                </div>
                <div className={forms.field}>
                  <label className={forms.label} htmlFor="donor-postal">
                    Code postal *
                  </label>
                  <input
                    id="donor-postal"
                    className={forms.input}
                    value={donorPostalCode}
                    onChange={(e) => setDonorPostalCode(e.target.value)}
                    required
                  />
                </div>
                <div className={forms.field}>
                  <label className={forms.label} htmlFor="donor-city">
                    Ville *
                  </label>
                  <input
                    id="donor-city"
                    className={forms.input}
                    value={donorCity}
                    onChange={(e) => setDonorCity(e.target.value)}
                    required
                  />
                </div>
                <div className={forms.field}>
                  <label className={forms.label} htmlFor="donor-email">
                    E-mail
                  </label>
                  <input
                    id="donor-email"
                    type="email"
                    className={forms.input}
                    value={donorEmail}
                    onChange={(e) => setDonorEmail(e.target.value)}
                  />
                </div>
              </div>
            </FormSection>

            <FormSection icon={HeartHandshake} title="Don" description="Montant, date, moyen de paiement et trésorerie.">
              <div className={forms.sectionGrid}>
                <div className={forms.field}>
                  <label className={forms.label} htmlFor="donation-date">
                    Date du don *
                  </label>
                  <DatePicker
                    selected={date}
                    onChange={(d: Date | null) => setDate(d)}
                    dateFormat="dd/MM/yyyy"
                    customInput={<DateInput id="donation-date" required />}
                    popperContainer={PopperToBody}
                  />
                </div>
                <div className={forms.field}>
                  <label className={forms.label} htmlFor="donation-amount">
                    Montant (€) *
                  </label>
                  <input
                    id="donation-amount"
                    className={forms.input}
                    inputMode="decimal"
                    value={amountEuros}
                    onChange={(e) => setAmountEuros(e.target.value)}
                    required
                  />
                </div>
                <div className={forms.field}>
                  <label className={forms.label} htmlFor="donation-method">
                    Moyen de paiement *
                  </label>
                  <select
                    id="donation-method"
                    className={forms.select}
                    value={paymentMethod}
                    onChange={(e) =>
                      setPaymentMethod(e.target.value as (typeof DONATION_PAYMENT_METHODS)[number])
                    }
                  >
                    {DONATION_PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {donationPaymentMethodLabel(m)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={forms.field}>
                  <label className={forms.label} htmlFor="donation-treasury">
                    Compte de trésorerie *
                  </label>
                  <AppSearchableSelect
                    inputId="donation-treasury"
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
                <div className={`${forms.field} ${forms.fieldFullWidth}`}>
                  <div className={forms.checkboxRow}>
                    <input
                      id="donation-eligibility"
                      type="checkbox"
                      checked={eligibilityAttested}
                      onChange={(e) => setEligibilityAttested(e.target.checked)}
                      required
                    />
                    <label htmlFor="donation-eligibility">
                      J’atteste que ce versement est un don (pas une cotisation avec contrepartie) et que l’association
                      est un organisme d’intérêt général (art. 200 et 238 bis CGI).
                    </label>
                  </div>
                </div>
              </div>
            </FormSection>
          </div>
          <div className={forms.formActionsBar}>
            <button type="submit" className="btn btn-primary" disabled={pending || treasuryAccounts.length === 0}>
              Enregistrer et émettre le reçu
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
