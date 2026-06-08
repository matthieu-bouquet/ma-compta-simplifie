// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { prisma } from '@/lib/prisma'
import { getValidatedCurrentAssociationId } from '@/lib/currentAssociationIdValidated'
import ParametreLayout from '@/components/ParametreLayout'
import parametreLayoutStyles from '@/components/ParametreLayout.module.css'
import AssociationSwitcher from '@/components/AssociationSwitcher'
import EntityRequiredEmptyState from '@/components/EntityRequiredEmptyState'
import {
  listEntryTemplatePackSummaries,
  listRecurringExpenseTemplates,
} from '@/actions/recurringExpenseTemplateActions'
import RecurringTemplatesClient from './RecurringTemplatesClient'

function toSelectOptions(accounts: { id: string; number: string; name: string }[]) {
  return accounts.map((a) => ({
    value: a.id,
    label: `${a.number} - ${a.name}`,
    number: a.number,
  }))
}

export default async function DepensesRecurrentesPage() {
  const associationId = await getValidatedCurrentAssociationId()

  if (!associationId) {
    return (
      <ParametreLayout
        title="Modèles de saisie"
        description="Sélectionnez une entité pour gérer les modèles de saisie."
        headerActions={
          <AssociationSwitcher
            currentAssociationId={null}
            inputId="parametres-recurring-association"
            className={parametreLayoutStyles.headerEntitySwitcher}
          />
        }
      >
        <EntityRequiredEmptyState purpose="default" />
      </ParametreLayout>
    )
  }

  const [association, templates, packSummaries, counterparties, referenceFy] = await Promise.all([
    prisma.association.findUnique({
      where: { id: associationId },
      select: { name: true },
    }),
    listRecurringExpenseTemplates(associationId),
    listEntryTemplatePackSummaries(associationId),
    prisma.counterparty.findMany({
      where: { associationId },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
    }),
    prisma.fiscalYear.findFirst({
      where: { associationId, status: 'OPEN' },
      orderBy: { startDate: 'desc' },
      select: { id: true },
    }),
  ])

  const referenceFyId =
    referenceFy?.id ??
    (
      await prisma.fiscalYear.findFirst({
        where: { associationId },
        orderBy: { startDate: 'desc' },
        select: { id: true },
      })
    )?.id

  const accounts =
    referenceFyId != null
      ? await prisma.account.findMany({
          where: { fiscalYearId: referenceFyId },
          orderBy: { number: 'asc' },
        })
      : []

  const chargeOptions = toSelectOptions(accounts.filter((a) => a.number.startsWith('6')))
  const productOptions = toSelectOptions(accounts.filter((a) => a.number.startsWith('7')))
  const treasuryOptions = toSelectOptions(accounts.filter((a) => a.number.startsWith('5')))

  const supplierOptions = counterparties
    .filter((c) => c.kind === 'SUPPLIER')
    .map((c) => ({ value: c.id, label: c.name }))

  const customerOptions = counterparties
    .filter((c) => c.kind === 'CUSTOMER')
    .map((c) => ({ value: c.id, label: c.name }))

  const entityLabel = association?.name?.trim() || 'Cette entité'

  return (
    <ParametreLayout
      title="Modèles de saisie"
      description={`Modèles pour « ${entityLabel} ». Utilisables depuis l’onglet Opérations de la saisie comptable.`}
      headerActions={
        <AssociationSwitcher
          currentAssociationId={associationId}
          inputId="parametres-recurring-association"
          className={parametreLayoutStyles.headerEntitySwitcher}
        />
      }
    >
      {accounts.length === 0 ? (
        <p className="alert alert-warning">
          Aucun exercice ou plan comptable disponible pour cette entité. Créez un exercice avant
          d’ajouter des modèles avec des comptes.
        </p>
      ) : null}
      <RecurringTemplatesClient
        key={`${templates.map((t) => t.id).sort().join(',')}|${packSummaries
          .filter((p) => p.imported)
          .map((p) => p.code)
          .sort()
          .join(',')}`}
        initialRows={templates}
        initialPackSummaries={packSummaries}
        supplierOptions={supplierOptions}
        customerOptions={customerOptions}
        chargeOptions={chargeOptions}
        productOptions={productOptions}
        treasuryOptions={treasuryOptions}
        accountIdByNumber={Object.fromEntries(accounts.map((a) => [a.number, a.id]))}
      />
    </ParametreLayout>
  )
}
