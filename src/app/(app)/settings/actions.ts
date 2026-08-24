'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/server/auth/session';
import { saveUserRules } from '@/server/services/rules';
import { parseMoneyToPence } from '@/core/money';

export interface RulesFormState {
  ok?: boolean;
  error?: string;
}

export async function saveRulesAction(_prev: RulesFormState, formData: FormData): Promise<RulesFormState> {
  const user = await requireUser();

  const minRaw = String(formData.get('minBalance') ?? '').trim();
  let minBalancePence: number | null = null;
  if (minRaw) {
    const p = parseMoneyToPence(minRaw);
    if (p == null || p < 0) return { error: 'Enter a valid minimum balance, or leave it blank.' };
    minBalancePence = p;
  }

  const emRaw = String(formData.get('emergencyMonths') ?? '').trim();
  let emergencyMonths: number | null = null;
  if (emRaw) {
    const n = parseInt(emRaw, 10);
    if (!Number.isInteger(n) || n < 0 || n > 24) return { error: 'Emergency months must be a whole number between 0 and 24.' };
    emergencyMonths = n;
  }

  const preferInstant = formData.get('preferInstant') === 'on';
  const doNotTouchAccountIds = formData.getAll('doNotTouch').map(String);

  await saveUserRules(user.id, { minBalancePence, emergencyMonths, preferInstant, doNotTouchAccountIds });
  revalidatePath('/', 'layout'); // rules feed the whole analysis
  return { ok: true };
}
