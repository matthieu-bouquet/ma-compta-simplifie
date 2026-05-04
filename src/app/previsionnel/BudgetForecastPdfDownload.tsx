'use client'

import { useTransition } from 'react'
import { FileDown } from 'lucide-react'
import { getBudgetForecastPdfPayload } from '@/actions/budgetActions'
import type { BudgetForecastPdfPayload } from '@/lib/budgetForecastPdfPayload'
import {
  defaultBudgetForecastPdfFileName,
  downloadCompteResultatStylePdf,
  type CompteResultatPdfBody,
} from '@/lib/compteResultatPdf'
import forms from '@/components/forms/forms.module.css'
import benevolatStyles from '@/app/benevolat/benevolat.module.css'

function splitPayload(p: BudgetForecastPdfPayload) {
  const { associationName, budgetName, updatedAtIso, ...body } = p
  return {
    header: {
      type: 'budget' as const,
      associationName,
      budgetName,
      updatedAtIso,
    },
    body: body as CompteResultatPdfBody,
    fileName: defaultBudgetForecastPdfFileName(associationName, budgetName),
  }
}

export default function BudgetForecastPdfDownload({
  variant,
  budgetId,
  initialPayload,
}: {
  variant: 'icon' | 'button'
  budgetId: string
  /** When set (e.g. detail page), skips server round-trip. */
  initialPayload?: BudgetForecastPdfPayload
}) {
  const [pending, startTransition] = useTransition()

  const runDownload = (payload: BudgetForecastPdfPayload) => {
    const { header, body, fileName } = splitPayload(payload)
    downloadCompteResultatStylePdf(header, body, fileName)
  }

  const handleClick = () => {
    if (initialPayload) {
      runDownload(initialPayload)
      return
    }
    startTransition(async () => {
      const payload = await getBudgetForecastPdfPayload(budgetId)
      if (payload) runDownload(payload)
    })
  }

  if (variant === 'icon') {
    return (
      <button
        type="button"
        className={benevolatStyles.iconBtn}
        aria-label="Télécharger en PDF"
        disabled={pending}
        onClick={handleClick}
      >
        <FileDown size={18} aria-hidden="true" />
      </button>
    )
  }

  return (
    <button
      type="button"
      className={`btn btn-primary ${forms.btnWithLeadingIcon}`}
      title="Télécharger en PDF (même présentation que le compte de résultat)"
      aria-label="Télécharger en PDF"
      disabled={pending}
      onClick={handleClick}
    >
      <FileDown size={18} aria-hidden="true" />
      {pending ? 'Préparation…' : 'Télécharger en PDF'}
    </button>
  )
}
