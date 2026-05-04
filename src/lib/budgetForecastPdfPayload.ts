import { classifyAccount } from '@/lib/budgetClassification'
import type { CompteResultatPdfBody } from '@/lib/compteResultatPdf'

export type BudgetForecastPdfPayload = CompteResultatPdfBody & {
  associationName: string
  budgetName: string
  updatedAtIso: string
}

type BudgetLineRow = { accountNumber: string; accountName: string; amountCents: number }

/** Pure mapping for PDF export (same buckets as the prévisionnel detail UI). */
export function buildBudgetForecastPdfPayload(
  budget: { name: string; updatedAt: Date; lines: BudgetLineRow[] },
  associationName: string,
): BudgetForecastPdfPayload {
  const chargesLines = budget.lines.filter((l) => classifyAccount(l.accountNumber) === 'CHARGE')
  const produitsLines = budget.lines.filter((l) => classifyAccount(l.accountNumber) === 'PRODUIT')
  const cvnLines = budget.lines.filter((l) => {
    const k = classifyAccount(l.accountNumber)
    return k === 'CVN_EMPLOI' || k === 'CVN_CONTRIBUTION'
  })

  const comptesCharges = chargesLines.map((l) => ({
    numero: l.accountNumber,
    libelle: l.accountName,
    solde: l.amountCents / 100,
  }))
  const comptesProduits = produitsLines.map((l) => ({
    numero: l.accountNumber,
    libelle: l.accountName,
    solde: l.amountCents / 100,
  }))

  const totalCharges = chargesLines.reduce((s, l) => s + l.amountCents, 0) / 100
  const totalProduits = produitsLines.reduce((s, l) => s + l.amountCents, 0) / 100
  const resultat = totalProduits - totalCharges

  const cvnEmploisRows = cvnLines
    .filter((l) => classifyAccount(l.accountNumber) === 'CVN_EMPLOI')
    .map((l) => ({
      numero: l.accountNumber,
      libelle: l.accountName,
      montant: l.amountCents / 100,
    }))
  const cvnContributionRows = cvnLines
    .filter((l) => classifyAccount(l.accountNumber) === 'CVN_CONTRIBUTION')
    .map((l) => ({
      numero: l.accountNumber,
      libelle: l.accountName,
      montant: l.amountCents / 100,
    }))

  const totalCvnEmplois = cvnEmploisRows.reduce((s, r) => s + r.montant, 0)
  const totalCvnContributions = cvnContributionRows.reduce((s, r) => s + r.montant, 0)
  const cvnIsBalanced = Math.abs(totalCvnEmplois - totalCvnContributions) < 0.01

  return {
    associationName,
    budgetName: budget.name,
    updatedAtIso: budget.updatedAt.toISOString(),
    comptesCharges,
    comptesProduits,
    totalCharges,
    totalProduits,
    resultat,
    cvnEmploisRows,
    cvnContributionRows,
    totalCvnEmplois,
    totalCvnContributions,
    cvnIsBalanced,
  }
}
