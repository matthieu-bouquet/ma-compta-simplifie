// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { getValidatedCurrentAssociationId } from '@/lib/currentAssociationIdValidated'
import EntityRequiredEmptyState from '@/components/EntityRequiredEmptyState'
import PageBackLink from '@/components/PageBackLink'
import SeasonForm from '../SeasonForm'
import styles from '../../vie-asso.module.css'

export default async function NewSeasonPage() {
  const associationId = await getValidatedCurrentAssociationId()
  if (!associationId) {
    return (
      <div className={styles.formPage}>
        <PageBackLink href="/saisons" aria-label="Retour aux saisons" />
        <h1 className="page-title no-topbar-pad">Nouvelle saison</h1>
        <EntityRequiredEmptyState />
      </div>
    )
  }
  return <SeasonForm />
}
