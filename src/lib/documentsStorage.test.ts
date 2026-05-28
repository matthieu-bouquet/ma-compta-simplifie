// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildRelativePath,
  getExtensionForMime,
  normalizeOriginalNameSlug,
  saveUploadedFile,
  toAbsolutePath,
} from '@/lib/documentsStorage'

describe('documentsStorage', () => {
  const uploads: string[] = []

  afterEach(async () => {
    for (const rel of uploads) {
      try {
        fs.rmSync(toAbsolutePath(rel), { force: true })
      } catch {
        // ignore
      }
    }
    uploads.length = 0
  })

  it('normalizeOriginalNameSlug strips accents and special chars', () => {
    expect(normalizeOriginalNameSlug('Facture été 2026.pdf')).toMatch(/^facture_ete/)
  })

  it('getExtensionForMime maps pdf', () => {
    expect(getExtensionForMime('application/pdf')).toBe('pdf')
    expect(getExtensionForMime('text/plain')).toBeNull()
  })

  it('toAbsolutePath rejects path traversal', () => {
    expect(() => toAbsolutePath('../etc/passwd')).toThrow(/invalide/i)
  })

  it('saveUploadedFile writes under DOCUMENTS_DIR', async () => {
    const base = process.env.DOCUMENTS_DIR!
    const assocId = 'assoc-doc-test'
    const fyId = 'fy-doc-test'
    const file = new File([Buffer.from('%PDF-1.4')], 'facture.pdf', { type: 'application/pdf' })

    const stored = await saveUploadedFile({
      file,
      associationId: assocId,
      exerciceId: fyId,
    })
    uploads.push(stored.relativePath)

    expect(stored.relativePath).toBe(
      buildRelativePath({ associationId: assocId, exerciceId: fyId, storedName: stored.storedName }),
    )
    const abs = toAbsolutePath(stored.relativePath)
    expect(abs.startsWith(path.resolve(base))).toBe(true)
    expect(fs.existsSync(abs)).toBe(true)
    expect(stored.sha256).toHaveLength(64)
  })
})
