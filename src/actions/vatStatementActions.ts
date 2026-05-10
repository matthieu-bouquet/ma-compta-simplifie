// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

'use server'

import { prisma } from '@/lib/prisma'
import { getCurrentAssociationId } from '@/lib/associationContext'
import { buildVatStatementPdfPayload, type VatStatementPdfPayload } from '@/lib/vatStatementPayload'

export type { VatStatementPdfPayload } from '@/lib/vatStatementPayload'

export async function getVatStatementPdfPayload(
  fiscalYearId: string,
  dateDebutIso: string,
  dateFinIso: string,
): Promise<VatStatementPdfPayload | null> {
  const associationId = await getCurrentAssociationId()
  if (!associationId) return null

  const fiscalYear = await prisma.fiscalYear.findFirst({
    where: { id: fiscalYearId, associationId },
    include: {
      association: { select: { name: true, vatLiable: true } },
    },
  })

  if (!fiscalYear) return null
  if (!fiscalYear.association.vatLiable) {
    throw new Error('État TVA disponible uniquement pour les entités assujetties à la TVA.')
  }

  const entries = await prisma.entry.findMany({
    where: { fiscalYearId },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    include: {
      journal: true,
      lines: true,
    },
  })

  try {
    return buildVatStatementPdfPayload({
      associationName: fiscalYear.association.name,
      fiscalYearStart: fiscalYear.startDate,
      fiscalYearEnd: fiscalYear.endDate,
      dateDebutIso,
      dateFinIso,
      entries,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Paramètres invalides.'
    throw new Error(msg)
  }
}
