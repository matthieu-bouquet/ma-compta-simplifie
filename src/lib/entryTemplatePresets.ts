// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

export type EntryTemplateEntityKind = 'ASSOCIATION' | 'TPE'

export type EntryTemplatePresetLine = {
  title: string
  operationType: 'DEPENSE' | 'RECETTE' | 'TRANSFERT'
  operationAccountNumber: string
  treasuryAccountNumber?: string | null
}

export type EntryTemplatePresetPack = {
  code: string
  name: string
  description: string
  entityKinds: EntryTemplateEntityKind[]
  autoSeedOnCreate: boolean
  templates: EntryTemplatePresetLine[]
}

export const ENTRY_TEMPLATE_PRESET_PACKS: EntryTemplatePresetPack[] = [
  {
    code: 'CORE_ASSOCIATION',
    name: 'Modèles courants',
    description: 'Cotisations, dons et frais bancaires fréquents.',
    entityKinds: ['ASSOCIATION'],
    autoSeedOnCreate: true,
    templates: [
      {
        title: 'Cotisation adhérent',
        operationType: 'RECETTE',
        operationAccountNumber: '7562',
        treasuryAccountNumber: '512',
      },
      {
        title: 'Don manuel',
        operationType: 'RECETTE',
        operationAccountNumber: '7541',
        treasuryAccountNumber: '512',
      },
      {
        title: 'Frais bancaires',
        operationType: 'DEPENSE',
        operationAccountNumber: '627',
        treasuryAccountNumber: '512',
      },
    ],
  },
  {
    code: 'EVENT_MANIFESTATION',
    name: 'Événement / manifestation',
    description: 'Inscriptions, buvette, tombola, récompenses et charges courantes d’organisation.',
    entityKinds: ['ASSOCIATION'],
    autoSeedOnCreate: false,
    templates: [
      {
        title: 'Inscription / participation',
        operationType: 'RECETTE',
        operationAccountNumber: '706',
        treasuryAccountNumber: '530',
      },
      {
        title: 'Buvette',
        operationType: 'RECETTE',
        operationAccountNumber: '707',
        treasuryAccountNumber: '530',
      },
      {
        title: 'Tombola',
        operationType: 'RECETTE',
        operationAccountNumber: '708',
        treasuryAccountNumber: '530',
      },
      {
        title: 'Repas bénévoles',
        operationType: 'DEPENSE',
        operationAccountNumber: '6257',
        treasuryAccountNumber: '512',
      },
      {
        title: 'Fournitures consommables',
        operationType: 'DEPENSE',
        operationAccountNumber: '6068',
        treasuryAccountNumber: '512',
      },
      {
        title: 'Petit matériel',
        operationType: 'DEPENSE',
        operationAccountNumber: '6063',
        treasuryAccountNumber: '512',
      },
      {
        title: 'Achats buvette',
        operationType: 'DEPENSE',
        operationAccountNumber: '607',
        treasuryAccountNumber: '512',
      },
      {
        title: 'Lots tombola',
        operationType: 'DEPENSE',
        operationAccountNumber: '607',
        treasuryAccountNumber: '512',
      },
      {
        title: 'Récompenses (coupes, médailles, diplômes)',
        operationType: 'DEPENSE',
        operationAccountNumber: '6063',
        treasuryAccountNumber: '512',
      },
    ],
  },
  {
    code: 'VIE_ASSOCIATIVE',
    name: 'Vie associative',
    description: 'Activités courantes du club : séances, entretien, réunions et trésorerie.',
    entityKinds: ['ASSOCIATION'],
    autoSeedOnCreate: false,
    templates: [
      {
        title: 'Séance / cours (participation payante)',
        operationType: 'RECETTE',
        operationAccountNumber: '706',
        treasuryAccountNumber: '512',
      },
      {
        title: 'Achat matériel pédagogique',
        operationType: 'DEPENSE',
        operationAccountNumber: '6068',
        treasuryAccountNumber: '512',
      },
      {
        title: 'Entretien local / matériel',
        operationType: 'DEPENSE',
        operationAccountNumber: '615',
        treasuryAccountNumber: '512',
      },
      {
        title: 'Repas réunion bureau',
        operationType: 'DEPENSE',
        operationAccountNumber: '6257',
        treasuryAccountNumber: '512',
      },
      {
        title: 'Virement caisse → banque',
        operationType: 'TRANSFERT',
        operationAccountNumber: '512',
        treasuryAccountNumber: '530',
      },
    ],
  },
  {
    code: 'FEDERATION',
    name: 'Fédération',
    description: 'Licence fédérale (redevance) et cotisation annuelle d’affiliation.',
    entityKinds: ['ASSOCIATION'],
    autoSeedOnCreate: false,
    templates: [
      {
        title: 'Licence fédérale (redevance)',
        operationType: 'DEPENSE',
        operationAccountNumber: '6511',
        treasuryAccountNumber: '512',
      },
      {
        title: 'Affiliation / cotisation fédérale',
        operationType: 'DEPENSE',
        operationAccountNumber: '6281',
        treasuryAccountNumber: '512',
      },
    ],
  },
]

export function getEntryTemplatePresetPack(code: string): EntryTemplatePresetPack | undefined {
  return ENTRY_TEMPLATE_PRESET_PACKS.find((p) => p.code === code)
}

export function getPackDisplayName(packCode: string | null | undefined): string | null {
  if (!packCode) return null
  return getEntryTemplatePresetPack(packCode)?.name ?? packCode
}

export function inferEntityKindFromLegalForm(
  legalFormCode: string | null | undefined,
): EntryTemplateEntityKind {
  if (!legalFormCode || legalFormCode === 'ASSOCIATION') return 'ASSOCIATION'
  return 'TPE'
}

export function listPresetPacksForEntityKind(
  entityKind: EntryTemplateEntityKind,
): EntryTemplatePresetPack[] {
  return ENTRY_TEMPLATE_PRESET_PACKS.filter((p) => p.entityKinds.includes(entityKind))
}

export function listAutoSeedPacksForEntityKind(
  entityKind: EntryTemplateEntityKind,
): EntryTemplatePresetPack[] {
  return listPresetPacksForEntityKind(entityKind).filter((p) => p.autoSeedOnCreate)
}
