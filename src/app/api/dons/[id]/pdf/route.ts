// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentAssociationId } from '@/lib/associationContext'
import {
  createReadStreamForRelativePath,
  nodeStreamToWeb,
  toAbsolutePath,
} from '@/lib/documentsStorage'
import fsp from 'fs/promises'
import path from 'path'

export const runtime = 'nodejs'

function safeDownloadName(originalName: string) {
  const base = path.basename(originalName || '')
  return base.trim() || 'recu-fiscal.pdf'
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const associationId = await getCurrentAssociationId()
  if (!associationId) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  }

  const donation = await prisma.donation.findUnique({
    where: { id },
    include: { taxReceipt: true },
  })
  if (!donation || donation.associationId !== associationId || !donation.taxReceipt?.pdfDocumentId) {
    return NextResponse.json({ error: 'Reçu introuvable.' }, { status: 404 })
  }

  const doc = await prisma.document.findUnique({
    where: { id: donation.taxReceipt.pdfDocumentId },
    select: {
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      relativePath: true,
      fiscalYear: { select: { associationId: true } },
    },
  })
  if (!doc || doc.fiscalYear.associationId !== associationId) {
    return NextResponse.json({ error: 'PDF introuvable.' }, { status: 404 })
  }

  try {
    await fsp.access(toAbsolutePath(doc.relativePath))
  } catch {
    return NextResponse.json({ error: 'Fichier PDF manquant sur le disque.' }, { status: 404 })
  }

  const filename = safeDownloadName(doc.originalName)
  const nodeStream = createReadStreamForRelativePath(doc.relativePath)
  const webStream = nodeStreamToWeb(nodeStream)

  return new Response(webStream, {
    headers: {
      'Content-Type': doc.mimeType || 'application/pdf',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Content-Length': String(doc.sizeBytes),
      'Cache-Control': 'no-store',
    },
  })
}
