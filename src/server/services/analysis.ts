import { loadSnapshot } from '@/server/services/snapshot';
import { analyseFinances, type Analysis } from '@/core/analyse';

// Load one user's snapshot and run the full deterministic pipeline. The single entry point used by
// the app pages and (later) the AI assistant's tools.
export async function getAnalysis(userId: string, asOf?: string): Promise<Analysis> {
  return analyseFinances(await loadSnapshot(userId, asOf));
}
