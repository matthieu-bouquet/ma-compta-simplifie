// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { getCurrentAssociationId } from '@/lib/associationContext'

export const getCurrentAssociation = cache(async () => {
  const associationId = await getCurrentAssociationId()
  if (!associationId) return null

  return prisma.association.findUnique({
    where: { id: associationId },
    select: {
      id: true,
      name: true,
      isClosed: true,
      legalFormCode: true,
      legalFormOther: true,
      chartTemplateId: true,
      vatLiable: true,
    },
  })
})

