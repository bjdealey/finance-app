import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  integer,
  bigint,
  timestamp,
  date,
  jsonb,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
// Relative (not '@/…') so drizzle-kit's bundler resolves it without tsconfig path support.
import type { ExplanationTrace, ReasonCode, ConstraintCode } from '../../core/types';

// Money is INTEGER PENCE everywhere. bigint(number) is safe to ±£90 trillion — no £21M
// integer ceiling, and never loses precision at personal-finance magnitudes.
const pence = (name: string) => bigint(name, { mode: 'number' });

// ---- Enums -----------------------------------------------------------------
export const accountType = pgEnum('account_type', [
  'CURRENT',
  'SAVINGS',
  'CREDIT_CARD',
  'CASH_ISA',
  'INVESTMENT',
  'LOAN',
  'MORTGAGE',
]);
export const accessType = pgEnum('access_type', [
  'INSTANT',
  'NOTICE',
  'FIXED_TERM',
  'RESTRICTED',
  'UNKNOWN',
]);
export const transactionType = pgEnum('transaction_type', [
  'INCOME',
  'EXPENSE',
  'TRANSFER',
  'REFUND',
  'INTEREST',
  'FEE',
  'CARD_PAYMENT',
  'UNKNOWN',
]);
export const txnStatus = pgEnum('txn_status', ['POSTED', 'PENDING', 'REVERSED']);
export const categoryKind = pgEnum('category_kind', [
  'INCOME',
  'EXPENSE',
  'TRANSFER',
  'NEUTRAL',
]);
export const ruleMatchType = pgEnum('rule_match_type', ['MERCHANT_EXACT', 'KEYWORD', 'REGEX']);
export const ruleSource = pgEnum('rule_source', ['SEED', 'USER_CORRECTION']);
export const txnSource = pgEnum('txn_source', ['SEED', 'CSV', 'MANUAL']);
export const recStatus = pgEnum('rec_status', ['PENDING', 'APPROVED', 'REJECTED', 'SNOOZED']);
export const recType = pgEnum('rec_type', [
  'MOVE_CASH',
  'REDUCE_SPEND',
  'KEEP_BUFFER',
  'PAY_DEBT',
  'GOAL_CONTRIBUTION',
]);
export const userRuleType = pgEnum('user_rule_type', [
  'MIN_CURRENT_BALANCE',
  'EMERGENCY_MONTHS',
  'NO_INVEST_WITHIN_MONTHS',
  'PRIORITISE_GOAL',
  'DO_NOT_TOUCH_ACCOUNT',
  'PREFER_INSTANT_ACCESS',
]);

// ---- Tables ----------------------------------------------------------------
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  baseCurrency: text('base_currency').notNull().default('GBP'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('users_email_uniq').on(t.email)]);

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(), // random token, also the cookie value
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('sessions_user_idx').on(t.userId)]);

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  institution: text('institution'),
  accountType: accountType('account_type').notNull(),
  currency: text('currency').notNull().default('GBP'),
  // Balance is DERIVED = openingBalance + sum(posted transactions). Stored anchor keeps it auditable.
  openingBalance: pence('opening_balance').notNull().default(0),
  openingBalanceDate: date('opening_balance_date').notNull(),
  interestRateBps: integer('interest_rate_bps').notNull().default(0), // 450 = 4.50% AER/APR
  accessType: accessType('access_type').notNull().default('UNKNOWN'),
  taxWrapper: text('tax_wrapper'), // extensible: CASH_ISA | STOCKS_SHARES_ISA | null
  purpose: text('purpose'),
  creditLimit: pence('credit_limit'),
  minimumPayment: pence('minimum_payment'),
  paymentDueDay: integer('payment_due_day'),
  statementDay: integer('statement_day'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('accounts_user_idx').on(t.userId)]);

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  parentId: uuid('parent_id').references((): AnyPgColumn => categories.id),
  kind: categoryKind('kind').notNull().default('EXPENSE'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('categories_user_idx').on(t.userId)]);

