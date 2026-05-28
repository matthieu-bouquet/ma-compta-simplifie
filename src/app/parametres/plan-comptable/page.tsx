// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { syncTemplateWithDefault } from '@/actions/planComptableActions'
import PlanComptablePageClient from './PlanComptablePageClient'

export default async function PlanComptablePage() {
  const sync = await syncTemplateWithDefault('ASSOCIATION', { revalidate: false })
  return (
    <PlanComptablePageClient
      initialTemplateCode="ASSOCIATION"
      initialTemplateId={sync.template.id}
      initialPlan={sync.data}
    />
  )
}
