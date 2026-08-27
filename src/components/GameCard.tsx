import Link from "next/link";
import type { Game } from "@/lib/cfbd";

export default function GameCard({ g }: { g: Game }) {
  const now = Date.now();
  const status = g.completed
    ? "FINAL"
    : +new Date(g.startDate) <= now
      ? "LIVE"
      : new Date(g.startDate).toLocaleString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
  const hw = (g.homePoints ?? 0) > (g.awayPoints ?? 0);
  return (
    <Link href={`/games/${g.id}`} className="card fade-in" style={{ display: "block" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <span className="label">Wk {g.week} · {g.seasonType}</span>
        <span
          className="mono"
          style={{ fontSize: 11, color: status === "LIVE" ? "var(--red)" : "var(--ink-soft)" }}
        >
          {status === "LIVE" ? "● LIVE" : status}
        </span>
      </div>
      {[
        [g.awayTeam, g.awayPoints, !hw && g.completed],
        [g.homeTeam, g.homePoints, hw && g.completed],
      ].map(([team, pts, win], i) => (
        <div
          key={i}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "3px 0",
            fontWeight: win ? 600 : 400,
          }}
        >
          <span>{team as string}</span>
          <span className="mono">{pts ?? "—"}</span>
        </div>
      ))}
    </Link>
  );
}
