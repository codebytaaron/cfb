// Statistical power ranking. The model produces the numbers; the AI only
// explains them. Inputs are all real CFBD data.

import { getElo, getGames, getRecords, getSP, type Game } from "./cfbd";

export type PowerRow = {
  rank: number;
  team: string;
  conference?: string;
  score: number; // 0-100
  elo: number;
  wins: number;
  losses: number;
  pointDiff: number;
  sos: number;
  quadWins: number; // wins vs top-25-ish Elo
  badLosses: number;
  trend: number; // recent Elo delta
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export async function computePowerRankings(
  year: number,
  limit = 25,
): Promise<{ year: number; generatedAt: string; rows: PowerRow[] }> {
  let [elo, sp, games, records] = await Promise.all([
    getElo(year),
    getSP(year),
    getGames(year, { seasonType: "both" }),
    getRecords(year),
  ]);

  // Preseason (no completed games yet, thin ratings): carry over last season.
  const anyCompleted = games.some((g) => g.completed);
  if (!anyCompleted && elo.length === 0) {
    const [prevGames, prevSp, prevElo] = await Promise.all([
      getGames(year - 1, { seasonType: "both" }).catch(() => [] as Game[]),
      getSP(year - 1).catch(() => [] as any[]),
      getElo(year - 1).catch(() => [] as any[]),
    ]);
    const carry = new Map<string, number>();
    for (const g of prevGames) {
      if (g.homePostgameElo) carry.set(g.homeTeam, g.homePostgameElo);
      if (g.awayPostgameElo) carry.set(g.awayTeam, g.awayPostgameElo);
    }
    elo = prevElo.length
      ? prevElo
      : [...carry.entries()].map(([team, e]) => ({ team, elo: e }));
    if (prevSp.length) sp = prevSp;
  }

  // Latest Elo per team + a trend from the earliest available Elo this run.
  const eloLatest = new Map<string, number>();
  const eloFirst = new Map<string, number>();
  for (const e of elo) {
    if (!e?.team) continue;
    if (!eloFirst.has(e.team)) eloFirst.set(e.team, e.elo);
    eloLatest.set(e.team, e.elo);
  }
  // Fall back to postgame Elo from games if the ratings endpoint is thin.
  for (const g of games) {
    if (g.completed) {
      if (g.homePostgameElo) eloLatest.set(g.homeTeam, g.homePostgameElo);
      if (g.awayPostgameElo) eloLatest.set(g.awayTeam, g.awayPostgameElo);
      if (g.homePregameElo && !eloFirst.has(g.homeTeam)) eloFirst.set(g.homeTeam, g.homePregameElo);
      if (g.awayPregameElo && !eloFirst.has(g.awayTeam)) eloFirst.set(g.awayTeam, g.awayPregameElo);
    }
  }

  const spRating = new Map<string, number>();
  for (const s of sp) if (s?.team) spRating.set(s.team, s.rating ?? 0);

  const strongThreshold = 1800; // ~ top-25 Elo
  const weakThreshold = 1500;

  type Agg = {
    team: string;
    conference?: string;
    wins: number;
    losses: number;
    pf: number;
    pa: number;
    oppElo: number[];
    quadWins: number;
    badLosses: number;
  };
  const agg = new Map<string, Agg>();
  const get = (team: string, conf?: string): Agg => {
    let a = agg.get(team);
    if (!a) {
      a = { team, conference: conf, wins: 0, losses: 0, pf: 0, pa: 0, oppElo: [], quadWins: 0, badLosses: 0 };
      agg.set(team, a);
    }
    if (conf && !a.conference) a.conference = conf;
    return a;
  };

  for (const g of games as Game[]) {
    if (!g.completed || g.homePoints == null || g.awayPoints == null) continue;
    const h = get(g.homeTeam, g.homeConference);
    const a = get(g.awayTeam, g.awayConference);
    h.pf += g.homePoints; h.pa += g.awayPoints;
    a.pf += g.awayPoints; a.pa += g.homePoints;
    const hElo = g.awayPregameElo ?? eloLatest.get(g.awayTeam) ?? 1500;
    const aElo = g.homePregameElo ?? eloLatest.get(g.homeTeam) ?? 1500;
    h.oppElo.push(hElo);
    a.oppElo.push(aElo);
    const homeWon = g.homePoints > g.awayPoints;
    if (homeWon) {
      h.wins++; a.losses++;
      if (hElo >= strongThreshold) h.quadWins++;
      if (aElo <= weakThreshold) a.badLosses++;
    } else {
      a.wins++; h.losses++;
      if (aElo >= strongThreshold) a.quadWins++;
      if (hElo <= weakThreshold) h.badLosses++;
    }
  }

  const recWins = new Map<string, { w: number; l: number }>();
  for (const r of records) recWins.set(r.team, { w: r.total.wins, l: r.total.losses });

  const rowsRaw = [...agg.values()]
    .filter((a) => eloLatest.has(a.team) || spRating.has(a.team))
    .map((a) => {
      const gp = Math.max(1, a.wins + a.losses);
      const elo = eloLatest.get(a.team) ?? 1500;
      const first = eloFirst.get(a.team) ?? elo;
      const sos = a.oppElo.length ? a.oppElo.reduce((s, x) => s + x, 0) / a.oppElo.length : 1500;
      const pointDiff = (a.pf - a.pa) / gp;
      const rec = recWins.get(a.team);
      const wins = rec?.w ?? a.wins;
      const losses = rec?.l ?? a.losses;

      // Normalised components → 0..1
      const eloN = clamp((elo - 1300) / 700, 0, 1);
      const sosN = clamp((sos - 1300) / 600, 0, 1);
      const pdN = clamp((pointDiff + 10) / 50, 0, 1);
      const winPctN = wins + losses > 0 ? wins / (wins + losses) : 0.5;
      const quadN = clamp(a.quadWins / 4, 0, 1);
      const badN = clamp(a.badLosses / 2, 0, 1);
      const spN = spRating.has(a.team) ? clamp((spRating.get(a.team)! + 5) / 40, 0, 1) : eloN;

      const score =
        100 *
        clamp(
          0.34 * eloN +
            0.16 * spN +
            0.14 * winPctN +
            0.12 * pdN +
            0.12 * sosN +
            0.09 * quadN -
            0.08 * badN,
          0,
          1,
        );

      return {
        team: a.team,
        conference: a.conference,
        score: Math.round(score * 10) / 10,
        elo: Math.round(elo),
        wins,
        losses,
        pointDiff: Math.round(pointDiff * 10) / 10,
        sos: Math.round(sos),
        quadWins: a.quadWins,
        badLosses: a.badLosses,
        trend: Math.round(elo - first),
      };
    });

  // Preseason / no games: rank purely on carry-over Elo + SP.
  if (rowsRaw.every((r) => r.wins + r.losses === 0)) {
    const pre = [...eloLatest.entries()]
      .map(([team, e]) => ({
        team,
        conference: agg.get(team)?.conference,
        score: Math.round(clamp((e - 1300) / 700, 0, 1) * 1000) / 10,
        elo: Math.round(e),
        wins: 0,
        losses: 0,
        pointDiff: 0,
        sos: 1500,
        quadWins: 0,
        badLosses: 0,
        trend: 0,
      }))
      .sort((a, b) => b.elo - a.elo)
      .slice(0, limit)
      .map((r, i) => ({ ...r, rank: i + 1 }));
    return { year, generatedAt: new Date().toISOString(), rows: pre };
  }

  const rows = rowsRaw
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  return { year, generatedAt: new Date().toISOString(), rows };
}
