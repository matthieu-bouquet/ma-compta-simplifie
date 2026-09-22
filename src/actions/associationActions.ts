'use server'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { writeAuditEvent } from '@/lib/audit'
import { assertCreateAssociationLegalForm, assertLegalFormAllowedWithoutVatFeature, validateLegalForm } from '@/lib/legalForms'
import { isVatLiableFeatureEnabled } from '@/lib/featureFlags'
import { setCurrentAssociationId } from '@/actions/contextActions'
import { syncTemplateWithDefault } from '@/actions/planComptableActions'
import { ensureVatAccountsForAssociation } from '@/lib/vatAccounts'
import { importAutoSeedEntryTemplatePacks } from '@/lib/entryTemplateImport'
import {
  deleteStoredFile,
  saveAssociationLogoFile,
} from '@/lib/documentsStorage'
import { getCurrentAssociationId } from '@/lib/associationContext'

function inferTemplateCodeFromLegalForm(legalFormCode: string | null): 'ASSOCIATION' | 'TPE' {
  if (!legalFormCode) return 'ASSOCIATION'
  return legalFormCode === 'ASSOCIATION' ? 'ASSOCIATION' : 'TPE'
}

export async function getAssociations() {
  const rows = await prisma.association.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { fiscalYears: true }
      }
    }
  })
  // Backward-compatible shape for existing UI (FR field names).
  return rows.map((a) => ({
    ...a,
    nom: a.name,
    cloturee: a.isClosed,
    adresse: a.address,
    codePostal: a.postalCode,
    ville: a.city,
    telephone: a.phone,
    _count: { exercices: a._count.fiscalYears },
  }))
}

export async function getAssociation(id: string) {
  const association = await prisma.association.findUnique({
    where: { id },
    include: {
      fiscalYears: {
        orderBy: { startDate: 'desc' }
      }
    }
  })
  if (!association) return null
  return {
    ...association,
    nom: association.name,
    cloturee: association.isClosed,
    adresse: association.address,
    codePostal: association.postalCode,
    ville: association.city,
    telephone: association.phone,
    exercices: association.fiscalYears.map((fy) => ({
      ...fy,
      dateDebut: fy.startDate,
      dateFin: fy.endDate,
      statut: fy.status === 'OPEN' ? 'OUVERT' : 'CLOTURE',
    })),
  }
}

export type AssociationListRow = Awaited<ReturnType<typeof getAssociations>>[number]

export type AssociationDetail = NonNullable<Awaited<ReturnType<typeof getAssociation>>>

export async function createAssociation(formData: FormData) {
  const name = formData.get('nom') as string
  const siret = formData.get('siret') as string
  const vatLiable = formData.get('vatLiable') === 'on'
  const legalFormCode = formData.get('legalFormCode') as string
  const legalFormOther = formData.get('legalFormOther') as string
  const address = formData.get('adresse') as string
  const postalCode = formData.get('codePostal') as string
  const city = formData.get('ville') as string
  const email = formData.get('email') as string
  const phone = formData.get('telephone') as string

  if (!name) {
    throw new Error('Le nom de l\'association est requis')
  }

  // Vérifier l'unicité du SIRET si fourni
  if (siret) {
    const existingSiret = await prisma.association.findUnique({
      where: { siret }
    })
    if (existingSiret) {
      throw new Error('Une association avec ce SIRET existe déjà')
    }
  }

  const validatedLegalForm = validateLegalForm({
    legalFormCode: legalFormCode || 'ASSOCIATION',
    legalFormOther: legalFormOther || null,
  })
  assertCreateAssociationLegalForm(validatedLegalForm.legalFormCode)
  if (!isVatLiableFeatureEnabled()) {
    assertLegalFormAllowedWithoutVatFeature(validatedLegalForm.legalFormCode)
  }

  const templateCode = 'ASSOCIATION' as const
  const template = await prisma.chartTemplate.upsert({
    where: { code: templateCode },
    update: { name: 'Association (modèle)' },
    create: { code: templateCode, name: 'Association (modèle)' },
  })

  const association = await prisma.association.create({
    data: {
      name,
      siret: siret || null,
      address: address || null,
      postalCode: postalCode || null,
      city: city || null,
      email: email || null,
      phone: phone || null,
      legalFormCode: validatedLegalForm.legalFormCode,
      legalFormOther: validatedLegalForm.legalFormOther,
      chartTemplateId: template.id,
      vatLiable,
    }
  })

  if (vatLiable) {
    await syncTemplateWithDefault(templateCode)
    await ensureVatAccountsForAssociation(prisma, association.id)
  }

  await importAutoSeedEntryTemplatePacks(prisma, association.id)

  // Default-select the newly created entity for the user.
  await setCurrentAssociationId(association.id)

  revalidatePath('/parametres/associations')
  revalidatePath('/parametres/entites')
  return association
}

