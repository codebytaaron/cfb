import { getGames, getRankings, type Game } from "./cfbd";

export type SeasonPhase = "preseason" | "in-season" | "postseason" | "offseason";
export type SeasonContext = {
  year: number;
  phase: SeasonPhase;
  week: number;
  seasonType: "regular" | "postseason";
};

let cached: { at: number; ctx: SeasonContext } | null = null;

// Figure out what part of the CFB calendar we're in, from real schedule data.
export async function seasonContext(): Promise<SeasonContext> {
  if (cached && Date.now() - cached.at < 5 * 60_000) return cached.ctx;

  const now = new Date();
  const guess = now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;

  let year = guess;
  let games: Game[] = [];
  try {
    games = await getGames(guess, { seasonType: "both" });
    if (games.length === 0) {
      year = guess - 1;
      games = await getGames(year, { seasonType: "both" });
    }
  } catch {
    games = [];
  }

  const completed = games.filter((g) => g.completed);
  const upcoming = games
    .filter((g) => !g.completed && new Date(g.startDate) > now)
    .sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate));

  let phase: SeasonPhase = "offseason";
  let week = 1;
  let seasonType: "regular" | "postseason" = "regular";

  if (completed.length === 0 && upcoming.length > 0) {
    phase = "preseason";
    week = upcoming[0].week || 1;
    seasonType = (upcoming[0].seasonType as any) || "regular";
  } else if (upcoming.length > 0) {
    phase = "in-season";
    const live = games.filter(
      (g) => !g.completed && new Date(g.startDate) <= now,
    );
    const ref = live[0] ?? upcoming[0];
    week = ref.week || 1;
    seasonType = (ref.seasonType as any) || "regular";
  } else if (completed.length > 0) {
    const last = completed.sort(
      (a, b) => +new Date(b.startDate) - +new Date(a.startDate),
    )[0];
    week = last.week;
    seasonType = (last.seasonType as any) || "regular";
    phase = seasonType === "postseason" ? "postseason" : "in-season";
    // if the final game was months ago, it's the offseason
    if (Date.now() - +new Date(last.startDate) > 30 * 86400_000) phase = "offseason";
  }

  const ctx: SeasonContext = { year, phase, week, seasonType };
  cached = { at: Date.now(), ctx };
  return ctx;
}

export async function latestRankingWeek(year: number) {
  for (const st of ["postseason", "regular"] as const) {
    try {
      const weeks = await getRankings(year, st);
      if (weeks.length) return weeks[weeks.length - 1];
    } catch {
      /* ignore */
    }
  }
  return null;
}
