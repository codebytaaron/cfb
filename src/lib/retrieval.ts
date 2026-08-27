// Pulls the slice of real data a chat question needs, so the model answers from
// facts instead of memory.

import { getGames, getRecords, getTeams, type Game } from "./cfbd";
import { computePowerRankings } from "./power";
import { latestRankingWeek, seasonContext } from "./season";

let teamCache: { at: number; names: string[] } | null = null;
async function teamNames(): Promise<string[]> {
  if (teamCache && Date.now() - teamCache.at < 3600_000) return teamCache.names;
  const teams = await getTeams().catch(() => []);
  const names = teams.map((t) => t.school);
  teamCache = { at: Date.now(), names };
  return names;
}

export async function buildContext(question: string, history: string[] = []) {
  const ctx = await seasonContext();
  const hay = `${history.join(" ")} ${question}`.toLowerCase();
  const names = await teamNames();
  const mentioned = names
    .filter((n) => n.length > 3 && hay.includes(n.toLowerCase()))
    .slice(0, 4);

  const parts: string[] = [
    `SEASON CONTEXT: ${ctx.year}, phase=${ctx.phase}, week ${ctx.week} (${ctx.seasonType}). Today is ${new Date().toISOString().slice(0, 10)}.`,
  ];

  const wantsRanking = /(rank|ranking|top \d+|poll|playoff|cfp|best team|power)/i.test(hay);
  if (wantsRanking || mentioned.length === 0) {
    const [poll, power] = await Promise.all([
      latestRankingWeek(ctx.year),
      computePowerRankings(ctx.year, 25).catch(() => null),
    ]);
    const p = poll?.polls.find((x) => /Playoff|AP/i.test(x.poll)) ?? poll?.polls[0];
    if (p) parts.push(`${p.poll} (week ${poll?.week}): ${p.ranks.slice(0, 25).map((r) => `${r.rank}.${r.school}`).join(", ")}`);
    if (power) parts.push(`GRIDIRON AI POWER RANKINGS (statistical model): ${power.rows.map((r) => `${r.rank}.${r.team} ${r.wins}-${r.losses} Elo${r.elo} ptDiff${r.pointDiff} SoS${r.sos}`).join(" | ")}`);
  }

  for (const team of mentioned) {
    const [rec, games] = await Promise.all([
      getRecords(ctx.year, team).catch(() => []),
      getGames(ctx.year, { team, seasonType: "both" }).catch(() => [] as Game[]),
    ]);
    const done = games
      .filter((g) => g.completed)
      .map((g) => {
        const home = g.homeTeam === team;
        return `${home ? g.awayTeam : g.homeTeam} ${home ? g.homePoints : g.awayPoints}-${home ? g.awayPoints : g.homePoints} ${(home ? g.homePoints ?? 0 : g.awayPoints ?? 0) > (home ? g.awayPoints ?? 0 : g.homePoints ?? 0) ? "W" : "L"}`;
      });
    const next = games
      .filter((g) => !g.completed)
      .sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate))
      .slice(0, 4)
      .map((g) => `${g.homeTeam === team ? "vs " + g.awayTeam : "at " + g.homeTeam} (${g.startDate.slice(0, 10)})`);
    parts.push(
      `${team}: record ${rec[0]?.total.wins ?? "?"}-${rec[0]?.total.losses ?? "?"}, conf ${rec[0]?.conference ?? "?"}. Results: ${done.join("; ") || "none yet"}. Next: ${next.join("; ") || "n/a"}.`,
    );
  }

  return { text: parts.join("\n"), mentioned, ctx };
}