export async function updateAssociation(id: string, formData: FormData) {
  const name = formData.get('nom') as string
  const siret = formData.get('siret') as string
  const vatLiable = formData.get('vatLiable') === 'on'
  const legalFormCode = formData.get('legalFormCode') as string
  const legalFormOther = formData.get('legalFormOther') as string
  const address = formData.get('adresse') as string
  const postalCode = formData.get('codePostal') as string
  const city = formData.get('ville') as string
  const email = formData.get('email') as string
  const phone = formData.get('telephone') as string
  const rna = String(formData.get('rna') ?? '').trim()
  const socialObject = String(formData.get('socialObject') ?? '').trim()
  const receiptSignatoryName = String(formData.get('receiptSignatoryName') ?? '').trim()
  const receiptSignatoryRole = String(formData.get('receiptSignatoryRole') ?? '').trim()
  const taxReceiptEligibilityAttested = formData.get('taxReceiptEligibilityAttested') === 'on'

  if (!name) {
    throw new Error('Le nom de l\'association est requis')
  }

  // Vérifier l'unicité du SIRET si fourni et différent de l'actuel
  if (siret) {
    const existingSiret = await prisma.association.findFirst({
      where: { 
        siret,
        id: { not: id }
      }
    })
    if (existingSiret) {
      throw new Error('Une association avec ce SIRET existe déjà')
    }
  }

  const validatedLegalForm = validateLegalForm({
    legalFormCode: legalFormCode || null,
    legalFormOther: legalFormOther || null,
  })
  if (!isVatLiableFeatureEnabled()) {
    assertLegalFormAllowedWithoutVatFeature(validatedLegalForm.legalFormCode)
  }

  const templateCode = inferTemplateCodeFromLegalForm(validatedLegalForm.legalFormCode)
  const template = await prisma.chartTemplate.upsert({
    where: { code: templateCode },
    update: { name: templateCode === 'TPE' ? 'Entreprise / TPE (modèle)' : 'Association (modèle)' },
    create: { code: templateCode, name: templateCode === 'TPE' ? 'Entreprise / TPE (modèle)' : 'Association (modèle)' },
  })

  const previous = await prisma.association.findUnique({
    where: { id },
    select: { vatLiable: true },
  })

  const association = await prisma.association.update({
    where: { id },
    data: {
      name,
      siret: siret || null,
      address: address || null,
      postalCode: postalCode || null,
      city: city || null,
      email: email || null,
      phone: phone || null,
      legalFormCode: validatedLegalForm.legalFormCode,
      legalFormOther: validatedLegalForm.legalFormOther,
      chartTemplateId: template.id,
      vatLiable,
      rna: rna || null,
      socialObject: socialObject || null,
      receiptSignatoryName: receiptSignatoryName || null,
      receiptSignatoryRole: receiptSignatoryRole || null,
      taxReceiptEligibilityAttested,
    }
  })

  if (vatLiable && !previous?.vatLiable) {
    await syncTemplateWithDefault(templateCode)
    await ensureVatAccountsForAssociation(prisma, id)
  }

  revalidatePath('/parametres/associations')
  revalidatePath('/parametres/entites')
  revalidatePath(`/parametres/associations/${id}`)
  revalidatePath(`/parametres/entites/${id}`)
  return association
}

