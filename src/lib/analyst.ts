import { AI, GUARDRAILS, RateLimited } from "./ai";
import { cacheGet, cacheSet } from "./store";
import { getGames, getRecords, getTeamStats, type Game } from "./cfbd";
import { computePowerRankings } from "./power";
import { latestRankingWeek, seasonContext } from "./season";

async function say(system: string, user: string, temp = 0.4, maxTokens = 600) {
  return AI.complete(
    [
      { role: "system", content: `${GUARDRAILS}\n${system}` },
      { role: "user", content: user },
    ],
    { temperature: temp, maxTokens },
  );
}

function firstJson(raw: string, open: "{" | "[") {
  const close = open === "{" ? "}" : "]";
  return JSON.parse(raw.slice(raw.indexOf(open), raw.lastIndexOf(close) + 1));
}

// ---------- Game analysis ----------
export async function analyzeGame(game: Game, question?: string) {
  const key = `game:${game.id}:${game.homePoints}-${game.awayPoints}:${game.completed}:${question ?? "auto"}`;
  const cached = await cacheGet(key, question ? 120 : 900);
  if (cached) return cached;

  const [homeRec, awayRec] = await Promise.all([
    getRecords(game.season, game.homeTeam).catch(() => []),
    getRecords(game.season, game.awayTeam).catch(() => []),
  ]);
  const side = (home: boolean) => ({
    team: home ? game.homeTeam : game.awayTeam,
    points: home ? game.homePoints : game.awayPoints,
    byQuarter: home ? game.homeLineScores : game.awayLineScores,
    pregameElo: home ? game.homePregameElo : game.awayPregameElo,
    winProb: home ? game.homePostgameWinProbability : game.awayPostgameWinProbability,
    record: (home ? homeRec : awayRec)[0]?.total,
  });
  const data = {
    status: game.completed ? "FINAL" : new Date(game.startDate) <= new Date() ? "LIVE" : "SCHEDULED",
    week: game.week,
    seasonType: game.seasonType,
    venue: game.venue,
    notes: game.notes,
    home: side(true),
    away: side(false),
    excitementIndex: game.excitementIndex,
  };

  const system = game.completed
    ? "Write an AI GAME SUMMARY: final result, the turning point, one key stat, playoff/conference meaning. 90-130 words, plain prose."
    : "You are the live AI analyst. Concise read: who's in control and why, what each team needs next. 70-110 words.";
  const user = question
    ? `DATA:\n${JSON.stringify(data)}\n\nFan question: "${question}"\nAnswer only from the data.`
    : `DATA:\n${JSON.stringify(data)}`;

  const text = await say(system, user, 0.45, 380);
  await cacheSet(key, "game-analysis", text);
  return text;
}

// ---------- Power ranking explanations ----------
export async function explainedPowerRankings(year: number) {
  const key = `power-explained:${year}`;
  const cached = await cacheGet(key, 1800);
  if (cached && !cached.degraded) return cached;
  if (cached?.degraded && Date.now() - +new Date(cached.generatedAt) < 300_000) return cached;

  const pr = await computePowerRankings(year, 25);
  const top = pr.rows.slice(0, 10).map((r) => ({
    team: r.team,
    rank: r.rank,
    elo: r.elo,
    rec: `${r.wins}-${r.losses}`,
    ptDiff: r.pointDiff,
    sos: r.sos,
  }));
  const preseason = pr.rows.every((r) => r.wins + r.losses === 0);
  const system = preseason
    ? 'PRESEASON model (carry-over Elo). One sentence per team, max 24 words, on what its Elo says entering the year. No mention of zero/missing stats. Strict JSON array [{"team","note"}] only.'
    : 'One sentence per team, max 26 words, citing its numbers (Elo, record, point diff, SoS). Strict JSON array [{"team","note"}] only.';

  const notes: Record<string, string> = {};
  let degraded = false;
  try {
    const raw = await say(system, JSON.stringify(top), 0.3, 650);
    for (const x of firstJson(raw, "[")) if (x?.team) notes[x.team] = x.note;
  } catch (e) {
    degraded = e instanceof RateLimited;
  }
  const out = {
    ...pr,
    degraded,
    generatedAt: new Date().toISOString(),
    rows: pr.rows.map((r) => ({ ...r, note: notes[r.team] ?? null })),
  };
  await cacheSet(key, "power-rankings", out);
  return out;
}

