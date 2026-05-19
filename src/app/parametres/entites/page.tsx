// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { getAssociations } from '@/actions/associationActions'
import EntitiesPageClient from './EntitiesPageClient'

export default async function EntitiesPage() {
  const entities = await getAssociations()
  return <EntitiesPageClient initialEntities={entities} />
}