// Keyword/merchant/regex rules drive categorisation; user corrections append here (source=USER_CORRECTION).
export const categoryRules = pgTable('category_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  matchType: ruleMatchType('match_type').notNull(),
  pattern: text('pattern').notNull(),
  categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  priority: integer('priority').notNull().default(100), // lower = checked first
  source: ruleSource('source').notNull().default('SEED'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('category_rules_user_idx').on(t.userId)]);

export const importBatches = pgTable('import_batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  rowCount: integer('row_count').notNull().default(0),
  importedCount: integer('imported_count').notNull().default(0),
  duplicateCount: integer('duplicate_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Immutable ledger. Only category_id / transfer flags may be corrected; amount/date/account never
// mutate (reversing entries handle real reversals).
export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  amount: pence('amount').notNull(), // signed: negative = money out
  currency: text('currency').notNull().default('GBP'),
  merchant: text('merchant'),
  description: text('description'),
  categoryId: uuid('category_id').references(() => categories.id),
  transactionType: transactionType('transaction_type').notNull().default('UNKNOWN'),
  status: txnStatus('status').notNull().default('POSTED'),
  transferGroupId: uuid('transfer_group_id'), // links the two legs of an internal transfer
  confidence: integer('confidence').notNull().default(0), // 0-100 categorisation confidence
  source: txnSource('source').notNull().default('MANUAL'),
  importBatchId: uuid('import_batch_id').references(() => importBatches.id),
  // Hash of (account,date,amount,description). Advisory only: the import pipeline uses it to
  // FLAG likely duplicates for the user — not a unique constraint, since two identical small
  // purchases on the same day are legitimate.
  dedupeKey: text('dedupe_key'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('txn_user_date_idx').on(t.userId, t.date),
  index('txn_account_idx').on(t.accountId),
  index('txn_transfer_group_idx').on(t.transferGroupId),
  index('txn_dedupe_idx').on(t.accountId, t.dedupeKey),
]);

export const goals = pgTable('goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  targetAmount: pence('target_amount').notNull(),
  targetDate: date('target_date'),
  linkedAccountId: uuid('linked_account_id').references(() => accounts.id),
  currentAmount: pence('current_amount').notNull().default(0), // manual override; else derived from linked account
  priority: integer('priority').notNull().default(100),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('goals_user_idx').on(t.userId)]);

// User-configured constraints that become explicit optimisation constraints.
export const userRules = pgTable('user_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  ruleType: userRuleType('rule_type').notNull(),
  params: jsonb('params').$type<Record<string, unknown>>().notNull().default({}),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('user_rules_user_idx').on(t.userId)]);

export const recommendations = pgTable('recommendations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // Deterministic key from the engine (e.g. "MOVE_CASH:main:easy"); a user's decision is upserted on it.
  key: text('key').notNull().default(''),
  type: recType('type').notNull(),
  priority: integer('priority').notNull().default(100),
  sourceAccountId: uuid('source_account_id').references(() => accounts.id),
  destinationAccountId: uuid('destination_account_id').references(() => accounts.id),
  amount: pence('amount'),
  reasonCodes: jsonb('reason_codes').$type<ReasonCode[]>().notNull().default([]),
  constraintsChecked: jsonb('constraints_checked').$type<ConstraintCode[]>().notNull().default([]),
  expectedBenefit: jsonb('expected_benefit').$type<Record<string, unknown>>(),
  confidence: integer('confidence').notNull().default(0), // 0-100
  impact: jsonb('impact').$type<Record<string, unknown>>(),
  explanationTrace: jsonb('explanation_trace').$type<ExplanationTrace>(),
  status: recStatus('status').notNull().default('PENDING'),
  snoozeUntil: timestamp('snooze_until', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
}, (t) => [index('recs_user_idx').on(t.userId), uniqueIndex('recs_user_key_uniq').on(t.userId, t.key)]);

// Row types for the service/engine layers.
export type UserRow = typeof users.$inferSelect;
export type AccountRow = typeof accounts.$inferSelect;
export type CategoryRow = typeof categories.$inferSelect;
export type CategoryRuleRow = typeof categoryRules.$inferSelect;
export type TransactionRow = typeof transactions.$inferSelect;
export type GoalRow = typeof goals.$inferSelect;
export type UserRuleRow = typeof userRules.$inferSelect;
export type RecommendationRow = typeof recommendations.$inferSelect;