// ---------- Daily briefing ----------
function briefingFallback(data: any, ctx: any) {
  const top = data.poll?.top15 ?? [];
  return {
    date: data.today,
    phase: ctx.phase,
    degraded: true,
    headline: top[0]
      ? `${String(top[0]).replace(/^\d+\s/, "")} opens on top of the ${data.poll.name}`
      : `College football — ${ctx.phase}, ${ctx.year}`,
    yourTeams: (data.favorites ?? []).map((t: string) => ({
      team: t,
      note: `Ranked context and results for ${t} are on its team page.`,
    })),
    topStories: [
      data.poll?.name && { title: `${data.poll.name} released`, detail: `Top five: ${top.slice(0, 5).map((s: string) => s.replace(/^\d+\s/, "")).join(", ")}.` },
      data.powerTop10?.[0] && { title: "Gridiron AI power model", detail: `Model favorite entering play: ${data.powerTop10[0]}.` },
      data.recentResults?.[0] && { title: "Latest results", detail: data.recentResults.slice(0, 3).map((r: any) => r.g).join(" · ") },
    ].filter(Boolean),
    gamesToWatch: (data.upcomingGames ?? []).slice(0, 4).map((g: any) => ({
      matchup: g.g,
      why: `Week ${g.wk}, ${String(g.when).slice(0, 10)}.`,
    })),
    outlook: "AI commentary is briefly rate-limited — this view is built straight from the data feed and will fill in shortly.",
    generatedAt: new Date().toISOString(),
  };
}

export async function dailyBriefing(favorites: string[] = []) {
  const ctx = await seasonContext();
  const key = `briefing:${ctx.year}:${new Date().toISOString().slice(0, 10)}:${favorites.slice().sort().join(",")}`;
  const cached = await cacheGet(key, 3 * 3600);
  if (cached && !cached.degraded) return cached;

  const [games, ranking, power] = await Promise.all([
    getGames(ctx.year, { seasonType: "both" }).catch(() => [] as Game[]),
    latestRankingWeek(ctx.year),
    computePowerRankings(ctx.year, 12).catch(() => null),
  ]);

  const now = Date.now();
  const recent = games
    .filter((g) => g.completed)
    .sort((a, b) => +new Date(b.startDate) - +new Date(a.startDate))
    .slice(0, 6)
    .map((g) => ({ g: `${g.awayTeam} ${g.awayPoints} @ ${g.homeTeam} ${g.homePoints}`, wk: g.week }));
  const upcoming = games
    .filter((g) => !g.completed && +new Date(g.startDate) > now)
    .sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate))
    .slice(0, 8)
    .map((g) => ({ g: `${g.awayTeam} @ ${g.homeTeam}`, when: g.startDate, wk: g.week }));

  const ap =
    ranking?.polls.find((p) => /Playoff|AP|Coaches/i.test(p.poll))?.ranks.slice(0, 12).map((r) => `${r.rank} ${r.school}`) ?? [];

  const data = {
    today: new Date().toISOString().slice(0, 10),
    phase: ctx.phase,
    season: ctx.year,
    poll: { name: ranking?.polls[0]?.poll, top15: ap },
    powerTop10: power?.rows.slice(0, 8).map((r) => `${r.rank} ${r.team} (${r.wins}-${r.losses}, Elo ${r.elo})`),
    recentResults: recent,
    upcomingGames: upcoming,
    favorites,
  };

  const system = `Produce the DAILY COLLEGE FOOTBALL BRIEFING as strict JSON:
{"date":"","phase":"","headline":"","yourTeams":[{"team":"","note":""}],"topStories":[{"title":"","detail":""}],"gamesToWatch":[{"matchup":"","why":""}],"outlook":""}
3-4 topStories, 3-4 gamesToWatch. Every claim traces to DATA. favorites empty -> yourTeams []. 1-2 sentences per field. JSON only.`;

  let json: any;
  try {
    json = firstJson(await say(system, `DATA:\n${JSON.stringify(data)}`, 0.5, 900), "{");
    json.generatedAt = new Date().toISOString();
    json.degraded = false;
  } catch {
    json = briefingFallback(data, ctx);
  }
  await cacheSet(key, "briefing", json);
  return json;
}

