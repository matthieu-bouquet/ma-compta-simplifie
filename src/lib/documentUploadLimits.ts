// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

/** Max size enforced when saving a justificatif (PDF / images). */
export const DOCUMENT_UPLOAD_MAX_BYTES = 20 * 1024 * 1024

/**
 * Next.js Server Actions default body limit is 1 MB; uploads must allow at least
 * {@link DOCUMENT_UPLOAD_MAX_BYTES} (multipart overhead included via headroom).
 */
export const DOCUMENT_UPLOAD_SERVER_ACTION_BODY_SIZE_LIMIT = '21mb' as const
