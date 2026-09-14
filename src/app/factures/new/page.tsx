// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { prisma } from '@/lib/prisma'
import { getValidatedCurrentAssociationId } from '@/lib/currentAssociationIdValidated'
import { getCurrentExerciceId } from '@/lib/exerciceContext'
import { resolveSelectedFiscalYearId } from '@/lib/fiscalYearSelection'
import EntityRequiredEmptyState from '@/components/EntityRequiredEmptyState'
import FiscalYearRequiredEmptyState from '@/components/FiscalYearRequiredEmptyState'
import InvoiceForm from './InvoiceForm'
import { listCounterparties } from '@/actions/counterpartyActions'
import { COUNTERPARTY_KIND_CUSTOMER } from '@/lib/counterparty'
import { assertFiscalYearWritable } from '@/lib/accountingGuards'
import styles from '../factures.module.css'

function toSelectOptions(accounts: { id: string; number: string; name: string }[]) {
  return accounts.map((a) => ({
    value: a.id,
    label: `${a.number} - ${a.name}`,
  }))
}

export default async function NewFacturePage() {
  const associationId = await getValidatedCurrentAssociationId()
  const cookieExerciceId = await getCurrentExerciceId()

  if (!associationId) {
    return (
      <div className={styles.page}>
        <h1 className="page-title">Nouvelle facture</h1>
        <EntityRequiredEmptyState purpose="default" />
      </div>
    )
  }

  const fiscalYears = await prisma.fiscalYear.findMany({
    where: { associationId },
    orderBy: { startDate: 'desc' },
  })

  if (fiscalYears.length === 0) {
    return (
      <div className={styles.page}>
        <h1 className="page-title">Nouvelle facture</h1>
        <FiscalYearRequiredEmptyState purpose="default" />
      </div>
    )
  }

  const selectedFiscalYearId = resolveSelectedFiscalYearId(fiscalYears, {
    cookieExerciceId,
  })

  const fiscalYear = selectedFiscalYearId ? fiscalYears.find((e) => e.id === selectedFiscalYearId) : null

  if (!fiscalYear) {
    return (
      <div className={styles.page}>
        <h1 className="page-title">Nouvelle facture</h1>
        <div className="card">
          <p className="text-warning">Impossible de charger l’exercice sélectionné.</p>
        </div>
      </div>
    )
  }

  try {
    await assertFiscalYearWritable({ fiscalYearId: fiscalYear.id, associationId })
  } catch (err: unknown) {
    return (
      <div className={styles.page}>
        <h1 className="page-title">Nouvelle facture</h1>
        <div className="card">
          <p className="text-warning">
            {err instanceof Error ? err.message : 'Cet exercice ne permet pas d’émettre une facture.'}
          </p>
        </div>
      </div>
    )
  }

  const [accounts, customers] = await Promise.all([
    prisma.account.findMany({
      where: { fiscalYearId: fiscalYear.id, number: { startsWith: '7' } },
      orderBy: { number: 'asc' },
    }),
    listCounterparties(COUNTERPARTY_KIND_CUSTOMER),
  ])

  const productOptions = toSelectOptions(accounts)
  const customerOptions = customers.map((c) => ({ value: c.id, label: c.name }))

  if (productOptions.length === 0) {
    return (
      <div className={styles.page}>
        <h1 className="page-title">Nouvelle facture</h1>
        <div className="card">
          <p className="text-warning">
            Aucun compte de produits (classe 7) sur cet exercice. Complétez le plan comptable avant d’émettre une
            facture.
          </p>
        </div>
      </div>
    )
  }

  return (
    <InvoiceForm fiscalYearId={fiscalYear.id} customerOptions={customerOptions} productOptions={productOptions} />
  )
}
