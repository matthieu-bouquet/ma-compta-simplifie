// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { describe, expect, it } from 'vitest'
import { amountInFrenchEuros } from '@/lib/amountInFrench'
import { parseMembersCsv } from '@/lib/membersCsv'
import {
  DEFAULT_MEMBERSHIP_OPTIONS,
  identityFromMembershipSnapshot,
  membershipSnapshotFromIdentity,
  normalizeMembershipOptions,
} from '@/lib/membership'
import { unpaidDuesMailtoHref, buildUnpaidDuesReminderCsv } from '@/lib/duesReminder'
import { formatTaxReceiptNumber } from '@/lib/taxReceiptNumbering'
import { taxReceiptLegalMentions, CERFA_FORM_NUMBER, buildTaxReceiptPdfBuffer } from '@/lib/taxReceiptPdf'

describe('amountInFrenchEuros', () => {
  it('formats round euros', () => {
    expect(amountInFrenchEuros(12000)).toBe('cent vingt euros')
  })

  it('includes centimes', () => {
    expect(amountInFrenchEuros(101)).toBe('un euro et un centime')
  })
})

describe('membership season snapshot', () => {
  const identity = {
    firstName: 'Léa',
    lastName: 'Martin',
    email: 'lea@example.org',
    phone: '0600000000',
    address: '1 rue Test',
    postalCode: '75001',
    city: 'Paris',
    licenseNumber: 'LIC-1',
  }

  it('round-trips identity through snapshot fields', () => {
    const snapshot = membershipSnapshotFromIdentity(identity)
    expect(snapshot.snapshotFirstName).toBe('Léa')
    expect(snapshot.snapshotLastName).toBe('Martin')
    expect(identityFromMembershipSnapshot(snapshot)).toEqual(identity)
  })

  it('normalizes missing options to false', () => {
    expect(normalizeMembershipOptions(null)).toEqual(DEFAULT_MEMBERSHIP_OPTIONS)
    expect(normalizeMembershipOptions({ imageRightsConsent: true })).toEqual({
      imageRightsConsent: true,
      internalRulesAccepted: false,
      emailCommunicationsConsent: false,
    })
  })
})

describe('parseMembersCsv', () => {
  it('parses semicolon headers', () => {
    const rows = parseMembersCsv('nom;prenom;email;categorie;numero_licence\nDupont;Marie;a@b.c;Adulte;LIC-1\n')
    expect(rows).toEqual([
      {
        lastName: 'Dupont',
        firstName: 'Marie',
        email: 'a@b.c',
        phone: null,
        categoryName: 'Adulte',
        licenseNumber: 'LIC-1',
      },
    ])
  })
})

describe('dues reminders', () => {
  it('builds mailto with subject and body', () => {
    const href = unpaidDuesMailtoHref({
      email: 'marie@example.org',
      member: { firstName: 'Marie', lastName: 'Dupont' },
      amountCents: 8000,
      associationName: 'Club Test',
      fiscalYearLabel: '2026',
    })
    expect(href.startsWith('mailto:marie%40example.org?')).toBe(true)
    expect(href).toContain('subject=')
    expect(href).toContain('body=')
  })

  it('exports csv columns', () => {
    const csv = buildUnpaidDuesReminderCsv([
      {
        lastName: 'Dupont',
        firstName: 'Marie',
        email: 'a@b.c',
        categoryName: 'Adulte',
        amountCents: 8000,
        fiscalYearLabel: '2026',
      },
    ])
    expect(csv.split('\n')[0]).toBe('Nom;Prenom;Email;Categorie;Montant;Saison')
    expect(csv).toContain('Dupont')
  })
})

describe('tax receipt numbering and mentions', () => {
  it('formats RF-year-sequence', () => {
    expect(formatTaxReceiptNumber(2026, 1)).toBe('RF-2026-0001')
  })

  it('includes Cerfa 11580 legal mentions', () => {
    const mentions = taxReceiptLegalMentions().join(' ')
    expect(mentions).toContain(CERFA_FORM_NUMBER)
    expect(mentions).toContain('200')
    expect(mentions).toContain('238 bis')
    expect(mentions).toContain('7562')
  })

  it('embeds sequential number and Cerfa mentions in the PDF payload', () => {
    const buf = buildTaxReceiptPdfBuffer({
      number: 'RF-2026-0001',
      issuedAt: new Date('2026-03-01T00:00:00.000Z'),
      donationDate: new Date('2026-02-20T00:00:00.000Z'),
      amountCents: 5000,
      paymentMethod: 'VIREMENT',
      organisme: {
        name: 'Asso Test',
        address: '1 rue du Don',
        postalCode: '75001',
        city: 'Paris',
        rna: 'W751111111',
        signatoryName: 'Claire Trésor',
        signatoryRole: 'Trésorière',
      },
      donor: {
        name: 'Paul Mécène',
        address: '5 boulevard Test',
        postalCode: '75003',
        city: 'Paris',
      },
    })
    const text = buf.toString('latin1')
    expect(text).toContain('RF-2026-0001')
    expect(text).toContain(CERFA_FORM_NUMBER)
    expect(text).toContain('200')
    expect(text).toContain('238 bis')
    expect(buf.byteLength).toBeGreaterThan(1000)
  })
})
