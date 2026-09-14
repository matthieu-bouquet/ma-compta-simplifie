'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { useState } from 'react'
import { ImageIcon, Trash2 } from 'lucide-react'
import FormSection from '@/components/forms/FormSection'
import forms from '@/components/forms/forms.module.css'
import ConfirmDialog from '@/components/ConfirmDialog'
import { removeAssociationLogo, uploadAssociationLogo } from '@/actions/associationActions'
import { appToast } from '@/lib/appToast'
import logoStyles from './entityLogo.module.css'

export default function EntityLogoSection({
  associationId,
  initialHasLogo,
}: {
  associationId: string
  initialHasLogo: boolean
}) {
  const [hasLogo, setHasLogo] = useState(initialHasLogo)
  const [logoVersion, setLogoVersion] = useState(0)
  const [pending, setPending] = useState(false)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPending(true)
    try {
      const fd = new FormData()
      fd.append('logo', file)
      await uploadAssociationLogo(associationId, fd)
      setHasLogo(true)
      setLogoVersion((v) => v + 1)
      appToast.success('Logo enregistré.')
    } catch (err: unknown) {
      appToast.error(err instanceof Error ? err.message : 'Erreur lors de l’upload.')
    } finally {
      setPending(false)
      e.target.value = ''
    }
  }

  async function handleRemove(close: () => void) {
    setPending(true)
    try {
      await removeAssociationLogo(associationId)
      setHasLogo(false)
      setLogoVersion((v) => v + 1)
      appToast.success('Logo supprimé.')
      close()
    } catch (err: unknown) {
      appToast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression.')
    } finally {
      setPending(false)
    }
  }

  const previewSrc = hasLogo ? `/api/associations/logo?inline=1&v=${logoVersion}` : null

  return (
    <div className="card">
      <FormSection
        icon={ImageIcon}
        title="Logo"
        description="Affiché sur les factures PDF (PNG, JPG ou WEBP, max 20 Mo)."
      >
        {previewSrc ? (
          <div className={logoStyles.previewWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewSrc} alt="Logo de l’entité" className={logoStyles.preview} />
          </div>
        ) : (
          <p className={forms.fieldHint}>Aucun logo enregistré.</p>
        )}

        <div className={logoStyles.actions}>
          <div className={forms.field}>
            <label className={forms.label} htmlFor="entity-logo-file">
              {hasLogo ? 'Remplacer le logo' : 'Ajouter un logo'}
            </label>
            <input
              id="entity-logo-file"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className={forms.fileInput}
              onChange={handleUpload}
              disabled={pending}
            />
          </div>

          {hasLogo ? (
            <ConfirmDialog
              title="Supprimer le logo"
              description="Le logo ne sera plus affiché sur les prochaines factures PDF."
              confirmText="Supprimer"
              trigger={({ open }) => (
                <button
                  type="button"
                  className={`btn btn-secondary ${forms.btnWithLeadingIcon}`}
                  onClick={open}
                  disabled={pending}
                >
                  <Trash2 size={16} aria-hidden="true" />
                  Supprimer le logo
                </button>
              )}
              onConfirm={({ close }) => handleRemove(close)}
            />
          ) : null}
        </div>
      </FormSection>
    </div>
  )
}
