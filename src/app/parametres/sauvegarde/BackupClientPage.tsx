'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Download, Upload } from 'lucide-react'
import styles from './sauvegarde.module.css'
import { getBackupSelectionTree, type BackupSelectionAssociation } from '@/actions/backupActions'
import ConfirmDialog from '@/components/ConfirmDialog'

type SelectionState = {
  associationIds: Set<string>
  fiscalYearIds: Set<string>
  budgetIds: Set<string>
}

function formatFyLabel(fy: { startDate: string; endDate: string }) {
  const start = new Date(fy.startDate).toLocaleDateString('fr-FR')
  const end = new Date(fy.endDate).toLocaleDateString('fr-FR')
  return `${start} → ${end}`
}

function computeAllFiscalYearIds(tree: BackupSelectionAssociation[]) {
  const ids = new Set<string>()
  for (const a of tree) {
    for (const fy of a.fiscalYears) ids.add(fy.id)
  }
  return ids
}

function computeAllBudgetIds(tree: BackupSelectionAssociation[]) {
  const ids = new Set<string>()
  for (const a of tree) {
    for (const b of a.budgets) ids.add(b.id)
  }
  return ids
}

function isFullTreeSelection(tree: BackupSelectionAssociation[], s: SelectionState) {
  if (tree.length === 0) return false
  for (const a of tree) {
    for (const fy of a.fiscalYears) {
      if (!s.fiscalYearIds.has(fy.id)) return false
    }
    for (const b of a.budgets) {
      if (!s.budgetIds.has(b.id)) return false
    }
  }
  return true
}

