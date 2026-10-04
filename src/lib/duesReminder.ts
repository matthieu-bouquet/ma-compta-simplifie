// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { csvEscape } from '@/lib/grandLivreCsv'
import { formatEurosFromCents } from '@/lib/money'
import { memberDisplayName } from '@/lib/membership'

export type UnpaidDuesReminderRow = {
  lastName: string
  firstName: string
  email: string | null
  categoryName: string | null
  amountCents: number
  fiscalYearLabel: string
}

export function buildUnpaidDuesReminderCsv(rows: UnpaidDuesReminderRow[]): string {
  const header = ['Nom', 'Prenom', 'Email', 'Categorie', 'Montant', 'Saison']
  const lines = [header.join(';')]
  for (const r of rows) {
    lines.push(
      [
        csvEscape(r.lastName),
        csvEscape(r.firstName),
        csvEscape(r.email ?? ''),
        csvEscape(r.categoryName ?? ''),
        csvEscape(formatEurosFromCents(r.amountCents)),
        csvEscape(r.fiscalYearLabel),
      ].join(';'),
    )
  }
  return `${lines.join('\n')}\n`
}

export function unpaidDuesMailtoHref(opts: {
  email: string
  member: { firstName: string; lastName: string }
  amountCents: number
  associationName: string
  fiscalYearLabel: string
}): string {
  const name = memberDisplayName(opts.member)
  const subject = `Relance cotisation ${opts.fiscalYearLabel} — ${opts.associationName}`
  const body = [
    `Bonjour ${opts.member.firstName},`,
    '',
    `Sauf erreur de notre part, la cotisation de ${name} pour ${opts.fiscalYearLabel} (${formatEurosFromCents(opts.amountCents)}) n’est pas encore enregistrée.`,
    '',
    'Merci de nous indiquer si le règlement a déjà été effectué, ou de procéder au paiement.',
    '',
    `Cordialement,`,
    `Le trésorier — ${opts.associationName}`,
  ].join('\n')
  return `mailto:${encodeURIComponent(opts.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
