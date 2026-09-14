// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getValidatedCurrentAssociationId } from '@/lib/currentAssociationIdValidated'
import { getCurrentExerciceId } from '@/lib/exerciceContext'
import { resolveSelectedFiscalYearId } from '@/lib/fiscalYearSelection'
import EntityRequiredEmptyState from '@/components/EntityRequiredEmptyState'
import FiscalYearRequiredEmptyState from '@/components/FiscalYearRequiredEmptyState'
import forms from '@/components/forms/forms.module.css'
import styles from './factures.module.css'
import InvoicesTableClient from './InvoicesTableClient'
import { listInvoices } from '@/actions/invoiceActions'
import { assertFiscalYearWritable } from '@/lib/accountingGuards'

export default async function FacturesPage({
  searchParams,
}: {
  searchParams?: Promise<{ exerciceId?: string }>
}) {
  const { exerciceId: spExerciceId } = (await searchParams) ?? {}
  const associationId = await getValidatedCurrentAssociationId()
  const cookieExerciceId = await getCurrentExerciceId()

  if (!associationId) {
    return (
      <div className={styles.page}>
        <h1 className="page-title no-topbar-pad">Factures</h1>
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
        <h1 className="page-title no-topbar-pad">Factures</h1>
        <FiscalYearRequiredEmptyState purpose="default" />
      </div>
    )
  }

  const selectedFiscalYearId = resolveSelectedFiscalYearId(fiscalYears, {
    urlExerciceId: spExerciceId,
    cookieExerciceId,
  })

  const fiscalYear = selectedFiscalYearId ? fiscalYears.find((e) => e.id === selectedFiscalYearId) : null

  if (!fiscalYear) {
    return (
      <div className={styles.page}>
        <h1 className="page-title no-topbar-pad">Factures</h1>
        <div className="card">
          <p className="text-warning">Impossible de charger l’exercice sélectionné.</p>
        </div>
      </div>
    )
  }

  let canCreate = fiscalYear.status === 'OPEN'
  try {
    await assertFiscalYearWritable({ fiscalYearId: fiscalYear.id, associationId })
  } catch {
    canCreate = false
  }

  const invoices = await listInvoices(fiscalYear.id)

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className={`page-title no-topbar-pad ${styles.pageTitle}`}>Factures</h1>
        {canCreate ? (
          <div className={styles.headerActions}>
            <Link href="/factures/new" className={`btn btn-primary ${forms.btnWithLeadingIcon}`}>
              <Plus size={18} aria-hidden="true" />
              Nouvelle facture
            </Link>
          </div>
        ) : null}
      </div>

      <div className="card">
        <p className={styles.lead}>
          Émettez des factures pour vos stages, démos ou prestations. Les informations de l’émetteur proviennent de
          l’entité (Paramètres → Entités). Vous pouvez optionnellement enregistrer une créance client (411) en compta.
        </p>
        <p className={styles.lead}>
          Une facture émise est <strong>définitive</strong> (numérotation légale) : elle n’est ni modifiable ni
          supprimable dans l’application. En cas d’erreur, il faudra émettre un avoir (fonctionnalité à venir).
        </p>
      </div>

      <InvoicesTableClient rows={invoices} />
    </div>
  )
}
