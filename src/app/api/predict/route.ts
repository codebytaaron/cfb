import { NextRequest, NextResponse } from "next/server";
import { getElo, getGames } from "@/lib/cfbd";
import { seasonContext } from "@/lib/season";
import { AI, GUARDRAILS } from "@/lib/ai";

export const maxDuration = 45;

// Elo win-probability model. The number comes from math, not the LLM.
function eloWinProb(a: number, b: number, homeEdge: number) {
  return 1 / (1 + Math.pow(10, -((a + homeEdge - b) / 400)));
}

export async function GET(req: NextRequest) {
  const home = req.nextUrl.searchParams.get("home");
  const away = req.nextUrl.searchParams.get("away");
  const neutral = req.nextUrl.searchParams.get("neutral") === "1";
  if (!home || !away) return NextResponse.json({ error: "home & away required" }, { status: 400 });

  const ctx = await seasonContext();
  const elo = await getElo(ctx.year).catch(() => []);
  const map = new Map<string, number>();
  for (const e of elo) if (e?.team) map.set(e.team, e.elo);
  if (!map.size) {
    const prev = await getGames(ctx.year - 1, { seasonType: "both" }).catch(() => []);
    for (const g of prev) {
      if (g.homePostgameElo) map.set(g.homeTeam, g.homePostgameElo);
      if (g.awayPostgameElo) map.set(g.awayTeam, g.awayPostgameElo);
    }
  }
  const hElo = map.get(home) ?? 1500;
  const aElo = map.get(away) ?? 1500;
  const homeEdge = neutral ? 0 : 55;
  const pHome = eloWinProb(hElo, aElo, homeEdge);
  const spread = Math.round(((hElo + homeEdge - aElo) / 25) * 2) / 2; // pts, home favored if positive

  const model = {
    homeTeam: home,
    awayTeam: away,
    neutral,
    homeElo: Math.round(hElo),
    awayElo: Math.round(aElo),
    homeWinProbability: Math.round(pHome * 1000) / 10,
    awayWinProbability: Math.round((1 - pHome) * 1000) / 10,
    projectedSpread: spread >= 0 ? `${home} -${spread}` : `${away} -${Math.abs(spread)}`,
  };

  let explanation = "";
  try {
    explanation = await AI.complete(
      [
        { role: "system", content: `${GUARDRAILS}\nThis is a MODEL PREDICTION (label it as such). Explain the projection in 2-3 sentences using the numbers. Do not change the probability.` },
        { role: "user", content: `DATA:\n${JSON.stringify(model)}` },
      ],
      { temperature: 0.4, maxTokens: 220 },
    );
  } catch {
    /* explanation optional */
  }
  return NextResponse.json({ model, explanation, disclaimer: "Prediction from an Elo model, not a guarantee." });
}
