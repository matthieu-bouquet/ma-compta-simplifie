// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

export type EntityRequiredEmptyStatePurpose =
  | 'default'
  | 'dashboard'
  | 'saisie'
  | 'documents'
  | 'grandLivre'
  | 'exercices'
  | 'bilan'
  | 'previsionnel'
  | 'previsionnelNew'

export function getEntityRequiredCopy(purpose: EntityRequiredEmptyStatePurpose): string {
  switch (purpose) {
    case 'saisie':
      return 'Utilisez le menu en haut à droite pour choisir l’entité sur laquelle vous travaillez afin d’accéder à la saisie.'
    case 'documents':
      return 'Utilisez le menu en haut à droite pour choisir l’entité sur laquelle vous travaillez afin d’accéder aux documents.'
    case 'grandLivre':
      return 'Utilisez le menu en haut à droite pour choisir l’entité sur laquelle vous travaillez afin d’accéder au grand livre.'
    case 'exercices':
      return 'Utilisez le menu en haut à droite pour choisir l’entité sur laquelle vous travaillez afin de voir et créer les exercices.'
    case 'bilan':
      return 'Utilisez le menu en haut à droite pour choisir l’entité sur laquelle vous travaillez afin d’accéder au bilan.'
    case 'previsionnel':
      return 'Utilisez le menu en haut à droite pour choisir l’entité sur laquelle vous travaillez afin d’accéder aux prévisionnels.'
    case 'previsionnelNew':
      return 'Utilisez le menu en haut à droite pour choisir l’entité sur laquelle vous travaillez afin de créer un prévisionnel.'
    case 'dashboard':
    case 'default':
    default:
      return 'Utilisez le menu en haut à droite pour choisir l’entité sur laquelle vous travaillez.'
  }
}

export function getNoEntitiesCopy(purpose: EntityRequiredEmptyStatePurpose): string {
  switch (purpose) {
    case 'saisie':
      return 'Aucune entité n’existe encore. Créez-en une pour commencer la saisie.'
    case 'documents':
      return 'Aucune entité n’existe encore. Créez-en une pour ajouter et consulter des documents.'
    case 'grandLivre':
      return 'Aucune entité n’existe encore. Créez-en une pour accéder au grand livre.'
    case 'bilan':
      return 'Aucune entité n’existe encore. Créez-en une pour accéder au bilan.'
    case 'previsionnel':
      return 'Aucune entité n’existe encore. Créez-en une pour accéder aux prévisionnels.'
    case 'previsionnelNew':
      return 'Aucune entité n’existe encore. Créez-en une pour créer un prévisionnel.'
    case 'exercices':
    case 'dashboard':
    case 'default':
    default:
      return 'Aucune entité n’existe encore. Créez-en une pour commencer.'
  }
}

export type FiscalYearRequiredEmptyStatePurpose =
  | 'default'
  | 'saisie'
  | 'documents'
  | 'grandLivre'
  | 'bilan'
  | 'previsionnel'

export function getFiscalYearRequiredCopy(purpose: FiscalYearRequiredEmptyStatePurpose): string {
  switch (purpose) {
    case 'saisie':
      return 'Créez un exercice pour commencer la saisie comptable.'
    case 'documents':
      return 'Créez un exercice pour ajouter et consulter des documents.'
    case 'grandLivre':
      return 'Créez un exercice pour accéder au grand livre.'
    case 'bilan':
      return 'Créez un exercice pour accéder au bilan.'
    case 'previsionnel':
      return 'Créez un exercice pour comparer un prévisionnel à un réalisé.'
    case 'default':
    default:
      return 'Créez un exercice pour commencer.'
  }
}

