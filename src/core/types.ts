// Core domain types. Deliberately DB-free and framework-free so every engine can be unit-tested
// with plain object fixtures. The service layer maps DB rows -> these types when building a snapshot.

export type AccountType =
  | 'CURRENT'
  | 'SAVINGS'
  | 'CREDIT_CARD'
  | 'CASH_ISA'
  | 'INVESTMENT'
  | 'LOAN'
  | 'MORTGAGE';

export type AccessType = 'INSTANT' | 'NOTICE' | 'FIXED_TERM' | 'RESTRICTED' | 'UNKNOWN';

export type TransactionType =
  | 'INCOME'
  | 'EXPENSE'
  | 'TRANSFER'
  | 'REFUND'
  | 'INTEREST'
  | 'FEE'
  | 'CARD_PAYMENT'
  | 'UNKNOWN';

export type TxnStatus = 'POSTED' | 'PENDING' | 'REVERSED';
export type TxnSource = 'SEED' | 'CSV' | 'MANUAL';
export type CategoryKind = 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'NEUTRAL';
export type TaxWrapper = 'CASH_ISA' | 'STOCKS_SHARES_ISA' | null;

export type UserRuleType =
  | 'MIN_CURRENT_BALANCE'
  | 'EMERGENCY_MONTHS'
  | 'NO_INVEST_WITHIN_MONTHS'
  | 'PRIORITISE_GOAL'
  | 'DO_NOT_TOUCH_ACCOUNT'
  | 'PREFER_INSTANT_ACCESS';

export interface Account {
  id: string;
  name: string;
  institution: string | null;
  accountType: AccountType;
  currency: string;
  openingBalance: number; // pence
  openingBalanceDate: string; // YYYY-MM-DD
  interestRateBps: number; // 450 = 4.50%
  accessType: AccessType;
  taxWrapper: TaxWrapper;
  purpose: string | null;
  creditLimit: number | null; // pence
  minimumPayment: number | null; // pence
  paymentDueDay: number | null;
  statementDay: number | null;
  active: boolean;
}

export interface Transaction {
  id: string;
  accountId: string;
  date: string; // YYYY-MM-DD
  amount: number; // signed pence; negative = money out
  currency: string;
  merchant: string | null;
  description: string | null;
  categoryId: string | null;
  transactionType: TransactionType;
  status: TxnStatus;
  transferGroupId: string | null;
  source: TxnSource; // SEED | CSV | MANUAL — a manual future-dated (pending) item is USER_ENTERED in forecasts
}

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  kind: CategoryKind;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number; // pence
  targetDate: string | null; // YYYY-MM-DD
  linkedAccountId: string | null;
  currentAmount: number; // pence (manual override; else derived from linked account balance)
  priority: number;
}

export interface UserRule {
  id: string;
  ruleType: UserRuleType;
  params: Record<string, unknown>;
  active: boolean;
}

// The single input to the engines. Built once by services/snapshot.ts.
export interface FinancialSnapshot {
  asOf: string; // YYYY-MM-DD
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  goals: Goal[];
  userRules: UserRule[];
}

// ---- Confidence & explainability ------------------------------------------
export type ConfidenceTier = 'INSUFFICIENT_DATA' | 'LOW' | 'MEDIUM' | 'HIGH';

export type ReasonCode =
  | 'EXCESS_CURRENT_BALANCE'
  | 'HIGHER_SAVINGS_RATE'
  | 'UPCOMING_EXPENSE'
  | 'LOW_LIQUIDITY'
  | 'EMERGENCY_FUND_GAP'
  | 'GOAL_BEHIND_TARGET'
  | 'HIGH_COST_DEBT'
  | 'DEBT_INTEREST'
  | 'BEHAVIOURAL_PATTERN'
  | 'ISA_ALLOWANCE'
  | 'DISCRETIONARY_BUFFER';

export type ConstraintCode =
  | '30_DAY_LIQUIDITY'
  | 'EMERGENCY_FUND'
  | 'UPCOMING_COMMITMENTS'
  | 'ACCOUNT_ACCESS'
  | 'USER_RULE'
  | 'DEBT_CONSTRAINT'
  | 'ISA_ALLOWANCE';

// Every recommendation carries one of these — no recommendation without an explanation trace.
export interface ExplanationTrace {
  what: string;
  why: string;
  whyThisAccount?: string;
  whatIfIgnored?: string;
  confidence: ConfidenceTier;
}
