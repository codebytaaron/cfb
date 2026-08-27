import { AI, GUARDRAILS } from "./ai";
import { cacheGet, cacheSet } from "./store";
import {
  getGames,
  getRecords,
  getTeamStats,
  type Game,
} from "./cfbd";
import { computePowerRankings } from "./power";
import { latestRankingWeek, seasonContext } from "./season";

async function say(system: string, user: string, temp = 0.4, maxTokens = 700) {
  return AI.complete(
    [
      { role: "system", content: `${GUARDRAILS}\n${system}` },
      { role: "user", content: user },
    ],
    { temperature: temp, maxTokens },
  );
}

// ---------- Game analysis ----------
export async function analyzeGame(game: Game, question?: string) {
  const key = `game:${game.id}:${game.homePoints}-${game.awayPoints}:${game.completed}:${question ?? "auto"}`;
  const cached = await cacheGet(key, question ? 120 : 600);
  if (cached) return cached;

  const [homeRec, awayRec] = await Promise.all([
    getRecords(game.season, game.homeTeam).catch(() => []),
    getRecords(game.season, game.awayTeam).catch(() => []),
  ]);
  const data = {
    status: game.completed ? "FINAL" : new Date(game.startDate) <= new Date() ? "LIVE/IN-PROGRESS" : "SCHEDULED",
    week: game.week,
    seasonType: game.seasonType,
    kickoff: game.startDate,
    venue: game.venue,
    neutralSite: game.neutralSite,
    notes: game.notes,
    home: {
      team: game.homeTeam,
      conference: game.homeConference,
      points: game.homePoints,
      byQuarter: game.homeLineScores,
      pregameElo: game.homePregameElo,
      postgameElo: game.homePostgameElo,
      postgameWinProb: game.homePostgameWinProbability,
      record: homeRec[0]?.total,
    },
    away: {
      team: game.awayTeam,
      conference: game.awayConference,
      points: game.awayPoints,
      byQuarter: game.awayLineScores,
      pregameElo: game.awayPregameElo,
      postgameElo: game.awayPostgameElo,
      postgameWinProb: game.awayPostgameWinProbability,
      record: awayRec[0]?.total,
    },
    excitementIndex: game.excitementIndex,
  };

  const system = game.completed
    ? "Write an AI GAME SUMMARY. Cover: final result, the turning point, key statistic, what it means for the playoff/conference picture. 120-160 words. Plain prose, no headers."
    : "You are the live AI analyst for this game. Give a concise read of the current state: who is in control, why, and what each team needs to do next. 90-130 words.";
  const user = question
    ? `DATA:\n${JSON.stringify(data)}\n\nFan question: "${question}"\nAnswer using only the data above.`
    : `DATA:\n${JSON.stringify(data)}`;

  const text = await say(system, user, 0.45, 500);
  await cacheSet(key, "game-analysis", text);
  return text;
}

// ---------- Power ranking explanations ----------
export async function explainedPowerRankings(year: number) {
  const key = `power-explained:${year}`;
  const cached = await cacheGet(key, 1800);
  if (cached) return cached;

  const pr = await computePowerRankings(year, 25);
  const top = pr.rows.slice(0, 12);
  const preseason = pr.rows.every((r) => r.wins + r.losses === 0);
  const system = preseason
    ? "This is a PRESEASON model driven by carry-over Elo from last season. For each team give ONE sentence (max 26 words) explaining what its Elo rating says about it entering the year. Do not mention missing/zero stats or placeholders. Return strict JSON array [{\"team\":\"..\",\"note\":\"..\"}]. No other text."
    : "For each team give ONE sentence (max 28 words) explaining its position, citing its actual numbers (Elo, record, point differential, SoS, quality wins, bad losses). Return strict JSON array: [{\"team\":\"..\",\"note\":\"..\"}]. No other text.";
  const user = `Ranking model output (already computed — do not re-rank):\n${JSON.stringify(top)}`;
  let notes: Record<string, string> = {};
  try {
    const raw = await say(system, user, 0.3, 900);
    const arr = JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1));
    for (const x of arr) notes[x.team] = x.note;
  } catch {
    /* notes optional */
  }
  const out = { ...pr, rows: pr.rows.map((r) => ({ ...r, note: notes[r.team] ?? null })) };
  await cacheSet(key, "power-rankings", out);
  return out;
}

