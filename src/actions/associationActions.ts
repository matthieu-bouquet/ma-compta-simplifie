'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { writeAuditEvent } from '@/lib/audit'
import { validateLegalForm } from '@/lib/legalForms'

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

export async function createAssociation(formData: FormData) {
  const name = formData.get('nom') as string
  const siret = formData.get('siret') as string
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
    legalFormCode: legalFormCode || null,
    legalFormOther: legalFormOther || null,
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
    }
  })

  revalidatePath('/parametres/associations')
  revalidatePath('/parametres/entites')
  return association
}

export async function updateAssociation(id: string, formData: FormData) {
  const name = formData.get('nom') as string
  const siret = formData.get('siret') as string
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
    }
  })

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
