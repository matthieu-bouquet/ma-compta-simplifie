// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { prisma } from '@/lib/prisma'
import SaisieForm from './SaisieForm'
import DeleteLigneButton from './DeleteLigneButton'
import AttachDocumentButton from './AttachDocumentButton'
import SaisieOpsListClient from './SaisieOpsListClient'
import { getValidatedCurrentAssociationId } from '@/lib/currentAssociationIdValidated'
import { getCurrentExerciceId } from '@/lib/exerciceContext'
import { Paperclip } from 'lucide-react'
import EntityRequiredEmptyState from '@/components/EntityRequiredEmptyState'
import FiscalYearRequiredEmptyState from '@/components/FiscalYearRequiredEmptyState'
import { listRecurringExpenseTemplates } from '@/actions/recurringExpenseTemplateActions'
import { mapOpsEntryLineToRow } from '@/lib/mapOpsListRow'
import { resolveSelectedFiscalYearId } from '@/lib/fiscalYearSelection'
import { toLocalYmd } from '@/lib/vatStatementPayload'
import styles from './saisieList.module.css'

const OPS_ENTRY_INCLUDE = {
  entry: {
    include: {
      lines: {
        include: {
          payableAllocations: {
            include: {
              settlementLine: {
                include: {
                  entry: {
                    include: {
                      lines: { where: { accountNumber: { startsWith: '5' } }, take: 1 },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  documents: {
    select: { document: { select: { id: true, mimeType: true, originalName: true } } },
    take: 1,
  },
} as const

export default async function SaisiePage({
  searchParams,
}: {
  searchParams?: Promise<{ exerciceId?: string; tab?: string }>
}) {
  const { exerciceId: exerciceIdParam, tab } = (await searchParams) ?? {}
  const associationId = await getValidatedCurrentAssociationId()
  const cookieExerciceId = await getCurrentExerciceId()

  if (!associationId) {
    return (
      <div>
        <h1 className="page-title">Saisie Comptable</h1>
        <EntityRequiredEmptyState purpose="saisie" />
      </div>
    )
  }

  const fiscalYears = await prisma.fiscalYear.findMany({
    where: { associationId },
    orderBy: { startDate: 'desc' },
  })

  const selectedExerciceId = resolveSelectedFiscalYearId(fiscalYears, {
    urlExerciceId: exerciceIdParam,
    cookieExerciceId: cookieExerciceId,
  })

  const exerciceOuvert = selectedExerciceId ? fiscalYears.find((e) => e.id === selectedExerciceId) : null

  if (!exerciceOuvert) {
    return (
      <div>
        <h1 className="page-title">Saisie Comptable</h1>
        <FiscalYearRequiredEmptyState purpose="saisie" />
      </div>
    )
  }

  const journaux = (await prisma.journal.findMany({ orderBy: { code: 'asc' } })).map((j) => ({
    ...j,
    nom: j.name,
  }))
  const comptes = (await prisma.account.findMany({
    where: { fiscalYearId: exerciceOuvert.id },
    orderBy: { number: 'asc' },
  })).map((a) => ({ ...a, numero: a.number, libelle: a.name }))

  const paymentAccountOptions = comptes
    .filter((c) => c.number.startsWith('5'))
    .map((c) => ({ value: c.id, label: `${c.number} - ${c.libelle}` }))

  const [fournisseurs, clients, associationVat, recurringTemplates] = await Promise.all([
    prisma.counterparty.findMany({
      where: { associationId, kind: 'SUPPLIER' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, kind: true },
    }),
    prisma.counterparty.findMany({
      where: { associationId, kind: 'CUSTOMER' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, kind: true },
    }),
    prisma.association.findUnique({
      where: { id: associationId },
      select: { vatLiable: true },
    }),
    listRecurringExpenseTemplates(associationId),
  ])

  const activeTab: 'ops' | 'treasury' = tab === 'treasury' ? 'treasury' : 'ops'
  const exerciceStartYmd = toLocalYmd(exerciceOuvert.startDate)
  const exerciceEndYmd = toLocalYmd(exerciceOuvert.endDate)

  const [lignesTreasury, lignesOpsRaw] = await Promise.all([
    activeTab === 'treasury'
      ? prisma.entryLine.findMany({
          where: {
            entry: { fiscalYearId: exerciceOuvert.id },
            accountNumber: { startsWith: '5' },
          },
          include: { entry: true, documents: { select: { id: true }, take: 1 } },
          orderBy: [{ entry: { date: 'desc' } }, { id: 'desc' }],
          take: 100,
        })
      : Promise.resolve([]),
    activeTab === 'ops'
      ? prisma.entryLine.findMany({
          where: {
            entry: { fiscalYearId: exerciceOuvert.id },
            OR: [{ accountNumber: { startsWith: '6' } }, { accountNumber: { startsWith: '7' } }],
          },
          include: OPS_ENTRY_INCLUDE,
          orderBy: [{ entry: { date: 'desc' } }, { id: 'desc' }],
          take: 500,
        })
      : Promise.resolve([]),
  ])

  const opsRows = lignesOpsRaw.map((l) => mapOpsEntryLineToRow(l))

  return (
    <div>
      <h1 className="page-title">Saisie Comptable</h1>

      <div className={`card ${styles.formCardSection}`}>
        <SaisieForm
          journaux={journaux}
          comptes={comptes}
          fournisseurs={fournisseurs}
          clients={clients}
          exerciceId={exerciceOuvert.id}
          exerciceStartDate={exerciceOuvert.startDate.toISOString()}
          exerciceEndDate={exerciceOuvert.endDate.toISOString()}
          vatLiable={associationVat?.vatLiable ?? false}
          initialTab={activeTab === 'treasury' ? 'TREASURY' : 'OPERATIONS'}
          recurringTemplates={recurringTemplates}
        />
      </div>

      <div className="card">
        <h2 className="card-title">
          {activeTab === 'treasury' ? 'Paiements / Trésorerie (comptes 5)' : 'Dépenses / Recettes (comptes 6 et 7)'}
        </h2>
        {activeTab === 'ops' ? (
          <SaisieOpsListClient
            rows={opsRows}
            paymentAccountOptions={paymentAccountOptions}
            exerciceStartYmd={exerciceStartYmd}
            exerciceEndYmd={exerciceEndYmd}
          />
        ) : lignesTreasury.length === 0 ? (
          <p>Aucune ligne comptable enregistrée pour l’instant.</p>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr className={styles.theadRow}>
                    <th className={`${styles.th} ${styles.nowrap}`}>Date</th>
                    <th className={styles.th}>Libellé</th>
                    <th className={styles.th}>Compte</th>
                    <th className={`${styles.th} ${styles.thRight}`}>Débit</th>
                    <th className={`${styles.th} ${styles.thRight}`}>Crédit</th>
                    <th className={styles.thCenter} title="Pièce" aria-label="Pièce">
                      Pièce
                    </th>
                    <th className={styles.thActions}></th>
                  </tr>
                </thead>
                <tbody>
                  {lignesTreasury.map((l) => (
                    <tr key={l.id} className={styles.tr}>
                      <td className={`${styles.td} ${styles.nowrap}`}>
                        {new Date(l.entry.date).toLocaleDateString('fr-FR')}
                      </td>
                      <td className={styles.td}>{l.entry.description}</td>
                      <td className={styles.td}>
                        {l.accountNumber} - {l.accountName}
                      </td>
                      <td className={`${styles.td} ${styles.tdRight}`}>
                        {l.debitCents ? `${(l.debitCents / 100).toFixed(2)} €` : ''}
                      </td>
                      <td className={`${styles.td} ${styles.tdRight}`}>
                        {l.creditCents ? `${(l.creditCents / 100).toFixed(2)} €` : ''}
                      </td>
                      <td className={styles.tdCenter}>
                        {l.documents.length > 0 ? (
                          <span
                            aria-label="Une pièce justificative a été ajoutée"
                            className={`has-tooltip ${styles.docBadge}`}
                            data-tooltip="Justificatif ajouté"
                          >
                            <Paperclip size={14} aria-hidden="true" />
                          </span>
                        ) : (
                          <AttachDocumentButton
                            ligneId={l.id}
                            ligneSummary={`${new Date(l.entry.date).toLocaleDateString('fr-FR')} · ${l.entry.description} · ${l.accountNumber} - ${l.accountName}`}
                          />
                        )}
                      </td>
                      <td className={styles.tdActions}>
                        <DeleteLigneButton ligneId={l.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={styles.footer}>Affichage des 100 dernières lignes (plus récentes en haut).</p>
          </>
        )}
      </div>
    </div>
  )
}
