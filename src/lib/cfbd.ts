// CollegeFootballData.com client — the source of truth for football facts.
// The AI never invents any of this data; it only explains what comes from here.

const BASE = "https://api.collegefootballdata.com";
const KEY = process.env.CFBD_API_KEY;

type CacheEntry = { at: number; data: unknown };
const cache = new Map<string, CacheEntry>();

export async function cfbd<T = any>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
  ttlSeconds = 300,
): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const url = `${BASE}${path}${qs.toString() ? `?${qs}` : ""}`;
  const hit = cache.get(url);
  const now = Date.now();
  if (hit && now - hit.at < ttlSeconds * 1000) return hit.data as T;

  if (!KEY) throw new Error("CFBD_API_KEY is not set");
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${KEY}`, Accept: "application/json" },
    next: { revalidate: ttlSeconds },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`CFBD ${res.status} for ${path}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as T;
  cache.set(url, { at: now, data });
  return data;
}

// ---- Typed helpers for the endpoints the app uses ----

export type Team = {
  id: number;
  school: string;
  mascot?: string;
  abbreviation?: string;
  conference?: string;
  classification?: string;
  color?: string;
  alternateColor?: string;
  logos?: string[];
};

export type Game = {
  id: number;
  season: number;
  week: number;
  seasonType: string;
  startDate: string;
  startTimeTBD?: boolean;
  completed: boolean;
  neutralSite?: boolean;
  conferenceGame?: boolean;
  venue?: string;
  homeId: number;
  homeTeam: string;
  homeConference?: string;
  homeClassification?: string;
  homePoints?: number | null;
  homeLineScores?: number[] | null;
  homePregameElo?: number | null;
  homePostgameElo?: number | null;
  homePostgameWinProbability?: number | null;
  awayId: number;
  awayTeam: string;
  awayConference?: string;
  awayClassification?: string;
  awayPoints?: number | null;
  awayLineScores?: number[] | null;
  awayPregameElo?: number | null;
  awayPostgameElo?: number | null;
  awayPostgameWinProbability?: number | null;
  excitementIndex?: number | null;
  notes?: string | null;
};

export type PollRank = {
  rank: number;
  school: string;
  conference?: string;
  firstPlaceVotes?: number;
  points?: number;
};
export type Poll = { poll: string; ranks: PollRank[] };
export type RankingWeek = {
  season: number;
  seasonType: string;
  week: number;
  polls: Poll[];
};

export type TeamRecord = {
  year: number;
  team: string;
  conference?: string;
  total: { games: number; wins: number; losses: number; ties: number };
  conferenceGames: { games: number; wins: number; losses: number; ties: number };
  homeGames?: { wins: number; losses: number };
  awayGames?: { wins: number; losses: number };
};

export const getTeams = (year?: number) =>
  cfbd<Team[]>("/teams/fbs", year ? { year } : {}, 86400);

export const getGames = (
  year: number,
  opts: { week?: number; seasonType?: string; team?: string } = {},
) =>
  cfbd<Game[]>(
    "/games",
    { year, seasonType: opts.seasonType ?? "both", week: opts.week, team: opts.team },
    120,
  );

export const getRankings = (year: number, seasonType = "regular", week?: number) =>
  cfbd<RankingWeek[]>("/rankings", { year, seasonType, week }, 600);

export const getRecords = (year: number, team?: string) =>
  cfbd<TeamRecord[]>("/records", { year, team }, 600);

export const getTeamGame = (year: number, team: string, seasonType = "both") =>
  cfbd<Game[]>("/games", { year, team, seasonType }, 120);

export const getScoreboard = () =>
  cfbd<any[]>("/scoreboard", {}, 20).catch(() => [] as any[]);

export const getTeamStats = (year: number, team: string) =>
  cfbd<any[]>("/stats/season", { year, team }, 600).catch(() => [] as any[]);

export const getSP = (year: number) =>
  cfbd<any[]>("/ratings/sp", { year }, 3600).catch(() => [] as any[]);

export const getElo = (year: number, week?: number) =>
  cfbd<any[]>("/ratings/elo", { year, week }, 600).catch(() => [] as any[]);

export const getLines = (year: number, week?: number, seasonType = "regular") =>
  cfbd<any[]>("/lines", { year, week, seasonType }, 300).catch(() => [] as any[]);

export const getTalent = (year: number) =>
  cfbd<any[]>("/talent", { year }, 86400).catch(() => [] as any[]);

export const getRecruitingTeams = (year: number) =>
  cfbd<any[]>("/recruiting/teams", { year }, 86400).catch(() => [] as any[]);

export const getRecruits = (year: number) =>
  cfbd<any[]>("/recruiting/players", { year }, 86400).catch(() => [] as any[]);

export const getPortal = (year: number) =>
  cfbd<any[]>("/player/portal", { year }, 3600).catch(() => [] as any[]);
