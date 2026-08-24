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

export function AssistantChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="flex min-h-[60vh] flex-col rounded-xl border border-border bg-surface">
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
            <div className={cn('max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm sm:max-w-[80%]', m.role === 'user' ? 'bg-primary text-primary-fg' : 'bg-surface-2')}>
              {m.content}
            </div>
          </div>
        ))}
        {pending && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-surface-2 px-4 py-2.5 text-sm text-muted">Thinking…</div>
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
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-fg disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
