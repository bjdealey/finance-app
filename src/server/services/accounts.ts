import { and, eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { accounts, type AccountRow } from '@/server/db/schema';
import type { AccountType, AccessType } from '@/core/types';

// Clean, already-parsed shape the actions build from FormData (money in pence, rate in bps).
export interface AccountInput {
  name: string;
  institution: string | null;
  accountType: AccountType;
  accessType: AccessType;
  openingBalance: number; // signed pence (negative for debt)
  openingBalanceDate: string; // YYYY-MM-DD
  interestRateBps: number;
  taxWrapper: string | null;
  purpose: string | null;
  creditLimit: number | null;
  minimumPayment: number | null;
  paymentDueDay: number | null;
  statementDay: number | null;
}

// A route param is untrusted input: a malformed id makes Postgres throw on the uuid cast, which would
// surface as a 500-class error boundary. Treat "not a uuid" as "not found" so a stale or hand-edited
// link renders the calmer 404 (the caller's notFound()) instead.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getAccount(userId: string, id: string): Promise<AccountRow | null> {
  if (!UUID_RE.test(id)) return null;
  const [row] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function createAccount(userId: string, input: AccountInput): Promise<string> {
  const [row] = await db.insert(accounts).values({ ...input, userId }).returning({ id: accounts.id });
  return row.id;
}

// Scoped by (id, userId) so a user can only ever edit their own account (IDOR-safe).
export async function updateAccount(userId: string, id: string, input: AccountInput): Promise<void> {
  await db
    .update(accounts)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
}

export async function setAccountActive(userId: string, id: string, active: boolean): Promise<void> {
  await db
    .update(accounts)
    .set({ active, updatedAt: new Date() })
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
}
