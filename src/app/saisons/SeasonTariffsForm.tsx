'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Tags } from 'lucide-react'
import FormSection from '@/components/forms/FormSection'
import forms from '@/components/forms/forms.module.css'
import styles from '../vie-asso.module.css'
import {
  deleteMembershipSeasonTariff,
  upsertMembershipSeasonTariffByCategoryName,
} from '@/actions/seasonActions'
import AppSearchableSelect from '@/components/forms/AppSearchableSelect'
import { DUES_ACCOUNT_WITH_COUNTERPART } from '@/lib/membership'
import { DUES_ACCOUNT_SELECT_OPTIONS, duesAccountSelectOption } from '@/lib/vieAssoSelectOptions'
import { appToast } from '@/lib/appToast'
import SeasonTariffRow from './SeasonTariffRow'

export default function SeasonTariffsForm({
  seasonId,
  tariffs,
  readOnly = false,
}: {
  seasonId: string
  tariffs: { id: string; categoryId: string; categoryName: string; amountCents: number; duesAccountNumber: string }[]
  readOnly?: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const [amount, setAmount] = useState('')
  const [account, setAccount] = useState(DUES_ACCOUNT_WITH_COUNTERPART)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    try {
      await upsertMembershipSeasonTariffByCategoryName({
        seasonId,
        categoryName,
        amountEuros: Number(amount.replace(',', '.')),
        duesAccountNumber: account,
      })
      appToast.success('Tarif de saison enregistré.')
      setCategoryName('')
      setAmount('')
      router.refresh()
    } catch (err) {
      appToast.error(err instanceof Error ? err.message : 'Erreur lors de l’enregistrement.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="card">
      <FormSection
        icon={Tags}
        title="Tarifs de la saison"
        description={
          readOnly
            ? 'Tarifs figés — saison clôturée.'
            : 'Catégories et montants pour cette saison. Chaque adhésion est liée à l’un de ces tarifs.'
        }
      >
        {tariffs.length === 0 ? (
          <p className={styles.lead}>Aucun tarif pour le moment.</p>
        ) : (
          <div className={styles.tariffTable}>
            <div className={styles.tariffTableHead} aria-hidden="true">
              <span>Catégorie</span>
              <span>Montant (€)</span>
              <span>Compte 756</span>
              <span className={styles.tariffTableHeadActions}>Actions</span>
            </div>
            <ul className={styles.tariffList}>
              {tariffs.map((t) => (
                <li key={t.id} className={styles.tariffListItem}>
                  <SeasonTariffRow
                    seasonId={seasonId}
                    tariff={t}
                    readOnly={readOnly}
                    onSaved={() => router.refresh()}
                    onDelete={async () => {
                      await deleteMembershipSeasonTariff(t.id)
                      appToast.success('Tarif supprimé.')
                      router.refresh()
                    }}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}

        {!readOnly ? (
        <div className={styles.tariffAddBlock}>
          <h3 className={forms.subsectionTitle}>Ajouter un tarif</h3>
          <form onSubmit={handleAdd} className={forms.formStack}>
            <div className={forms.sectionGrid}>
              <div className={forms.field}>
                <label className={forms.label} htmlFor="tariff-category-name">
                  Catégorie *
                </label>
                <input
                  id="tariff-category-name"
                  className={forms.input}
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="Adulte, Jeune…"
                  required
                />
                <p className={forms.fieldHint}>Crée la catégorie si elle n’existe pas encore pour l’association.</p>
              </div>
              <div className={forms.field}>
                <label className={forms.label} htmlFor="tariff-amount">
                  Tarif (€) *
                </label>
                <input
                  id="tariff-amount"
                  className={forms.input}
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className={forms.field}>
                <label className={forms.label} htmlFor="tariff-account">
                  Compte *
                </label>
                <AppSearchableSelect
                  inputId="tariff-account"
                  aria-label="Compte cotisation"
                  options={DUES_ACCOUNT_SELECT_OPTIONS}
                  value={duesAccountSelectOption(account)}
                  onChange={(next) => setAccount(next ?? DUES_ACCOUNT_WITH_COUNTERPART)}
                  placeholder="Compte 756…"
                  isClearable={false}
                />
              </div>
            </div>
            <div className={forms.formActionsBar}>
              <button type="submit" className={`btn btn-primary ${forms.btnWithLeadingIcon}`} disabled={pending}>
                <Plus size={18} aria-hidden="true" />
                Ajouter le tarif
              </button>
            </div>
          </form>
        </div>
        ) : null}
      </FormSection>
    </div>
  )
}
