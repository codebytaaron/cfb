import Link from "next/link";
import { notFound } from "next/navigation";
import GameAnalysis from "@/components/GameAnalysis";
import ExplainButton from "@/components/ExplainButton";
import { seasonContext } from "@/lib/season";
import { getGames, type Game } from "@/lib/cfbd";

export const revalidate = 60;

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gid = Number(id);
  const ctx = await seasonContext();
  let game: Game | undefined;
  for (const y of [ctx.year, ctx.year - 1]) {
    const games = await getGames(y, { seasonType: "both" }).catch(() => [] as Game[]);
    game = games.find((g) => g.id === gid);
    if (game) break;
  }
  if (!game) notFound();

  const status = game.completed
    ? "FINAL"
    : +new Date(game.startDate) <= Date.now()
      ? "LIVE"
      : new Date(game.startDate).toLocaleString();
  const rows: [string, number | null | undefined, number[] | null | undefined, number | null | undefined][] = [
    [game.awayTeam, game.awayPoints, game.awayLineScores, game.awayPostgameWinProbability],
    [game.homeTeam, game.homePoints, game.homeLineScores, game.homePostgameWinProbability],
  ];

  return (
    <div className="wrap section" style={{ borderTop: "none" }}>
      <Link href="/games" className="label">← games</Link>
      <p className="label" style={{ marginTop: 14 }}>
        Week {game.week} · {game.seasonType} · {game.venue ?? "TBD"} {game.notes ? `· ${game.notes}` : ""}
      </p>
      <h1 style={{ fontFamily: "var(--serif)", fontWeight: 350, fontSize: 34, margin: "6px 0 4px" }}>
        {game.awayTeam} <span style={{ color: "var(--ink-soft)" }}>at</span> {game.homeTeam}
      </h1>
      <p className="mono" style={{ color: status === "LIVE" ? "var(--red)" : "var(--ink-soft)", fontSize: 13 }}>
        {status === "LIVE" ? "● LIVE" : status}
      </p>

      <table style={{ margin: "20px 0 8px", maxWidth: 520 }}>
        <thead>
          <tr>
            <th>Team</th>
            {(rows[0][2] ?? []).map((_, i) => (
              <th key={i}>Q{i + 1}</th>
            ))}
            <th>T</th>
            <th>Win%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([team, pts, ls, wp]) => (
            <tr key={team}>
              <td style={{ fontWeight: 600 }}>
                <Link href={`/teams/${encodeURIComponent(team)}`}>{team}</Link>
              </td>
              {(ls ?? []).map((q, i) => (
                <td key={i} className="mono">{q}</td>
              ))}
              <td className="mono big-num" style={{ fontSize: 18 }}>{pts ?? "—"}</td>
              <td className="mono">{wp != null ? `${Math.round(wp * 100)}%` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {(game.homePregameElo || game.awayPregameElo) && (
        <p className="prose" style={{ color: "var(--ink-soft)", fontSize: 14 }}>
          Pregame Elo — {game.awayTeam} {game.awayPregameElo ?? "?"}, {game.homeTeam}{" "}
          {game.homePregameElo ?? "?"}
          {game.excitementIndex != null && ` · excitement index ${game.excitementIndex.toFixed(1)}`}
        </p>
      )}

      <div style={{ marginTop: 24 }}>
        <GameAnalysis id={game.id} />
      </div>

      <ExplainButton topic={`the win probability and Elo numbers for ${game.awayTeam} at ${game.homeTeam}`} data={game} />
    </div>
  );
}
