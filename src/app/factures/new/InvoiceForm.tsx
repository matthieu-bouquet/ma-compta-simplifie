'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { forwardRef, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { createPortal } from 'react-dom'
import { FileText, Plus, Trash2, User } from 'lucide-react'
import FormSection from '@/components/forms/FormSection'
import AppSearchableSelect from '@/components/forms/AppSearchableSelect'
import forms from '@/components/forms/forms.module.css'
import styles from '../factures.module.css'
import PageBackLink from '@/components/PageBackLink'
import CounterpartyCreateDialog from '@/components/CounterpartyCreateDialog'
import { createInvoice, type CreateInvoiceInput } from '@/actions/invoiceActions'
import { COUNTERPARTY_KIND_CUSTOMER } from '@/lib/counterparty'
import type { Counterparty } from '@/lib/db'
import {
  calendarDateInTimeZone,
  ENTRY_DATE_TIMEZONE,
  isEntryDateAfterToday,
} from '@/lib/entryDateValidation'
import { eurosToCents, normalizeEurosAmount } from '@/lib/money'
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

type SelectOption = { value: string; label: string }

type LineDraft = {
  key: string
  description: string
  quantity: string
  unitPriceEuros: string
  amountEuros: string
  accountId: string | null
}

function newLineDraft(): LineDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    description: '',
    quantity: '',
    unitPriceEuros: '',
    amountEuros: '',
    accountId: null,
  }
}

function lineAmountCents(line: LineDraft): number {
  const qty = line.quantity.trim() ? Number(line.quantity.replace(',', '.')) : null
  const unit = line.unitPriceEuros.trim() ? Number(line.unitPriceEuros.replace(',', '.')) : null
  if (qty != null && unit != null && Number.isFinite(qty) && Number.isFinite(unit) && qty > 0 && unit > 0) {
    return eurosToCents(normalizeEurosAmount(qty * unit))
  }
  const amount = Number(line.amountEuros.replace(',', '.'))
  if (!Number.isFinite(amount) || amount <= 0) return 0
  return eurosToCents(normalizeEurosAmount(amount))
}

