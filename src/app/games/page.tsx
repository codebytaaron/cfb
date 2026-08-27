import Link from "next/link";
import GameCard from "@/components/GameCard";
import { seasonContext } from "@/lib/season";
import { getGames, type Game } from "@/lib/cfbd";

export const revalidate = 120;

export default async function GamesPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; type?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await seasonContext();
  const seasonType = sp.type ?? ctx.seasonType;
  let all: Game[] = [];
  try {
    all = await getGames(ctx.year, { seasonType: "both" });
  } catch {}

  const weeksAvail = [...new Set(all.filter((g) => g.seasonType === seasonType).map((g) => g.week))].sort(
    (a, b) => a - b,
  );
  const week = sp.week ? Number(sp.week) : ctx.week;
  const games = all
    .filter((g) => g.seasonType === seasonType && g.week === week)
    .sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate));

  return (
    <div className="wrap section" style={{ borderTop: "none" }}>
      <p className="label">{ctx.year} · {ctx.phase}</p>
      <h1 style={{ fontFamily: "var(--serif)", fontWeight: 350, fontSize: 40, margin: "6px 0 18px" }}>
        Games
      </h1>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {(["regular", "postseason"] as const).map((t) => (
          <Link
            key={t}
            href={`/games?type=${t}`}
            className="pill"
            style={{ background: seasonType === t ? "var(--ink)" : "transparent", color: seasonType === t ? "#fff" : "var(--ink-soft)" }}
          >
            {t}
          </Link>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24 }}>
        {weeksAvail.map((w) => (
          <Link
            key={w}
            href={`/games?type=${seasonType}&week=${w}`}
            className="pill"
            style={{ background: w === week ? "var(--red)" : "transparent", color: w === week ? "#fff" : "var(--ink-soft)", borderColor: w === week ? "var(--red)" : "var(--line)" }}
          >
            Wk {w}
          </Link>
        ))}
      </div>

      {games.length === 0 ? (
        <p className="prose" style={{ color: "var(--ink-soft)" }}>No games for this selection.</p>
      ) : (
        <div className="grid g3">
          {games.map((g) => (
            <GameCard key={g.id} g={g} />
          ))}
        </div>
      )}
    </div>
  );
}
