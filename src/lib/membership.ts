// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

export const DUES_ACCOUNT_WITHOUT_COUNTERPART = '7561'
export const DUES_ACCOUNT_WITH_COUNTERPART = '7562'
export const DONATION_INCOME_ACCOUNT = '7541'

export const MEMBERSHIP_FEE_STATUS_DUE = 'DUE'
export const MEMBERSHIP_FEE_STATUS_PAID = 'PAID'

export const DONATION_PAYMENT_METHODS = ['ESPECES', 'CHEQUE', 'VIREMENT', 'CB', 'AUTRE'] as const
export type DonationPaymentMethod = (typeof DONATION_PAYMENT_METHODS)[number]

export function isDuesAccountNumber(value: string): boolean {
  return value === DUES_ACCOUNT_WITHOUT_COUNTERPART || value === DUES_ACCOUNT_WITH_COUNTERPART
}

export function isDonationPaymentMethod(value: string): value is DonationPaymentMethod {
  return (DONATION_PAYMENT_METHODS as readonly string[]).includes(value)
}

export function donationPaymentMethodLabel(method: string): string {
  switch (method) {
    case 'ESPECES':
      return 'Espèces'
    case 'CHEQUE':
      return 'Chèque'
    case 'VIREMENT':
      return 'Virement'
    case 'CB':
      return 'Carte bancaire'
    default:
      return 'Autre'
  }
}

export function memberDisplayName(member: { firstName: string; lastName: string }): string {
  return `${member.lastName.trim().toUpperCase()} ${member.firstName.trim()}`.trim()
}

export type MemberIdentityFields = {
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  address: string | null
  postalCode: string | null
  city: string | null
  licenseNumber: string | null
}

export type MembershipSeasonOptions = {
  imageRightsConsent: boolean
  internalRulesAccepted: boolean
  emailCommunicationsConsent: boolean
}

export const DEFAULT_MEMBERSHIP_OPTIONS: MembershipSeasonOptions = {
  imageRightsConsent: false,
  internalRulesAccepted: false,
  emailCommunicationsConsent: false,
}

export function membershipSnapshotFromIdentity(identity: MemberIdentityFields) {
  return {
    snapshotFirstName: identity.firstName,
    snapshotLastName: identity.lastName,
    snapshotEmail: identity.email,
    snapshotPhone: identity.phone,
    snapshotAddress: identity.address,
    snapshotPostalCode: identity.postalCode,
    snapshotCity: identity.city,
    snapshotLicenseNumber: identity.licenseNumber,
  }
}

export function identityFromMembershipSnapshot(membership: {
  snapshotFirstName: string
  snapshotLastName: string
  snapshotEmail: string | null
  snapshotPhone: string | null
  snapshotAddress: string | null
  snapshotPostalCode: string | null
  snapshotCity: string | null
  snapshotLicenseNumber: string | null
}): MemberIdentityFields {
  return {
    firstName: membership.snapshotFirstName,
    lastName: membership.snapshotLastName,
    email: membership.snapshotEmail,
    phone: membership.snapshotPhone,
    address: membership.snapshotAddress,
    postalCode: membership.snapshotPostalCode,
    city: membership.snapshotCity,
    licenseNumber: membership.snapshotLicenseNumber,
  }
}

export function normalizeMembershipOptions(opts?: Partial<MembershipSeasonOptions> | null): MembershipSeasonOptions {
  return {
    imageRightsConsent: Boolean(opts?.imageRightsConsent),
    internalRulesAccepted: Boolean(opts?.internalRulesAccepted),
    emailCommunicationsConsent: Boolean(opts?.emailCommunicationsConsent),
  }
}

export function journalCodeForTreasuryAccount(accountNumber: string): 'BQ' | 'CA' {
  return accountNumber.startsWith('53') ? 'CA' : 'BQ'
}