export default function BackupClientPage() {
  const [tree, setTree] = useState<BackupSelectionAssociation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')
  const [collapsedAssociationIds, setCollapsedAssociationIds] = useState<Set<string>>(new Set())
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importToken, setImportToken] = useState<string | null>(null)
  const [importPreview, setImportPreview] = useState<{
    summary: { associations: number; fiscalYears: number; budgets: number; documents: number }
    conflicts: {
      associations: {
        kind: 'ASSOCIATION'
        backupAssociation: { id: string; name: string; siret: string | null; postalCode: string | null; city: string | null }
        existingAssociation: { id: string; name: string; siret: string | null; postalCode: string | null; city: string | null }
      }[]
      fiscalYears: {
        kind: 'FISCAL_YEAR'
        backupFiscalYear: { id: string; associationId: string; startDate: string; endDate: string }
        existingFiscalYear: { id: string; associationId: string; startDate: string; endDate: string }
      }[]
      budgets?: {
        kind: 'BUDGET'
        matchKind: 'SAME_ID' | 'SAME_ASSOCIATION_AND_NAME'
        backupBudget: { id: string; associationId: string; name: string }
        existingBudget: { id: string; associationId: string; name: string }
      }[]
    }
  } | null>(null)
  const [overwriteAssociationIds, setOverwriteAssociationIds] = useState<Set<string>>(new Set())
  const [overwriteFiscalYearIds, setOverwriteFiscalYearIds] = useState<Set<string>>(new Set())
  const [overwriteBudgetIds, setOverwriteBudgetIds] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)

  const [selection, setSelection] = useState<SelectionState>({
    associationIds: new Set<string>(),
    fiscalYearIds: new Set<string>(),
    budgetIds: new Set<string>(),
  })

  useEffect(() => {
    async function load() {
      try {
        const data = await getBackupSelectionTree()
        setTree(data)
        setCollapsedAssociationIds(new Set(data.map((a) => a.id)))
        setSelection({
          associationIds: new Set<string>(),
          fiscalYearIds: new Set<string>(),
          budgetIds: new Set<string>(),
        })
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Erreur lors du chargement des entités/exercices')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const selectedCounts = useMemo(() => {
    const associationCount = selection.associationIds.size
    const fiscalYearCount = selection.fiscalYearIds.size
    const budgetCount = selection.budgetIds.size
    return { associationCount, fiscalYearCount, budgetCount }
  }, [selection])

  async function exportBackup() {
    setError('')
    setSuccess('')
    try {
      const fiscalYearIds = Array.from(selection.fiscalYearIds)
      const budgetIds = Array.from(selection.budgetIds)
      if (fiscalYearIds.length === 0 && budgetIds.length === 0) {
        setError('Sélectionnez au moins un exercice ou un prévisionnel.')
        return
      }

      const res = await fetch('/api/backups/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fiscalYearIds, budgetIds }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || 'Erreur lors de la génération de la sauvegarde.')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const yyyyMmDd = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      a.download = `sauvegarde_${yyyyMmDd}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setSuccess('Sauvegarde téléchargée.')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors du téléchargement.')
    }
  }

  async function previewImport() {
    setError('')
    setSuccess('')
    setImportPreview(null)
    setImportToken(null)
    setOverwriteAssociationIds(new Set())
    setOverwriteFiscalYearIds(new Set())
    setOverwriteBudgetIds(new Set())

    if (!importFile) {
      setError('Sélectionnez un fichier ZIP.')
      return
    }

    try {
      const form = new FormData()
      form.append('phase', 'preview')
      form.append('file', importFile)
      const res = await fetch('/api/backups/import', { method: 'POST', body: form })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || "Erreur lors de l'analyse de la sauvegarde.")
      }
      const data = await res.json()
      setImportToken(data.token)
      setImportPreview({ summary: data.summary, conflicts: data.conflicts })
      setSuccess('Sauvegarde analysée.')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur lors de l'analyse.")
    }
  }

  async function applyImport() {
    setError('')
    setSuccess('')
    if (!importToken) {
      setError('Analyse requise avant import.')
      return
    }

    setImporting(true)
    try {
      const form = new FormData()
      form.append('phase', 'apply')
      form.append('token', importToken)
      form.append(
        'decisions',
        JSON.stringify({
          overwriteAssociationIds: Array.from(overwriteAssociationIds),
          overwriteFiscalYearIds: Array.from(overwriteFiscalYearIds),
          overwriteBudgetIds: Array.from(overwriteBudgetIds),
        })
      )

      const res = await fetch('/api/backups/import', { method: 'POST', body: form })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || "Erreur lors de l'import.")
      }
      setSuccess('Sauvegarde importée.')
      setImportPreview(null)
      setImportToken(null)
      setImportFile(null)
      setOverwriteAssociationIds(new Set())
      setOverwriteFiscalYearIds(new Set())
      setOverwriteBudgetIds(new Set())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur lors de l'import.")
    } finally {
      setImporting(false)
    }
  }

  const hasOverwrites =
    overwriteAssociationIds.size > 0 || overwriteFiscalYearIds.size > 0 || overwriteBudgetIds.size > 0

  function budgetConflictMatchLabel(matchKind: 'SAME_ID' | 'SAME_ASSOCIATION_AND_NAME') {
    return matchKind === 'SAME_ID'
      ? 'Même identifiant que le prévisionnel existant'
      : 'Même entité et même nom (insensible à la casse)'
  }

  function toggleAll(next: boolean) {
    const associationIds = next ? new Set(tree.map((a) => a.id)) : new Set<string>()
    const fiscalYearIds = next ? computeAllFiscalYearIds(tree) : new Set<string>()
    const budgetIds = next ? computeAllBudgetIds(tree) : new Set<string>()
    setSelection({ associationIds, fiscalYearIds, budgetIds })
  }

  function toggleAssociation(association: BackupSelectionAssociation, next: boolean) {
    setSelection((prev) => {
      const associationIds = new Set(prev.associationIds)
      const fiscalYearIds = new Set(prev.fiscalYearIds)
      const budgetIds = new Set(prev.budgetIds)

      if (next) {
        associationIds.add(association.id)
        for (const fy of association.fiscalYears) fiscalYearIds.add(fy.id)
        for (const b of association.budgets) budgetIds.add(b.id)
      } else {
        associationIds.delete(association.id)
        for (const fy of association.fiscalYears) fiscalYearIds.delete(fy.id)
        for (const b of association.budgets) budgetIds.delete(b.id)
      }

      return { associationIds, fiscalYearIds, budgetIds }
    })
  }

  function toggleFiscalYear(association: BackupSelectionAssociation, fiscalYearId: string, next: boolean) {
    setSelection((prev) => {
      const associationIds = new Set(prev.associationIds)
      const fiscalYearIds = new Set(prev.fiscalYearIds)
      const budgetIds = new Set(prev.budgetIds)

      if (next) fiscalYearIds.add(fiscalYearId)
      else fiscalYearIds.delete(fiscalYearId)

      const anyFy = association.fiscalYears.some((fy) => fiscalYearIds.has(fy.id))
      const anyBudget = association.budgets.some((b) => budgetIds.has(b.id))
      if (anyFy || anyBudget) associationIds.add(association.id)
      else associationIds.delete(association.id)

      return { associationIds, fiscalYearIds, budgetIds }
    })
  }

  function toggleBudget(association: BackupSelectionAssociation, budgetId: string, next: boolean) {
    setSelection((prev) => {
      const associationIds = new Set(prev.associationIds)
      const fiscalYearIds = new Set(prev.fiscalYearIds)
      const budgetIds = new Set(prev.budgetIds)

      if (next) budgetIds.add(budgetId)
      else budgetIds.delete(budgetId)

      const anyFy = association.fiscalYears.some((fy) => fiscalYearIds.has(fy.id))
      const anyBudget = association.budgets.some((b) => budgetIds.has(b.id))
      if (anyFy || anyBudget) associationIds.add(association.id)
      else associationIds.delete(association.id)

      return { associationIds, fiscalYearIds, budgetIds }
    })
  }

  function toggleAssociationCollapsed(associationId: string) {
    setCollapsedAssociationIds((prev) => {
      const next = new Set(prev)
      if (next.has(associationId)) next.delete(associationId)
      else next.add(associationId)
      return next
    })
  }

  if (loading) return <div>Chargement...</div>

  return (
    <div className={styles.wrap}>
      {error ? <div className={`card ${styles.alertError}`}>{error}</div> : null}
      {success ? <div className={`card ${styles.alertSuccess}`}>{success}</div> : null}

      <div className={`card ${styles.card}`}>
        <div className={styles.cardHeader}>
          <div>
            <div className={styles.cardTitle}>Exporter</div>
            <div className={styles.cardSubtitle}>
              Choisissez ce que vous souhaitez exporter. L’export inclut la base de données et les documents liés.
            </div>
          </div>
        </div>

        <div className={styles.selectionSummary}>
          <div className={styles.summaryPill}>
            <strong>{selectedCounts.associationCount}</strong> entité(s)
          </div>
          <div className={styles.summaryPill}>
            <strong>{selectedCounts.fiscalYearCount}</strong> exercice(s)
          </div>
          <div className={styles.summaryPill}>
            <strong>{selectedCounts.budgetCount}</strong> prévisionnel(s)
          </div>
        </div>

        <div className={styles.tree}>
          <label className={styles.row}>
            <input
              type="checkbox"
              checked={isFullTreeSelection(tree, selection)}
              onChange={(e) => toggleAll(e.target.checked)}
              aria-label="Tout sélectionner"
            />
            <span className={styles.rowTitle}>Tout</span>
          </label>

          <div className={styles.treeChildren}>
            {tree.map((a) => {
              const associationChecked = selection.associationIds.has(a.id)
              const isCollapsed = collapsedAssociationIds.has(a.id)
              return (
                <div key={a.id} className={styles.associationBlock}>
                  <label className={styles.row}>
                    <input
                      type="checkbox"
                      checked={associationChecked}
                      onChange={(e) => toggleAssociation(a, e.target.checked)}
                      aria-label={`Sélectionner l’entité ${a.name}`}
                    />
                    <span className={styles.rowTitle}>{a.name}</span>
                    <span className={styles.rowMeta}>
                      {a.fiscalYears.length} exercice(s)
                      {a.budgets.length > 0 ? ` · ${a.budgets.length} prévisionnel(s)` : ''}
                    </span>
                    <button
                      type="button"
                      className={`btn ${styles.collapseButton}`}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        toggleAssociationCollapsed(a.id)
                      }}
                      title={isCollapsed ? 'Déplier' : 'Replier'}
                      aria-label={isCollapsed ? 'Déplier' : 'Replier'}
                    >
                      {isCollapsed ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronUp size={16} aria-hidden="true" />}
                    </button>
                  </label>

                  {isCollapsed ? null : (
                    <div className={styles.associationSelections}>
                      <div className={styles.selectionSection}>
                        <div className={styles.selectionSectionTitle}>Exercices</div>
                        {a.fiscalYears.length === 0 ? (
                          <div className={styles.emptyHint}>Aucun exercice pour cette entité.</div>
                        ) : (
                          a.fiscalYears.map((fy) => (
                            <label key={fy.id} className={styles.rowSmall}>
                              <input
                                type="checkbox"
                                checked={selection.fiscalYearIds.has(fy.id)}
                                onChange={(e) => toggleFiscalYear(a, fy.id, e.target.checked)}
                                aria-label={`Sélectionner l’exercice ${formatFyLabel(fy)} pour ${a.name}`}
                              />
                              <span className={styles.rowTitle}>{formatFyLabel(fy)}</span>
                              <span className={styles.rowMeta}>{fy.status === 'OPEN' ? 'Ouvert' : 'Clôturé'}</span>
                            </label>
                          ))
                        )}
                      </div>
                      {a.budgets.length > 0 ? (
                        <div className={styles.selectionSection}>
                          <div className={styles.selectionSectionTitle}>Prévisionnel</div>
                          {a.budgets.map((b) => (
                            <label key={b.id} className={styles.rowSmall}>
                              <input
                                type="checkbox"
                                checked={selection.budgetIds.has(b.id)}
                                onChange={(e) => toggleBudget(a, b.id, e.target.checked)}
                                aria-label={`Sélectionner le prévisionnel « ${b.name} » pour ${a.name}`}
                              />
                              <span className={styles.rowTitle}>{b.name}</span>
                            </label>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className={styles.exportActions}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={exportBackup}
          >
            <Download size={16} aria-hidden="true" />
            Télécharger la sauvegarde
          </button>
        </div>
      </div>

      <div className={`card ${styles.card}`}>
        <div className={styles.cardHeader}>
          <div>
            <div className={styles.cardTitle}>Importer</div>
            <div className={styles.cardSubtitle}>Importe une sauvegarde ZIP au même format.</div>
          </div>
        </div>

        <div className={styles.importRow}>
          <label className={styles.fileLabel} htmlFor="backup-zip">
            Fichier ZIP
          </label>
          <input
            id="backup-zip"
            type="file"
            accept=".zip"
            className={styles.fileInput}
            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
          />
          <button
            type="button"
            className="btn"
            onClick={previewImport}
            title="Analyser"
            aria-label="Analyser"
          >
            <Upload size={16} aria-hidden="true" />
            Analyser
          </button>
        </div>

        {importPreview ? (
          <div className={styles.importPreview}>
            <div className={styles.previewTitle}>Résumé</div>
            <div className={styles.previewSummary}>
              <div className={styles.summaryPill}>
                <strong>{importPreview.summary.associations}</strong> entité(s)
              </div>
              <div className={styles.summaryPill}>
                <strong>{importPreview.summary.fiscalYears}</strong> exercice(s)
              </div>
              <div className={styles.summaryPill}>
                <strong>{importPreview.summary.budgets}</strong> prévisionnel(s)
              </div>
              <div className={styles.summaryPill}>
                <strong>{importPreview.summary.documents}</strong> document(s)
              </div>
            </div>

            {importPreview.conflicts.associations.length > 0 ||
            importPreview.conflicts.fiscalYears.length > 0 ||
            (importPreview.conflicts.budgets ?? []).length > 0 ? (
              <>
                <div className={styles.previewTitle}>Conflits</div>
                {importPreview.conflicts.associations.map((c) => {
                  const checked = overwriteAssociationIds.has(c.existingAssociation.id)
                  return (
                    <label key={`a-${c.existingAssociation.id}`} className={styles.conflictRow}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = new Set(overwriteAssociationIds)
                          if (e.target.checked) next.add(c.existingAssociation.id)
                          else next.delete(c.existingAssociation.id)
                          setOverwriteAssociationIds(next)
                        }}
                        aria-label={`Écraser l’entité existante ${c.existingAssociation.name}`}
                      />
                      <span className={styles.conflictMain}>
                        Entité existante: <strong>{c.existingAssociation.name}</strong> — sauvegarde: <strong>{c.backupAssociation.name}</strong>
                      </span>
                      <span className={styles.conflictMeta}>Écraser</span>
                    </label>
                  )
                })}

                {importPreview.conflicts.fiscalYears.map((c) => {
                  const checked = overwriteFiscalYearIds.has(c.existingFiscalYear.id)
                  return (
                    <label key={`fy-${c.existingFiscalYear.id}`} className={styles.conflictRow}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = new Set(overwriteFiscalYearIds)
                          if (e.target.checked) next.add(c.existingFiscalYear.id)
                          else next.delete(c.existingFiscalYear.id)
                          setOverwriteFiscalYearIds(next)
                        }}
                        aria-label="Écraser l’exercice existant"
                      />
                      <span className={styles.conflictMain}>
                        Exercice existant — sauvegarde: <strong>{c.backupFiscalYear.startDate.slice(0, 10)}</strong> →{' '}
                        <strong>{c.backupFiscalYear.endDate.slice(0, 10)}</strong>
                      </span>
                      <span className={styles.conflictMeta}>Écraser</span>
                    </label>
                  )
                })}

                {(importPreview.conflicts.budgets ?? []).map((c) => {
                  const checked = overwriteBudgetIds.has(c.existingBudget.id)
                  return (
                    <label key={`b-${c.existingBudget.id}-${c.backupBudget.id}`} className={styles.conflictRow}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = new Set(overwriteBudgetIds)
                          if (e.target.checked) next.add(c.existingBudget.id)
                          else next.delete(c.existingBudget.id)
                          setOverwriteBudgetIds(next)
                        }}
                        aria-label={`Écraser le prévisionnel existant ${c.existingBudget.name}`}
                      />
                      <span className={styles.conflictMain}>
                        Prévisionnel existant: <strong>{c.existingBudget.name}</strong> — sauvegarde:{' '}
                        <strong>{c.backupBudget.name}</strong>
                        <span className={styles.conflictHint}> ({budgetConflictMatchLabel(c.matchKind)})</span>
                      </span>
                      <span className={styles.conflictMeta}>Écraser</span>
                    </label>
                  )
                })}
              </>
            ) : (
              <div className={styles.noConflicts}>Aucun conflit détecté.</div>
            )}

            <div className={styles.importActions}>
              {hasOverwrites ? (
                <ConfirmDialog
                  title="Écraser des données existantes"
                  description="Vous avez sélectionné l’écrasement de données existantes. Cette action est irréversible."
                  confirmText="Importer"
                  confirmTone="danger"
                  disabled={importing}
                  trigger={({ open }) => (
                    <button type="button" className="btn btn-primary" onClick={open} disabled={importing}>
                      Importer
                    </button>
                  )}
                  onConfirm={async ({ close }) => {
                    await applyImport()
                    close()
                  }}
                />
              ) : (
                <button type="button" className="btn btn-primary" onClick={applyImport} disabled={importing}>
                  Importer
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

