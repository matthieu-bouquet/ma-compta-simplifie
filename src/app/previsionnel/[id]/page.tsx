// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { notFound } from 'next/navigation'
import PageBackLink from '@/components/PageBackLink'
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Equal,
  FileText,
  HandHeart,
  PlusCircle,
  Save,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getValidatedCurrentAssociationId } from '@/lib/currentAssociationIdValidated'
import { getCurrentAssociation } from '@/lib/currentAssociation'
import { getFiscalYears } from '@/actions/exerciceActions'
import { getBudgetDetail, updateBudgetMeta, upsertBudgetLine } from '@/actions/budgetActions'
import { buildBudgetForecastPdfPayload } from '@/lib/budgetForecastPdfPayload'
import { classifyAccount } from '@/lib/budgetClassification'
import type { FiscalYearNetTotals } from '@/lib/accountTotals'
import { findNetCentsForAccount, getNetAccountTotalsForFiscalYear } from '@/lib/accountTotals'
import { forecastVsRealizedKind } from '@/lib/budgetCompareVariance'
import { formatEurosFromCents } from '@/lib/money'
import { isAssociationLegalForm, showClass8CvnForLegalForm } from '@/lib/legalForms'
import PrefillBudgetDialog from '../PrefillBudgetDialog'
import BudgetCompareSelect from '../BudgetCompareSelect'
import DeleteBudgetButton from '../DeleteBudgetButton'
import DeleteBudgetLineButton from '../DeleteBudgetLineButton'
import AddBudgetLineForm from '../AddBudgetLineForm'
import BudgetForecastPdfDownload from '../BudgetForecastPdfDownload'
import forms from '@/components/forms/forms.module.css'
import { NumberInput } from '@/components/forms/NumberInput'
import styles from '../previsionnel.module.css'

function realizedAmountCellText(totals: FiscalYearNetTotals, accountNumber: string): string {
  const n = findNetCentsForAccount(totals, accountNumber)
  if (n === null) return '—'
  return formatEurosFromCents(Math.abs(n))
}

function ForecastVsRealizedIcon({
  totals,
  accountNumber,
  forecastCents,
}: {
  totals: FiscalYearNetTotals
  accountNumber: string
  forecastCents: number
}) {
  const kind = forecastVsRealizedKind(forecastCents, totals, accountNumber)
  if (kind === 'up') {
    const a11y = 'Prévisionnel supérieur au réalisé'
    return (
      <span className={`${styles.compareIconWrap} ${styles.compareIconUp}`} title={a11y} aria-label={a11y}>
        <ArrowUp size={16} aria-hidden="true" />
      </span>
    )
  }
  if (kind === 'equal') {
    const a11y = 'Prévisionnel égal au réalisé'
    return (
      <span className={`${styles.compareIconWrap} ${styles.compareIconEqual}`} title={a11y} aria-label={a11y}>
        <Equal size={16} aria-hidden="true" />
      </span>
    )
  }
  if (kind === 'down') {
    const a11y = 'Prévisionnel inférieur au réalisé'
    return (
      <span className={`${styles.compareIconWrap} ${styles.compareIconDown}`} title={a11y} aria-label={a11y}>
        <ArrowDown size={16} aria-hidden="true" />
      </span>
    )
  }
  return null
}

