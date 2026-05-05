// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { prisma } from '@/lib/prisma'
import { getCurrentAssociationId } from '@/lib/associationContext'
import { getCurrentExerciceId } from '@/lib/exerciceContext'

export default async function EcrituresPage({
  searchParams
}: {
  searchParams: { exerciceId?: string }
}) {
  const params = await searchParams; // Next.js 15: searchParams is a Promise
  const spExerciceId = params?.exerciceId;

  const associationId = await getCurrentAssociationId()
  const cookieExerciceId = await getCurrentExerciceId()

  if (!associationId) {
    return (
      <div>
        <h1 className="page-title">Grand Livre</h1>
        <div className="card">
          <p className="text-warning">Sélectionnez une association (menu en haut à droite).</p>
        </div>
      </div>
    )
  }

  const fiscalYears = await prisma.fiscalYear.findMany({
    where: { associationId },
    orderBy: { startDate: 'desc' },
  })

  if (fiscalYears.length === 0) {
    return (
      <div>
        <h1 className="page-title">Grand Livre</h1>
        <div className="card">
          <p>Aucun exercice disponible pour cette association.</p>
        </div>
      </div>
    );
  }

  const fiscalYearId =
    (spExerciceId && fiscalYears.some((e) => e.id === spExerciceId)
      ? spExerciceId
      : cookieExerciceId && fiscalYears.some((e) => e.id === cookieExerciceId)
        ? cookieExerciceId
        : fiscalYears[0].id)

  const fiscalYear = fiscalYears.find((e) => e.id === fiscalYearId)!

  const exportHref = `/api/exercices/${encodeURIComponent(fiscalYearId)}/grand-livre.csv`

  const entries = await prisma.entry.findMany({
    where: { fiscalYearId },
    orderBy: { date: 'desc' },
    include: {
      journal: true,
      lines: true
    }
  });

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 className="page-title no-topbar-pad" style={{ margin: 0 }}>
          Grand Livre - {`${new Date(fiscalYear.startDate).getFullYear()}`}
        </h1>
        <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-start' }}>
          <a className="btn btn-primary" href={exportHref} style={{ height: '32px', padding: '0 0.9rem' }}>
            Exporter CSV
          </a>
        </div>
      </div>

      <div className="card">
        {entries.length === 0 ? (
          <p>Aucune écriture comptable trouvée pour cet exercice.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-color)' }}>
                <th style={{ padding: '0.75rem' }}>Date</th>
                <th>Journal</th>
                <th>Libellé</th>
                <th>Compte</th>
                <th style={{ textAlign: 'right' }}>Débit</th>
                <th style={{ textAlign: 'right', paddingRight: '0.75rem' }}>Crédit</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <React.Fragment key={entry.id}>
                  {entry.lines.map((line, i) => (
                    <tr 
                      key={line.id} 
                      style={{ 
                        borderBottom: i === entry.lines.length - 1 ? '1px solid var(--border-color)' : 'none',
                        backgroundColor: index % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)'
                      }}
                    >
                      {i === 0 && (
                        <>
                          <td style={{ padding: '0.5rem 0.75rem' }} rowSpan={entry.lines.length}>
                            {new Date(entry.date).toLocaleDateString('fr-FR')}
                          </td>
                          <td rowSpan={entry.lines.length}>
                            <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{entry.journal.code}</span>
                          </td>
                          <td rowSpan={entry.lines.length} style={{ fontStyle: 'italic' }}>
                            {entry.description}
                          </td>
                        </>
                      )}
                      <td style={{ padding: '0.5rem 0', fontWeight: 500 }}>
                        {line.accountNumber} - {line.accountName}
                      </td>
                      <td style={{ textAlign: 'right', color: line.debitCents > 0 ? 'var(--text-primary)' : 'transparent' }}>
                        {(line.debitCents / 100).toFixed(2)} €
                      </td>
                      <td style={{ textAlign: 'right', paddingRight: '0.75rem', color: line.creditCents > 0 ? 'var(--text-primary)' : 'transparent' }}>
                        {(line.creditCents / 100).toFixed(2)} €
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// React est nécessaire pour React.Fragment
import React from 'react';
