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

/** Forms offered when FEATURE_VAT_LIABLE is off (associations / structures non assujetties au périmètre TVA). */
const NON_VAT_LIABLE_PRODUCT_LEGAL_FORM_CODES: LegalFormCode[] = ['ASSOCIATION', 'OTHER']

export function isLegalFormAllowedWithoutVatFeature(code: LegalFormCode | null): boolean {
  if (!code) return true
  return NON_VAT_LIABLE_PRODUCT_LEGAL_FORM_CODES.includes(code)
}

export function assertLegalFormAllowedWithoutVatFeature(legalFormCode: LegalFormCode | null): void {
  if (!isLegalFormAllowedWithoutVatFeature(legalFormCode)) {
    throw new Error(
      'Cette forme juridique n’est pas disponible (périmètre associations non assujetties à la TVA).',
    )
  }
}

/** Product is association-only: create UI offers Association; legacy TPE rows stay selectable on edit. */
export function legalFormSelectOptions(
  _vatFeatureEnabled: boolean,
  currentCode?: string | null,
): LegalFormOption[] {
  const allowed = LEGAL_FORM_OPTIONS.filter((o) => o.code === 'ASSOCIATION')

  if (currentCode && isLegalFormCode(currentCode) && currentCode !== 'ASSOCIATION') {
    const legacy = LEGAL_FORM_OPTIONS.find((o) => o.code === currentCode)
    if (legacy) return [...allowed, legacy]
  }

  return allowed
}

export function assertCreateAssociationLegalForm(
  legalFormCode: LegalFormCode | null,
): 'ASSOCIATION' {
  if (!legalFormCode || legalFormCode === 'ASSOCIATION') return 'ASSOCIATION'
  throw new Error('Seules les associations sont prises en charge.')
}

export function isLegalFormCode(value: string | null | undefined): value is LegalFormCode {
  if (!value) return false
  return LEGAL_FORM_OPTIONS.some((o) => o.code === value)
}

export function isAssociationLegalForm(code: string | null | undefined): boolean {
  return code === 'ASSOCIATION'
}

/** CVN / classe 8 (ANC) : affichée pour association déclarée ou forme non renseignée (comportement legacy aligné sur le modèle de plan). */
export function showClass8CvnForLegalForm(code: string | null | undefined): boolean {
  return code == null || code === 'ASSOCIATION'
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