export default async function PrevisionnelDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ compareExerciceId?: string }>
}) {
  const { id } = await params
  const sp = (await searchParams) ?? {}
  const compareExerciceIdRaw = sp.compareExerciceId?.trim()
  const compareExerciceId =
    compareExerciceIdRaw && compareExerciceIdRaw.length > 0 ? compareExerciceIdRaw : null

  const associationId = await getValidatedCurrentAssociationId()
  if (!associationId) {
    return (
      <div className={styles.detailBudgetPage}>
        <h1 className="page-title">Prévisionnel</h1>
        <div className="card">
          <p className="text-warning">Sélectionnez une association (menu en haut à droite).</p>
        </div>
      </div>
    )
  }

  const budget = await getBudgetDetail(id)
  if (!budget) notFound()

  const association = await getCurrentAssociation()
  const canEdit = Boolean(association && !association.isClosed)

  const fiscalYearsFull = await getFiscalYears(associationId)
  const fiscalYearOptions = fiscalYearsFull.map((fy) => ({
    id: fy.id,
    label: `${new Date(fy.startDate).toLocaleDateString('fr-FR')} — ${new Date(fy.endDate).toLocaleDateString('fr-FR')} (${fy.status})`,
  }))

  let compareTotals: Awaited<ReturnType<typeof getNetAccountTotalsForFiscalYear>> | null = null
  if (compareExerciceId && fiscalYearsFull.some((f) => f.id === compareExerciceId)) {
    compareTotals = await getNetAccountTotalsForFiscalYear(compareExerciceId)
  }

  const templateCode =
    association?.legalFormCode && association.legalFormCode !== 'ASSOCIATION' ? 'TPE' : 'ASSOCIATION'

  const template =
    association?.chartTemplateId
      ? await prisma.chartTemplate.findUnique({ where: { id: association.chartTemplateId } })
      : await prisma.chartTemplate.upsert({
          where: { code: templateCode },
          update: { name: templateCode === 'TPE' ? 'Entreprise / TPE (modèle)' : 'Association (modèle)' },
          create: { code: templateCode, name: templateCode === 'TPE' ? 'Entreprise / TPE (modèle)' : 'Association (modèle)' },
        })
  if (!template) {
    throw new Error('Plan comptable modèle introuvable.')
  }

  const globalAccounts = await prisma.chartTemplateAccount.findMany({
    where: { chartTemplateId: template.id },
    orderBy: { number: 'asc' },
  })

  const lines = budget.lines
  const existingNumbers = new Set(lines.map((l) => l.accountNumber))

  const preferAssociationCvnUi = isAssociationLegalForm(association?.legalFormCode)

  const eligibleAccounts = globalAccounts.filter((a) => {
    const k = classifyAccount(a.number)
    if (k === 'OTHER') return false
    if (!preferAssociationCvnUi && (k === 'CVN_EMPLOI' || k === 'CVN_CONTRIBUTION')) return false
    return true
  })

  const eligibleForAdd = eligibleAccounts.filter((a) => !existingNumbers.has(a.number))

  const chargesLines = lines.filter((l) => classifyAccount(l.accountNumber) === 'CHARGE')
  const produitsLines = lines.filter((l) => classifyAccount(l.accountNumber) === 'PRODUIT')
  const cvnLines = lines.filter((l) => {
    const k = classifyAccount(l.accountNumber)
    return k === 'CVN_EMPLOI' || k === 'CVN_CONTRIBUTION'
  })

  const totalChargesCents = chargesLines.reduce((s, l) => s + l.amountCents, 0)
  const totalProduitsCents = produitsLines.reduce((s, l) => s + l.amountCents, 0)
  const resultatCents = totalProduitsCents - totalChargesCents

  const cvnEmploiCents = cvnLines
    .filter((l) => classifyAccount(l.accountNumber) === 'CVN_EMPLOI')
    .reduce((s, l) => s + l.amountCents, 0)
  const cvnContribCents = cvnLines
    .filter((l) => classifyAccount(l.accountNumber) === 'CVN_CONTRIBUTION')
    .reduce((s, l) => s + l.amountCents, 0)
  const cvnBalanced = Math.abs(cvnEmploiCents - cvnContribCents) < 1

  const showCvnSection = cvnLines.length > 0 || preferAssociationCvnUi
  const showCompareColumn = Boolean(compareTotals)

  const pdfPayload = buildBudgetForecastPdfPayload(
    {
      name: budget.name,
      updatedAt: budget.updatedAt,
      lines: budget.lines.map((l) => ({
        accountNumber: l.accountNumber,
        accountName: l.accountName,
        amountCents: l.amountCents,
      })),
    },
    association?.name ?? 'Association',
    showClass8CvnForLegalForm(association?.legalFormCode),
  )

  return (
    <div className={styles.detailBudgetPage}>
      <div className={styles.detailPageHeader}>
        <PageBackLink href="/previsionnel" aria-label="Retour à la liste des prévisionnels" />
        <h1 className="page-title no-topbar-pad">{budget.name}</h1>
        <div className={styles.detailPdfDownloadWrap}>
          <BudgetForecastPdfDownload variant="button" budgetId={budget.id} initialPayload={pdfPayload} />
        </div>
      </div>

      {!canEdit ? (
        <div className={`card ${styles.detailCardStatic}`}>
          <p className="text-warning">
            Cette association est clôturée : le prévisionnel est consultable mais non modifiable.
          </p>
        </div>
      ) : null}

      <details className={`card config-toggle ${styles.detailCardStatic} ${styles.infoDetailsBlock}`}>
        <summary className={styles.infoSummary}>
          <span className={styles.infoSummaryLeft}>
            <span className={forms.sectionIcon} aria-hidden="true">
              <FileText size={18} />
            </span>
            <span className={styles.infoSummaryText}>
              <span className={styles.infoSummaryTitle}>Informations</span>
              <span className={styles.infoSummaryDesc}>Nom affiché dans la liste et notes pour votre équipe.</span>
            </span>
          </span>
          <svg
            className={`details-chevron ${styles.infoChevron}`}
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M6 9l6 6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </summary>
        <div className={styles.infoDetailsBody}>
          <form action={updateBudgetMeta} className={forms.formGrid}>
            <input type="hidden" name="budgetId" value={budget.id} />
            <div className={forms.field}>
              <label className={forms.label} htmlFor="detail-budget-name">
                Nom
              </label>
              <input
                id="detail-budget-name"
                name="name"
                type="text"
                required
                defaultValue={budget.name}
                disabled={!canEdit}
                autoComplete="off"
                className={forms.input}
              />
            </div>
            <div className={`${forms.field} ${forms.fieldFullWidth}`}>
              <label className={forms.label} htmlFor="detail-budget-notes">
                Notes
              </label>
              <textarea
                id="detail-budget-notes"
                name="notes"
                rows={4}
                defaultValue={budget.notes ?? ''}
                disabled={!canEdit}
                placeholder="Hypothèses, arbitrages…"
                className={forms.textarea}
              />
            </div>
            {canEdit ? (
              <div className={`${forms.fieldFullWidth} ${styles.primaryActions}`}>
                <button type="submit" className="btn btn-primary">
                  Enregistrer les informations
                </button>
              </div>
            ) : null}
          </form>
        </div>
      </details>

      <div className={`card ${styles.detailCardStatic}`}>
        <div className={styles.detailSectionIntro}>
          <div className={forms.sectionIcon} aria-hidden="true">
            <PlusCircle size={18} />
          </div>
          <div>
            <h2 className={styles.detailSectionHeading}>Ajouter une ligne</h2>
            <p className={forms.sectionDescription}>Choisissez un compte du plan global pas encore présent.</p>
          </div>
        </div>
        {eligibleForAdd.length === 0 ? (
          <p className={styles.emptySectionHint}>
            Tous les comptes éligibles sont déjà présents dans ce prévisionnel.
          </p>
        ) : (
          <AddBudgetLineForm
            budgetId={budget.id}
            eligibleAccounts={eligibleForAdd.map((a) => ({ number: a.number, name: a.name }))}
            canEdit={canEdit}
          />
        )}
      </div>

      <div className={`card ${styles.detailCardStatic}`}>
        <div className={styles.detailSectionIntro}>
          <div className={forms.sectionIcon} aria-hidden="true">
            <BarChart3 size={18} />
          </div>
          <div>
            <h2 className={styles.detailSectionHeading}>Synthèse prévisionnelle</h2>
            <p className={forms.sectionDescription}>Totaux agrégés à partir des lignes saisies ci-dessous.</p>
          </div>
        </div>
        <div className={styles.synthCardInner}>
          <div className={styles.synthPill}>
            <span className={styles.synthPillLabel}>Charges</span>
            <span className={`${styles.synthPillValue} ${styles.synthCharges}`}>
              {formatEurosFromCents(totalChargesCents)}
            </span>
          </div>
          <div className={styles.synthPill}>
            <span className={styles.synthPillLabel}>Produits</span>
            <span className={`${styles.synthPillValue} ${styles.synthProduits}`}>
              {formatEurosFromCents(totalProduitsCents)}
            </span>
          </div>
          <div className={styles.synthPill}>
            <span className={styles.synthPillLabel}>Résultat</span>
            <span
              className={`${styles.synthPillValue} ${resultatCents >= 0 ? styles.resultPositive : styles.resultNegative}`}
            >
              {resultatCents >= 0 ? '+' : ''}
              {formatEurosFromCents(resultatCents)}
            </span>
          </div>
        </div>
      </div>

      <div className={`card ${styles.detailCardStatic} ${styles.toolbarCard}`}>
        <div className={styles.toolbarInner}>
          <div className={styles.toolbarActions}>
            <PrefillBudgetDialog budgetId={budget.id} fiscalYears={fiscalYearOptions} disabled={!canEdit} />
            <BudgetCompareSelect
              budgetId={budget.id}
              fiscalYears={fiscalYearOptions}
              compareExerciceId={compareExerciceId}
            />
          </div>
          {canEdit ? (
            <div className={styles.toolbarDeleteWrap}>
              <DeleteBudgetButton
                budgetId={budget.id}
                budgetName={budget.name}
                redirectAfterDelete="/previsionnel"
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className={`card ${styles.detailCardStatic}`}>
        <div className={styles.detailSectionIntro}>
          <div className={forms.sectionIcon} aria-hidden="true">
            <TrendingDown size={18} />
          </div>
          <div>
            <h2 className={styles.detailSectionHeading}>Charges (classe 6)</h2>
            <p className={forms.sectionDescription}>Montants prévisionnels des comptes de charges.</p>
          </div>
        </div>
        {chargesLines.length === 0 ? (
          <p className={styles.emptySectionHint}>Aucune ligne de charge. Utilisez le pré-remplissage ou ajoutez un compte.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table
              className={`${styles.table} ${styles.budgetLinesTable}`}
              data-variant={showCompareColumn ? 'compare' : 'solo'}
            >
              <colgroup>
                <col className={styles.budgetColAccount} />
                <col className={styles.budgetColForecast} />
                {showCompareColumn ? <col className={styles.budgetColRealized} /> : null}
                <col className={styles.budgetColTools} />
              </colgroup>
              <thead>
                <tr className={styles.tableHeadRow}>
                  <th className={styles.tableTh}>Compte</th>
                  <th className={`${styles.tableTh} ${styles.amountCell}`}>Prévisionnel</th>
                  {showCompareColumn ? (
                    <th className={`${styles.tableTh} ${styles.amountCell}`}>Réalisé</th>
                  ) : null}
                  <th
                    className={`${styles.tableTh} ${styles.rowActionsHeader}`}
                    scope="col"
                    aria-label="Actions sur la ligne"
                  />
                </tr>
              </thead>
              <tbody>
                {chargesLines.map((line) => (
                  <tr key={line.id}>
                    <td className={styles.tableTd}>
                      <span className={styles.accountCell}>
                        <span className={styles.accountNum}>{line.accountNumber}</span>
                        <span className={styles.accountSep}>—</span>
                        <span>{line.accountName}</span>
                      </span>
                    </td>
                    <td className={`${styles.tableTd} ${styles.amountCell}`}>
                      <form action={upsertBudgetLine} className={styles.lineForm}>
                        <input type="hidden" name="budgetId" value={budget.id} />
                        <input type="hidden" name="accountNumber" value={line.accountNumber} />
                        <input type="hidden" name="accountName" value={line.accountName} />
                        <label htmlFor={`amt-charges-${line.id}`} className="sr-only">
                          Montant prévisionnel (€)
                        </label>
                        {showCompareColumn && compareTotals ? (
                          <ForecastVsRealizedIcon
                            totals={compareTotals}
                            accountNumber={line.accountNumber}
                            forecastCents={line.amountCents}
                          />
                        ) : null}
                        <NumberInput
                          id={`amt-charges-${line.id}`}
                          name="amountEuros"
                          step="0.01"
                          min="0"
                          className={`${forms.compactInput} ${styles.budgetAmountInput}`}
                          defaultValue={(line.amountCents / 100).toFixed(2)}
                          disabled={!canEdit}
                        />
                        {canEdit ? (
                          <button
                            type="submit"
                            className={`btn btn-primary ${styles.saveLineIconBtn}`}
                            title="Enregistrer"
                            aria-label="Enregistrer"
                          >
                            <Save size={16} aria-hidden="true" />
                          </button>
                        ) : null}
                      </form>
                    </td>
                    {showCompareColumn ? (
                      <td className={`${styles.tableTd} ${styles.amountCell}`}>
                        {compareTotals ? realizedAmountCellText(compareTotals, line.accountNumber) : null}
                      </td>
                    ) : null}
                    <td className={`${styles.tableTd} ${styles.rowActions}`}>
                      <div className={styles.rowActionsInner}>
                        <DeleteBudgetLineButton
                          lineId={line.id}
                          accountLabel={`${line.accountNumber} — ${line.accountName}`}
                          disabled={!canEdit}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={`card ${styles.detailCardStatic}`}>
        <div className={styles.detailSectionIntro}>
          <div className={forms.sectionIcon} aria-hidden="true">
            <TrendingUp size={18} />
          </div>
          <div>
            <h2 className={styles.detailSectionHeading}>Produits (classe 7)</h2>
            <p className={forms.sectionDescription}>Montants prévisionnels des comptes de produits.</p>
          </div>
        </div>
        {produitsLines.length === 0 ? (
          <p className={styles.emptySectionHint}>Aucune ligne de produits.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table
              className={`${styles.table} ${styles.budgetLinesTable}`}
              data-variant={showCompareColumn ? 'compare' : 'solo'}
            >
              <colgroup>
                <col className={styles.budgetColAccount} />
                <col className={styles.budgetColForecast} />
                {showCompareColumn ? <col className={styles.budgetColRealized} /> : null}
                <col className={styles.budgetColTools} />
              </colgroup>
              <thead>
                <tr className={styles.tableHeadRow}>
                  <th className={styles.tableTh}>Compte</th>
                  <th className={`${styles.tableTh} ${styles.amountCell}`}>Prévisionnel</th>
                  {showCompareColumn ? (
                    <th className={`${styles.tableTh} ${styles.amountCell}`}>Réalisé</th>
                  ) : null}
                  <th
                    className={`${styles.tableTh} ${styles.rowActionsHeader}`}
                    scope="col"
                    aria-label="Actions sur la ligne"
                  />
                </tr>
              </thead>
              <tbody>
                {produitsLines.map((line) => (
                  <tr key={line.id}>
                    <td className={styles.tableTd}>
                      <span className={styles.accountCell}>
                        <span className={styles.accountNum}>{line.accountNumber}</span>
                        <span className={styles.accountSep}>—</span>
                        <span>{line.accountName}</span>
                      </span>
                    </td>
                    <td className={`${styles.tableTd} ${styles.amountCell}`}>
                      <form action={upsertBudgetLine} className={styles.lineForm}>
                        <input type="hidden" name="budgetId" value={budget.id} />
                        <input type="hidden" name="accountNumber" value={line.accountNumber} />
                        <input type="hidden" name="accountName" value={line.accountName} />
                        <label htmlFor={`amt-produits-${line.id}`} className="sr-only">
                          Montant prévisionnel (€)
                        </label>
                        {showCompareColumn && compareTotals ? (
                          <ForecastVsRealizedIcon
                            totals={compareTotals}
                            accountNumber={line.accountNumber}
                            forecastCents={line.amountCents}
                          />
                        ) : null}
                        <NumberInput
                          id={`amt-produits-${line.id}`}
                          name="amountEuros"
                          step="0.01"
                          min="0"
                          className={`${forms.compactInput} ${styles.budgetAmountInput}`}
                          defaultValue={(line.amountCents / 100).toFixed(2)}
                          disabled={!canEdit}
                        />
                        {canEdit ? (
                          <button
                            type="submit"
                            className={`btn btn-primary ${styles.saveLineIconBtn}`}
                            title="Enregistrer"
                            aria-label="Enregistrer"
                          >
                            <Save size={16} aria-hidden="true" />
                          </button>
                        ) : null}
                      </form>
                    </td>
                    {showCompareColumn ? (
                      <td className={`${styles.tableTd} ${styles.amountCell}`}>
                        {compareTotals ? realizedAmountCellText(compareTotals, line.accountNumber) : null}
                      </td>
                    ) : null}
                    <td className={`${styles.tableTd} ${styles.rowActions}`}>
                      <div className={styles.rowActionsInner}>
                        <DeleteBudgetLineButton
                          lineId={line.id}
                          accountLabel={`${line.accountNumber} — ${line.accountName}`}
                          disabled={!canEdit}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCvnSection ? (
        <div className={`card ${styles.detailCardStatic}`}>
          <div className={styles.detailSectionIntro}>
            <div className={forms.sectionIcon} aria-hidden="true">
              <HandHeart size={18} />
            </div>
            <div>
              <h2 className={styles.detailSectionHeading}>Contributions volontaires en nature (classes 86 / 87)</h2>
              <p className={forms.sectionDescription}>CVN : en prévision, les totaux 86 et 87 peuvent différer.</p>
            </div>
          </div>
          {!cvnBalanced ? (
            <div className={styles.warnBox}>
              Totaux prévisionnels 86 et 87 non équilibrés (écarts possibles en prévision ; en comptabilité les montants
              doivent être alignés).
            </div>
          ) : null}
          {cvnLines.length === 0 ? (
            <p className={styles.emptySectionHint}>
              Aucune ligne CVN. Ajoutez des comptes 86xx / 87xx depuis le bas de page si nécessaire.
            </p>
          ) : (
            <div className={styles.tableWrap}>
              <table
                className={`${styles.table} ${styles.budgetLinesTable}`}
                data-variant={showCompareColumn ? 'compare' : 'solo'}
              >
                <colgroup>
                  <col className={styles.budgetColAccount} />
                  <col className={styles.budgetColForecast} />
                  {showCompareColumn ? <col className={styles.budgetColRealized} /> : null}
                  <col className={styles.budgetColTools} />
                </colgroup>
                <thead>
                  <tr className={styles.tableHeadRow}>
                    <th className={styles.tableTh}>Compte</th>
                    <th className={`${styles.tableTh} ${styles.amountCell}`}>Prévisionnel</th>
                    {showCompareColumn ? (
                      <th className={`${styles.tableTh} ${styles.amountCell}`}>Réalisé</th>
                    ) : null}
                    <th
                      className={`${styles.tableTh} ${styles.rowActionsHeader}`}
                      scope="col"
                      aria-label="Actions sur la ligne"
                    />
                  </tr>
                </thead>
                <tbody>
                  {cvnLines.map((line) => (
                    <tr key={line.id}>
                      <td className={styles.tableTd}>
                        <span className={styles.accountCell}>
                          <span className={styles.accountNum}>{line.accountNumber}</span>
                          <span className={styles.accountSep}>—</span>
                          <span>{line.accountName}</span>
                        </span>
                      </td>
                      <td className={`${styles.tableTd} ${styles.amountCell}`}>
                        <form action={upsertBudgetLine} className={styles.lineForm}>
                          <input type="hidden" name="budgetId" value={budget.id} />
                          <input type="hidden" name="accountNumber" value={line.accountNumber} />
                          <input type="hidden" name="accountName" value={line.accountName} />
                          <label htmlFor={`amt-cvn-${line.id}`} className="sr-only">
                            Montant prévisionnel (€)
                          </label>
                          {showCompareColumn && compareTotals ? (
                            <ForecastVsRealizedIcon
                              totals={compareTotals}
                              accountNumber={line.accountNumber}
                              forecastCents={line.amountCents}
                            />
                          ) : null}
                          <NumberInput
                            id={`amt-cvn-${line.id}`}
                            name="amountEuros"
                            step="0.01"
                            min="0"
                            className={`${forms.compactInput} ${styles.budgetAmountInput}`}
                            defaultValue={(line.amountCents / 100).toFixed(2)}
                            disabled={!canEdit}
                          />
                          {canEdit ? (
                            <button
                              type="submit"
                              className={`btn btn-primary ${styles.saveLineIconBtn}`}
                              title="Enregistrer"
                              aria-label="Enregistrer"
                            >
                              <Save size={16} aria-hidden="true" />
                            </button>
                          ) : null}
                        </form>
                      </td>
                      {showCompareColumn ? (
                        <td className={`${styles.tableTd} ${styles.amountCell}`}>
                          {compareTotals ? realizedAmountCellText(compareTotals, line.accountNumber) : null}
                        </td>
                      ) : null}
                      <td className={`${styles.tableTd} ${styles.rowActions}`}>
                        <div className={styles.rowActionsInner}>
                          <DeleteBudgetLineButton
                            lineId={line.id}
                            accountLabel={`${line.accountNumber} — ${line.accountName}`}
                            disabled={!canEdit}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
