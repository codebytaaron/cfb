import { NextRequest, NextResponse } from "next/server";
import { getGames } from "@/lib/cfbd";
import { seasonContext } from "@/lib/season";
import { analyzeGame } from "@/lib/analyst";
import { RateLimited } from "@/lib/ai";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get("id"));
  const question = req.nextUrl.searchParams.get("q") ?? undefined;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const ctx = await seasonContext();
  const years = [ctx.year, ctx.year - 1];
  for (const y of years) {
    const games = await getGames(y, { seasonType: "both" }).catch(() => []);
    const g = games.find((x) => x.id === id);
    if (g) {
      try {
        return NextResponse.json({ game: g, analysis: await analyzeGame(g, question) });
      } catch (e: any) {
        if (e instanceof RateLimited)
          return NextResponse.json({
            game: g,
            analysis: "The AI analyst is briefly at its free-tier rate limit. The box score above is live — refresh in a few seconds.",
          });
        return NextResponse.json({ error: e.message }, { status: 500 });
      }
    }
  }
  return NextResponse.json({ error: "game not found" }, { status: 404 });
}
