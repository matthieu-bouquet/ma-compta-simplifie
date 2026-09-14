// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentAssociationId } from '@/lib/associationContext'
import { createReadStreamForRelativePath, nodeStreamToWeb } from '@/lib/documentsStorage'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const associationId = await getCurrentAssociationId()
  if (!associationId) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  }

  const association = await prisma.association.findUnique({
    where: { id: associationId },
    select: { logoRelativePath: true, logoMimeType: true, logoSizeBytes: true },
  })

  if (!association?.logoRelativePath || !association.logoMimeType) {
    return NextResponse.json({ error: 'Logo introuvable.' }, { status: 404 })
  }

  const url = new URL(req.url)
  const inline = url.searchParams.get('inline') === '1'

  const nodeStream = createReadStreamForRelativePath(association.logoRelativePath)
  const webStream = nodeStreamToWeb(nodeStream)

  return new Response(webStream, {
    headers: {
      'Content-Type': association.logoMimeType,
      'Content-Length': String(association.logoSizeBytes ?? 0),
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="logo"`,
      'Cache-Control': 'no-store',
    },
  })
}
