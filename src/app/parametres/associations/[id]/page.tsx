// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { redirect } from 'next/navigation'

export default async function AssociationDetailRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/parametres/entites/${id}`)
}
