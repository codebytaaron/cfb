// The automatic pipeline: data -> detect meaningful change -> AI -> store -> realtime.
// Runs from /api/cron/refresh. Event-driven: the AI is only called when something
// meaningful actually changed.

import { getGames, getRankings, type Game } from "./cfbd";
import { seasonContext } from "./season";
import { analyzeGame } from "./analyst";
import { recordEvent, cacheGet, cacheSet } from "./store";

type Snap = { pts: string; completed: boolean; period: number };

function period(g: Game): number {
  return Math.max(g.homeLineScores?.length ?? 0, g.awayLineScores?.length ?? 0);
}

export async function runPipeline() {
  const ctx = await seasonContext();
  const games = await getGames(ctx.year, { seasonType: "both" }).catch(() => [] as Game[]);
  const prev: Record<string, Snap> = (await cacheGet("pipeline:snapshot", 86400)) ?? {};
  const next: Record<string, Snap> = {};
  const now = Date.now();
  const events: string[] = [];

  const relevant = games.filter((g) => {
    const t = +new Date(g.startDate);
    return t < now + 6 * 3600_000 && t > now - 12 * 3600_000;
  });

  for (const g of relevant) {
    const snap: Snap = {
      pts: `${g.homePoints ?? 0}-${g.awayPoints ?? 0}`,
      completed: g.completed,
      period: period(g),
    };
    next[g.id] = snap;
    const was = prev[String(g.id)];

    const started = was == null && !g.completed && +new Date(g.startDate) <= now;
    const ended = was && !was.completed && g.completed;
    const scored = was && was.pts !== snap.pts && !g.completed;
    const periodChanged = was && was.period !== snap.period && !g.completed;

    if (ended) {
      const summary = await analyzeGame(g).catch(() => null);
      if (summary) {
        await recordEvent({
          kind: "game-final",
          importance: "MEDIUM",
          team: g.homeTeam,
          headline: `Final: ${g.awayTeam} ${g.awayPoints} — ${g.homeTeam} ${g.homePoints}`,
          body: summary,
          data: { gameId: g.id },
        });
        events.push(`final ${g.id}`);
      }
    } else if (started) {
      await recordEvent({
        kind: "game-start",
        importance: "LOW",
        team: g.homeTeam,
        headline: `Kickoff: ${g.awayTeam} at ${g.homeTeam}`,
        body: `Week ${g.week} ${g.seasonType} game underway${g.venue ? ` at ${g.venue}` : ""}.`,
        data: { gameId: g.id },
      });
      events.push(`start ${g.id}`);
    } else if (scored || periodChanged) {
      const analysis = await analyzeGame(g).catch(() => null);
      if (analysis) {
        await recordEvent({
          kind: scored ? "score-change" : "period-change",
          importance: "LOW",
          team: g.homeTeam,
          headline: `${g.awayTeam} ${g.awayPoints} — ${g.homeTeam} ${g.homePoints} (Q${snap.period})`,
          body: analysis,
          data: { gameId: g.id },
        });
        events.push(`update ${g.id}`);
      }
    }
  }

  // Ranking movement
  try {
    const weeks = await getRankings(ctx.year, ctx.seasonType);
    const latest = weeks[weeks.length - 1];
    const prevRanks: Record<string, number> = (await cacheGet("pipeline:ranks", 30 * 86400)) ?? {};
    const poll = latest?.polls.find((p) => /Playoff|AP/i.test(p.poll)) ?? latest?.polls[0];
    const cur: Record<string, number> = {};
    for (const r of poll?.ranks ?? []) cur[r.school] = r.rank;
    if (Object.keys(prevRanks).length) {
      for (const [team, rank] of Object.entries(cur)) {
        const old = prevRanks[team];
        if (old && Math.abs(old - rank) >= 4) {
          await recordEvent({
            kind: "ranking-change",
            importance: Math.abs(old - rank) >= 8 ? "HIGH" : "MEDIUM",
            team,
            headline: `${team} moves ${old} → ${rank} in the ${poll?.poll}`,
            body: `${team} ${rank < old ? "climbed" : "fell"} ${Math.abs(old - rank)} spots week over week.`,
          });
          events.push(`rank ${team}`);
        }
      }
    }
    if (Object.keys(cur).length) await cacheSet("pipeline:ranks", "ranks", cur);
  } catch {
    /* ignore */
  }

  await cacheSet("pipeline:snapshot", "snapshot", next);
  return { checked: relevant.length, events };
}
