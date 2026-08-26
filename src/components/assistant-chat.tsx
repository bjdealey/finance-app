'use client';

import { useState, useRef, useEffect } from 'react';
import { askAction } from '@/app/(app)/assistant/actions';
import type { ChatMessage } from '@/server/ai/assistant';
import { cn } from '@/components/ui';

const SUGGESTIONS = [
  'Why are you telling me to move money?',
  'Can I afford a £4,000 holiday next summer?',
  'Where am I overspending?',
  'How much can I safely move into savings?',
  'Why is my savings rate lower than I thought?',
];

const STORE_PREFIX = 'financeos.assistant.';
const MAX_STORED = 50; // keep the saved transcript from growing without bound

export function AssistantChat({ userId }: { userId: string }) {
  const storageKey = STORE_PREFIX + userId;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Restore the saved transcript once on mount. Read in an effect (not a lazy initializer) so the
  // server-rendered empty state matches the first client render — no hydration mismatch. Keyed per
  // user so switching accounts on a shared browser never shows one person's chat to another. Guarded:
  // storage can be unavailable (private mode) or hold corrupt/forged data, so every entry is revalidated.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved: unknown = JSON.parse(raw);
        if (Array.isArray(saved)) setMessages(saved.filter(isChatMessage));
      }
    } catch {
      /* unreadable storage — start empty */
    }
    setHydrated(true);
  }, [storageKey]);

  // Persist after each turn — but only once hydrated, so the initial empty state can't overwrite a
  // saved transcript before we've read it.
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (messages.length) localStorage.setItem(storageKey, JSON.stringify(messages.slice(-MAX_STORED)));
      else localStorage.removeItem(storageKey);
    } catch {
      /* quota / disabled — chat still works this session */
    }
  }, [messages, hydrated, storageKey]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pending]);

  async function send(text: string) {
    if (!text.trim() || pending) return;
    setError(null);
    const next: ChatMessage[] = [...messages, { role: 'user', content: text.trim() }];
    setMessages(next);
    setInput('');
    setPending(true);
    const res = await askAction(next);
    setPending(false);
    if (res.error === 'NO_API_KEY') return setError('The assistant needs an ANTHROPIC_API_KEY set on the server.');
    if (res.error) return setError('The assistant hit an error. Please try again.');
    setMessages([...next, { role: 'assistant', content: res.text ?? '' }]);
  }

  function clear() {
    setMessages([]);
    setError(null);
  }

  return (
    <div className="flex min-h-[60vh] flex-col rounded-xl border border-border bg-surface">
      {messages.length > 0 && (
        <div className="flex items-center justify-between border-b border-border px-5 py-2.5">
          <span className="text-xs text-muted">Saved on this device</span>
          <button onClick={clear} className="rounded-md px-2 py-1 text-xs text-muted transition hover:bg-surface-2 hover:text-fg">
            Clear
          </button>
        </div>
      )}
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-sm text-muted">Ask about your money — I answer only from your actual data.</p>
            <div className="mx-auto mt-5 flex max-w-xl flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((q) => (
                <button key={q} onClick={() => send(q)} className="rounded-full border border-border px-3 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-fg">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn('rise-in max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm sm:max-w-[80%]', m.role === 'user' ? 'bg-primary-strong text-primary-fg' : 'bg-surface-2')}>
              {m.content}
            </div>
          </div>
        ))}
        {pending && (
          <div className="rise-in flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl bg-surface-2 px-4 py-3.5" role="status" aria-label="Assistant is thinking">
              <span className="dot h-1.5 w-1.5 rounded-full bg-muted" />
              <span className="dot h-1.5 w-1.5 rounded-full bg-muted [animation-delay:0.2s]" />
              <span className="dot h-1.5 w-1.5 rounded-full bg-muted [animation-delay:0.4s]" />
            </div>
          </div>
        )}
        {error && <p className="text-center text-sm text-neg">{error}</p>}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 border-t border-border p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your finances…"
          className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="rounded-lg bg-primary-strong px-4 py-2 text-sm font-medium text-primary-fg disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}

// Restored transcripts are untrusted (anyone can edit localStorage): keep only well-formed,
// non-empty turns, matching the server action's own history schema.
function isChatMessage(m: unknown): m is ChatMessage {
  if (typeof m !== 'object' || m === null) return false;
  const { role, content } = m as { role?: unknown; content?: unknown };
  return (role === 'user' || role === 'assistant') && typeof content === 'string' && content.trim().length > 0;
}
