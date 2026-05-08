// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { prisma } from '@/lib/prisma'
import { getCurrentAssociationId } from '@/lib/associationContext'

/**
 * Returns the current association/entity id from cookies only if it still exists in DB.
 * This avoids stale cookie values (e.g. after DB reset) causing wrong empty states.
 */
export async function getValidatedCurrentAssociationId(): Promise<string | null> {
  const associationId = await getCurrentAssociationId()
  if (!associationId) return null

  const exists = await prisma.association.findUnique({
    where: { id: associationId },
    select: { id: true },
  })
  return exists ? associationId : null
}

