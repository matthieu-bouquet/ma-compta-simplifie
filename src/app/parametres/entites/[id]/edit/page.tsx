// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { isVatLiableFeatureEnabled } from '@/lib/featureFlags'
import EditEntityPageClient from './EditEntityPageClient'

export default function EditEntityPage() {
  return <EditEntityPageClient vatFeatureEnabled={isVatLiableFeatureEnabled()} />
}
