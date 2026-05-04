import crypto from 'crypto'
import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import { Readable } from 'stream'

const DEFAULT_MAX_BYTES = 20 * 1024 * 1024

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export type StoredDocumentInfo = {
  storedName: string
  relativePath: string
  mimeType: string
  sizeBytes: number
  sha256: string
}

function formatTimestampUtc(d: Date) {
  // Avoid ':' for Windows filesystem compatibility.
  // Example: 2026-04-26T210412Z
  const iso = d.toISOString() // 2026-04-26T19:04:12.123Z
  return iso.replace(/\.\d{3}Z$/, 'Z').replace(/:(?=\d{2})/g, '').replace('T', 'T')
}

function stripExtension(filename: string) {
  const base = path.basename(filename)
  const lastDot = base.lastIndexOf('.')
  return lastDot > 0 ? base.slice(0, lastDot) : base
}

export function normalizeOriginalNameSlug(originalName: string) {
  const base = stripExtension(originalName)
  const ascii = base
    .normalize('NFKD')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  const cleaned = ascii
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)

  return cleaned || 'document'
}

export function getExtensionForMime(mimeType: string) {
  return ALLOWED_MIME_TO_EXT[mimeType] || null
}

export function getUploadsBaseDir() {
  return process.env.DOCUMENTS_DIR
    ? path.resolve(process.env.DOCUMENTS_DIR)
    : path.join(process.cwd(), 'data')
}

export function buildRelativePath(opts: {
  associationId: string
  exerciceId: string
  storedName: string
}) {
  return path.posix.join('uploads', opts.associationId, opts.exerciceId, opts.storedName)
}

export function toAbsolutePath(relativePath: string) {
  if (relativePath.includes('..')) throw new Error('Chemin invalide.')
  const baseDir = getUploadsBaseDir()
  const absolute = path.join(baseDir, relativePath)
  const normalized = path.normalize(absolute)
  const root = path.normalize(baseDir)
  if (!normalized.startsWith(root + path.sep) && normalized !== root) {
    throw new Error('Chemin invalide.')
  }
  return normalized
}

export async function saveUploadedFile(opts: {
  file: File
  associationId: string
  exerciceId: string
  maxBytes?: number
}): Promise<StoredDocumentInfo> {
  const mimeType = opts.file.type
  const ext = getExtensionForMime(mimeType)
  if (!ext) {
    throw new Error('Type de fichier non autorisé (PDF/images uniquement).')
  }

  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES
  if (opts.file.size > maxBytes) {
    throw new Error(`Fichier trop volumineux (max ${(maxBytes / (1024 * 1024)).toFixed(0)} Mo).`)
  }

  const timestamp = formatTimestampUtc(new Date())
  const slug = normalizeOriginalNameSlug(opts.file.name)
  const shortId = crypto.randomBytes(3).toString('hex')
  const storedName = `${timestamp}_${slug}__${shortId}.${ext}`

  const relativePath = buildRelativePath({
    associationId: opts.associationId,
    exerciceId: opts.exerciceId,
    storedName,
  })
  const absolutePath = toAbsolutePath(relativePath)

  await fsp.mkdir(path.dirname(absolutePath), { recursive: true })

  const ab = await opts.file.arrayBuffer()
  const buf = Buffer.from(ab)

  const sha256 = crypto.createHash('sha256').update(buf).digest('hex')
  await fsp.writeFile(absolutePath, buf)

  return {
    storedName,
    relativePath,
    mimeType,
    sizeBytes: buf.byteLength,
    sha256,
  }
}

export function createReadStreamForRelativePath(relativePath: string) {
  const absolutePath = toAbsolutePath(relativePath)
  return fs.createReadStream(absolutePath)
}

export function nodeStreamToWeb(stream: NodeJS.ReadableStream): ReadableStream {
  return Readable.toWeb(stream as any) as unknown as ReadableStream
}

export async function deleteStoredFile(relativePath: string) {
  const absolutePath = toAbsolutePath(relativePath)
  await fsp.rm(absolutePath, { force: true })
}

