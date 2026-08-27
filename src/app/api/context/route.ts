import { NextResponse } from "next/server";
import { seasonContext } from "@/lib/season";
import { getGames, type Game } from "@/lib/cfbd";

export const revalidate = 60;

export async function GET() {
  const ctx = await seasonContext();
  const games = await getGames(ctx.year, { seasonType: "both" }).catch(() => [] as Game[]);
  const now = Date.now();
  const live = games.filter((g) => !g.completed && +new Date(g.startDate) <= now);
  const recent = games
    .filter((g) => g.completed)
    .sort((a, b) => +new Date(b.startDate) - +new Date(a.startDate))
    .slice(0, 10);
  const upcoming = games
    .filter((g) => !g.completed && +new Date(g.startDate) > now)
    .sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate))
    .slice(0, 12);
  return NextResponse.json({ ctx, live, recent, upcoming });
}
