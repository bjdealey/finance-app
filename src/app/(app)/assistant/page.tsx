import { requireUser } from '@/server/auth/session';
import { assistantAvailable } from '@/server/ai/assistant';
import { Card, PageHeader } from '@/components/ui';
import { AssistantChat } from '@/components/assistant-chat';

export default async function AssistantPage() {
  await requireUser();
  const available = assistantAvailable();

  return (
    <div>
      <PageHeader title="Assistant" subtitle="Ask about your finances. The assistant reads your figures through deterministic tools; any number it can't verify against them is removed before you see it." />
      {available ? (
        <AssistantChat />
      ) : (
        <Card>
          <h2 className="font-semibold">Assistant not configured</h2>
          <p className="mt-2 text-sm text-muted">
            The AI assistant is optional — the rest of the app works fully without it. To enable it, set an{' '}
            <span className="font-mono">ANTHROPIC_API_KEY</span> in the server environment and restart. You can also set{' '}
            <span className="font-mono">ANTHROPIC_MODEL</span> (defaults to <span className="font-mono">claude-opus-5</span>).
          </p>
          <p className="mt-3 text-xs text-muted">
            The assistant only ever calls read-only tools over your deterministic financial data — it never moves money or fabricates numbers.
          </p>
        </Card>
      )}
    </div>
  );
}
