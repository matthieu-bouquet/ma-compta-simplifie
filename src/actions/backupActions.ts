'use server'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { prisma } from '@/lib/prisma'

export type BackupSelectionBudget = {
  id: string
  name: string
}

export type BackupSelectionAssociation = {
  id: string
  name: string
  siret: string | null
  postalCode: string | null
  city: string | null
  fiscalYears: {
    id: string
    startDate: string
    endDate: string
    status: string
  }[]
  budgets: BackupSelectionBudget[]
}

export async function getBackupSelectionTree(): Promise<BackupSelectionAssociation[]> {
  const associations = await prisma.association.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      siret: true,
      postalCode: true,
      city: true,
      fiscalYears: {
        orderBy: { startDate: 'desc' },
        select: { id: true, startDate: true, endDate: true, status: true },
      },
      budgets: {
        orderBy: { updatedAt: 'desc' },
        select: { id: true, name: true },
      },
    },
  })

  return associations.map((a) => ({
    id: a.id,
    name: a.name,
    siret: a.siret,
    postalCode: a.postalCode,
    city: a.city,
    fiscalYears: a.fiscalYears.map((fy) => ({
      id: fy.id,
      startDate: fy.startDate.toISOString(),
      endDate: fy.endDate.toISOString(),
      status: fy.status,
    })),
    budgets: a.budgets.map((b) => ({ id: b.id, name: b.name })),
  }))
}

