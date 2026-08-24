'use server';

import { requireUser } from '@/server/auth/session';
import { askAssistant, type ChatMessage } from '@/server/ai/assistant';

export interface AskResult {
  text: string | null;
  toolsUsed?: string[];
  error?: 'NO_API_KEY' | 'ERROR';
}

export async function askAction(history: ChatMessage[]): Promise<AskResult> {
  const user = await requireUser();
  try {
    const { text, toolsUsed } = await askAssistant(user.id, history);
    return { text, toolsUsed };
  } catch (e) {
    if (String(e).includes('NO_API_KEY')) return { text: null, error: 'NO_API_KEY' };
    console.error('assistant error:', e);
    return { text: null, error: 'ERROR' };
  }
}