export async function deleteAssociation(id: string) {
  // Vérifier qu'il n'y a pas d'exercices liés
  const fiscalYearsCount = await prisma.fiscalYear.count({
    where: { associationId: id }
  })

  if (fiscalYearsCount > 0) {
    throw new Error(`Impossible de supprimer : ${fiscalYearsCount} exercice(s) lié(s) à cette association`)
  }

  await prisma.association.delete({
    where: { id }
  })

  revalidatePath('/parametres/associations')
  revalidatePath('/parametres/entites')
}

export async function cloturerAssociation(id: string) {
  const fiscalYearsCount = await prisma.fiscalYear.count({
    where: { associationId: id },
  })

  if (fiscalYearsCount === 0) {
    throw new Error("Impossible de clôturer : aucun exercice n'est lié à cette association")
  }

  await prisma.association.update({
    where: { id },
    data: { isClosed: true },
  })

  revalidatePath('/parametres/associations')
  revalidatePath('/parametres/entites')
  revalidatePath(`/parametres/associations/${id}`)
  revalidatePath(`/parametres/entites/${id}`)

  await writeAuditEvent({
    associationId: id,
    fiscalYearId: null,
    actor: id,
    action: 'ASSOCIATION_CLOSE',
    entityType: 'Association',
    entityId: id,
  })
}

export async function uploadAssociationLogo(associationId: string, formData: FormData) {
  const currentId = await getCurrentAssociationId()
  if (!currentId || currentId !== associationId) {
    throw new Error('Entité non autorisée.')
  }

  const file = formData.get('logo')
  if (!(file instanceof File) || file.size === 0) {
    throw new Error('Choisissez une image (PNG, JPG ou WEBP).')
  }

  const existing = await prisma.association.findUnique({
    where: { id: associationId },
    select: { logoRelativePath: true },
  })
  if (!existing) throw new Error('Entité introuvable.')

  if (existing.logoRelativePath) {
    await deleteStoredFile(existing.logoRelativePath).catch(() => undefined)
  }

  const stored = await saveAssociationLogoFile({ file, associationId })

  await prisma.association.update({
    where: { id: associationId },
    data: {
      logoRelativePath: stored.relativePath,
      logoMimeType: stored.mimeType,
      logoSizeBytes: stored.sizeBytes,
    },
  })

  await writeAuditEvent({
    associationId,
    fiscalYearId: null,
    actor: associationId,
    action: 'ASSOCIATION_LOGO_UPDATE',
    entityType: 'Association',
    entityId: associationId,
    data: { mimeType: stored.mimeType, sizeBytes: stored.sizeBytes },
  })

  revalidatePath(`/parametres/entites/${associationId}/edit`)
  revalidatePath('/factures')
}

export async function removeAssociationLogo(associationId: string) {
  const currentId = await getCurrentAssociationId()
  if (!currentId || currentId !== associationId) {
    throw new Error('Entité non autorisée.')
  }

  const existing = await prisma.association.findUnique({
    where: { id: associationId },
    select: { logoRelativePath: true },
  })
  if (!existing) throw new Error('Entité introuvable.')

  if (existing.logoRelativePath) {
    await deleteStoredFile(existing.logoRelativePath).catch(() => undefined)
  }

  await prisma.association.update({
    where: { id: associationId },
    data: {
      logoRelativePath: null,
      logoMimeType: null,
      logoSizeBytes: null,
    },
  })

  await writeAuditEvent({
    associationId,
    fiscalYearId: null,
    actor: associationId,
    action: 'ASSOCIATION_LOGO_REMOVE',
    entityType: 'Association',
    entityId: associationId,
  })

  revalidatePath(`/parametres/entites/${associationId}/edit`)
  revalidatePath('/factures')
}
