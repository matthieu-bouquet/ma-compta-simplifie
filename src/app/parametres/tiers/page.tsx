// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { prisma } from '@/lib/prisma'
import { getValidatedCurrentAssociationId } from '@/lib/currentAssociationIdValidated'
import ParametreLayout from '@/components/ParametreLayout'
import parametreLayoutStyles from '@/components/ParametreLayout.module.css'
import AssociationSwitcher from '@/components/AssociationSwitcher'
import EntityRequiredEmptyState from '@/components/EntityRequiredEmptyState'
import TiersTable from './TiersTable'

export default async function TiersPage() {
  const associationId = await getValidatedCurrentAssociationId()

  if (!associationId) {
    return (
      <ParametreLayout
        title="Fournisseurs et clients"
        description="Sélectionnez une entité dans le menu ci-dessus pour afficher et gérer ses tiers."
        headerActions={
          <AssociationSwitcher
            currentAssociationId={null}
            inputId="parametres-tiers-association"
            className={parametreLayoutStyles.headerEntitySwitcher}
          />
        }
      >
        <EntityRequiredEmptyState purpose="default" />
      </ParametreLayout>
    )
  }

  const [association, counterparties] = await Promise.all([
    prisma.association.findUnique({
      where: { id: associationId },
      select: { name: true },
    }),
    prisma.counterparty.findMany({
      where: { associationId },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
    }),
  ])

  const entityLabel = association?.name?.trim() || 'Cette entité'

  return (
    <ParametreLayout
      title="Fournisseurs et clients"
      description={`Tiers de « ${entityLabel} » uniquement (changez l’entité avec le sélecteur ci-dessus si besoin). Utilisés en saisie pour les comptes 401 et 411.`}
      headerActions={
        <AssociationSwitcher
          currentAssociationId={associationId}
          inputId="parametres-tiers-association"
          className={parametreLayoutStyles.headerEntitySwitcher}
        />
      }
    >
      <TiersTable
        initialRows={counterparties}
        key={counterparties.map((c) => `${c.id}:${c.updatedAt.toISOString()}`).join('|')}
      />
    </ParametreLayout>
  )
}
