import type { FinancialSnapshot, AccountType } from './types';
import { computeBalances } from './ledger';

// Makes the LOAN / MORTGAGE / CREDIT_CARD metadata live (spec §6/§16): a deterministic fixed-payment
// amortisation so we can say how long a debt takes to clear and what it costs — never invented.
export interface DebtPayoff {
  monthlyInterest: number; // pence accruing this month at the current balance
  monthsToClear: number | null; // null when the payment never clears the balance
  totalInterest: number | null; // total interest until cleared (null when it never clears)
  clears: boolean;
}

const DEBT_TYPES: AccountType[] = ['CREDIT_CARD', 'LOAN', 'MORTGAGE'];

export function debtPayoff(balancePence: number, aprBps: number, monthlyPayment: number): DebtPayoff {
  const principal = Math.abs(balancePence);
  const monthlyRate = aprBps / 10000 / 12; // bps -> annual fraction -> monthly
  const monthlyInterest = Math.round(principal * monthlyRate);
  if (principal <= 0) return { monthlyInterest: 0, monthsToClear: 0, totalInterest: 0, clears: true };
  // A payment that doesn't even cover the interest never reduces the balance.
  if (monthlyPayment <= monthlyInterest) return { monthlyInterest, monthsToClear: null, totalInterest: null, clears: false };

  let bal = principal;
  let months = 0;
  let interestPaid = 0;
  while (bal > 0 && months < 1000) {
    const interest = Math.round(bal * monthlyRate);
    interestPaid += interest;
    bal = bal + interest - monthlyPayment; // interest accrues, then the payment lands
    months++;
  }
  return { monthlyInterest, monthsToClear: months, totalInterest: interestPaid, clears: true };
}

export interface DebtAccountSummary {
  accountId: string;
  name: string;
  accountType: AccountType;
  balance: number; // signed (negative = owed)
  aprBps: number;
  monthlyPayment: number | null; // known minimum/scheduled payment, if set
  utilisationPct: number | null; // for cards with a credit limit
  payoff: DebtPayoff | null; // null when no payment is known to project from
}

// Per-account debt picture for every account currently in the red. Ordered most-expensive first.
export function debtSummary(snapshot: FinancialSnapshot): DebtAccountSummary[] {
  const balances = new Map(computeBalances(snapshot).map((b) => [b.accountId, b.balance]));
  return snapshot.accounts
    .filter((a) => DEBT_TYPES.includes(a.accountType) && (balances.get(a.id) ?? 0) < 0)
    .map((a) => {
      const balance = balances.get(a.id) ?? 0;
      const monthlyPayment = a.minimumPayment && a.minimumPayment > 0 ? a.minimumPayment : null;
      return {
        accountId: a.id,
        name: a.name,
        accountType: a.accountType,
        balance,
        aprBps: a.interestRateBps,
        monthlyPayment,
        utilisationPct: a.creditLimit && a.creditLimit > 0 ? Math.round((-balance / a.creditLimit) * 100) : null,
        payoff: monthlyPayment != null ? debtPayoff(balance, a.interestRateBps, monthlyPayment) : null,
      };
    })
    .sort((x, y) => y.aprBps - x.aprBps);
}
