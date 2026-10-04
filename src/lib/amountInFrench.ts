// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

const UNITS = [
  'zéro',
  'un',
  'deux',
  'trois',
  'quatre',
  'cinq',
  'six',
  'sept',
  'huit',
  'neuf',
  'dix',
  'onze',
  'douze',
  'treize',
  'quatorze',
  'quinze',
  'seize',
]

const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt']

function belowHundred(n: number): string {
  if (n < 17) return UNITS[n] ?? String(n)
  if (n < 20) return `dix-${UNITS[n - 10]}`
  const ten = Math.floor(n / 10)
  const unit = n % 10
  if (ten === 7 || ten === 9) {
    const remainder = n - (ten === 7 ? 60 : 80)
    if (remainder === 1 && ten === 7) return 'soixante-et-onze'
    if (remainder === 0 && ten === 8) return 'quatre-vingts'
    return `${TENS[ten]}-${belowHundred(remainder)}`
  }
  if (unit === 0) {
    return ten === 8 ? 'quatre-vingts' : TENS[ten]
  }
  if (unit === 1 && ten !== 8) return `${TENS[ten]}-et-un`
  return `${TENS[ten]}-${UNITS[unit]}`
}

function belowThousand(n: number): string {
  if (n < 100) return belowHundred(n)
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  const hundredWord = hundreds === 1 ? 'cent' : `${UNITS[hundreds]} cent${rest === 0 ? 's' : ''}`
  if (rest === 0) return hundredWord
  return `${hundreds === 1 ? 'cent' : `${UNITS[hundreds]} cent`} ${belowHundred(rest)}`
}

function integerToFrench(n: number): string {
  if (n === 0) return 'zéro'
  if (n < 1000) return belowThousand(n)
  const millions = Math.floor(n / 1_000_000)
  const thousands = Math.floor((n % 1_000_000) / 1000)
  const rest = n % 1000
  const parts: string[] = []
  if (millions > 0) {
    parts.push(millions === 1 ? 'un million' : `${integerToFrench(millions)} millions`)
  }
  if (thousands > 0) {
    parts.push(thousands === 1 ? 'mille' : `${belowThousand(thousands)} mille`)
  }
  if (rest > 0) parts.push(belowThousand(rest))
  return parts.join(' ')
}

/** Amount in French words for Cerfa receipts, e.g. "cent vingt euros". */
export function amountInFrenchEuros(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) throw new Error('Montant invalide.')
  const euros = Math.floor(cents / 100)
  const remainder = cents % 100
  const euroWord = euros <= 1 ? 'euro' : 'euros'
  const euroPart = `${integerToFrench(euros)} ${euroWord}`
  if (remainder === 0) return euroPart
  const centWord = remainder <= 1 ? 'centime' : 'centimes'
  return `${euroPart} et ${integerToFrench(remainder)} ${centWord}`
}