// ---------- Daily briefing ----------
export async function dailyBriefing(favorites: string[] = []) {
  const ctx = await seasonContext();
  const key = `briefing:${ctx.year}:${new Date().toISOString().slice(0, 10)}:${favorites.slice().sort().join(",")}`;
  const cached = await cacheGet(key, 3 * 3600);
  if (cached) return cached;

  const [games, ranking, power] = await Promise.all([
    getGames(ctx.year, { seasonType: "both" }).catch(() => [] as Game[]),
    latestRankingWeek(ctx.year),
    computePowerRankings(ctx.year, 15).catch(() => null),
  ]);

  const now = Date.now();
  const recent = games
    .filter((g) => g.completed)
    .sort((a, b) => +new Date(b.startDate) - +new Date(a.startDate))
    .slice(0, 12)
    .map((g) => ({ g: `${g.awayTeam} ${g.awayPoints} @ ${g.homeTeam} ${g.homePoints}`, wk: g.week, ei: g.excitementIndex }));
  const upcoming = games
    .filter((g) => !g.completed && +new Date(g.startDate) > now)
    .sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate))
    .slice(0, 14)
    .map((g) => ({ g: `${g.awayTeam} @ ${g.homeTeam}`, when: g.startDate, wk: g.week }));

  const ap =
    ranking?.polls.find((p) => /AP|Coaches|Playoff/i.test(p.poll))?.ranks.slice(0, 15).map((r) => `${r.rank} ${r.school}`) ?? [];

  const data = {
    today: new Date().toISOString().slice(0, 10),
    phase: ctx.phase,
    season: ctx.year,
    poll: { name: ranking?.polls[0]?.poll, top15: ap },
    powerTop10: power?.rows.slice(0, 10).map((r) => `${r.rank} ${r.team} (${r.wins}-${r.losses}, Elo ${r.elo})`),
    recentResults: recent,
    upcomingGames: upcoming,
    favorites,
  };

  const system = `Produce the DAILY COLLEGE FOOTBALL BRIEFING as strict JSON:
{"date":"","phase":"","headline":"","yourTeams":[{"team":"","note":""}],"topStories":[{"title":"","detail":""}],"gamesToWatch":[{"matchup":"","why":""}],"outlook":""}
- 3-5 topStories, 3-4 gamesToWatch. Every claim must trace to the DATA. If favorites is non-empty, yourTeams covers each; otherwise return [].
- detail/note/why: 1-2 sentences each. No markdown. Return JSON only.`;
  const raw = await say(system, `DATA:\n${JSON.stringify(data)}`, 0.5, 1400);
  let json: any;
  try {
    json = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
  } catch {
    json = { date: data.today, phase: ctx.phase, headline: "Briefing unavailable", topStories: [], gamesToWatch: [], yourTeams: [], outlook: raw.slice(0, 400) };
  }
  json.generatedAt = new Date().toISOString();
  await cacheSet(key, "briefing", json);
  return json;
}

// ---------- Team report ----------
export async function teamReport(teamName: string) {
  const ctx = await seasonContext();
  const key = `team-report:${teamName}:${ctx.year}:${ctx.week}`;
  const cached = await cacheGet(key, 6 * 3600);
  if (cached) return cached;

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
      const opp = home ? g.awayTeam : g.homeTeam;
      return { opp, us, them, w: (us ?? 0) > (them ?? 0), wk: g.week, oppElo: home ? g.awayPregameElo : g.homePregameElo };
    });
  const schedule = games
    .filter((g) => !g.completed)
    .map((g) => ({ opp: g.homeTeam === teamName ? g.awayTeam : g.homeTeam, when: g.startDate, wk: g.week }));

  const statLine: Record<string, number> = {};
  for (const s of stats) if (s?.statName) statLine[s.statName] = s.statValue;

  const powerRow = powerNow?.rows.find((r) => r.team === teamName);
  const lastYearRow = powerPrev?.rows.find((r) => r.team === teamName);

  const data = {
    season: ctx.year,
    phase: ctx.phase,
    record: records[0]?.total,
    conference: records[0]?.conference,
    powerRank: powerRow ? { rank: powerRow.rank, score: powerRow.score, elo: powerRow.elo, sos: powerRow.sos, trend: powerRow.trend } : null,
    lastSeasonPowerRank: lastYearRow?.rank ?? null,
    results,
    remainingSchedule: schedule,
    seasonStats: statLine,
  };

  const system = `Produce a TEAM REPORT as strict JSON:
{"team":"","summary":"","biggestStrength":"","biggestWeakness":"","playerToWatch":"","mostImportantGame":"","playoffOutlook":""}
- summary 2-3 sentences. Each other field 1-2 sentences, grounded in the DATA numbers.
- playerToWatch: only name a player if one appears in the data; otherwise describe a unit/role. Never invent a name.
- Return JSON only.`;
  const raw = await say(system, `DATA:\n${JSON.stringify(data)}`, 0.45, 900);
  let json: any;
  try {
    json = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
  } catch {
    json = { team: teamName, summary: raw.slice(0, 500), biggestStrength: "", biggestWeakness: "", playerToWatch: "", mostImportantGame: "", playoffOutlook: "" };
  }
  json.data = data;
  json.generatedAt = new Date().toISOString();
  await cacheSet(key, "team-report", json);
  return json;
}
