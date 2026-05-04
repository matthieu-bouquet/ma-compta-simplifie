import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentAssociationId } from '@/lib/associationContext'
import { createReadStreamForRelativePath, nodeStreamToWeb } from '@/lib/documentsStorage'
import path from 'path'

export const runtime = 'nodejs'

function safeDownloadName(originalName: string, fallbackExt: string) {
  const base = path.basename(originalName || '')
  const trimmed = base.trim()
  if (!trimmed) return `document.${fallbackExt}`
  return trimmed
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const associationId = await getCurrentAssociationId()
  if (!associationId) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  }

  const doc = await prisma.document.findUnique({
    where: { id },
    include: { fiscalYear: { select: { associationId: true } } },
  })

  if (!doc || doc.fiscalYear.associationId !== associationId) {
    return NextResponse.json({ error: 'Document introuvable.' }, { status: 404 })
  }

  const ext = doc.storedName.split('.').pop() || 'bin'
  const filename = safeDownloadName(doc.originalName, ext)

  const url = new URL(req.url)
  const inline = url.searchParams.get('inline') === '1'

  const nodeStream = createReadStreamForRelativePath(doc.relativePath)
  const webStream = nodeStreamToWeb(nodeStream)

  return new Response(webStream, {
    headers: {
      'Content-Type': doc.mimeType || 'application/octet-stream',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(filename)}"`,
      'Content-Length': String(doc.sizeBytes),
      'Cache-Control': 'no-store',
    },
  })
}

