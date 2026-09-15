// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

export type MemberCsvRow = {
  lastName: string
  firstName: string
  email: string | null
  phone: string | null
  categoryName: string | null
  licenseNumber: string | null
}

const HEADER_ALIASES: Record<string, keyof MemberCsvRow> = {
  nom: 'lastName',
  lastname: 'lastName',
  last_name: 'lastName',
  prenom: 'firstName',
  prénom: 'firstName',
  firstname: 'firstName',
  first_name: 'firstName',
  email: 'email',
  mail: 'email',
  telephone: 'phone',
  téléphone: 'phone',
  tel: 'phone',
  phone: 'phone',
  categorie: 'categoryName',
  catégorie: 'categoryName',
  category: 'categoryName',
  tarif: 'categoryName',
  numero_licence: 'licenseNumber',
  numéro_licence: 'licenseNumber',
  licence: 'licenseNumber',
  license: 'licenseNumber',
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if ((ch === ';' || ch === ',') && !inQuotes) {
      out.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  out.push(current.trim())
  return out
}

function normalizeHeader(h: string): string {
  return h
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
}

export function parseMembersCsv(text: string): MemberCsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) throw new Error('Le fichier CSV doit contenir un en-tête et au moins une ligne.')

  const headers = splitCsvLine(lines[0]!).map(normalizeHeader)
  const indexes: Partial<Record<keyof MemberCsvRow, number>> = {}
  for (let i = 0; i < headers.length; i++) {
    const mapped = HEADER_ALIASES[headers[i]!]
    if (mapped) indexes[mapped] = i
  }
  if (indexes.lastName === undefined || indexes.firstName === undefined) {
    throw new Error('Colonnes requises : nom, prenom (séparateur virgule ou point-virgule).')
  }

  const rows: MemberCsvRow[] = []
  for (let li = 1; li < lines.length; li++) {
    const cols = splitCsvLine(lines[li]!)
    const lastName = (cols[indexes.lastName] ?? '').trim()
    const firstName = (cols[indexes.firstName] ?? '').trim()
    if (!lastName && !firstName) continue
    if (!lastName || !firstName) {
      throw new Error(`Ligne ${li + 1} : nom et prénom sont requis.`)
    }
    const cell = (key: keyof MemberCsvRow) => {
      const idx = indexes[key]
      if (idx === undefined) return null
      const v = (cols[idx] ?? '').trim()
      return v || null
    }
    rows.push({
      lastName,
      firstName,
      email: cell('email'),
      phone: cell('phone'),
      categoryName: cell('categoryName'),
      licenseNumber: cell('licenseNumber'),
    })
  }
  if (rows.length === 0) throw new Error('Aucune ligne adhérent exploitable.')
  return rows
}

export const MEMBERS_CSV_TEMPLATE =
  'nom;prenom;email;telephone;categorie;numero_licence\nDupont;Marie;marie@example.org;0600000000;Adulte;LIC-001\n'
