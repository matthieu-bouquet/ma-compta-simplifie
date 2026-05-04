'use client'

import { useState, useEffect } from 'react'
import { 
  getPlanComptableGlobal, 
  initializePlanComptableGlobal,
  addCompteToPlanGlobal,
  deleteCompteFromPlanGlobal,
  updateCompteInPlanGlobal,
  syncPlanComptableGlobalWithDefault,
} from '@/actions/planComptableActions'
import ParametreLayout from '@/components/ParametreLayout'
import ConfirmDialog from '@/components/ConfirmDialog'
import { Hash, Pencil, Plus, Trash2 } from 'lucide-react'
import FormSection from '@/components/forms/FormSection'
import forms from '@/components/forms/forms.module.css'
import styles from './planComptable.module.css'
import pageStyles from './planComptablePage.module.css'

export default function PlanComptablePage() {
  const [planComptable, setPlanComptable] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    numero: '',
    libelle: ''
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingNumero, setEditingNumero] = useState('')
  const [editingLibelle, setEditingLibelle] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    loadPlanComptable()
  }, [])

  async function loadPlanComptable() {
    try {
      let data = await getPlanComptableGlobal()
      
      // Si le plan comptable est vide, l'initialiser avec les comptes par défaut
      if (data.length === 0) {
        data = await initializePlanComptableGlobal()
        setSuccess('Plan comptable initialisé avec les comptes par défaut')
      }

      // S'assurer que le plan comptable contient les comptes par défaut (ex: classe 8)
      const sync = await syncPlanComptableGlobalWithDefault()
      if (sync.addedCount > 0) {
        setSuccess(`Plan comptable mis à jour (+${sync.addedCount} compte(s) ajouté(s))`)
      }
      data = sync.data
      
      setPlanComptable(data)
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement du plan comptable')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const form = new FormData()
      form.append('numero', formData.numero)
      form.append('libelle', formData.libelle)

      await addCompteToPlanGlobal(form)
      setSuccess('Compte ajouté avec succès')
      setFormData({ numero: '', libelle: '' })
      setShowForm(false)
      loadPlanComptable()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'ajout du compte')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteCompteFromPlanGlobal(id)
      setSuccess('Compte supprimé avec succès')
      loadPlanComptable()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression du compte')
    }
  }

  function startEdit(compte: { id: string; numero: string; libelle: string }) {
    setEditingId(compte.id)
    setEditingNumero(compte.numero)
    setEditingLibelle(compte.libelle)
    setError('')
    setSuccess('')
  }

  function cancelEdit() {
    if (savingEdit) return
    setEditingId(null)
    setEditingNumero('')
    setEditingLibelle('')
  }

  async function saveEdit(compteId: string) {
    if (!editingNumero || !editingLibelle) {
      setError('Le numéro et le libellé sont requis')
      return
    }
    setSavingEdit(true)
    setError('')
    setSuccess('')
    try {
      const form = new FormData()
      form.append('numero', editingNumero)
      form.append('libelle', editingLibelle)
      await updateCompteInPlanGlobal(compteId, form)
      setSuccess('Compte modifié avec succès')
      cancelEdit()
      await loadPlanComptable()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la modification du compte')
    } finally {
      setSavingEdit(false)
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  function groupByClasse(comptes: any[]) {
    const grouped: { [key: string]: any[] } = {}
    comptes.forEach(compte => {
      const classe = compte.numero.charAt(0)
      if (!grouped[classe]) {
        grouped[classe] = []
      }
      grouped[classe].push(compte)
    })
    return grouped
  }

  if (loading) return <div>Chargement...</div>

  const groupedComptes = groupByClasse(planComptable)

  return (
    <ParametreLayout 
      title="Plan Comptable Global"
      description="Configurer le plan comptable utilisé comme template pour la création des exercices"
    >
      <div className={pageStyles.toolbar}>
        <button type="button" onClick={() => setShowForm(!showForm)} className={`btn btn-primary ${forms.btnWithLeadingIcon}`}>
          <Plus size={18} aria-hidden="true" />
          Ajouter un compte
        </button>
      </div>

      <div className={`card ${pageStyles.noticeCard}`}>
        <p className={pageStyles.noticeText}>
          <strong>Important :</strong> Ce plan comptable sert de modèle pour la création des exercices. Chaque exercice
          aura sa propre copie de ce plan. Les modifications apportées ici n&apos;affecteront pas les exercices
          existants.
        </p>
      </div>

      {error ? <div className={`card ${forms.alertError}`}>{error}</div> : null}

      {success ? <div className={`card ${forms.alertSuccess}`}>{success}</div> : null}

      {showForm ? (
        <div className={`card ${pageStyles.formCard}`}>
          <form onSubmit={handleSubmit}>
            <FormSection
              icon={Hash}
              title="Ajouter un compte"
              description="Numéro et libellé du compte dans le plan comptable modèle (ex. 601, 512)."
            >
              <div className={forms.formGrid}>
                <div className={forms.field}>
                  <label className={forms.label} htmlFor="plan-global-numero">
                    Numéro de compte *
                  </label>
                  <input
                    id="plan-global-numero"
                    type="text"
                    name="numero"
                    value={formData.numero}
                    onChange={handleInputChange}
                    required
                    placeholder="Ex: 601, 512, etc."
                    className={forms.input}
                  />
                </div>
                <div className={forms.field}>
                  <label className={forms.label} htmlFor="plan-global-libelle">
                    Libellé *
                  </label>
                  <input
                    id="plan-global-libelle"
                    type="text"
                    name="libelle"
                    value={formData.libelle}
                    onChange={handleInputChange}
                    required
                    placeholder="Ex: Achats stockés, Banque, etc."
                    className={forms.input}
                  />
                </div>
              </div>
            </FormSection>
            <div className={forms.formActions}>
              <button type="button" onClick={() => setShowForm(false)} className={`btn ${forms.btnSecondary}`}>
                Annuler
              </button>
              <button type="submit" className={`btn btn-primary ${forms.btnWithLeadingIcon}`}>
                <Plus size={18} aria-hidden="true" />
                Ajouter
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className={pageStyles.classStack}>
        {Object.entries(groupedComptes).map(([classe, comptes]) => (
          <div key={classe} className={`card ${pageStyles.classCard}`}>
            <div className={pageStyles.classCardHead}>
              Classe {classe} — {getClasseLibelle(classe)}
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <colgroup>
                  <col className={styles.colNumber} />
                  <col />
                  <col className={styles.colActions} />
                </colgroup>
                <thead>
                  <tr>
                    <th className={styles.th}>Numéro</th>
                    <th className={styles.th}>Libellé</th>
                    <th className={`${styles.th} ${styles.thActions}`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {comptes.map((compte) => (
                    <tr key={compte.id} className={styles.row}>
                      {editingId === compte.id ? (
                        <>
                          <td className={styles.tdEdit}>
                            <label className="sr-only" htmlFor={`plan-edit-numero-${compte.id}`}>
                              Numéro de compte
                            </label>
                            <input
                              id={`plan-edit-numero-${compte.id}`}
                              value={editingNumero}
                              onChange={(e) => setEditingNumero(e.target.value)}
                              className={`${forms.input} ${pageStyles.inputTableEdit} ${pageStyles.inputTableNum}`}
                            />
                          </td>
                          <td className={styles.tdEdit}>
                            <label className="sr-only" htmlFor={`plan-edit-libelle-${compte.id}`}>
                              Libellé
                            </label>
                            <input
                              id={`plan-edit-libelle-${compte.id}`}
                              value={editingLibelle}
                              onChange={(e) => setEditingLibelle(e.target.value)}
                              className={`${forms.input} ${pageStyles.inputTableEdit}`}
                            />
                          </td>
                          <td className={`${styles.tdEdit} ${pageStyles.tdEditRight}`}>
                            <div className={pageStyles.iconRow}>
                              <button
                                type="button"
                                onClick={() => saveEdit(compte.id)}
                                disabled={savingEdit}
                                className={`btn btn-primary ${pageStyles.iconBtnSm}`}
                                title="Valider"
                                aria-label="Valider"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                  <path
                                    d="M20 6L9 17l-5-5"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                disabled={savingEdit}
                                className={`btn ${pageStyles.iconBtn}`}
                                title="Annuler"
                                aria-label="Annuler"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                  <path
                                    d="M18 6L6 18M6 6l12 12"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                  />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className={styles.tdNumber}>{compte.numero}</td>
                          <td className={styles.tdLabel}>{compte.libelle}</td>
                          <td className={styles.tdActions}>
                            <div className={pageStyles.iconRow}>
                              <button
                                type="button"
                                onClick={() => startEdit(compte)}
                                className={`btn ${pageStyles.iconBtn}`}
                                title="Modifier"
                                aria-label="Modifier"
                              >
                                <Pencil size={16} />
                              </button>

                              <ConfirmDialog
                                title="Supprimer ce compte"
                                description="Êtes-vous sûr de vouloir supprimer ?"
                                confirmText="Supprimer"
                                confirmTone="danger"
                                trigger={({ open }) => (
                                  <button
                                    type="button"
                                    onClick={open}
                                    className={`btn ${pageStyles.iconBtnDanger}`}
                                    title="Supprimer"
                                    aria-label="Supprimer"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                                onConfirm={async ({ close }) => {
                                  await handleDelete(compte.id)
                                  close()
                                }}
                              />
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {planComptable.length === 0 ? <div className={pageStyles.emptyState}>Aucun compte dans le plan comptable</div> : null}
    </ParametreLayout>
  )

}

function getClasseLibelle(classe: string): string {
  const classes: { [key: string]: string } = {
    '1': 'Comptes de capitaux',
    '2': 'Comptes d\'immobilisations',
    '3': 'Comptes de stocks',
    '4': 'Comptes de tiers',
    '5': 'Comptes financiers',
    '6': 'Comptes de charges',
    '7': 'Comptes de produits',
    '8': 'Comptes spéciaux'
  }
  return classes[classe] || 'Autres'
}
