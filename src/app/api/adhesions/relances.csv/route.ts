// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { NextResponse } from 'next/server'
import { getCurrentAssociationId } from '@/lib/associationContext'
import { listUnpaidFeesForReminder } from '@/actions/memberActions'
import { buildUnpaidDuesReminderCsv } from '@/lib/duesReminder'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const associationId = await getCurrentAssociationId()
  if (!associationId) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  }

  const url = new URL(req.url)
  const seasonId = url.searchParams.get('seasonId')
  if (!seasonId) {
    return NextResponse.json({ error: 'Saison requise.' }, { status: 400 })
  }

  try {
    const rows = await listUnpaidFeesForReminder(seasonId)
    const csv = buildUnpaidDuesReminderCsv(rows)
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="relances-cotisations.csv"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
