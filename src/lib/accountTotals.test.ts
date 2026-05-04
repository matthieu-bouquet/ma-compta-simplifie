import { describe, it, expect } from 'vitest'
import {
  aggregateAccountTotalsFromAccounts,
  scaleAbsoluteAmountCents,
  budgetLinesFromFiscalYearTotals,
} from '@/lib/accountTotals'

describe('aggregateAccountTotalsFromAccounts', () => {
  it('puts 864 under CVN emplois, not charges (prefix trap)', () => {
    const totals = aggregateAccountTotalsFromAccounts([
      {
        number: '864',
        name: 'Personnel bénévole',
        lines: [{ debitCents: 3000, creditCents: 0 }],
      },
      {
        number: '606',
        name: 'Fournitures',
        lines: [{ debitCents: 1000, creditCents: 0 }],
      },
    ])

    expect(totals.charges.map((c) => c.number)).toEqual(['606'])
    expect(totals.cvnEmplois.map((c) => c.number)).toEqual(['864'])
    expect(totals.charges.some((c) => c.number === '864')).toBe(false)
  })
})

describe('scaleAbsoluteAmountCents & budgetLinesFromFiscalYearTotals', () => {
  it('scales by coefficient percent with rounding', () => {
    expect(scaleAbsoluteAmountCents(10000, 110)).toBe(11000)
    expect(scaleAbsoluteAmountCents(10000, 50)).toBe(5000)
    expect(scaleAbsoluteAmountCents(333, 110)).toBe(366)
  })

  it('builds budget lines from totals', () => {
    const lines = budgetLinesFromFiscalYearTotals(
      {
        charges: [{ number: '606', name: 'X', netCents: 10000 }],
        produits: [{ number: '740', name: 'Y', netCents: 5000 }],
        cvnEmplois: [{ number: '864', name: 'Z', netCents: 3000 }],
        cvnContributions: [{ number: '875', name: 'W', netCents: 3000 }],
      },
      100,
    )
    expect(lines).toHaveLength(4)
    expect(lines.find((l) => l.accountNumber === '606')?.amountCents).toBe(10000)
  })
})
