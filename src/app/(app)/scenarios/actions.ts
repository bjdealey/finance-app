'use server';

import { requireUser } from '@/server/auth/session';
import { loadSnapshot } from '@/server/services/snapshot';
import { runScenario, type ScenarioDelta, type ScenarioResult } from '@/core/scenario';

export async function runScenarioAction(deltas: ScenarioDelta[]): Promise<ScenarioResult> {
  const user = await requireUser();
  return runScenario(await loadSnapshot(user.id), deltas);
}
