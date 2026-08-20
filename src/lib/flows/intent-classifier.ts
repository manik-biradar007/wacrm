/**
 * AI intent-fallback for `send_buttons` / `send_list` flow nodes.
 *
 * When a customer replies with free text instead of tapping a button —
 * often in Hindi, Marathi, Hinglish, or "Minglish" (Marathi-English
 * code-mixed, usually Latin script) — the engine's id-based matcher
 * (`matchReplyId` in engine.ts) can't match it. This module asks the
 * account's configured LLM (bring-your-own-key, via `src/lib/ai`)
 * whether the free text means one of the current node's options, so
 * the engine can route it exactly as if that option had been tapped.
 *
 * Never throws — every failure mode (no AI configured, provider error,
 * timeout, unparseable response) collapses to `{ status: "unavailable" }`
 * or `{ status: "none" }` so the caller's existing fallback_policy
 * (reprompt/handoff/end) remains the untouched safety net.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAiConfig } from "@/lib/ai/config";
import { generateReply } from "@/lib/ai/generate";
import { AiError } from "@/lib/ai/types";

// Read per-call (not module-load time) so tests can stub the env var
// and so a runtime config change doesn't require a redeploy to pick up.
function classifyTimeoutMs(): number {
  return Number(process.env.AI_INTENT_CLASSIFY_TIMEOUT_MS) || 8000;
}

// WhatsApp text messages can run up to ~65k chars. A menu-option match
// never needs more than a sentence or two, so cap what we forward to
// the provider — bounds token cost per call and closes off a cheap
// way to run up the account's own AI spend by pasting huge text at a
// button prompt repeatedly.
const MAX_CLASSIFY_TEXT_LENGTH = 500;

export interface IntentCandidate {
  reply_id: string;
  title: string;
  next_node_key: string;
}

export type IntentClassifyResult =
  | { status: "matched"; next_node_key: string; reply_id: string }
  | { status: "none" }
  | { status: "unavailable" };

function buildSystemPrompt(candidates: IntentCandidate[]): string {
  const options = candidates
    .map((c) => `- ${c.reply_id}: ${c.title}`)
    .join("\n");
  return `You are an intent classifier for a WhatsApp menu the customer did not tap.
The customer was shown these options (id: label):
${options}

The customer message may be in any language or mix of languages,
including English, Hindi, Marathi, Hinglish, or Minglish (Marathi-English
code-mixed, usually written in Latin script). Match the customer's message
to the option they most likely meant, by MEANING, not literal wording or
language -- for example "mala tickit havi ahe", "I want ticket", and
"mujhe ticket chahiye" should all match an option titled "Buy Ticket" if
one exists.

Reply with EXACTLY ONE LINE containing either:
- the bare id of the single best-matching option (no quotes, no
  punctuation, nothing else), if you are reasonably confident, or
- the literal text NONE, if no option is a good match, the message is not
  related to any option, or you are unsure.

Do not explain your answer. Do not invent an id that is not listed above.`;
}

/** Strip quotes/punctuation and take the first line of the model's reply. */
function parseResponse(
  raw: string,
  candidates: IntentCandidate[],
): IntentCandidate | null {
  const firstLine = raw.trim().split("\n")[0]?.trim() ?? "";
  const cleaned = firstLine.replace(/^['"`]+|['"`.]+$/g, "");
  if (!cleaned || cleaned.toUpperCase() === "NONE") return null;
  return candidates.find((c) => c.reply_id === cleaned) ?? null;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`intent classification timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Classify a customer's free-text reply against the current node's
 * button/row options. Returns `unavailable` when the account has no
 * active AI config or the provider call fails/times out — callers
 * should treat that identically to "AI wasn't attempted."
 */
export async function classifyIntent(args: {
  db: SupabaseClient;
  accountId: string;
  text: string;
  candidates: IntentCandidate[];
}): Promise<IntentClassifyResult> {
  const { db, accountId, candidates } = args;
  if (candidates.length === 0) return { status: "unavailable" };

  const text = args.text.slice(0, MAX_CLASSIFY_TEXT_LENGTH);
  if (!text.trim()) return { status: "unavailable" };

  const config = await loadAiConfig(db, accountId, { requireActive: true });
  if (!config) return { status: "unavailable" };

  try {
    const result = await withTimeout(
      generateReply({
        config,
        systemPrompt: buildSystemPrompt(candidates),
        messages: [{ role: "user", content: text }],
      }),
      classifyTimeoutMs(),
    );
    const candidate = parseResponse(result.text, candidates);
    return candidate
      ? {
          status: "matched",
          next_node_key: candidate.next_node_key,
          reply_id: candidate.reply_id,
        }
      : { status: "none" };
  } catch (err) {
    console.error(
      "[intent-classifier] classification failed:",
      err instanceof AiError ? `${err.code}: ${err.message}` : err,
    );
    return { status: "unavailable" };
  }
}
