import { requireUser } from '@/server/auth/session';
import { loadSnapshot } from '@/server/services/snapshot';
import { runScenario } from '@/core/scenario';
import { PageHeader } from '@/components/ui';
import { ScenarioLab } from '@/components/scenario-lab';

export default async function ScenariosPage() {
  const user = await requireUser();
  const initial = runScenario(await loadSnapshot(user.id), []);
  return (
    <div>
      <PageHeader title="What if?" subtitle="Model a change without touching your real finances. Pick a preset or enter your own — nothing here is saved or moved." />
      <ScenarioLab initial={initial} />
    </div>
  );
}
