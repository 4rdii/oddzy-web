import "server-only";

/**
 * Server-only client for the LLM router behind the extension's market finder.
 *
 * The router speaks the Anthropic Messages API. Its key is as sensitive as
 * ODDZY_API_TOKEN — it spends real credits per call — so it lives only here and
 * in /api/extension/match; the extension itself never sees it.
 *
 * The router's backends are uneven: named models intermittently fail with
 * credential or rate-limit errors, and some `auto/*` combos take 30s. So every
 * call has a hard timeout and walks an ordered model list within a time budget;
 * a reply that is not parseable JSON counts as a failure. `auto/*` routes are
 * the ones that answered when this was written — the router moves the model
 * behind each route, so revisit EXTENSION_LLM_MODELS when latency drifts.
 */

const BASE = (process.env.EXTENSION_LLM_BASE_URL ?? "https://router.rng-dev.online").replace(/\/+$/, "");
const KEY = process.env.EXTENSION_LLM_API_KEY ?? "";
const MODELS = (process.env.EXTENSION_LLM_MODELS ?? "auto/chat,auto/best-chat,auto/thrifty")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

export class LlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmError";
  }
}

type ContentBlock = { type: string; text?: string };

/** Pulls the first JSON object out of a reply that may carry prose or code fences. */
function parseJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function callOnce(
  model: string,
  system: string,
  user: string,
  maxTokens: number,
  timeoutMs: number,
): Promise<unknown> {
  const res = await fetch(`${BASE}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0,
      system,
      messages: [{ role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok) throw new LlmError(`${model}: HTTP ${res.status}`);
  const body = (await res.json()) as { content?: ContentBlock[] };
  const text = (body.content ?? [])
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("");
  const parsed = parseJsonObject(text);
  if (!parsed || typeof parsed !== "object") {
    const kinds = (body.content ?? []).map((b) => b.type).join(",") || "none";
    throw new LlmError(`${model}: no JSON in reply [${kinds}] ${JSON.stringify(text.slice(0, 160))}`);
  }
  return parsed;
}

/**
 * One JSON-returning completion. Tries each configured model in order until one
 * answers with a JSON object inside `timeoutMs`; throws LlmError if none does.
 */
export async function completeJson(opts: {
  system: string;
  user: string;
  maxTokens: number;
  /** Per-model timeout. */
  timeoutMs: number;
  /** Total time across all models; no new attempt starts past it. */
  budgetMs: number;
}): Promise<unknown> {
  if (!KEY) throw new LlmError("EXTENSION_LLM_API_KEY is not configured");
  const errors: string[] = [];
  // The router caches replies keyed on the messages alone (not the system
  // prompt or max_tokens), so a truncated or empty reply comes back verbatim on
  // an identical retry. Attempts after the first vary the user message instead.
  const deadline = Date.now() + opts.budgetMs;
  for (const [i, model] of MODELS.entries()) {
    const left = deadline - Date.now();
    if (left < 1500) break;
    const user = i === 0 ? opts.user : `${opts.user}\n\n(attempt ${i + 1})`;
    try {
      return await callOnce(model, opts.system, user, opts.maxTokens, Math.min(opts.timeoutMs, left));
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  throw new LlmError(`all models failed: ${errors.join("; ")}`);
}
