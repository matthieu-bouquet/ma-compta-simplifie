'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useMemo, useState, useTransition } from 'react'
import { linkDocumentToLignes, unlinkDocumentFromLigne } from '@/actions/documentActions'
import ConfirmDialog from '@/components/ConfirmDialog'
import FloatingTooltipHost from '@/components/FloatingTooltipHost'
import { Link2Off, Save } from 'lucide-react'
import forms from '@/components/forms/forms.module.css'
import styles from '../../documentsForms.module.css'

type LigneVM = {
  id: string
  date: string
  journalCode: string
  libelle: string
  compteNumero: string
  compteLibelle: string
  debit: number
  credit: number
  linked: boolean
}

export default function LinkDocumentToLignesForm({
  documentId,
  initialLinkedLigneIds,
  lignes,
}: {
  documentId: string
  initialLinkedLigneIds: string[]
  lignes: LigneVM[]
}) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set(initialLinkedLigneIds))
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return lignes
    return lignes.filter((l) => {
      const hay = `${l.journalCode} ${l.libelle} ${l.compteNumero} ${l.compteLibelle}`.toLowerCase()
      return hay.includes(q)
    })
  }, [lignes, query])

  const linkedLignes = useMemo(() => lignes.filter((l) => l.linked), [lignes])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const onSave = () => {
    setError(null)
    const ligneIds = [...selected]
    startTransition(async () => {
      try {
        await linkDocumentToLignes({ documentId, ligneIds })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur lors de la liaison.')
      }
    })
  }

  return (
    <div className={styles.linkRoot}>
      <div className={styles.linkToolbar}>
        <div className={`${forms.field} ${styles.searchField}`}>
          <label className={forms.label} htmlFor="link-doc-search">
            Rechercher une ligne
          </label>
          <input
            id="link-doc-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Journal, libellé, compte…"
            disabled={isPending}
            className={forms.input}
          />
        </div>

        <button className="btn btn-primary" type="button" onClick={onSave} disabled={isPending}>
          <span className={styles.btnInner}>
            <Save size={16} aria-hidden="true" />
            {isPending ? 'Enregistrement…' : 'Enregistrer les liaisons'}
          </span>
        </button>
      </div>

      {error ? <div className={`card ${forms.alertError}`}>{error}</div> : null}

      {linkedLignes.length > 0 ? (
        <div className={styles.linkedBox}>
          <div className={styles.linkedTitle}>Lignes déjà liées</div>
          <div className={styles.linkedList}>
            {linkedLignes.map((l) => (
              <div key={l.id} className={styles.linkedRow}>
                <div className={styles.linkedMain}>
                  <div className={styles.linkedLine1}>
                    {new Date(l.date).toLocaleDateString('fr-FR')} — {l.journalCode} — {l.libelle}
                  </div>
                  <div className={styles.linkedLine2}>
                    {l.compteNumero} — {l.compteLibelle} • {l.debit ? `${l.debit.toFixed(2)} € D` : ''}
                    {l.credit ? `${l.credit.toFixed(2)} € C` : ''}
                  </div>
                </div>

                <ConfirmDialog
                  title="Délier la ligne ?"
                  description="Le document ne sera plus associé à cette ligne comptable."
                  confirmText={isPending ? 'Déliaison…' : 'Délier'}
                  confirmTone="danger"
                  disabled={isPending}
                  trigger={({ open }) => (
                    <FloatingTooltipHost label="Supprimer la liaison">
                      <button
                        type="button"
                        className={`btn ${styles.unlinkBtn}`}
                        onClick={open}
                        disabled={isPending}
                        aria-label="Supprimer la liaison"
                      >
                        <Link2Off size={16} aria-hidden="true" />
                      </button>
                    </FloatingTooltipHost>
                  )}
                  onConfirm={({ close }) => {
                    setError(null)
                    startTransition(async () => {
                      try {
                        await unlinkDocumentFromLigne({ documentId, ligneId: l.id })
                        close()
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Erreur lors de la déliaison.')
                      }
                    })
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <div className={styles.sectionTitle}>Sélectionner des lignes à lier</div>
        <div className={styles.lineList}>
          {filtered.map((l) => {
            const checked = selected.has(l.id)
            return (
              <label
                key={l.id}
                className={`${styles.lineLabel} ${checked ? styles.lineLabelChecked : ''} ${isPending ? styles.lineLabelDisabled : ''}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={isPending}
                  onChange={() => toggle(l.id)}
                  className={styles.lineCheckbox}
                />
                <div className={styles.linkedMain}>
                  <div className={styles.linkedLine1}>
                    {new Date(l.date).toLocaleDateString('fr-FR')} — {l.journalCode} — {l.libelle}
                  </div>
                  <div className={styles.linkedLine2}>
                    {l.compteNumero} — {l.compteLibelle} • {l.debit ? `${l.debit.toFixed(2)} € D` : ''}
                    {l.credit ? `${l.credit.toFixed(2)} € C` : ''}
                  </div>
                </div>
              </label>
            )
          })}
        </div>
      </div>
    </div>
  )
}
