// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

export type LegalFormCode =
  | 'ASSOCIATION'
  | 'AUTO_ENTREPRENEUR'
  | 'EI'
  | 'EURL'
  | 'SARL'
  | 'SASU'
  | 'SAS'
  | 'SCI'
  | 'OTHER'

export type LegalFormOption = { code: LegalFormCode; label: string }

export const LEGAL_FORM_OPTIONS: LegalFormOption[] = [
  { code: 'ASSOCIATION', label: 'Association' },
  { code: 'AUTO_ENTREPRENEUR', label: 'Micro-entrepreneur' },
  { code: 'EI', label: 'Entreprise individuelle (EI)' },
  { code: 'EURL', label: 'EURL' },
  { code: 'SARL', label: 'SARL' },
  { code: 'SASU', label: 'SASU' },
  { code: 'SAS', label: 'SAS' },
  { code: 'SCI', label: 'SCI' },
  { code: 'OTHER', label: 'Autre (préciser)' },
]

export function isLegalFormCode(value: string | null | undefined): value is LegalFormCode {
  if (!value) return false
  return LEGAL_FORM_OPTIONS.some((o) => o.code === value)
}

export function isAssociationLegalForm(code: string | null | undefined): boolean {
  return code === 'ASSOCIATION'
}

export function validateLegalForm({
  legalFormCode,
  legalFormOther,
}: {
  legalFormCode: string | null | undefined
  legalFormOther: string | null | undefined
}): { legalFormCode: LegalFormCode | null; legalFormOther: string | null } {
  if (!legalFormCode) {
    return { legalFormCode: null, legalFormOther: null }
  }

  if (!isLegalFormCode(legalFormCode)) {
    throw new Error('Forme juridique invalide')
  }

  if (legalFormCode === 'OTHER') {
    const other = (legalFormOther ?? '').trim()
    if (!other) {
      throw new Error('Veuillez préciser la forme juridique')
    }
    return { legalFormCode, legalFormOther: other }
  }

  return { legalFormCode, legalFormOther: null }
}

