'use server';

import { z } from 'zod';
import { requireUser } from '@/server/auth/session';
import { askAssistant, type ChatMessage } from '@/server/ai/assistant';

export interface AskResult {
  text: string | null;
  toolsUsed?: string[];
  error?: 'NO_API_KEY' | 'ERROR';
}

// Never trust the client-supplied chat history: validate its shape, cap its size, and keep only the
// most recent turns. This bounds token/cost abuse and shrinks the surface for a forged "assistant"
// turn seeding false figures. (Every number still comes from a fresh deterministic tool call.)
const MAX_MESSAGES = 20;
const HistorySchema = z
  .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(24_000) }))
  .min(1)
  .max(200);

export async function askAction(history: ChatMessage[]): Promise<AskResult> {
  const user = await requireUser();

  const parsed = HistorySchema.safeParse(history);
  if (!parsed.success) return { text: null, error: 'ERROR' };
  const trimmed = parsed.data.slice(-MAX_MESSAGES);
  while (trimmed.length && trimmed[0].role === 'assistant') trimmed.shift(); // conversation must start with a user turn
  if (trimmed.length === 0) return { text: null, error: 'ERROR' };

  try {
    const { text, toolsUsed } = await askAssistant(user.id, trimmed);
    return { text, toolsUsed };
  } catch (e) {
    if (String(e).includes('NO_API_KEY')) return { text: null, error: 'NO_API_KEY' };
    console.error('assistant error:', e);
    return { text: null, error: 'ERROR' };
  }
}
