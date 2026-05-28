// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { expect, type Page } from '@playwright/test'

/** Sonner toasts render message text in the document (role region / li). */
export async function expectToastVisible(page: Page, message: string | RegExp) {
  await expect(page.getByText(message)).toBeVisible()
}
