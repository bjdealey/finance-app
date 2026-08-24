import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { userRules } from '@/server/db/schema';
import type { UserRuleType } from '@/core/types';

// Only these rule types are managed by the settings editor; anything else is left untouched.
const MANAGED: UserRuleType[] = ['MIN_CURRENT_BALANCE', 'EMERGENCY_MONTHS', 'PREFER_INSTANT_ACCESS', 'DO_NOT_TOUCH_ACCOUNT'];

export interface RulesInput {
  minBalancePence: number | null; // null = no minimum-balance rule
  emergencyMonths: number | null; // null = engine default (3 months)
  preferInstant: boolean;
  doNotTouchAccountIds: string[];
}

export async function getUserRulesForEdit(userId: string): Promise<RulesInput> {
  const rows = await db.select().from(userRules).where(eq(userRules.userId, userId));
  const num = (v: unknown) => (typeof v === 'number' ? v : null);
  const find = (t: UserRuleType) => rows.find((r) => r.active && r.ruleType === t);
  return {
    minBalancePence: num(find('MIN_CURRENT_BALANCE')?.params?.amountPence),
    emergencyMonths: num(find('EMERGENCY_MONTHS')?.params?.months),
    preferInstant: Boolean(find('PREFER_INSTANT_ACCESS')),
    doNotTouchAccountIds: rows
      .filter((r) => r.active && r.ruleType === 'DO_NOT_TOUCH_ACCOUNT')
      .map((r) => r.params?.accountId)
      .filter((v): v is string => typeof v === 'string'),
  };
}

// Replace the managed rules wholesale with the submitted set (simplest consistent model).
export async function saveUserRules(userId: string, input: RulesInput): Promise<void> {
  await db.delete(userRules).where(and(eq(userRules.userId, userId), inArray(userRules.ruleType, MANAGED)));

  const rows: (typeof userRules.$inferInsert)[] = [];
  if (input.minBalancePence != null && input.minBalancePence > 0) {
    rows.push({ userId, ruleType: 'MIN_CURRENT_BALANCE', params: { amountPence: input.minBalancePence } });
  }
  if (input.emergencyMonths != null) {
    rows.push({ userId, ruleType: 'EMERGENCY_MONTHS', params: { months: input.emergencyMonths } });
  }
  if (input.preferInstant) {
    rows.push({ userId, ruleType: 'PREFER_INSTANT_ACCESS', params: {} });
  }
  for (const accountId of input.doNotTouchAccountIds) {
    rows.push({ userId, ruleType: 'DO_NOT_TOUCH_ACCOUNT', params: { accountId } });
  }
  if (rows.length) await db.insert(userRules).values(rows);
}
