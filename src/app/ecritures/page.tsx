// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import React from 'react'
import { prisma } from '@/lib/prisma'
import { getValidatedCurrentAssociationId } from '@/lib/currentAssociationIdValidated'
import { getCurrentExerciceId } from '@/lib/exerciceContext'
import { toLocalYmd } from '@/lib/vatStatementPayload'
import EntityRequiredEmptyState from '@/components/EntityRequiredEmptyState'
import FiscalYearRequiredEmptyState from '@/components/FiscalYearRequiredEmptyState'
import EcrituresVatExports from '@/app/ecritures/EcrituresVatExports'
import styles from '@/app/ecritures/ecritures.module.css'

export default async function EcrituresPage({
  searchParams,
}: {
  searchParams?: Promise<{ exerciceId?: string }>
}) {
  const { exerciceId: spExerciceId } = (await searchParams) ?? {}

  const associationId = await getValidatedCurrentAssociationId()
  const cookieExerciceId = await getCurrentExerciceId()

  if (!associationId) {
    return (
      <div>
        <h1 className="page-title">Grand Livre</h1>
        <EntityRequiredEmptyState purpose="grandLivre" />
      </div>
    )
  }

  const [fiscalYears, association] = await Promise.all([
    prisma.fiscalYear.findMany({
      where: { associationId },
      orderBy: { startDate: 'desc' },
    }),
    prisma.association.findUnique({
      where: { id: associationId },
      select: { vatLiable: true },
    }),
  ])

  if (fiscalYears.length === 0) {
    return (
      <div>
        <h1 className="page-title">Grand Livre</h1>
        <FiscalYearRequiredEmptyState purpose="grandLivre" />
      </div>
    )
  }

  const fiscalYearId =
    spExerciceId && fiscalYears.some((e) => e.id === spExerciceId)
      ? spExerciceId
      : cookieExerciceId && fiscalYears.some((e) => e.id === cookieExerciceId)
        ? cookieExerciceId
        : fiscalYears[0].id

  const fiscalYear = fiscalYears.find((e) => e.id === fiscalYearId)!

  const exportHref = `/api/exercices/${encodeURIComponent(fiscalYearId)}/grand-livre.csv`

  const entries = await prisma.entry.findMany({
    where: { fiscalYearId },
    orderBy: { date: 'desc' },
    include: {
      journal: true,
      lines: true,
    },
  })

  const vatLiable = association?.vatLiable ?? false
  const exerciceStartYmd = toLocalYmd(fiscalYear.startDate)
  const exerciceEndYmd = toLocalYmd(fiscalYear.endDate)

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={`page-title no-topbar-pad ${styles.pageTitle}`}>
          Grand Livre - {`${new Date(fiscalYear.startDate).getFullYear()}`}
        </h1>
        <div className={styles.toolbar}>
          <a className={`btn btn-primary ${styles.toolbarBtn}`} href={exportHref}>
            Exporter CSV
          </a>
          {vatLiable ? (
            <EcrituresVatExports
              fiscalYearId={fiscalYearId}
              exerciceStartYmd={exerciceStartYmd}
              exerciceEndYmd={exerciceEndYmd}
            />
          ) : null}
        </div>
      </div>

      <div className="card">
        {entries.length === 0 ? (
          <p>Aucune écriture comptable trouvée pour cet exercice.</p>
        ) : (
          <table className={styles.tableWrap}>
            <thead>
              <tr className={styles.thRow}>
                <th className={styles.thCell}>Date</th>
                <th className={styles.thCell}>Journal</th>
                <th className={styles.thCell}>Libellé</th>
                <th className={styles.thCell}>Compte</th>
                <th className={`${styles.thCell} ${styles.thRight}`}>Débit</th>
                <th className={`${styles.thCell} ${styles.thRightPad}`}>Crédit</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <React.Fragment key={entry.id}>
                  {entry.lines.map((line, i) => (
                    <tr
                      key={line.id}
                      className={
                        i === entry.lines.length - 1
                          ? index % 2 === 0
                            ? styles.trEven
                            : styles.trOdd
                          : styles.trInner
                      }
                    >
                      {i === 0 && (
                        <>
                          <td className={styles.tdPad} rowSpan={entry.lines.length}>
                            {new Date(entry.date).toLocaleDateString('fr-FR')}
                          </td>
                          <td rowSpan={entry.lines.length}>
                            <span className={styles.journalCode}>{entry.journal.code}</span>
                          </td>
                          <td rowSpan={entry.lines.length} className={styles.libelle}>
                            {entry.description}
                          </td>
                        </>
                      )}
                      <td className={styles.tdAccount}>
                        {line.accountNumber} - {line.accountName}
                      </td>
                      <td
                        className={`${styles.cellDebit} ${
                          line.debitCents > 0 ? styles.amountCell : styles.amountCellEmpty
                        }`}
                      >
                        {(line.debitCents / 100).toFixed(2)} €
                      </td>
                      <td
                        className={`${styles.cellCredit} ${
                          line.creditCents > 0 ? styles.amountCell : styles.amountCellEmpty
                        }`}
                      >
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
