// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, expect, it } from 'vitest'
import { parse as parseBytes } from 'next/dist/compiled/bytes'
import nextConfig from '../../next.config'
import {
  DOCUMENT_UPLOAD_MAX_BYTES,
  DOCUMENT_UPLOAD_SERVER_ACTION_BODY_SIZE_LIMIT,
} from '@/lib/documentUploadLimits'

describe('documentUploadLimits', () => {
  it('server action body limit is at least the app document max size', () => {
    expect(parseBytes(DOCUMENT_UPLOAD_SERVER_ACTION_BODY_SIZE_LIMIT)).toBeGreaterThanOrEqual(
      DOCUMENT_UPLOAD_MAX_BYTES,
    )
  })

  it('next.config serverActions bodySizeLimit matches the shared constant', () => {
    expect(nextConfig.experimental?.serverActions?.bodySizeLimit).toBe(
      DOCUMENT_UPLOAD_SERVER_ACTION_BODY_SIZE_LIMIT,
    )
  })
})
