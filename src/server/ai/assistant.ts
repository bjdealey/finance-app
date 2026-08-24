import Anthropic from '@anthropic-ai/sdk';
import { getAnalysis } from '@/server/services/analysis';
import { TOOLS, runTool } from './tools';
import { redactUngrounded } from './validate';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5';

const SYSTEM = `You are the assistant inside "Finance OS", a personal financial optimisation app.
Help the user understand their finances and the app's recommendations.

ABSOLUTE RULES — these define your safety boundary:
- NEVER invent, estimate, guess, or calculate any financial figure (balances, rates, forecasts, amounts, recommendations). EVERY number must come from a tool result.
- Before stating any figure, call the relevant tool and quote its value exactly. Tool outputs are already formatted in GBP (£) — quote them directly and never do arithmetic on them.
- If the tools don't provide what's needed, say so plainly instead of guessing.
- You never move money or execute anything. These are financial planning suggestions and educational information, not regulated financial advice.
- Be concise, calm, non-judgemental, and clear about the reasoning behind each figure.`;

export function assistantAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Runs the tool-use loop server-side. The LLM orchestrates read-only tools and explains their
// results; it computes nothing itself (spec §32). Stateless per turn — tools re-run against fresh data.
export async function askAssistant(userId: string, history: ChatMessage[]): Promise<{ text: string; toolsUsed: string[] }> {
  if (!assistantAvailable()) throw new Error('NO_API_KEY');
  const analysis = await getAnalysis(userId);
  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));
  const toolsUsed: string[] = [];
  const toolOutputs: string[] = []; // every tool result this turn, for the post-hoc grounding check

  for (let i = 0; i < 6; i++) {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM,
      tools: TOOLS,
      messages,
    });
    messages.push({ role: 'assistant', content: resp.content });

    if (resp.stop_reason !== 'tool_use') {
      const text = resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      if (!text) return { text: 'I could not produce an answer.', toolsUsed };
      // Guardrail (spec §32): fail closed — redact any £/rate figure that didn't come from a tool
      // rather than showing an unverified number with a caveat.
      const { text: safe, removed } = redactUngrounded(text, toolOutputs);
      if (!removed.length) return { text: safe, toolsUsed };
      const note = `\n\n---\n⚠️ I removed ${removed.length} figure${removed.length > 1 ? 's' : ''} I couldn't verify against your data (shown as [unverified] above). Ask me to pull the exact number and I'll read it from the tools.`;
      return { text: safe + note, toolsUsed };
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of resp.content) {
      if (block.type === 'tool_use') {
        toolsUsed.push(block.name);
        let result: unknown;
        try {
          result = runTool(block.name, block.input as Record<string, unknown>, analysis);
        } catch (e) {
          result = { error: String(e) };
        }
        const json = JSON.stringify(result);
        toolOutputs.push(json);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: json });
      }
    }
    messages.push({ role: 'user', content: toolResults });
  }
  return { text: 'That needed more steps than I can take in one go — try asking something more specific.', toolsUsed };
}
