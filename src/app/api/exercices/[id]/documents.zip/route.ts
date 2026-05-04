import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentAssociationId } from '@/lib/associationContext'
import { createReadStreamForRelativePath, nodeStreamToWeb } from '@/lib/documentsStorage'
import archiver from 'archiver'
import { PassThrough } from 'stream'
import path from 'path'

export const runtime = 'nodejs'

function normalizeZipName(name: string) {
  const base = path.basename(name || '').trim()
  return base || 'document'
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const docs = await prisma.document.findMany({
    where: { fiscalYearId: exerciceId },
    orderBy: { uploadedAt: 'asc' },
    select: { originalName: true, storedName: true, relativePath: true },
  })

  const pass = new PassThrough()
  const archive = archiver('zip', { zlib: { level: 9 } })

  archive.on('error', (err) => {
    pass.destroy(err)
  })

  archive.pipe(pass)

  const usedNames = new Map<string, number>()
  for (const d of docs) {
    const original = normalizeZipName(d.originalName)
    const count = usedNames.get(original) ?? 0
    usedNames.set(original, count + 1)

    const zipName =
      count === 0
        ? original
        : (() => {
            const ext = path.extname(original)
            const base = ext ? original.slice(0, -ext.length) : original
            const shortId = d.storedName.split('__').pop()?.split('.')[0] || String(count + 1)
            return `${base}__${shortId}${ext}`
          })()

    archive.append(createReadStreamForRelativePath(d.relativePath), { name: zipName })
  }

  void archive.finalize()

  const fileName = `documents_${new Date(fiscalYear.startDate).getFullYear()}-${new Date(fiscalYear.endDate).getFullYear()}.zip`

  return new Response(nodeStreamToWeb(pass), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      'Cache-Control': 'no-store',
    },
  })
}