// ---------- Team report ----------
export async function teamReport(teamName: string) {
  const ctx = await seasonContext();
  const key = `team-report:${teamName}:${ctx.year}:${ctx.week}`;
  const cached = await cacheGet(key, 6 * 3600);
  if (cached && !cached.degraded) return cached;

  const [records, games, stats, powerNow, powerPrev] = await Promise.all([
    getRecords(ctx.year, teamName).catch(() => []),
    getGames(ctx.year, { team: teamName, seasonType: "both" }).catch(() => [] as Game[]),
    getTeamStats(ctx.year, teamName).catch(() => []),
    computePowerRankings(ctx.year, 140).catch(() => null),
    computePowerRankings(ctx.year - 1, 140).catch(() => null),
  ]);

  const results = games
    .filter((g) => g.completed)
    .map((g) => {
      const home = g.homeTeam === teamName;
      const us = home ? g.homePoints : g.awayPoints;
      const them = home ? g.awayPoints : g.homePoints;
      return { opp: home ? g.awayTeam : g.homeTeam, us, them, w: (us ?? 0) > (them ?? 0), wk: g.week };
    });
  const schedule = games
    .filter((g) => !g.completed)
    .slice(0, 12)
    .map((g) => ({ opp: g.homeTeam === teamName ? g.awayTeam : g.homeTeam, when: g.startDate.slice(0, 10), wk: g.week }));

  const statLine: Record<string, number> = {};
  for (const s of stats) if (s?.statName) statLine[s.statName] = s.statValue;

  const powerRow = powerNow?.rows.find((r) => r.team === teamName);
  const lastYearRow = powerPrev?.rows.find((r) => r.team === teamName);

  const data = {
    season: ctx.year,
    phase: ctx.phase,
    record: records[0]?.total,
    conference: records[0]?.conference,
    powerRank: powerRow ? { rank: powerRow.rank, score: powerRow.score, elo: powerRow.elo, trend: powerRow.trend } : null,
    lastSeasonPowerRank: lastYearRow?.rank ?? null,
    results,
    remainingSchedule: schedule,
    seasonStats: statLine,
  };

  const system = `Produce a TEAM REPORT as strict JSON:
{"team":"","summary":"","biggestStrength":"","biggestWeakness":"","playerToWatch":"","mostImportantGame":"","playoffOutlook":""}
summary 2-3 sentences; other fields 1-2, grounded in DATA numbers. Only name a player if one is in the data, else describe a unit. JSON only.`;

  let json: any;
  try {
    json = firstJson(await say(system, `DATA:\n${JSON.stringify(data)}`, 0.45, 700), "{");
    json.degraded = false;
  } catch (e) {
    json = {
      team: teamName,
      summary:
        e instanceof RateLimited
          ? "The AI write-up is briefly rate-limited. The data below is live — reload in a moment for the full report."
          : "Report unavailable right now.",
      biggestStrength: "",
      biggestWeakness: "",
      playerToWatch: "",
      mostImportantGame: "",
      playoffOutlook: "",
      degraded: true,
    };
  }
  json.data = data;
  json.generatedAt = new Date().toISOString();
  await cacheSet(key, "team-report", json);
  return json;
}
