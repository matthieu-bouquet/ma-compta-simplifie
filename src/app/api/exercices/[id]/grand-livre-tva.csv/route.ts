// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentAssociationId } from '@/lib/associationContext'
import { buildGrandLivreCsv } from '@/lib/grandLivreCsv'
import { isVatAccountNumber } from '@/lib/vatAccounts'

export const runtime = 'nodejs'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: exerciceId } = await params
  const associationId = await getCurrentAssociationId()
  if (!associationId) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  }

  const fiscalYear = await prisma.fiscalYear.findUnique({
    where: { id: exerciceId },
    select: {
      id: true,
      associationId: true,
      startDate: true,
      endDate: true,
      association: { select: { vatLiable: true } },
    },
  })

  if (!fiscalYear || fiscalYear.associationId !== associationId) {
    return NextResponse.json({ error: 'Exercice introuvable.' }, { status: 404 })
  }

  if (!fiscalYear.association.vatLiable) {
    return NextResponse.json({ error: 'Export réservé aux entités assujetties à la TVA.' }, { status: 403 })
  }

  const entries = await prisma.entry.findMany({
    where: { fiscalYearId: exerciceId },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    include: { journal: true, lines: true },
  })

  const csvBody = buildGrandLivreCsv(entries, (line) => isVatAccountNumber(line.accountNumber))

  const fileName = `grand_livre_tva_${new Date(fiscalYear.startDate).getFullYear()}-${new Date(fiscalYear.endDate).getFullYear()}.csv`
  return new Response(csvBody, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      'Cache-Control': 'no-store',
    },
  })
}
