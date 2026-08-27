import { NextRequest } from "next/server";
import { AI, GUARDRAILS, RateLimited, type ChatMessage } from "@/lib/ai";
import { buildContext } from "@/lib/retrieval";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { messages, favorites = [] } = (await req.json()) as {
    messages: ChatMessage[];
    favorites?: string[];
  };
  const history = messages.filter((m) => m.role !== "system").map((m) => m.content);
  const last = messages[messages.length - 1]?.content ?? "";

  let context = "";
  try {
    context = (await buildContext(last, history.slice(-6))).text;
  } catch (e: any) {
    context = `Data retrieval failed: ${e.message}`;
  }

  const sys: ChatMessage = {
    role: "system",
    content: `${GUARDRAILS}
You are in a conversation — resolve pronouns like "their"/"they" from earlier turns.
${favorites.length ? `The user follows: ${favorites.join(", ")}. Prioritise them when relevant.` : ""}

LIVE DATA (source of truth — use these exact numbers):
${context}`,
  };

  const convo = [sys, ...messages.filter((m) => m.role !== "system").slice(-10)];

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      try {
        for await (const chunk of AI.stream(convo, { temperature: 0.5, maxTokens: 600 })) {
          controller.enqueue(enc.encode(chunk));
        }
      } catch (e: any) {
        const msg =
          e instanceof RateLimited
            ? "\n\n_(The AI is briefly at its free-tier rate limit — wait a few seconds and send again.)_"
            : `\n\n_(Something went wrong: ${e.message})_`;
        controller.enqueue(enc.encode(msg));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
