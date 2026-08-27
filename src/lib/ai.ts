// Provider-swappable AI layer. Groq is primary; others are optional and
// selected with AI_PROVIDER. Nothing in the app imports a provider directly.

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export interface AIProvider {
  name: string;
  complete(messages: ChatMessage[], opts?: { temperature?: number; maxTokens?: number }): Promise<string>;
  stream(messages: ChatMessage[], opts?: { temperature?: number; maxTokens?: number }): AsyncIterable<string>;
}

function openAICompatible(cfg: {
  name: string;
  baseUrl: string;
  apiKey: string | undefined;
  model: string;
}): AIProvider {
  async function call(messages: ChatMessage[], opts: any, stream: boolean) {
    if (!cfg.apiKey) throw new Error(`${cfg.name} API key not set`);
    return fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: opts?.temperature ?? 0.4,
        max_tokens: opts?.maxTokens ?? 900,
        ...(/gpt-oss/.test(cfg.model) || process.env.AI_REASONING_EFFORT
          ? { reasoning_effort: process.env.AI_REASONING_EFFORT || "low" }
          : {}),
        stream,
      }),
    });
  }
  return {
    name: cfg.name,
    async complete(messages, opts) {
      const res = await call(messages, opts, false);
      if (!res.ok) throw new Error(`${cfg.name} ${res.status}: ${await res.text()}`);
      const json = await res.json();
      return json.choices?.[0]?.message?.content?.trim() ?? "";
    },
    async *stream(messages, opts) {
      const res = await call(messages, opts, true);
      if (!res.ok || !res.body)
        throw new Error(`${cfg.name} ${res.status}: ${await res.text().catch(() => "")}`);
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
            /* partial */
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
Hard rules:
- The structured DATA provided in the prompt is the only source of truth for scores, stats, rankings, records, injuries, recruiting and results.
- Never invent a score, player, statistic, ranking, injury, commitment, transfer or result. If the data doesn't contain it, say "I don't have verified current information on that."
- Clearly label any prediction or estimate as a prediction.
- Be concise and specific. Use numbers from the data. No filler, no hype-for-hype's-sake.
- You explain and contextualize the numbers; you do not create them.`;
