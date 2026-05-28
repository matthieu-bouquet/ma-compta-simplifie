// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { expect, type Mock } from 'vitest'

/** Assert writeAuditEvent mock was called with action + optional entity type. */
export function expectAuditCalled(
  writeAuditEvent: Mock,
  action: string,
  opts?: { entityType?: string; entityId?: string },
) {
  expect(writeAuditEvent).toHaveBeenCalledWith(
    expect.objectContaining({
      action,
      ...(opts?.entityType ? { entityType: opts.entityType } : {}),
      ...(opts?.entityId ? { entityId: opts.entityId } : {}),
    }),
  )
}
