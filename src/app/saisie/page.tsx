// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { prisma } from '@/lib/prisma'
import SaisieForm from './SaisieForm'
import DeleteLigneButton from './DeleteLigneButton'
import AttachDocumentButton from './AttachDocumentButton'
import { getValidatedCurrentAssociationId } from '@/lib/currentAssociationIdValidated'
import { getCurrentExerciceId } from '@/lib/exerciceContext'
import { Paperclip } from 'lucide-react'
import EntityRequiredEmptyState from '@/components/EntityRequiredEmptyState'
import FiscalYearRequiredEmptyState from '@/components/FiscalYearRequiredEmptyState'
import { getOpsLineStatusLabel } from '@/lib/opsStatus'

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

  const selectedExerciceId =
    (exerciceIdParam && fiscalYears.some((e) => e.id === exerciceIdParam)
      ? exerciceIdParam
      : cookieExerciceId && fiscalYears.some((e) => e.id === cookieExerciceId)
        ? cookieExerciceId
        : fiscalYears.find((e) => e.status === 'OPEN')?.id || fiscalYears[0]?.id) || null

  const exerciceOuvert = selectedExerciceId ? fiscalYears.find((e) => e.id === selectedExerciceId) : null

  if (!exerciceOuvert) {
    return (
      <div>
        <h1 className="page-title">Saisie Comptable</h1>
        <FiscalYearRequiredEmptyState purpose="saisie" />
      </div>
    )
  }

  // Journaux standards (assos): Banque/Caisse/Achats/Ventes/OD
  // On s'assure qu'ils existent pour alimenter correctement les selects côté UI.
  const STANDARD_JOURNAUX: { code: string; name: string }[] = [
    { code: 'AC', name: 'Achats' },
    { code: 'BQ', name: 'Banque' },
    { code: 'CA', name: 'Caisse' },
    { code: 'OD', name: 'Opérations Diverses' },
    { code: 'VE', name: 'Ventes' },
  ]

  await prisma.$transaction(
    STANDARD_JOURNAUX.map((j) =>
      prisma.journal.upsert({
        where: { code: j.code },
        update: { name: j.name },
        create: { code: j.code, name: j.name },
      })
    )
  )

  const journaux = (await prisma.journal.findMany({ orderBy: { code: 'asc' } })).map((j) => ({
    ...j,
    nom: j.name,
  }))
  const comptes = (await prisma.account.findMany({
    where: { fiscalYearId: exerciceOuvert.id },
    orderBy: { number: 'asc' }
  })).map((a) => ({ ...a, numero: a.number, libelle: a.name }))

  const [fournisseurs, clients, associationVat] = await Promise.all([
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
  ])

  const activeTab: 'ops' | 'treasury' = tab === 'treasury' ? 'treasury' : 'ops'

  const lignesRecentes =
    activeTab === 'treasury'
      ? await prisma.entryLine.findMany({
          where: {
            entry: { fiscalYearId: exerciceOuvert.id },
            accountNumber: { startsWith: '5' },
          },
          include: { entry: true, documents: { select: { id: true }, take: 1 } },
          orderBy: [{ entry: { date: 'desc' } }, { id: 'desc' }],
          take: 100,
        })
      : await prisma.entryLine.findMany({
          where: {
            entry: { fiscalYearId: exerciceOuvert.id },
            OR: [{ accountNumber: { startsWith: '6' } }, { accountNumber: { startsWith: '7' } }],
          },
          include: {
            entry: {
              include: {
                lines: {
                  where: {
                    OR: [{ accountNumber: { startsWith: '401' } }, { accountNumber: { startsWith: '411' } }],
                  },
                  include: { payableAllocations: { select: { amountCents: true } } },
                },
              },
            },
            documents: { select: { id: true }, take: 1 },
          },
          orderBy: [{ entry: { date: 'desc' } }, { id: 'desc' }],
          take: 100,
        })

  function getOpsStatusLabel(row: (typeof lignesRecentes)[number]) {
    if (activeTab !== 'ops') return ''
    const entryLines =
      (row.entry as unknown as {
        lines?: { accountNumber: string; debitCents: number; creditCents: number; payableAllocations?: { amountCents: number }[] }[]
      })?.lines ?? []

    return getOpsLineStatusLabel({
      accountNumber: row.accountNumber,
      entryLines,
    })
  }

  return (
    <div>
      <h1 className="page-title">Saisie Comptable</h1>
      
      <div className="card" style={{ marginBottom: '1.5rem' }}>
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
        />
      </div>

      <div className="card">
        <h2 className="card-title">
          {activeTab === 'treasury' ? 'Paiements / Trésorerie (comptes 5)' : 'Dépenses / Recettes (comptes 6 et 7)'}
        </h2>
        {lignesRecentes.length === 0 ? (
          <p>Aucune ligne comptable enregistrée pour l’instant.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '0.9rem 0.5rem', whiteSpace: 'nowrap' }}>Date</th>
                  <th style={{ padding: '0.9rem 0.5rem' }}>Libellé</th>
                  <th style={{ padding: '0.9rem 0.5rem' }}>Compte</th>
                  {activeTab === 'ops' ? (
                    <th style={{ padding: '0.9rem 0.5rem', whiteSpace: 'nowrap' }}>Statut</th>
                  ) : null}
                  <th style={{ padding: '0.9rem 0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Débit</th>
                  <th style={{ padding: '0.9rem 0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Crédit</th>
                  <th
                    style={{ padding: '0.9rem 0.5rem', textAlign: 'center', width: '1%' }}
                    title="Pièce"
                    aria-label="Pièce"
                  >
                    Pièce
                  </th>
                  <th style={{ padding: '0.75rem 0', textAlign: 'right', width: '1%' }}></th>
                </tr>
              </thead>
              <tbody>
                {lignesRecentes.map((l) => (
                  <tr key={l.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem 0.5rem', whiteSpace: 'nowrap' }}>
                      {new Date(l.entry.date).toLocaleDateString('fr-FR')}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      {(l.entry as { description: string; libelle?: string | null }).libelle ?? l.entry.description}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      {l.accountNumber} - {l.accountName}
                    </td>
                    {activeTab === 'ops' ? (
                      <td style={{ padding: '0.75rem 0.5rem', whiteSpace: 'nowrap' }}>
                        {getOpsStatusLabel(l)}
                      </td>
                    ) : null}
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {l.debitCents ? `${(l.debitCents / 100).toFixed(2)} €` : ''}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {l.creditCents ? `${(l.creditCents / 100).toFixed(2)} €` : ''}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap', width: '1%' }}>
                      {l.documents.length > 0 ? (
                        <span
                          aria-label="Une pièce justificative a été ajoutée"
                          className="has-tooltip"
                          data-tooltip="Justificatif ajouté"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '0.25rem 0.4rem',
                            borderRadius: '999px',
                            border: '1px solid rgba(66, 120, 186, 0.35)',
                            background: 'rgba(66, 120, 186, 0.08)',
                            color: 'var(--primary)',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            lineHeight: 1,
                          }}
                        >
                          <Paperclip size={14} aria-hidden="true" style={{ pointerEvents: 'none' }} />
                        </span>
                      ) : (
                        <AttachDocumentButton
                          ligneId={l.id}
                          ligneSummary={`${new Date(l.entry.date).toLocaleDateString('fr-FR')} · ${
                            (l.entry as { description: string; libelle?: string | null }).libelle ?? l.entry.description
                          } · ${l.accountNumber} - ${l.accountName}`}
                        />
                      )}
                    </td>
                    <td
                      style={{
                        padding: '0.5rem 0 0.5rem 0.5rem',
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                        minWidth: '44px',
                      }}
                    >
                      <DeleteLigneButton
                        ligneId={l.id}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ marginTop: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Affichage des 100 dernières lignes (plus récentes en haut).
        </p>
      </div>
    </div>
  )
}
