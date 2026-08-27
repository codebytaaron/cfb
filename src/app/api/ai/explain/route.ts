import { NextRequest, NextResponse } from "next/server";
import { AI, GUARDRAILS, RateLimited } from "@/lib/ai";

export const maxDuration = 45;

const DEPTH: Record<string, string> = {
  quick: "One or two sentences.",
  normal: "A short paragraph, 3-5 sentences.",
  deep: "A detailed explanation, 2-3 short paragraphs.",
};

export async function POST(req: NextRequest) {
  const { topic, data, depth = "normal" } = await req.json();
  if (!topic) return NextResponse.json({ error: "topic required" }, { status: 400 });
  try {
    const text = await AI.complete(
      [
        {
          role: "system",
          content: `${GUARDRAILS}\nExplain the item for a fan who is not a stats expert. ${DEPTH[depth] ?? DEPTH.normal} Only use the supplied DATA; do not add facts.`,
        },
        { role: "user", content: `Explain this: ${topic}\n\nDATA:\n${JSON.stringify(data ?? {})}` },
      ],
      { temperature: 0.4, maxTokens: depth === "deep" ? 550 : 260 },
    );
    return NextResponse.json({ text });
  } catch (e: any) {
    if (e instanceof RateLimited)
      return NextResponse.json({ text: "The AI is briefly at its free-tier rate limit. Try again in a few seconds." });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