export default function InvoiceForm({
  fiscalYearId,
  customerOptions: initialCustomers,
  productOptions,
}: {
  fiscalYearId: string
  customerOptions: SelectOption[]
  productOptions: SelectOption[]
}) {
  const router = useRouter()
  const [customers, setCustomers] = useState(initialCustomers)
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [showCustomerCreate, setShowCustomerCreate] = useState(false)
  const [recipientName, setRecipientName] = useState('')
  const [recipientAddress, setRecipientAddress] = useState('')
  const [recipientPostalCode, setRecipientPostalCode] = useState('')
  const [recipientCity, setRecipientCity] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [recipientSiret, setRecipientSiret] = useState('')
  const [issueDate, setIssueDate] = useState<Date | null>(() => new Date())
  const [postToAccounting, setPostToAccounting] = useState(true)
  const [lines, setLines] = useState<LineDraft[]>(() => [newLineDraft()])
  const [pending, setPending] = useState(false)

  const totalCents = useMemo(() => lines.reduce((sum, l) => sum + lineAmountCents(l), 0), [lines])

  function onCustomerChange(nextId: string | null) {
    setCustomerId(nextId)
    if (nextId) {
      const opt = customers.find((c) => c.value === nextId)
      if (opt?.label) setRecipientName(opt.label)
    }
  }

  function updateLine(key: string, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function addLine() {
    setLines((prev) => [...prev, newLineDraft()])
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.key !== key)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    try {
      if (!issueDate) throw new Error('Date de facture requise.')
      const issueDateStr = calendarDateInTimeZone(issueDate, ENTRY_DATE_TIMEZONE)
      if (isEntryDateAfterToday(issueDateStr)) {
        throw new Error('La date ne peut pas être dans le futur.')
      }

      const payloadLines: CreateInvoiceInput['lines'] = []
      lines.forEach((line, idx) => {
        const amountCents = lineAmountCents(line)
        if (amountCents <= 0) throw new Error(`Ligne ${idx + 1} : montant invalide.`)
        if (!line.accountId) throw new Error(`Ligne ${idx + 1} : choisissez un compte produit.`)
        const qtyRaw = line.quantity.trim() ? Number(line.quantity.replace(',', '.')) : null
        const unitRaw = line.unitPriceEuros.trim() ? Number(line.unitPriceEuros.replace(',', '.')) : null
        payloadLines.push({
          description: line.description,
          amountCents,
          accountId: line.accountId,
          quantityMilliUnits:
            qtyRaw != null && Number.isFinite(qtyRaw) ? Math.round(qtyRaw * 1000) : null,
          unitPriceCents:
            unitRaw != null && Number.isFinite(unitRaw) ? eurosToCents(normalizeEurosAmount(unitRaw)) : null,
        })
      })

      await createInvoice({
        fiscalYearId,
        issueDate: issueDateStr,
        recipientName,
        recipientAddress: recipientAddress || null,
        recipientPostalCode: recipientPostalCode || null,
        recipientCity: recipientCity || null,
        recipientEmail: recipientEmail || null,
        recipientSiret: recipientSiret || null,
        counterpartyId: customerId,
        postToAccounting,
        lines: payloadLines,
      })

      appToast.success('Facture émise.')
      router.push('/factures')
    } catch (err: unknown) {
      appToast.error(err instanceof Error ? err.message : 'Erreur lors de l’émission.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={styles.formPage}>
      <header className={styles.formHeader}>
        <PageBackLink href="/factures" aria-label="Retour à la liste des factures" />
        <h1 className="page-title no-topbar-pad">Nouvelle facture</h1>
        <p className={styles.lead}>
          Renseignez le destinataire et les lignes (montants TTC). L’émetteur et le logo proviennent des paramètres
          entité.
        </p>
      </header>

      <div className={`card ${styles.formCard} ${styles.detailCardStatic}`}>
        <div className={styles.formCardInner}>
          <form onSubmit={handleSubmit} className={forms.formStack}>
            <div className={forms.sections}>
          <FormSection icon={User} title="Destinataire" description="Client et coordonnées affichées sur le PDF.">
            <div className={forms.sectionGrid}>
              <div className={forms.field}>
                <label className={forms.label} htmlFor="invoice-customer">
                  Client (tiers)
                </label>
                <AppSearchableSelect
                  inputId="invoice-customer"
                  options={customers}
                  value={customers.find((o) => o.value === customerId) ?? null}
                  onChange={onCustomerChange}
                  placeholder="Choisir un client…"
                />
                <button
                  type="button"
                  className={`btn ${styles.formSecondaryBtn} ${forms.btnWithLeadingIcon} ${styles.customerActions}`}
                  onClick={() => setShowCustomerCreate(true)}
                >
                  <Plus size={16} aria-hidden="true" />
                  Nouveau client
                </button>
              </div>
              <div>
                <label className={forms.label} htmlFor="invoice-recipient-name">
                  Nom affiché *
                </label>
                <input
                  id="invoice-recipient-name"
                  className={forms.input}
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={forms.label} htmlFor="invoice-recipient-address">
                  Adresse
                </label>
                <input
                  id="invoice-recipient-address"
                  className={forms.input}
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                />
              </div>
              <div>
                <label className={forms.label} htmlFor="invoice-recipient-postal">
                  Code postal
                </label>
                <input
                  id="invoice-recipient-postal"
                  className={forms.input}
                  value={recipientPostalCode}
                  onChange={(e) => setRecipientPostalCode(e.target.value)}
                />
              </div>
              <div>
                <label className={forms.label} htmlFor="invoice-recipient-city">
                  Ville
                </label>
                <input
                  id="invoice-recipient-city"
                  className={forms.input}
                  value={recipientCity}
                  onChange={(e) => setRecipientCity(e.target.value)}
                />
              </div>
              <div>
                <label className={forms.label} htmlFor="invoice-recipient-email">
                  Email
                </label>
                <input
                  id="invoice-recipient-email"
                  type="email"
                  className={forms.input}
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                />
              </div>
              <div>
                <label className={forms.label} htmlFor="invoice-recipient-siret">
                  SIRET
                </label>
                <input
                  id="invoice-recipient-siret"
                  className={forms.input}
                  value={recipientSiret}
                  onChange={(e) => setRecipientSiret(e.target.value)}
                />
              </div>
            </div>
          </FormSection>

          <FormSection icon={FileText} title="Facture" description="Date et lignes (montants TTC).">
            <div className={forms.field}>
              <label className={forms.label} htmlFor="invoice-issue-date">
                Date de facture *
              </label>
              <DatePicker
                selected={issueDate}
                onChange={(d: Date | null) => setIssueDate(d)}
                dateFormat="dd/MM/yyyy"
                customInput={<DateInput id="invoice-issue-date" required />}
                popperContainer={PopperToBody}
              />
            </div>

            {lines.map((line, index) => (
              <div key={line.key} className={styles.lineRow}>
                <div className={styles.lineFields}>
                  <div>
                    <label className={forms.label} htmlFor={`invoice-line-desc-${line.key}`}>
                      Description ligne {index + 1} *
                    </label>
                    <input
                      id={`invoice-line-desc-${line.key}`}
                      className={forms.input}
                      value={line.description}
                      onChange={(e) => updateLine(line.key, { description: e.target.value })}
                      required
                    />
                  </div>
                  <div className={styles.lineGrid}>
                    <div>
                      <label className={forms.label} htmlFor={`invoice-line-qty-${line.key}`}>
                        Quantité
                      </label>
                      <input
                        id={`invoice-line-qty-${line.key}`}
                        className={forms.input}
                        inputMode="decimal"
                        value={line.quantity}
                        onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={forms.label} htmlFor={`invoice-line-unit-${line.key}`}>
                        Prix unitaire TTC (€)
                      </label>
                      <input
                        id={`invoice-line-unit-${line.key}`}
                        className={forms.input}
                        inputMode="decimal"
                        value={line.unitPriceEuros}
                        onChange={(e) => updateLine(line.key, { unitPriceEuros: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={forms.label} htmlFor={`invoice-line-amount-${line.key}`}>
                        Montant TTC (€)
                      </label>
                      <input
                        id={`invoice-line-amount-${line.key}`}
                        className={forms.input}
                        inputMode="decimal"
                        value={line.amountEuros}
                        onChange={(e) => updateLine(line.key, { amountEuros: e.target.value })}
                        placeholder={line.quantity && line.unitPriceEuros ? 'Calculé via qté × P.U.' : ''}
                      />
                    </div>
                    <div>
                      <label className={forms.label} htmlFor={`invoice-line-account-${line.key}`}>
                        Compte produit *
                      </label>
                      <AppSearchableSelect
                        inputId={`invoice-line-account-${line.key}`}
                        options={productOptions}
                        value={productOptions.find((o) => o.value === line.accountId) ?? null}
                        onChange={(accountId) => updateLine(line.key, { accountId })}
                        placeholder="Compte classe 7…"
                      />
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className={`btn ${styles.iconBtn}`}
                  title="Supprimer la ligne"
                  aria-label={`Supprimer la ligne ${index + 1}`}
                  onClick={() => removeLine(line.key)}
                  disabled={lines.length <= 1}
                >
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              </div>
            ))}

            <button
              type="button"
              className={`btn ${styles.formSecondaryBtn} ${forms.btnWithLeadingIcon}`}
              onClick={addLine}
            >
              <Plus size={16} aria-hidden="true" />
              Ajouter une ligne
            </button>
          </FormSection>

          <FormSection
            icon={FileText}
            title="Comptabilité"
            description="Enregistrer une créance client (411), non réglée."
          >
            <div className={forms.field}>
              <div className={styles.checkboxRow}>
                <input
                  id="invoice-post-accounting"
                  type="checkbox"
                  checked={postToAccounting}
                  onChange={(e) => setPostToAccounting(e.target.checked)}
                />
                <label htmlFor="invoice-post-accounting">
                  Envoyer en compta (créance client, non réglée)
                </label>
              </div>
              <p className={forms.fieldHint}>
                Créance client : compte 411 débité ; encaissement ultérieur via « Encaissement client » en saisie.
              </p>
            </div>
          </FormSection>
            </div>

            <div className={styles.formFooter}>
          <p className={styles.totalLine}>
            Total TTC : <strong>{(totalCents / 100).toFixed(2)} €</strong>
          </p>
          <div className={styles.formFooterActions}>
            <button
              type="button"
              className={`btn ${styles.formSecondaryBtn}`}
              onClick={() => router.push('/factures')}
            >
              Annuler
            </button>
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? 'Émission…' : 'Émettre la facture'}
            </button>
          </div>
            </div>
          </form>
        </div>
      </div>

      <CounterpartyCreateDialog
        kind={COUNTERPARTY_KIND_CUSTOMER}
        title="Nouveau client"
        isOpen={showCustomerCreate}
        onClose={() => setShowCustomerCreate(false)}
        onCreated={(row: Counterparty) => {
          const opt = { value: row.id, label: row.name }
          setCustomers((prev) => [...prev, opt].sort((a, b) => a.label.localeCompare(b.label)))
          setCustomerId(row.id)
          setRecipientName(row.name)
        }}
      />
    </div>
  )
}
