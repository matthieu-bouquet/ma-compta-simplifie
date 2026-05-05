// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentAssociationId } from '@/lib/associationContext'

export const runtime = 'nodejs'

function csvEscape(v: string) {
  if (v.includes('"') || v.includes(';') || v.includes('\n') || v.includes('\r')) {
    return `"${v.replace(/"/g, '""')}"`
  }
  return v
}

function fmtDateIso(d: Date) {
  return d.toISOString().slice(0, 10)
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: exerciceId } = await params
  const associationId = await getCurrentAssociationId()
  if (!associationId) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  }

  const fiscalYear = await prisma.fiscalYear.findUnique({
    where: { id: exerciceId },
    select: { id: true, associationId: true, startDate: true, endDate: true },
  })
  if (!fiscalYear || fiscalYear.associationId !== associationId) {
    return NextResponse.json({ error: 'Exercice introuvable.' }, { status: 404 })
  }

  const entries = await prisma.entry.findMany({
    where: { fiscalYearId: exerciceId },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    include: { journal: true, lines: true },
  })

  const header = ['Date', 'Journal', 'NumeroPiece', 'Libelle', 'CompteNumero', 'CompteLibelle', 'Debit', 'Credit']

  const lines: string[] = []
  lines.push(header.join(';'))

  for (const e of entries) {
    for (const l of e.lines) {
      const debit = (l.debitCents / 100).toFixed(2)
      const credit = (l.creditCents / 100).toFixed(2)
      lines.push(
        [
          fmtDateIso(e.date),
          e.journal.code,
          e.referenceNumber ?? '',
          csvEscape(e.description ?? ''),
          l.accountNumber,
          csvEscape(l.accountName ?? ''),
          debit,
          credit,
        ].join(';')
      )
    }
  }

  const fileName = `grand_livre_${new Date(fiscalYear.startDate).getFullYear()}-${new Date(fiscalYear.endDate).getFullYear()}.csv`
  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      'Cache-Control': 'no-store',
    },
  })
}

