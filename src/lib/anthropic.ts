import Anthropic from '@anthropic-ai/sdk';
import { parseProposal, PHYSIO_MODEL, PHYSIO_SYSTEM, PROPOSE_TOOL } from '../domain/physio';
import type { Exercise, StoredChatMessage } from '../domain/types';

// Talks to Claude straight from the phone with the user's own API key.
// The key is device-level (not part of any profile or backup).

export { getApiKey, setApiKey, removeApiKey } from './apiKey';

function client(apiKey: string) {
  // Browser use is safe here only because the key is the user's own and never leaves their device except to Anthropic.
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });
}

/** A short, human message for an API failure. */
export function explainError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return 'Your API key was rejected. Check it under You → Physio assistant.';
  if (err instanceof Anthropic.PermissionDeniedError) return "Your API key doesn't have access to this model.";
  if (err instanceof Anthropic.RateLimitError) return 'Too many requests right now. Wait a moment and try again.';
  if (err instanceof Anthropic.APIConnectionError) return "Couldn't reach the assistant. Check your connection and try again.";
  if (err instanceof Anthropic.APIError) {
    if (err.status === 529 || (err.status ?? 0) >= 500) return 'The assistant is busy. Try again in a minute.';
    return `Something went wrong (${err.status ?? 'error'}). Try again.`;
  }
  return 'Something went wrong. Try again.';
}

/** Checks a key with a free metadata call. */
export async function testApiKey(key: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await client(key).models.retrieve(PHYSIO_MODEL);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: explainError(err) };
  }
}

export interface TurnResult {
  /** The full conversation after this turn, assistant content kept exactly as returned. */
  messages: StoredChatMessage[];
  /** Set when the assistant declined or the turn couldn't finish. */
  notice?: string;
}

/**
 * Sends the conversation, streams text through `onText`, and handles the
 * propose_rehab_plan tool: valid proposals are acknowledged so the assistant
 * can carry on; invalid ones go back as errors for it to fix (up to 2 tries).
 */
export async function runPhysioTurn(opts: {
  apiKey: string;
  context: string;
  messages: StoredChatMessage[];
  exercises: Exercise[];
  onText: (fullTextSoFar: string) => void;
  signal?: AbortSignal;
}): Promise<TurnResult> {
  const api = client(opts.apiKey);
  const messages = [...opts.messages];
  let fixes = 0;

  for (let round = 0; round < 4; round++) {
    let text = '';
    const stream = api.beta.messages.stream(
      {
        model: PHYSIO_MODEL,
        max_tokens: 64000,
        output_config: { effort: 'medium' },
        // On a safety decline, the API re-runs the request on a fallback model it picks.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: [
          { type: 'text', text: PHYSIO_SYSTEM, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: opts.context },
        ],
        tools: [PROPOSE_TOOL as unknown as Anthropic.Beta.BetaTool],
        messages: messages as Anthropic.Beta.BetaMessageParam[],
      },
      { signal: opts.signal },
    );
    stream.on('text', (delta) => {
      text += delta;
      opts.onText(text);
    });

    let message: Anthropic.Beta.BetaMessage;
    try {
      message = await stream.finalMessage();
    } catch (err) {
      // A tool input that couldn't be parsed at all: re-issue the turn once or twice.
      if (!(err instanceof Anthropic.APIError) && !(err instanceof Anthropic.APIUserAbortError) && fixes++ < 2) continue;
      throw err;
    }

    if (message.stop_reason === 'refusal') {
      return { messages, notice: "The assistant couldn't help with that. Try rephrasing, or speak to a physio or doctor." };
    }
    messages.push({ role: 'assistant', content: message.content as unknown[] });
    if (message.stop_reason !== 'tool_use') {
      if (message.stop_reason === 'max_tokens') return { messages, notice: 'That reply was cut short. Ask it to continue.' };
      return { messages };
    }

    const results = message.content
      .filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use')
      .map((b) => {
        if (b.name !== PROPOSE_TOOL.name) {
          return { type: 'tool_result' as const, tool_use_id: b.id, is_error: true, content: `Unknown tool ${b.name}.` };
        }
        const parsed = parseProposal(b.input, opts.exercises);
        if (!parsed.ok) fixes++;
        return parsed.ok
          ? { type: 'tool_result' as const, tool_use_id: b.id, content: 'The plan is shown to the person as a card with Save and Start buttons.' }
          : { type: 'tool_result' as const, tool_use_id: b.id, is_error: true, content: `The plan was not valid: ${parsed.error} Please fix it and call the tool again.` };
      });
    messages.push({ role: 'user', content: results });
    if (fixes > 2) return { messages, notice: "The assistant's plan couldn't be read. Ask it to try again." };
  }
  return { messages, notice: 'The assistant took too many steps. Ask it to continue.' };
}
