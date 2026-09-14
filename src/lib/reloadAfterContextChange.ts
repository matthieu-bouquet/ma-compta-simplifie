'use client'

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

/**
 * Full document navigation after a context cookie change (entity / fiscal year).
 *
 * Soft `router.refresh()` inside `useTransition` can hang indefinitely in the
 * Electron shell (select stays disabled, RSC payload never settles). A document
 * load always picks up the new cookies and remounts client state.
 */
export function contextChangeNavigationUrl(href: string): string {
  const url = new URL(href, 'http://local.invalid')
  url.searchParams.delete('exerciceId')
  return `${url.pathname}${url.search}${url.hash}`
}

export function reloadAfterContextChange(): void {
  const next = contextChangeNavigationUrl(window.location.href)
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
  if (next === current) {
    window.location.reload()
    return
  }
  window.location.assign(next)
}

export async function applyContextChangeAndReload(
  action: () => Promise<void>,
  onError?: () => void,
): Promise<void> {
  try {
    await action()
    reloadAfterContextChange()
  } catch {
    onError?.()
  }
}
