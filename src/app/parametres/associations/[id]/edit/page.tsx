// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { redirect } from 'next/navigation'

export default function EditAssociationRedirectPage({ params }: { params: { id: string } }) {
  redirect(`/parametres/entites/${params.id}/edit`)
}

