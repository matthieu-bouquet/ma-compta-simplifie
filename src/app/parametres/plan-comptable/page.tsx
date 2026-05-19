// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { syncPlanComptableGlobalWithDefault } from '@/actions/planComptableActions'
import PlanComptablePageClient from './PlanComptablePageClient'

export default async function PlanComptablePage() {
  const sync = await syncPlanComptableGlobalWithDefault('ASSOCIATION')
  return (
    <PlanComptablePageClient
      initialTemplateCode="ASSOCIATION"
      initialTemplateId={sync.template.id}
      initialPlan={sync.data}
    />
  )
}
