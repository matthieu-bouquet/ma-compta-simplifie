// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { getValidatedCurrentAssociationId } from '@/lib/currentAssociationIdValidated'
import EntityRequiredEmptyState from '@/components/EntityRequiredEmptyState'
import PageBackLink from '@/components/PageBackLink'
import MemberForm from '../MemberForm'
import styles from '../../vie-asso.module.css'

export default async function NewMemberPage() {
  const associationId = await getValidatedCurrentAssociationId()

  if (!associationId) {
    return (
      <div className={styles.formPage}>
        <PageBackLink href="/adherents" aria-label="Retour à la liste des adhérents" />
        <h1 className="page-title no-topbar-pad">Nouvel adhérent</h1>
        <EntityRequiredEmptyState />
      </div>
    )
  }

  return <MemberForm />
}
