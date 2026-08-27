// Provider-swappable AI layer. Groq is primary; others are optional and
// selected with AI_PROVIDER. Nothing in the app imports a provider directly.
//
// Groq's free tier is a tight 8000 tokens/minute, so every call goes through a
// single in-process queue (one request at a time, min gap between them) and
// retries on HTTP 429 using the wait hint Groq returns.

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type AIOpts = { temperature?: number; maxTokens?: number };

export interface AIProvider {
  name: string;
  complete(messages: ChatMessage[], opts?: AIOpts): Promise<string>;
  stream(messages: ChatMessage[], opts?: AIOpts): AsyncIterable<string>;
}

export class RateLimited extends Error {
  constructor(public retryAfter: number) {
    super("AI rate limit reached — try again shortly.");
  }
}

// ---- global serialized queue + adaptive cooldown ----
const MIN_GAP_MS = Number(process.env.AI_MIN_GAP_MS || 900);
const MAX_RETRIES = Number(process.env.AI_MAX_RETRIES || 4);
const MAX_WAIT_MS = 12000;
let chain: Promise<unknown> = Promise.resolve();
let lastRun = 0;
let cooldownUntil = 0; // set when a 429 is seen; the next call waits it out

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const now = Date.now();
    const wait = Math.max(MIN_GAP_MS - (now - lastRun), cooldownUntil - now, 0);
    if (wait > 0) await sleep(Math.min(wait, MAX_WAIT_MS));
    try {
      return await fn();
    } finally {
      lastRun = Date.now();
    }
  });
  chain = run.catch(() => {});
  return run as Promise<T>;
}

function parseDuration(v?: string | null): number {
  if (!v) return 0;
  const s = v.trim();
  let ms = 0;
  const min = s.match(/([\d.]+)m(?!s)/); if (min) ms += parseFloat(min[1]) * 60000;
  const sec = s.match(/([\d.]+)s/); if (sec) ms += parseFloat(sec[1]) * 1000;
  const mil = s.match(/([\d.]+)ms/); if (mil) ms = parseFloat(mil[1]);
  if (!ms && /^[\d.]+$/.test(s)) ms = parseFloat(s) * 1000; // bare seconds (Retry-After)
  return ms;
}

// Groq's token bucket refills continuously; the reset header is the accurate wait.
function retryDelay(body: string, headers: Headers): number {
  const reset = parseDuration(headers.get("x-ratelimit-reset-tokens"));
  const after = parseDuration(headers.get("retry-after"));
  const hint = parseDuration((body.match(/try again in ([\d.]+m?s)/i) || [])[1]);
  const best = Math.max(reset, after, hint);
  return Math.min(Math.max(best + 700, 1500), MAX_WAIT_MS);
}

function openAICompatible(cfg: {
  name: string;
  baseUrl: string;
  apiKey: string | undefined;
  model: string;
}): AIProvider {
  function body(messages: ChatMessage[], opts: AIOpts | undefined, stream: boolean) {
    return JSON.stringify({
      model: cfg.model,
      messages,
      temperature: opts?.temperature ?? 0.4,
      max_tokens: opts?.maxTokens ?? 700,
      ...(/gpt-oss/.test(cfg.model) || process.env.AI_REASONING_EFFORT
        ? { reasoning_effort: process.env.AI_REASONING_EFFORT || "low" }
        : {}),
      stream,
    });
  }

  async function fetchOnce(messages: ChatMessage[], opts: AIOpts | undefined, stream: boolean) {
    if (!cfg.apiKey) throw new Error(`${cfg.name} API key not set`);
    return fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: body(messages, opts, stream),
    });
  }

  // Run through the queue, retrying 429s a few times.
  async function request(messages: ChatMessage[], opts: AIOpts | undefined, stream: boolean): Promise<Response> {
    return enqueue(async () => {
      let attempt = 0;
      while (true) {
        const res = await fetchOnce(messages, opts, stream);
        if (res.ok) return res;
        const text = await res.text().catch(() => "");
        if (res.status === 429) {
          const delay = retryDelay(text, res.headers);
          cooldownUntil = Date.now() + delay;
          if (attempt < MAX_RETRIES) {
            await sleep(delay);
            attempt++;
            lastRun = Date.now();
            continue;
          }
          throw new RateLimited(delay);
        }
        throw new Error(`${cfg.name} ${res.status}: ${text.slice(0, 300)}`);
      }
    });
  }

  return {
    name: cfg.name,
    async complete(messages, opts) {
      const res = await request(messages, opts, false);
      const json = await res.json();
      return json.choices?.[0]?.message?.content?.trim() ?? "";
    },
    async *stream(messages, opts) {
      const res = await request(messages, opts, true);
      if (!res.body) throw new Error(`${cfg.name}: no response body`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const payload = t.slice(5).trim();
          if (payload === "[DONE]") return;
          try {
            const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
            if (delta) yield delta as string;
          } catch {
            /* partial line */
          }
        }
      }
    },
  };
}

function makeProvider(): AIProvider {
  const provider = (process.env.AI_PROVIDER || "groq").toLowerCase();
  switch (provider) {
    case "gemini":
      return openAICompatible({
        name: "gemini",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
        apiKey: process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
      });
    case "openrouter":
      return openAICompatible({
        name: "openrouter",
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY,
        model: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct",
      });
    case "groq":
    default:
      return openAICompatible({
        name: "groq",
        baseUrl: "https://api.groq.com/openai/v1",
        apiKey: process.env.GROQ_API_KEY,
        model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
      });
  }
}

export const AI = makeProvider();

export const GUARDRAILS = `You are Gridiron AI, a college football analyst.
Rules:
- The DATA in the prompt is the only source of truth for scores, stats, rankings, records, injuries, recruiting and results.
- Never invent any of those. If the data lacks it, say "I don't have verified current information on that."
- Label predictions as predictions.
- Be concise and specific, use the numbers, no filler. You explain the numbers; you don't create them.`;
