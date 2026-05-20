// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { toast } from 'sonner'

/** User feedback after an action — use instead of inline success/error banners. */
export const appToast = {
  success: (message: string) => toast.success(message),
  warning: (message: string) => toast.warning(message),
  error: (message: string) => toast.error(message),
}
