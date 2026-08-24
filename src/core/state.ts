import type { FinancialSnapshot, AccountType } from './types';
import { computeBalances } from './ledger';
import { analyseCategories } from './behaviour';
import { detectRecurring } from './recurring';
import { completeMonthsBefore, monthKey } from './dates';

// Default UK essential leaf categories. Everything else is treated as discretionary.
const ESSENTIAL = new Set([
  'rent',
  'mortgage',
  'council tax',
  'utilities',
  'water',
  'broadband',
  'groceries',
  'insurance',
  'debt payments',
  'interest charged',
  'public transport',
  'mobile',
]);

export interface FinancialState {
  asOf: string;
  totalCash: number; // current + savings + cash ISA
  liquidCash: number; // instant-access cash only
  currentAccountCash: number;
  savingsCash: number;
  investmentValue: number;
  creditCardDebt: number; // positive = owed
  otherDebt: number; // loans + mortgages owed (positive)
  monthlyIncome: number;
  essentialMonthlySpend: number;
  discretionaryMonthlySpend: number;
  expectedMonthlySpend: number;
  monthlyCommitments: number; // recurring bills + external transfers
  savingsFlowIn: number; // per month into savings/ISA/investments
  savingsFlowOut: number; // per month out
  grossSavingsRate: number; // %
  netSavingsRate: number; // %
  effectiveSavingsRate: number; // %
}

const SAVINGS_TYPES: AccountType[] = ['SAVINGS', 'CASH_ISA'];
const INVESTED_TYPES: AccountType[] = ['INVESTMENT'];

export function computeFinancialState(snapshot: FinancialSnapshot): FinancialState {
  const balances = new Map(computeBalances(snapshot).map((b) => [b.accountId, b]));
  const bal = (id: string) => balances.get(id)?.balance ?? 0;
  const byType = (types: AccountType[]) =>
    snapshot.accounts.filter((a) => types.includes(a.accountType)).reduce((s, a) => s + bal(a.id), 0);

  const currentAccountCash = byType(['CURRENT']);
  const savingsCash = byType(SAVINGS_TYPES);
  const investmentValue = byType(INVESTED_TYPES);
  // Instant-access cash: current accounts + instant savings.
  const liquidCash =
    currentAccountCash +
    snapshot.accounts
      .filter((a) => SAVINGS_TYPES.includes(a.accountType) && a.accessType === 'INSTANT')
      .reduce((s, a) => s + bal(a.id), 0);
  const creditCardDebt = -Math.min(0, byType(['CREDIT_CARD']));
  const otherDebt = -Math.min(0, byType(['LOAN', 'MORTGAGE']));

  // Income: average of actual monthly income over the last 12 complete months.
  const months = completeMonthsBefore(snapshot.asOf, 12);
  const monthSet = new Set(months);
  let incomeTotal = 0;
  for (const t of snapshot.transactions) {
    if (t.transactionType === 'INCOME' && t.amount > 0 && monthSet.has(monthKey(t.date))) incomeTotal += t.amount;
  }
  const monthlyIncome = Math.round(incomeTotal / months.length);

  // Spend: behavioural monthly averages split essential vs discretionary by category name.
  const catName = new Map(snapshot.categories.map((c) => [c.id, c.name.toLowerCase()]));
  const stats = analyseCategories(snapshot);
  let essential = 0;
  let discretionary = 0;
  for (const s of stats) {
    const name = catName.get(s.categoryId) ?? '';
    if (ESSENTIAL.has(name)) essential += s.monthlyAverage;
    else discretionary += s.monthlyAverage;
  }
  const expectedMonthlySpend = essential + discretionary;

  // Commitments: recurring fixed BILLS on current accounts (excludes transfers/savings, which are
  // tracked separately) so this stays an honest "money you're obligated to pay out" figure.
  const currentIds = new Set(snapshot.accounts.filter((a) => a.accountType === 'CURRENT').map((a) => a.id));
  const recurring = detectRecurring(snapshot).filter(
    (r) => r.confidence >= 50 && currentIds.has(r.accountId) && r.direction === 'EXPENSE' && !r.isTransfer,
  );
  const perMonth = (f: string, intervalDays: number) =>
    f === 'WEEKLY' ? 30.4 / 7 : f === 'FORTNIGHTLY' ? 30.4 / 14 : f === 'MONTHLY' ? 1 : f === 'QUARTERLY' ? 1 / 3 : f === 'ANNUAL' ? 1 / 12 : 30.4 / Math.max(intervalDays, 1);
  const monthlyCommitments = Math.round(recurring.reduce((s, r) => s + r.expectedAmount * perMonth(r.frequency, r.intervalDays), 0));

  // Savings flows: transfers into/out of savings + cash ISA + investment accounts.
  const savingsIds = new Set(
    snapshot.accounts.filter((a) => [...SAVINGS_TYPES, ...INVESTED_TYPES].includes(a.accountType)).map((a) => a.id),
  );
  let flowIn = 0;
  let flowOut = 0;
  for (const t of snapshot.transactions) {
    if (t.transactionType !== 'TRANSFER' || !savingsIds.has(t.accountId)) continue;
    if (!monthSet.has(monthKey(t.date))) continue;
    if (t.amount > 0) flowIn += t.amount;
    else flowOut += Math.abs(t.amount);
  }
  const savingsFlowIn = Math.round(flowIn / months.length);
  const savingsFlowOut = Math.round(flowOut / months.length);

  const pct = (n: number) => (monthlyIncome > 0 ? Math.round((n / monthlyIncome) * 100) : 0);
  return {
    asOf: snapshot.asOf,
    totalCash: currentAccountCash + savingsCash,
    liquidCash,
    currentAccountCash,
    savingsCash,
    investmentValue,
    creditCardDebt,
    otherDebt,
    monthlyIncome,
    essentialMonthlySpend: essential,
    discretionaryMonthlySpend: discretionary,
    expectedMonthlySpend,
    monthlyCommitments,
    savingsFlowIn,
    savingsFlowOut,
    grossSavingsRate: pct(savingsFlowIn),
    netSavingsRate: pct(savingsFlowIn - savingsFlowOut),
    effectiveSavingsRate: pct(monthlyIncome - expectedMonthlySpend),
  };
}
